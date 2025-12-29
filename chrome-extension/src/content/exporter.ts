// Export helper functions for content script

import { ImageMap } from '@/types';

// Re-export ImageMap for convenience
export type { ImageMap };

export interface ProcessedArticle {
  sanitizedTitle: string;
  markdownContent: string;
  originalTitle: string;
}

/**
 * Download ZIP file using streaming
 */
export async function downloadZip(zipBlob: Blob, filename: string): Promise<void> {
  console.log(`[STREAMING-ZIP] Downloading: ${filename} (${Math.round(zipBlob.size / 1024 / 1024)}MB)`);

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
