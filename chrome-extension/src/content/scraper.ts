// DOM scraping functions for Lodestone blog pages

import { SELECTORS } from '@/utils/constants';

export interface BlogEntry {
  url: string;
  title: string;
  date: string;
  tags: string[];
  thumbnail: string | null;
}

export interface ArticleDetails {
  title: string | null;
  bodyHtml: string | null;
  likes: number;
  commentsCount: number;
  publishDate: string | null;
  tags: string[];
  imageUrls: string[];
  thumbnailUrls: string[];
  commentsData: CommentData[];
}

export interface CommentData {
  author: string;
  timestamp: string;
  commentBodyHtml: string;
}

/**
 * Extract blog entries from blog list page
 */
export function extractBlogEntries(): BlogEntry[] {
  const blogEntries = document.querySelectorAll(SELECTORS.BLOG_ENTRIES);
  console.log('[extractBlogEntries] Found', blogEntries.length, 'blog entries');

  const currentCharacterMatch = window.location.href.match(/\/lodestone\/character\/(\d+)\//);
  const currentCharacterId = currentCharacterMatch ? currentCharacterMatch[1] : null;

  const extractedData: BlogEntry[] = [];

  blogEntries.forEach((entry, index) => {
    const urlElement = entry.querySelector(SELECTORS.BLOG_LINK) as HTMLAnchorElement;
    const titleElement = entry.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
    const timeElement = entry.querySelector(SELECTORS.BLOG_TIME) as HTMLElement;
    const tagsElements = entry.querySelectorAll(SELECTORS.BLOG_TAGS);
    const thumbnailElement = entry.querySelector(SELECTORS.BLOG_THUMBNAIL) as HTMLImageElement;

    const url = urlElement?.href || '';
    const title = titleElement?.innerText.trim() || '';
    const date = timeElement?.innerText.trim() || '';
    const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());
    const thumbnail = thumbnailElement?.src || null;

    const entryCharacterMatch = url.match(/\/lodestone\/character\/(\d+)\//);
    const entryCharacterId = entryCharacterMatch ? entryCharacterMatch[1] : null;

    if (currentCharacterId && entryCharacterId === currentCharacterId) {
      extractedData.push({ url, title, date, tags, thumbnail });
    } else {
      console.log(`[extractBlogEntries] Skipping entry ${index} (different character)`);
    }
  });

  return extractedData;
}

/**
 * Get total pages from pagination element
 */
export function getPaginationInfo(): number {
  let totalPages = 1;
  const paginationElement = document.querySelector(SELECTORS.PAGINATION) as HTMLElement;
  if (paginationElement) {
    const paginationText = paginationElement.innerText;
    const match = paginationText.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
    if (match?.[2]) {
      totalPages = parseInt(match[2], 10);
    }
  }
  return totalPages;
}

/**
 * Extract article details from individual article page
 */
export function extractArticleDetails(): ArticleDetails {
  const titleElement = document.querySelector(SELECTORS.BLOG_TITLE) as HTMLElement;
  const bodyElement = document.querySelector(SELECTORS.ARTICLE_BODY) as HTMLElement;
  const likesElement = document.querySelector(SELECTORS.ARTICLE_LIKES) as HTMLElement;
  const commentsCountElement = document.querySelector(SELECTORS.ARTICLE_COMMENTS_COUNT) as HTMLElement;
  const publishDateElement = document.querySelector(SELECTORS.ARTICLE_PUBLISH_DATE);
  const tagsElements = document.querySelectorAll(SELECTORS.ARTICLE_TAGS);

  const title = titleElement?.innerText.trim() || null;
  const bodyHtml = bodyElement?.innerHTML || null;
  const likes = likesElement ? parseInt(likesElement.innerText.replace(/[^\d]/g, ''), 10) : 0;
  const commentsCount = commentsCountElement ? parseInt(commentsCountElement.innerText.trim(), 10) : 0;
  const publishDate = publishDateElement ?
    (publishDateElement.getAttribute('datetime') || (publishDateElement as HTMLElement).innerText.trim()) : null;
  const tags = Array.from(tagsElements).map(tag => (tag as HTMLElement).innerText.replace(/[\[\]]/g, '').trim());

  const imageUrls: string[] = [];
  const thumbnailUrls: string[] = [];

  // Extract thumbnail images
  const thumbnailElements = document.querySelectorAll('.thumb_list img');
  thumbnailElements.forEach(img => {
    const thumbnailImg = img as HTMLImageElement;
    const originalSrc = thumbnailImg.getAttribute('data-origin_src');
    if (originalSrc) {
      thumbnailUrls.push(originalSrc);
      imageUrls.push(originalSrc);
    }
  });

  // Extract images from article body
  if (bodyHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(bodyHtml, 'text/html');

    // Images with data-origin_src
    doc.querySelectorAll('img[data-origin_src]').forEach(img => {
      const originalSrc = img.getAttribute('data-origin_src');
      if (originalSrc && !imageUrls.includes(originalSrc)) {
        imageUrls.push(originalSrc);
      }
    });

    // Regular img tags
    doc.querySelectorAll('img:not([data-origin_src])').forEach(img => {
      const imgElement = img as HTMLImageElement;
      if (imgElement.src && !imageUrls.includes(imgElement.src)) {
        imageUrls.push(imgElement.src);
      }
    });

    // Thumbnail src from data-origin_src images
    doc.querySelectorAll('img[data-origin_src]').forEach(img => {
      const imgElement = img as HTMLImageElement;
      if (imgElement.src && !imageUrls.includes(imgElement.src)) {
        imageUrls.push(imgElement.src);
      }
    });

    // Linked images
    doc.querySelectorAll('a[href]').forEach(link => {
      const href = (link as HTMLAnchorElement).href;
      if (href && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(href) && !imageUrls.includes(href)) {
        imageUrls.push(href);
      }
    });
  }

  // Extract comments
  const commentsData: CommentData[] = [];
  const commentBodies = document.querySelectorAll(SELECTORS.COMMENT_BODIES);

  commentBodies.forEach(bodyElement => {
    const entryElement = bodyElement.previousElementSibling;
    if (entryElement?.classList.contains('entry')) {
      const authorElement = entryElement.querySelector(SELECTORS.COMMENT_AUTHOR) as HTMLElement;
      const timestampElement = entryElement.querySelector(SELECTORS.COMMENT_TIMESTAMP) as HTMLElement;

      if (authorElement && bodyElement) {
        commentsData.push({
          author: authorElement.innerText.trim(),
          timestamp: timestampElement?.innerText.trim() || '',
          commentBodyHtml: (bodyElement as HTMLElement).innerHTML
        });
      }
    }
  });

  return {
    title,
    bodyHtml,
    likes,
    commentsCount,
    publishDate,
    tags,
    imageUrls,
    thumbnailUrls,
    commentsData
  };
}

/**
 * Detect if current page is user's own blog
 */
export function detectOwnBlog(): boolean {
  const bodyId = document.body.getAttribute('id');
  const hasIdAttribute = document.body.hasAttribute('id');
  console.log('[detectOwnBlog] body.id:', bodyId, 'hasIdAttribute:', hasIdAttribute);
  return !hasIdAttribute || bodyId !== 'community';
}

/**
 * Scrape image URLs from image list page (/my/image/)
 */
export function scrapeImageListPageUrls(): string[] {
  const imageUrls: string[] = [];

  // External images (GitHub, etc.)
  document.querySelectorAll('.image__list a.outboundLink.outboundImage[data-target="external_image"]').forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    if (href) imageUrls.push(href);
  });

  // Internal images (FFXIV screenshots)
  document.querySelectorAll('.image__list a.fancybox_element[rel="view_image"]').forEach(link => {
    const href = (link as HTMLAnchorElement).href;
    if (href) imageUrls.push(href);
  });

  return imageUrls;
}

/**
 * Get total pages from image list pagination
 */
export function getImageListTotalPages(): number {
  let totalPages = 1;
  const element = document.querySelector('.btn__pager__current');
  if (element) {
    const match = element.textContent?.match(/(\d+)ページ\s*\/\s*(\d+)ページ/);
    if (match?.[2]) {
      totalPages = parseInt(match[2], 10);
    }
  }
  return totalPages;
}
