// Markdown conversion functions for content script

import { ImageMap } from '@/types';

// TurndownService is loaded from popup.html
declare const TurndownService: any;

// Create and configure TurndownService instance
const turndownService = new TurndownService();

export interface CommentForMarkdown {
  author: string;
  timestamp: string;
  commentBodyHtml: string;
}

export interface MarkdownConversionData {
  title: string;
  htmlContent: string;
  likes: number;
  commentsCount: number;
  publishDate: string | null;
  tags: string[];
  imageMap: ImageMap;
  thumbnailUrls: string[];
  commentsData: CommentForMarkdown[];
}

export interface MarkdownConversionResult {
  success: boolean;
  markdown?: string;
  message?: string;
}

/**
 * Configure Turndown with custom image replacement rule
 */
function configureImageRule(imageMap: ImageMap): void {
  turndownService.addRule('image', {
    filter: 'img',
    replacement: function (_content: string, node: any) {
      const originalSrc = node.getAttribute('src');
      const alt = node.getAttribute('alt') || '';
      const newSrc = imageMap[originalSrc] || originalSrc;
      return `![${alt}](${newSrc})`;
    }
  });
}

/**
 * Configure Turndown with custom image link replacement rule
 */
function configureImageLinkRule(imageMap: ImageMap): void {
  turndownService.addRule('imageLink', {
    filter: function (node: any) {
      return node.nodeName === 'A' && node.getAttribute('href') && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(node.getAttribute('href'));
    },
    replacement: function (content: string, node: any) {
      const originalHref = node.getAttribute('href');
      const newHref = imageMap[originalHref] || originalHref;
      return `[${content}](${newHref})`;
    }
  });
}

/**
 * Build YAML frontmatter for markdown file
 */
function buildFrontmatter(title: string, publishDate: string | null, likes: number, commentsCount: number, tags: string[]): string {
  let frontmatter = `---\n`;
  frontmatter += `title: "${title.replace(/"/g, '\\"')}"\n`;
  if (publishDate) {
    frontmatter += `date: "${publishDate}"\n`;
  }
  frontmatter += `likes: ${likes}\n`;
  frontmatter += `comments: ${commentsCount}\n`;
  if (tags && tags.length > 0) {
    frontmatter += `tags:\n`;
    tags.forEach((tag: string) => {
      frontmatter += `  - ${tag}\n`;
    });
  }
  frontmatter += `---\n\n`;
  return frontmatter;
}

/**
 * Build thumbnail section for markdown
 */
function buildThumbnailSection(thumbnailUrls: string[], imageMap: ImageMap): string {
  if (!thumbnailUrls || thumbnailUrls.length === 0) {
    return '';
  }

  let section = '';
  thumbnailUrls.forEach((thumbnailUrl: string) => {
    const localPath = imageMap[thumbnailUrl] || thumbnailUrl;
    section += `![](${localPath})\n\n`;
  });
  return section;
}

/**
 * Build comments section for markdown
 */
function buildCommentsSection(commentsData: CommentForMarkdown[]): string {
  if (!commentsData || commentsData.length === 0) {
    return '';
  }

  let section = '\n\n## Comments\n\n';
  commentsData.forEach((comment: CommentForMarkdown) => {
    section += `### ${comment.author} (${comment.timestamp})\n\n`;
    section += turndownService.turndown(comment.commentBodyHtml);
    section += '\n\n---\n\n';
  });
  return section;
}

/**
 * Convert HTML content to Markdown with image mapping and metadata
 */
export function processImagesAndConvertToMarkdown(data: MarkdownConversionData): MarkdownConversionResult {
  try {
    const { title, htmlContent, likes, commentsCount, publishDate, tags, imageMap, thumbnailUrls, commentsData } = data;

    // Configure Turndown with custom rules
    configureImageRule(imageMap);
    configureImageLinkRule(imageMap);

    // Build markdown content
    let markdown = buildFrontmatter(title, publishDate, likes, commentsCount, tags);
    markdown += buildThumbnailSection(thumbnailUrls, imageMap);
    markdown += turndownService.turndown(htmlContent);
    markdown += buildCommentsSection(commentsData);

    return { success: true, markdown };
  } catch (error) {
    return {
      success: false,
      message: `Failed to convert to markdown: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get the turndown service instance for direct use
 */
export function getTurndownService(): any {
  return turndownService;
}
