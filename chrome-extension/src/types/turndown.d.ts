declare module 'turndown' {
  interface Options {
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

  interface Rule {
    filter: string | string[] | ((node: any) => boolean);
    replacement: (content: string, node: any, options?: any) => string;
  }

  class TurndownService {
    constructor(options?: Options);
    addRule(key: string, rule: Rule): TurndownService;
    turndown(html: string): string;
  }

  export = TurndownService;
}