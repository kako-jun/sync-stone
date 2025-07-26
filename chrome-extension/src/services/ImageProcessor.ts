import JSZip from 'jszip';
import { ImageMap } from '@/types';
import { generateHash, extractFilenameFromUrl, waitForTabLoad } from '@/utils/helpers';
import { URLS, CONFIG, calculateTimeout } from '@/utils/constants';

export class ImageProcessor {
  private zip: JSZip;
  private exportDelay: number;

  constructor(zip: JSZip, exportDelay: number = 2000) {
    this.zip = zip;
    this.exportDelay = exportDelay;
  }

  /**
   * Download all images from Lodestone image list pages
   */
  async downloadAllImages(onProgress?: (current: number, total: number) => void): Promise<ImageMap> {
    const allImageUrls = await this.getAllImageUrls();
    return this.downloadImages(Array.from(allImageUrls), onProgress);
  }

  /**
   * Download specific images
   */
  async downloadImages(imageUrls: string[], onProgress?: (current: number, total: number) => void): Promise<ImageMap> {
    const imageMap: ImageMap = {};
    let downloadedImageCount = 0;
    const totalImages = imageUrls.length;

    for (const imageUrl of imageUrls) {
      try {
        const imageBlob = await this.fetchImage(imageUrl);
        const imagePath = this.generateImagePath(imageUrl);
        
        this.zip.file(imagePath, imageBlob);
        imageMap[imageUrl] = imagePath;
        
        downloadedImageCount++;
        onProgress?.(downloadedImageCount, totalImages);
      } catch (error) {
        console.error(`Failed to download image: ${imageUrl}`, error);
        // Keep original URL if download fails
        imageMap[imageUrl] = imageUrl;
      }
    }

    return imageMap;
  }

  /**
   * Get all image URLs from all image list pages
   */
  private async getAllImageUrls(): Promise<Set<string>> {
    const allImageUrls = new Set<string>();
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const imageUrls = await this.scrapeImageListPage(currentPage);
      imageUrls.forEach(url => allImageUrls.add(url));
      
      if (currentPage === 1 && imageUrls.length > 0) {
        totalPages = await this.getTotalPagesFromCurrentTab();
      }
      
      currentPage++;
    }

    return allImageUrls;
  }

  /**
   * Scrape images from a specific image list page
   */
  private async scrapeImageListPage(page: number): Promise<string[]> {
    const imageUrlListPage = URLS.IMAGE_LIST_PAGE(page);
    
    try {
      const tab = await chrome.tabs.create({ url: imageUrlListPage, active: false });
      await waitForTabLoad(tab.id, calculateTimeout(this.exportDelay));

      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'scrapeImageListPage' 
      });

      await chrome.tabs.remove(tab.id);

      if (response?.success) {
        return response.imageUrls || [];
      } else {
        console.error(`Failed to scrape image list page: ${imageUrlListPage}`, response?.message);
        return [];
      }
    } catch (error) {
      console.error(`Image list page scraping error: ${imageUrlListPage}`, error);
      return [];
    }
  }

  /**
   * Get total pages from current tab (used for first page)
   */
  private async getTotalPagesFromCurrentTab(): Promise<number> {
    try {
      const tabs = await chrome.tabs.query({ active: false });
      const imageListTab = tabs.find(tab => tab.url?.includes('/lodestone/my/image/'));
      
      if (imageListTab?.id) {
        const response = await chrome.tabs.sendMessage(imageListTab.id, { 
          action: 'scrapeImageListPage' 
        });
        return response?.totalPages || 1;
      }
    } catch (error) {
      console.error('Failed to get total pages:', error);
    }
    return 1;
  }

  /**
   * Fetch image as blob
   */
  private async fetchImage(imageUrl: string): Promise<Blob> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    return response.blob();
  }

  /**
   * Generate unique image path for ZIP file
   */
  private generateImagePath(imageUrl: string): string {
    const originalFilename = extractFilenameFromUrl(imageUrl);
    const uniqueFilename = `${generateHash(imageUrl)}_${originalFilename}`;
    return `images/${uniqueFilename}`;
  }
}