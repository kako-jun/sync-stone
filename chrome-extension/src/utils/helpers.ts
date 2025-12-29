import { FILE_PATTERNS, CONFIG } from './constants';

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
  const sanitized = filename
    .replace(FILE_PATTERNS.INVALID_FILENAME_CHARS, '_')
    .replace(FILE_PATTERNS.WHITESPACE, '_')
    .substring(0, maxLength);

  // Return fallback if sanitized result is empty or only underscores
  return sanitized.replace(/_+/g, '') === '' ? 'untitled' : sanitized;
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
 * Create a promise that resolves when a tab finishes loading
 */
export function waitForTabLoad(tabId: number, timeout: number = CONFIG.MAX_EXPORT_DELAY): Promise<void> {
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

/**
 * Send error message to popup via chrome.runtime
 */
export function sendErrorMessage(message: string): void {
  chrome.runtime.sendMessage({
    action: 'showError',
    message
  });
}

/**
 * Convert base64 string to Uint8Array (for zip.js)
 */
export function base64ToUint8Array(base64String: string): Uint8Array {
  const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}