import axios from "axios";

export interface UploadProgress {
  progress: number;
  loaded: number;
  total: number;
}

export interface UploadResult {
  type: "success" | "error";
  result: string;
  fileName?: string;
  fileSize?: number;
}

export interface S3UploadOptions {
  folderName: string;
  onProgress?: (progress: UploadProgress) => void;
  maxFileSize?: number; // in bytes
}

/**
 * Sanitizes a filename by replacing spaces and special characters with underscores
 * to prevent URL encoding issues in S3 links
 *
 * @param {string} fileName - The original filename
 * @returns {string} Sanitized filename safe for S3 URLs
 * @example
 *   sanitizeFileName("IFT 212 COMPUTER ORGANIZATION.pdf")
 *   // Returns: "IFT_212_COMPUTER_ORGANIZATION.pdf"
 */
export const sanitizeFileName = (fileName: string): string => {
  // Get file extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';

  // Replace spaces and special characters (except hyphens and underscores) with underscores
  const sanitizedName = name
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars with underscores
    .replace(/_+/g, '_'); // Replace multiple consecutive underscores with single underscore

  return sanitizedName + extension;
};

const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = () => {
      resolve(fileReader.result?.toString().split(",")[1] || "");
    };
    fileReader.onerror = (error) => {
      reject(error);
    };
  });
};

/**
 * Calculates the SHA-256 checksum of a file
 *
 * @param {File} file - The file to calculate the checksum for
 * @returns {Promise<string>} Hex string of the SHA-256 checksum
 */
export const calculateChecksum = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Uploads a file to S3 with progress tracking
 *
 * @param {File} file - The file to be uploaded
 * @param {S3UploadOptions} options - Upload options including folder name and progress callback
 * @returns {Promise<UploadResult>} A promise that resolves to an upload result object
 * @example
 *   const handleFileUpload = async (file) => {
 *     const result = await uploadToS3(file, {
 *       folderName: 'employee-documents',
 *       onProgress: (progress) => {
 *         console.log(`Upload progress: ${progress.progress}%`);
 *       }
 *     });
 *
 *     if (result.type === 'success') {
 *       console.log('File uploaded successfully:', result.result);
 *     } else {
 *       console.error('Upload failed:', result.result);
 *     }
 *   };
 */
export const uploadToS3 = async (
  file: File,
  options: S3UploadOptions
): Promise<UploadResult> => {
  const { folderName, onProgress, maxFileSize = 2000000 } = options;
  const originalFileName = file.name;
  const fileName = sanitizeFileName(file.name);

  // Validate file size
  if (file.size > maxFileSize) {
    return {
      type: "error",
      result: `File size must be less than ${Math.round(
        maxFileSize / 1024 / 1024
      )}MB`,
      fileName: originalFileName,
      fileSize: file.size,
    };
  }

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      type: "error",
      result:
        "Please select a PDF, image, Word document, Excel file, or text file",
      fileName: originalFileName,
      fileSize: file.size,
    };
  }

  try {
    // Convert file to base64
    const base64 = await convertToBase64(file);

    // Prepare API endpoint
    const convertToUrlAPI = `https://qerhd0lxje.execute-api.us-east-1.amazonaws.com/prod/upload-file?fileName=${encodeURIComponent(
      fileName
    )}&projectFolder=${encodeURIComponent(folderName)}`;

    const payload = { file: base64 };

    // Upload with progress tracking
    const response = await axios.post(convertToUrlAPI, payload, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress({
            progress,
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      },
      timeout: 30000, // 30 second timeout
    });

    if (response.data?.responseObj?.pdf_url) {
      return {
        type: "success",
        result: response.data.responseObj.pdf_url,
        fileName: originalFileName,
        fileSize: file.size,
      };
    } else {
      return {
        type: "error",
        result: "Upload failed: No URL returned from server",
        fileName: originalFileName,
        fileSize: file.size,
      };
    }
  } catch (error) {
    console.error("S3 upload error:", error);
    return {
      type: "error",
      result:
        error instanceof Error
          ? error.message
          : "Upload failed due to network error",
      fileName: originalFileName,
      fileSize: file.size,
    };
  }
};

/**
 * Uploads multiple files to S3 with individual progress tracking
 *
 * @param {File[]} files - Array of files to upload
 * @param {S3UploadOptions} options - Upload options
 * @returns {Promise<UploadResult[]>} Array of upload results for each file
 * @example
 *   const handleMultipleUploads = async (files) => {
 *     const results = await uploadMultipleToS3(files, {
 *       folderName: 'employee-documents',
 *       onProgress: (progress, fileIndex) => {
 *         console.log(`File ${fileIndex} progress: ${progress.progress}%`);
 *       }
 *     });
 *   };
 */
