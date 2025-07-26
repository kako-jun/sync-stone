import { BlogEntry, ArticleDetails, ScrapingResponse } from '@/types';
import { waitForTabLoad } from '@/utils/helpers';
import { CONFIG, calculateTimeout } from '@/utils/constants';

export class LodestoneAPI {
  private exportDelay: number;

  constructor(exportDelay: number = 2000) {
    this.exportDelay = exportDelay;
  }

  /**
   * Scrape blog entries from the current blog list page
   */
  async scrapeBlogEntries(): Promise<{ entries: BlogEntry[], totalPages: number }> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      throw new Error('No active tab found');
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, { 
      action: 'scrapeLodestone' 
    });

    if (!response?.success) {
      throw new Error('Failed to scrape blog entries');
    }

    return {
      entries: response.data || [],
      totalPages: response.totalPages || 1
    };
  }

  /**
   * Scrape additional blog pages
   */
  async scrapeAdditionalPages(
    baseUrl: string, 
    totalPages: number,
    onProgress?: (current: number, total: number, pageInfo?: { currentPage: number, totalPages: number }, currentItem?: string) => void,
    isCancelled?: () => boolean
  ): Promise<BlogEntry[]> {
    const allEntries: BlogEntry[] = [];
    const maxPages = Math.min(totalPages, CONFIG.EXPERIMENTAL_MAX_PAGES);

    for (let page = 2; page <= maxPages; page++) {
      if (isCancelled?.()) {
        break;
      }
      
      try {
        const entries = await this.scrapePage(baseUrl, page);
        allEntries.push(...entries);
        onProgress?.(allEntries.length, allEntries.length, {
          currentPage: page,
          totalPages: maxPages
        }, `ページ ${page} (${entries.length}件発見)`);
      } catch (error) {
        console.error(`Error scraping page ${page}:`, error);
      }
    }

    return allEntries;
  }

  /**
   * Get detailed article information
   */
  async getArticleDetails(articleUrl: string): Promise<ArticleDetails> {
    const tab = await chrome.tabs.create({ url: articleUrl, active: false });
    
    try {
      await waitForTabLoad(tab.id, calculateTimeout(this.exportDelay));
      
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'getArticleDetails' 
      });

      if (!response?.success) {
        throw new Error(`Failed to get article details: ${response?.message}`);
      }

      return {
        title: response.title,
        bodyHtml: response.bodyHtml,
        likes: response.likes,
        commentsCount: response.commentsCount,
        publishDate: response.publishDate,
        tags: response.tags,
        imageUrls: response.imageUrls,
        thumbnailUrls: response.thumbnailUrls,
        commentsData: response.commentsData
      };
    } finally {
      await chrome.tabs.remove(tab.id);
    }
  }

  /**
   * Process multiple articles in batch
   */
  async processArticlesBatch(
    articleUrls: string[],
    onProgress?: (current: number, total: number, pageInfo?: { currentPage: number, totalPages: number }, currentItem?: string) => void,
    isCancelled?: () => boolean,
    isOwnBlog: boolean = true
  ): Promise<ArticleDetails[]> {
    const articles: ArticleDetails[] = [];
    let processedCount = 0;

    for (const url of articleUrls) {
      if (isCancelled?.()) {
        break;
      }
      
      try {
        const article = await this.getArticleDetails(url);
        
        // For other's blog, process images within each article
        if (!isOwnBlog) {
          // Mark all images as needing download for other's blog
          article.imageUrls = [...new Set(article.imageUrls)]; // Remove duplicates
        }
        
        articles.push(article);
        processedCount++;
        onProgress?.(processedCount, articleUrls.length, {
          currentPage: processedCount,
          totalPages: articleUrls.length
        }, article.title);
      } catch (error) {
        console.error(`Failed to process article: ${url}`, error);
        processedCount++;
        onProgress?.(processedCount, articleUrls.length, {
          currentPage: processedCount,
          totalPages: articleUrls.length
        }, 'エラー: ' + url);
      }
    }

    return articles;
  }

  /**
   * Get article info (lightweight version for preview)
   */
  async getArticleInfo(tabId: number): Promise<{
    title: string;
    bodyLength: number;
    imageCount: number;
    likes: number;
    commentsCount: number;
  }> {
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'getArticleInfo' 
    });

    if (!response?.success) {
      throw new Error('Could not retrieve article information');
    }

    return {
      title: response.title,
      bodyLength: response.bodyLength,
      imageCount: response.imageCount,
      likes: response.likes,
      commentsCount: response.commentsCount
    };
  }

  /**
   * Scrape a specific blog page
   */
  private async scrapePage(baseUrl: string, pageNumber: number): Promise<BlogEntry[]> {
    const pageUrl = `${baseUrl}&page=${pageNumber}`;
    const tab = await chrome.tabs.create({ url: pageUrl, active: false });

    try {
      await waitForTabLoad(tab.id, calculateTimeout(this.exportDelay));
      
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'scrapeAdditionalPage' 
      });

      return response?.success ? response.data : [];
    } finally {
      await chrome.tabs.remove(tab.id);
    }
  }
}