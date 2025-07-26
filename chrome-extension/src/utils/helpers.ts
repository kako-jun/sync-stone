import { FILE_PATTERNS } from './constants';

/**
 * Generate a simple hash for unique filenames
 */
export function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Sanitize filename for safe file system usage
 */
export function sanitizeFilename(filename: string, maxLength = 50): string {
  return filename
    .replace(FILE_PATTERNS.INVALID_FILENAME_CHARS, '_')
    .replace(FILE_PATTERNS.WHITESPACE, '_')
    .substring(0, maxLength);
}

/**
 * Extract filename from URL
 */
export function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(urlObj.pathname.lastIndexOf('/') + 1) || 'image';
  } catch {
    return url.substring(url.lastIndexOf('/') + 1) || 'image';
  }
}

/**
 * Check if image is a thumbnail based on filename pattern
 */
export function isThumbnailImage(src: string): boolean {
  return FILE_PATTERNS.THUMBNAIL_PATTERN.test(src);
}

/**
 * Create a promise that resolves when a tab finishes loading
 */
export function waitForTabLoad(tabId: number, timeout = 10000): Promise<void> {
  return new Promise((resolve) => {
    const listener = (changedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
    
    // Add timeout as fallback
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeout);
  });
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}