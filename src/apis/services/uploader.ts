// Uploads a file to S3 via a presigned-URL multipart upload flow, in chunks,
// so large files don't hit the body-size limits that broke the old
// base64-in-JSON single-shot upload. Ported from ecms-frontend's
// src/utils/uploader.ts, which this mirrors near-verbatim — same chunking,
// concurrency and retry behaviour, just Next.js-flavoured wiring.
import axios, { type AxiosResponse } from 'axios';
import { sanitizeFileName } from './s3.service';

const api = axios.create({
  baseURL: '/',
});

/** Strips every non-alphanumeric character and camelCases what's left, so a
 *  folder name is always a single clean token (e.g. "EDMS Documents!" ->
 *  "edmsDocuments") — no spaces, hyphens, punctuation, etc. */
function toCamelCaseFolderName(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, i) => {
      const lower = word.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

export interface UploaderOptions {
  file: File;
  fileName?: string;
  contentType: string;
  folderName: string;
  baseURL: string;
}

interface InitializeResponse {
  status: boolean;
  fileId: string | null;
  fileKey: string | null;
}

interface PresignedPart {
  signedUrl: string;
  PartNumber: number;
}

interface PresignedUrlResponse {
  status: boolean;
  parts: PresignedPart[];
}

interface UploadedPart {
  PartNumber: number;
  ETag: string;
}

interface FinalizeResponseData {
  $metadata: {
    httpStatusCode: number;
    requestId: string;
    extendedRequestId: string;
    attempts: number;
    totalRetryDelay: number;
  };
  ServerSideEncryption: string;
  VersionId: string;
  Bucket: string;
  ETag: string;
  Key: string;
  Location: string;
}

export interface FinalizeResponse {
  status: boolean;
  message: string;
  data: FinalizeResponseData;
}

export interface UploadProgress {
  sent: number;
  total: number;
  percentage: number;
}

type ProgressCallback = (progress: UploadProgress) => void;
type ErrorCallback = (error: Error) => void;
type CompleteCallback = (result: AxiosResponse<FinalizeResponse>) => void;

const toError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage);

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class Uploader {
  private readonly chunkSize: number;
  private readonly threadsQuantity: number;
  private readonly timeout: number;
  private readonly file: File;
  private readonly contentType: string;
  private readonly folderName: string;
  private readonly fileName: string;
  private readonly baseURL: string;

  private aborted: boolean;
  private completed: boolean;
  private uploadedSize: number;
  private progressCache: Record<number, number>;
  private activeConnections: Record<number, XMLHttpRequest>;
  private parts: PresignedPart[];
  private uploadedParts: UploadedPart[];
  private fileId: string | null;
  private fileKey: string | null;

  private onProgressFn: ProgressCallback;
  private onErrorFn: ErrorCallback;
  private onCompleteFn: CompleteCallback;

  constructor(options: UploaderOptions) {
    this.chunkSize = 1024 * 1024 * 5;
    this.threadsQuantity = 5;
    this.timeout = 0;
    this.file = options.file;
    this.contentType = options.contentType;
    this.folderName = toCamelCaseFolderName(options.folderName);
    this.fileName = options.fileName ?? options.file.name;
    this.baseURL = options.baseURL;

    this.aborted = false;
    this.completed = false;
    this.uploadedSize = 0;
    this.progressCache = {};
    this.activeConnections = {};
    this.parts = [];
    this.uploadedParts = [];
    this.fileId = null;
    this.fileKey = null;

    this.onProgressFn = () => {};
    this.onErrorFn = () => {};
    this.onCompleteFn = () => {};
  }

  start(): void {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const videoInitializationUploadInput = {
        name: sanitizeFileName(this.fileName),
        contentType: this.contentType,
        folderName: this.folderName,
      };

      const initializeResponse = await api.request<InitializeResponse>({
        url: '/initialize',
        method: 'POST',
        data: videoInitializationUploadInput,
        baseURL: this.baseURL,
      });

      const { fileId, fileKey } = initializeResponse.data;
      if (!fileId || !fileKey) {
        throw new Error('Upload initialization failed.');
      }

      this.fileId = fileId;
      this.fileKey = fileKey;

      const numberOfParts = Math.ceil(this.file.size / this.chunkSize);

      const urlsResponse = await api.request<PresignedUrlResponse>({
        url: '/presigned-url',
        method: 'POST',
        data: {
          uploadId: this.fileId,
          filePath: this.fileKey,
          parts: numberOfParts,
        },
        baseURL: this.baseURL,
      });

      this.parts.push(...urlsResponse.data.parts);

      this.sendNext();
    } catch (error) {
      await this.complete(toError(error, 'Upload initialization failed.'));
    }
  }

  private sendNext(retry = 0): void {
    const activeConnections = Object.keys(this.activeConnections).length;

    if (activeConnections >= this.threadsQuantity) {
      return;
    }

    if (!this.parts.length) {
      if (!activeConnections) {
        this.complete();
      }

      return;
    }

    const part = this.parts.pop();
    if (!part) return;

    const sentSize = (part.PartNumber - 1) * this.chunkSize;
    const chunk = this.file.slice(sentSize, sentSize + this.chunkSize);

    const sendChunkStarted = () => {
      this.sendNext();
    };

    this.sendChunk(chunk, part, sendChunkStarted)
      .then(() => {
        if (!this.aborted) {
          this.sendNext();
        }
      })
      .catch((error: unknown) => {
        if (this.aborted) {
          this.complete(toError(error, 'Upload canceled.'));
          return;
        }

        if (retry <= 6) {
          const nextRetry = retry + 1;
          // exponential backoff retry before giving up
          wait(2 ** nextRetry * 100).then(() => {
            this.parts.push(part);
            this.sendNext(nextRetry);
          });
        } else {
          this.complete(toError(error, `Part#${part.PartNumber} failed to upload.`));
        }
      });
  }

  private async complete(error?: Error): Promise<void> {
    if (this.completed) return;

    if (error) {
      this.completed = true;
      this.onErrorFn(error);
      return;
    }

    try {
      const response = await this.sendCompleteRequest();
      this.completed = true;
      this.onCompleteFn(response);
    } catch (err) {
      this.completed = true;
      this.onErrorFn(toError(err, 'Failed to finalize upload.'));
    }
  }

  private async sendCompleteRequest(): Promise<AxiosResponse<FinalizeResponse>> {
    if (!this.fileId || !this.fileKey) {
      throw new Error('Upload was not initialized.');
    }

    return api.request<FinalizeResponse>({
      url: '/finalize',
      method: 'POST',
      data: {
        fileId: this.fileId,
        fileKey: this.fileKey,
        parts: this.uploadedParts,
      },
      baseURL: this.baseURL,
    });
  }

  private sendChunk(chunk: Blob, part: PresignedPart, sendChunkStarted: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.aborted) {
        reject(new Error('Upload aborted'));
        return;
      }

      this.upload(chunk, part, sendChunkStarted)
        .then((status) => {
          if (this.aborted) {
            reject(new Error('Upload aborted'));
            return;
          }
          if (status !== 200) {
            reject(new Error('Failed chunk upload'));
            return;
          }

          resolve();
        })
        .catch((error: unknown) => {
          reject(this.aborted ? new Error('Upload aborted') : toError(error, 'Failed chunk upload'));
        });
    });
  }

  private handleProgress(part: number, event: ProgressEvent): void {
    if (event.type === 'progress' || event.type === 'error' || event.type === 'abort') {
      this.progressCache[part] = event.loaded;
    }

    if (event.type === 'uploaded') {
      this.uploadedSize += this.progressCache[part] || 0;
      delete this.progressCache[part];
    }

    const inProgress = Object.values(this.progressCache).reduce((memo, loaded) => memo + loaded, 0);

    const sent = Math.min(this.uploadedSize + inProgress, this.file.size);
    const total = this.file.size;
    const percentage = Math.round((sent / total) * 100);

    this.onProgressFn({ sent, total, percentage });
  }

  private upload(chunk: Blob, part: PresignedPart, sendChunkStarted: () => void): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.fileId || !this.fileKey) {
        reject(new Error('Upload was not initialized.'));
        return;
      }

      const throwXHRError = (error: Error, partNumber: number, abortFx: () => void) => {
        delete this.activeConnections[partNumber];
        reject(error);
        window.removeEventListener('offline', abortFx);
      };

      if (!window.navigator.onLine) {
        reject(new Error('System is offline'));
        return;
      }

      const xhr = new XMLHttpRequest();
      this.activeConnections[part.PartNumber - 1] = xhr;
      xhr.timeout = this.timeout;
      sendChunkStarted();

      const progressListener = this.handleProgress.bind(this, part.PartNumber - 1);

      xhr.upload.addEventListener('progress', progressListener);
      xhr.addEventListener('error', progressListener);
      xhr.addEventListener('abort', progressListener);
      xhr.addEventListener('loadend', progressListener);

      xhr.open('PUT', part.signedUrl);

      const abortXHR = () => xhr.abort();

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const ETag = xhr.getResponseHeader('ETag');

          if (ETag) {
            this.uploadedParts.push({
              PartNumber: part.PartNumber,
              ETag: ETag.replaceAll('"', ''),
            });

            resolve(xhr.status);
            delete this.activeConnections[part.PartNumber - 1];
            window.removeEventListener('offline', abortXHR);
          }
        }
      };

      xhr.onerror = () => {
        throwXHRError(new Error('Chunk upload failed'), part.PartNumber - 1, abortXHR);
      };
      xhr.ontimeout = () => {
        throwXHRError(new Error('Chunk upload timed out'), part.PartNumber - 1, abortXHR);
      };
      xhr.onabort = () => {
        throwXHRError(new Error('Upload canceled by user or system'), part.PartNumber - 1, abortXHR);
      };

      window.addEventListener('offline', abortXHR);
      xhr.send(chunk);
    });
  }

  onProgress(onProgress: ProgressCallback): this {
    this.onProgressFn = onProgress;
    return this;
  }

  onError(onError: ErrorCallback): this {
    this.onErrorFn = onError;
    return this;
  }

  onComplete(onComplete: CompleteCallback): this {
    this.onCompleteFn = onComplete;
    return this;
  }

  abort(): void {
    Object.values(this.activeConnections).forEach((xhr) => xhr.abort());
    this.aborted = true;
  }
}
