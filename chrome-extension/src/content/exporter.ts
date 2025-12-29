// Export helper functions for content script

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
