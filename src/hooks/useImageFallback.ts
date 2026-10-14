'use client';

import { useState } from 'react';

/**
 * Whether to render an image or fall back to text. Remembers a failed `src` and
 * forgets it when `src` changes, so a different image gets its own chance —
 * which is what the brand logo needs: an empty `logoUrl` and a broken one both
 * have to end up showing the wordmark instead.
 */
export function useImageFallback(src: string) {
  const [failedSrc, setFailedSrc] = useState('');

  return {
    showImage: !!src && failedSrc !== src,
    onImageError: () => setFailedSrc(src),
  };
}
