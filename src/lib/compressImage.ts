import imageCompression from 'browser-image-compression';

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,        // max 800KB after compression
  maxWidthOrHeight: 1200, // enough for mobile display
  useWebWorker: true,     // non-blocking
  fileType: 'image/jpeg', // consistent format
  initialQuality: 0.85,   // good quality/size balance
};

/**
 * Compress an image file before upload.
 * Falls back to original file if compression fails or file is already small.
 */
export const compressImage = async (file: File): Promise<File> => {
  // Skip compression if already small enough (< 300KB)
  if (file.size < 300 * 1024) return file;

  try {
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
    console.log(
      `[Image] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`
    );
    return compressed as File;
  } catch (err) {
    console.warn('[Image] Compression failed, using original:', err);
    return file; // safe fallback
  }
};
