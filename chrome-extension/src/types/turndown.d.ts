// Type declarations for Turndown library

interface TurndownOptions {
  headingStyle?: 'setext' | 'atx';
  hr?: string;
  bulletListMarker?: '-' | '+' | '*';
  codeBlockStyle?: 'indented' | 'fenced';
  fence?: '```' | '~~~';
  emDelimiter?: '_' | '*';
  strongDelimiter?: '**' | '__';
  linkStyle?: 'inlined' | 'referenced';
  linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
}

interface TurndownRule {
  filter: string | string[] | ((node: HTMLElement) => boolean);
  replacement: (content: string, node: HTMLElement, options?: TurndownOptions) => string;
}

declare class TurndownService {
  constructor(options?: TurndownOptions);
  addRule(key: string, rule: TurndownRule): TurndownService;
  turndown(html: string): string;
}

declare module 'turndown' {
  export = TurndownService;
}