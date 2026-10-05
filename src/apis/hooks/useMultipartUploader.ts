import { useCallback, useEffect, useRef, useState } from 'react';
import { Uploader } from '@/apis/services/uploader';
import { resolveUploadMimeType, validateUploadFile } from '@/constants/uploadTypes';

// Same host edms already uploads to (see s3.service.ts's legacy base64 path) —
// only the /initialize, /presigned-url and /finalize routes under it are new.
// Confirm this exact path once those routes are deployed; override via env in
// the meantime if the backend team lands them somewhere else.
const baseURL =
  process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ||
  'https://qerhd0lxje.execute-api.us-east-1.amazonaws.com/prod/upload-file/multipart';

export interface StartUploadParams {
  file: File;
  fileName: string;
  folderName: string;
}

export function useMultipartUploader() {
  // `targetProgress` is what the uploader last reported; `uploadProgress` is
  // what's shown, counted up toward it a step at a time. Small files only get
  // one or two real progress events, so without this the label jumps 0 → 100.
  // It never runs ahead of a real milestone.
  const [targetProgress, setTargetProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploaderRef = useRef<Uploader | null>(null);

  useEffect(() => {
    if (targetProgress < uploadProgress) {
      setUploadProgress(targetProgress); // reset for a new upload
      return;
    }
    if (targetProgress === uploadProgress) return;
    const timer = window.setTimeout(() => {
      setUploadProgress((shown) =>
        Math.min(targetProgress, shown + Math.max(1, Math.ceil((targetProgress - shown) / 6))),
      );
    }, 40);
    return () => window.clearTimeout(timer);
  }, [targetProgress, uploadProgress]);

  const startUpload = useCallback(({ file, fileName, folderName }: StartUploadParams): Promise<string> => {
    // Allowed types and the size cap live in `@/constants/uploadTypes`.
    const validationError = validateUploadFile(file);
    if (validationError) {
      return Promise.reject(new Error(validationError));
    }

    setTargetProgress(0);
    setUploadProgress(0);

    const uploader = new Uploader({
      file,
      fileName,
      contentType: resolveUploadMimeType(file) ?? file.type,
      folderName,
      baseURL,
    });

    uploaderRef.current = uploader;

    return new Promise<string>((resolve, reject) => {
      uploader
        .onProgress(({ percentage }) => {
          setTargetProgress(percentage);
        })
        .onError((error) => {
          console.error(error);
          reject(new Error(error.message || 'File upload failed.'));
        })
        .onComplete((result) => {
          resolve(result.data.data.Location);
        });

      uploader.start();
    });
  }, []);

  const abort = useCallback(() => {
    uploaderRef.current?.abort();
  }, []);

  return { uploadProgress, startUpload, abort };
}