export const uploadMultipleToS3 = async (
  files: File[],
  options: S3UploadOptions
): Promise<UploadResult[]> => {
  const uploadPromises = files.map((file) => {
    const fileOptions = {
      ...options,
      onProgress: (progress: UploadProgress) => {
        options.onProgress?.(progress);
      },
    };

    return uploadToS3(file, fileOptions);
  });

  return Promise.all(uploadPromises);
};

/**
 * Validates a file before upload
 *
 * @param {File} file - The file to validate
 * @param {number} maxFileSize - Maximum file size in bytes
 * @returns {string | null} Error message if invalid, null if valid
 */
export const validateFile = (
  file: File,
  maxFileSize: number = 2000000
): string | null => {
  if (file.size > maxFileSize) {
    return `File size must be less than ${Math.round(
      maxFileSize / 1024 / 1024
    )}MB`;
  }

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];

  if (!allowedTypes.includes(file.type)) {
    return "Please select a PDF, image, Word document, Excel file, or text file";
  }

  return null;
};

export const uploadImageToS3 = async (
  file: File,
  options: S3UploadOptions
): Promise<UploadResult> => {
  const { folderName, onProgress, maxFileSize = 25000000 } = options; // Default 25MB
  const originalFileName = file.name;
  const fileName = sanitizeFileName(file.name);
  const fileFormat = file.type.slice(6); // Extract format (e.g., "jpeg", "png")

  // Validate file size
  if (file.size > maxFileSize) {
    return {
      type: 'error',
      result: `File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`,
      fileName: originalFileName,
      fileSize: file.size,
    };
  }

  // Validate file type (images only)
  const allowedImageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  if (!allowedImageTypes.includes(file.type)) {
    return {
      type: 'error',
      result: 'Please select a valid image file (JPEG, PNG, GIF, WebP, or SVG)',
      fileName: originalFileName,
      fileSize: file.size,
    };
  }

  try {
    // Convert file to base64
    const base64 = await convertToBase64(file);

    // Prepare API endpoint (using your original image upload endpoint)
    const convertToUrlAPI = `https://qerhd0lxje.execute-api.us-east-1.amazonaws.com/prod/upload-image?fileName=${encodeURIComponent(
      fileName,
    )}&projectFolder=${encodeURIComponent(
      folderName,
    )}&fileFormat=${encodeURIComponent(fileFormat)}`;

    const payload = { file: base64 };

    // Upload with progress tracking
    const response = await axios.post(convertToUrlAPI, payload, {
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress({
            progress,
            loaded: progressEvent.loaded,
            total: progressEvent.total,
          });
        }
      },
      timeout: 30000, // 30 second timeout
    });

    // Check if upload was successful
    if (response.data?.uploadResult?.Location) {
      return {
        type: 'success',
        result: response.data.uploadResult.Location,
        fileName: originalFileName,
        fileSize: file.size,
      };
    } else {
      return {
        type: 'error',
        result: 'Upload failed: No URL returned from server',
        fileName: originalFileName,
        fileSize: file.size,
      };
    }
  } catch (error) {
    console.error('S3 image upload error:', error);
    return {
      type: 'error',
      result: error instanceof Error ? error.message : 'Upload failed due to network error',
      fileName: originalFileName,
      fileSize: file.size,
    };
  }
};

/**
 * Uploads a file to S3, automatically choosing the appropriate upload function
 * based on file type (image or other).
 *
 * @param {File} file - The file to be uploaded
 * @param {S3UploadOptions} options - Upload options including folder name and progress callback
 * @returns {Promise<UploadResult>} A promise that resolves to an upload result object
 * @example
 *   const result = await uploadFile(file, {
 *     folderName: 'documents',
 *     onProgress: (progress) => {
 *       console.log(`Upload progress: ${progress.progress}%`);
 *     }
 *   });
 */
export const uploadFile = async (
  file: File,
  options: S3UploadOptions
): Promise<UploadResult> => {
  const allowedImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  if (allowedImageTypes.includes(file.type)) {
    return uploadImageToS3(file, options);
  }

  const allowedTypes = [
    "application/pdf",
  ];

  if (allowedTypes.includes(file.type)) {
    return uploadToS3(file, options);
  }

  return {
    type: "error",
    result: "Unsupported file type",
    fileName: file.name,
    fileSize: file.size,
  };
};
