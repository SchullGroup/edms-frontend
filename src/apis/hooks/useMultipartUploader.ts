import { useCallback, useRef, useState } from 'react';
import { Uploader } from '@/apis/services/uploader';

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

// Same file types/size limits s3.service.ts's uploadFile() dispatcher actually
// enforced (images route through uploadImageToS3 at a 3MB cap, application/pdf
// through uploadToS3 at a 2MB cap, everything else was rejected) — kept in
// sync deliberately rather than reusing validateFile(), whose broader
// allowedTypes list (Word/Excel/text) was never actually reachable through
// uploadFile() in practice.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const MAX_IMAGE_SIZE = 10_000_000;
const MAX_PDF_SIZE = 50_000_000;

function validateUpload(file: File): string | null {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_IMAGE_SIZE) {
      return `File size must be less than ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)}MB`;
    }
    return null;
  }

  if (ALLOWED_PDF_TYPES.includes(file.type)) {
    if (file.size > MAX_PDF_SIZE) {
      return `File size must be less than ${Math.round(MAX_PDF_SIZE / 1024 / 1024)}MB`;
    }
    return null;
  }

  return 'Unsupported file type';
}

export function useMultipartUploader() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploaderRef = useRef<Uploader | null>(null);

  const startUpload = useCallback(({ file, fileName, folderName }: StartUploadParams): Promise<string> => {
    const validationError = validateUpload(file);
    if (validationError) {
      return Promise.reject(new Error(validationError));
    }

    setUploadProgress(0);

    const uploader = new Uploader({
      file,
      fileName,
      contentType: file.type,
      folderName,
      baseURL,
    });

    uploaderRef.current = uploader;

    return new Promise<string>((resolve, reject) => {
      uploader
        .onProgress(({ percentage }) => {
          setUploadProgress(percentage);
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
