// Export helper functions for content script

import { base64ToUint8Array, generateHash, sanitizeFilename } from '@/utils/helpers';

// Declare external dependencies
declare const zip: any;

export interface ImageMap {
  [url: string]: string;
}

export interface ProcessedArticle {
  sanitizedTitle: string;
  markdownContent: string;
  originalTitle: string;
}

/**
 * Download additional images from background script
 */
export async function downloadAdditionalImages(
  newImageUrls: string[],
  imageMap: ImageMap,
  isCancelledFn: () => boolean
): Promise<{ successCount: number; failCount: number }> {
  let successCount = 0;
  let failCount = 0;

  if (newImageUrls.length === 0) {
    return { successCount, failCount };
  }

  console.log('[EXPORT-LOG] Phase 2: Starting download of', newImageUrls.length, 'additional images');

  // Request background to download images
  let timeoutId: NodeJS.Timeout;
  const downloadResult: any = await Promise.race([
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'downloadAllImages',
        imageUrls: newImageUrls,
        totalImages: newImageUrls.length
      }, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    }),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Additional image download timeout after 2 minutes'));
      }, 2 * 60 * 1000);
    })
  ]);

  if (!downloadResult?.success) {
    console.log('[EXPORT-LOG] Phase 2: Download failed');
    return { successCount: 0, failCount: newImageUrls.length };
  }

  // Process downloaded images
  for (const imageUrl of newImageUrls) {
    if (isCancelledFn()) break;

    const imageResponse: any = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'getDownloadedImage',
        imageUrl: imageUrl
      }, resolve);
    });

    if (imageResponse?.success && imageResponse.imageData?.success && imageResponse.imageData?.base64) {
      const imagePath = `images/${imageResponse.imageData.filename}`;
      imageMap[imageResponse.imageData.url] = imagePath;
      successCount++;
    } else {
      imageMap[imageUrl] = imageUrl;
      failCount++;
    }
  }

  console.log('[EXPORT-LOG] Phase 2: Complete -', successCount, 'success,', failCount, 'failed');
  return { successCount, failCount };
}

/**
 * Add images to ZIP from IndexedDB
 */
export async function addImagesToZip(
  zipWriter: any,
  imageMap: ImageMap,
  isCancelledFn: () => boolean
): Promise<{ successCount: number; failCount: number }> {
  const imageUrls = Object.keys(imageMap).filter(url => imageMap[url].startsWith('images/'));
  let successCount = 0;
  let failCount = 0;

  console.log('[STREAMING-ZIP] Adding', imageUrls.length, 'images to ZIP');

  for (let i = 0; i < imageUrls.length; i++) {
    if (isCancelledFn()) {
      console.log('[STREAMING-ZIP] Cancelled at image', i + 1);
      break;
    }

    const imageUrl = imageUrls[i];
    const imageResponse: any = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'getDownloadedImage',
        imageUrl: imageUrl
      }, resolve);
    });

    if (imageResponse?.success && imageResponse.imageData?.base64) {
      try {
        const imageBytes = base64ToUint8Array(imageResponse.imageData.base64);
        await zipWriter.add(imageMap[imageUrl], new zip.Uint8ArrayReader(imageBytes));
        successCount++;
      } catch (error) {
        failCount++;
        console.error('[STREAMING-ZIP] Failed to add image:', error);
      }
    } else {
      failCount++;
    }

    // Log progress every 20 images
    if ((i + 1) % 20 === 0) {
      console.log(`[STREAMING-ZIP] Progress: ${i + 1}/${imageUrls.length}`);
    }
  }

  console.log('[STREAMING-ZIP] Complete:', successCount, 'added,', failCount, 'failed');
  return { successCount, failCount };
}

/**
 * Create unified ZIP with articles and images
 */
export async function createUnifiedZip(
  processedArticles: ProcessedArticle[],
  imageMap: ImageMap,
  isOwnBlog: boolean,
  isCancelledFn: () => boolean
): Promise<Blob> {
  console.log('[STREAMING-ZIP] Creating unified ZIP with', processedArticles.length, 'articles');

  const zipWriter = new zip.ZipWriter(new zip.BlobWriter());

  // Add articles
  for (let i = 0; i < processedArticles.length; i++) {
    const article = processedArticles[i];
    const filename = `${String(i + 1).padStart(3, '0')}_${article.sanitizedTitle}.md`;
    await zipWriter.add(filename, new zip.TextReader(article.markdownContent));
  }

  // Add index
  const indexContent = `# Articles Index\n\n${processedArticles.map((a, i) =>
    `- [${a.originalTitle}](${String(i + 1).padStart(3, '0')}_${a.sanitizedTitle}.md)`
  ).join('\n')}`;
  await zipWriter.add('index.md', new zip.TextReader(indexContent));

  // Add images
  await addImagesToZip(zipWriter, imageMap, isCancelledFn);

  return await zipWriter.close();
}

/**
 * Send progress update to popup
 */
export function sendProgressUpdate(
  type: 'collecting' | 'articles' | 'images',
  current: number,
  total: number,
  currentItem?: string
): void {
  chrome.runtime.sendMessage({
    action: 'updateProgress',
    type,
    current,
    total,
    currentItem
  });
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
