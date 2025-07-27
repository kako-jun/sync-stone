import TurndownService from 'turndown';
import { ArticleDetails, CommentData, ImageMap } from '@/types';

export class MarkdownConverter {
  private turndownService: TurndownService;

  constructor() {
    // Configure TurndownService for background script environment
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    this.setupCustomRules();
  }

  /**
   * Convert article to markdown with YAML frontmatter
   */
  convertArticleToMarkdown(
    article: ArticleDetails,
    imageMap: ImageMap
  ): string {
    // Update image replacement rule with current imageMap
    this.updateImageReplacementRule(imageMap);

    let markdown = this.generateFrontmatter(article);
    markdown += this.addThumbnails(article.thumbnailUrls, imageMap);
    markdown += this.convertBodyToMarkdown(article.bodyHtml);
    markdown += this.addComments(article.commentsData);

    return markdown;
  }

  /**
   * Setup custom TurndownService rules
   */
  private setupCustomRules(): void {
    // Default image rule (will be updated with imageMap)
    this.turndownService.addRule('image', {
      filter: 'img',
      replacement: (content: string, node: any) => {
        const originalSrc = node.getAttribute('src');
        const alt = node.getAttribute('alt') || '';
        return `![${alt}](${originalSrc})`;
      }
    });
  }

  /**
   * Update image replacement rule with current imageMap
   */
  private updateImageReplacementRule(imageMap: ImageMap): void {
    this.turndownService.addRule('image', {
      filter: 'img',
      replacement: (content: string, node: any) => {
        const originalSrc = node.getAttribute('src');
        const alt = node.getAttribute('alt') || '';
        const newSrc = imageMap[originalSrc] || originalSrc;
        return `![${alt}](${newSrc})`;
      }
    });
  }

  /**
   * Generate YAML frontmatter
   */
  private generateFrontmatter(article: ArticleDetails): string {
    let frontmatter = '---\n';
    frontmatter += `title: "${this.escapeYamlString(article.title)}"\n`;
    
    if (article.publishDate) {
      frontmatter += `date: "${article.publishDate}"\n`;
    }
    
    frontmatter += `likes: ${article.likes}\n`;
    frontmatter += `comments: ${article.commentsCount}\n`;
    
    if (article.tags && article.tags.length > 0) {
      frontmatter += 'tags:\n';
      article.tags.forEach(tag => {
        frontmatter += `  - ${tag}\n`;
      });
    }
    
    frontmatter += '---\n\n';
    return frontmatter;
  }

  /**
   * Add thumbnail images at the beginning of the article
   */
  private addThumbnails(thumbnailUrls: string[], imageMap: ImageMap): string {
    if (!thumbnailUrls || thumbnailUrls.length === 0) {
      return '';
    }

    let thumbnailsMarkdown = '';
    thumbnailUrls.forEach(thumbnailUrl => {
      const localPath = imageMap[thumbnailUrl] || thumbnailUrl;
      thumbnailsMarkdown += `![](${localPath})\n\n`;
    });

    return thumbnailsMarkdown;
  }

  /**
   * Convert HTML body to markdown
   */
  private convertBodyToMarkdown(bodyHtml: string): string {
    return this.turndownService.turndown(bodyHtml);
  }

  /**
   * Add comments section
   */
  private addComments(commentsData: CommentData[]): string {
    if (!commentsData || commentsData.length === 0) {
      return '';
    }

    let commentsMarkdown = '\n\n## Comments\n\n';
    
    commentsData.forEach(comment => {
      commentsMarkdown += `### ${comment.author} (${comment.timestamp})\n\n`;
      commentsMarkdown += this.turndownService.turndown(comment.commentBodyHtml);
      commentsMarkdown += '\n\n---\n\n';
    });

    return commentsMarkdown;
  }

  /**
   * Escape special characters in YAML strings
   */
  private escapeYamlString(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}