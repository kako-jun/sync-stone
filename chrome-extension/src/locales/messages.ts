// Centralized i18n messages for SyncStone Chrome Extension
// This file is the single source of truth for all UI messages

export type SupportedLanguage = 'ja' | 'en';

export interface Messages {
  // Extension info
  extensionName: string;
  lodestoneExportDescription: string;

  // Settings
  accessIntervalLabel: string;

  // Buttons
  exportAllArticlesButton: string;
  exportAllArticlesButtonFirstPage: string;
  exportCurrentArticleButton: string;
  yesButton: string;
  noButton: string;
  cancelExport: string;

  // Confirmation dialog
  confirmationText: string;
  confirmationOwnBlog: string;
  confirmationOthersBlog: string;

  // Progress messages
  downloadingImages: string;
  exportingArticles: string;
  exportComplete: string;
  startingExport: string;
  startingDownload: string;
  exportCancelled: string;
  collectingArticles: string;
  imageDownloadHeader: string;
  articleProcessHeader: string;
  imageDownloadComplete: string;
  articleProcessComplete: string;
  completed: string;

  // Success/Error messages
  singleArticleExported: string;
  failedToExportArticle: string;
  failedToExport: string;
  couldNotRetrieveTitle: string;
  contentScriptNotAvailable: string;
  notOnBlogListPageError: string;
  connectionError: string;

  // Guidance
  guidanceTitle: string;
  guidanceDetails: string;
  guidanceLinkText: string;

  // Article info
  articleInfoHeader: string;
  articleTitle: string;
  articleBody: string;
  articleImages: string;
  articleLikes: string;
  articleComments: string;
  chars: string;
  件: string;

  // Background script messages
  blogListMoved: string;
  exportDataNotFound: string;

  // Content script messages
  noArticlesToExport: string;
  articleDataNotFound: string;
  markdownConversionFailed: string;
  exportProcessError: string;
  articleProcessError: string;

  // Warning messages
  doNotClosePopup: string;

  // Progress format strings
  progressPage: string;
  progressArticleCount: string;
  progressImageCount: string;
  progressArticles: string;
  progressImages: string;
  collectingImageList: string;
}

export const messages: Record<SupportedLanguage, Messages> = {
  ja: {
    // Extension info
    extensionName: 'SyncStone - 星紡のメモワール',
    lodestoneExportDescription: 'ロドストの記事を、Markdown形式でエクスポートします。',

    // Settings
    accessIntervalLabel: 'アクセス間隔:',

    // Buttons
    exportAllArticlesButton: 'すべての記事をエクスポート',
    exportAllArticlesButtonFirstPage: '1ページ目へ移動してエクスポート開始',
    exportCurrentArticleButton: 'この記事をエクスポート',
    yesButton: 'はい',
    noButton: 'いいえ',
    cancelExport: 'エクスポートをキャンセル',

    // Confirmation dialog
    confirmationText: '件の記事が見つかりました。エクスポートしますか？',
    confirmationOwnBlog: '（自分の記事）',
    confirmationOthersBlog: '（他のプレイヤーの記事 - 記事内の画像のみ取得）',

    // Progress messages
    downloadingImages: '画像を処理中',
    exportingArticles: '記事を処理中',
    exportComplete: 'ZIPファイルの準備ができました。ダウンロードダイアログで保存してください。',
    startingExport: '処理中です...',
    startingDownload: '処理中です...',
    exportCancelled: 'エクスポートをキャンセルしました',
    collectingArticles: '記事を収集中',
    imageDownloadHeader: '画像処理',
    articleProcessHeader: '記事処理',
    imageDownloadComplete: '画像処理完了',
    articleProcessComplete: '記事処理完了',
    completed: '完了',

    // Success/Error messages
    singleArticleExported: 'ZIPファイルの準備ができました。ダウンロードダイアログで保存してください。',
    failedToExportArticle: 'エクスポートに失敗しました: ',
    failedToExport: 'エクスポートに失敗しました: ',
    couldNotRetrieveTitle: '取得できませんでした',
    contentScriptNotAvailable: 'ページとの通信に失敗しました。ページをリロードしてから再度お試しください。',
    notOnBlogListPageError: 'ロドストの日記ページで実行してください。',
    connectionError: 'ページとの通信に失敗しました。ページをリロードしてください。',

    // Guidance
    guidanceTitle: 'ロドストのブログページに移動してください',
    guidanceDetails: '• 記事一覧ページ → 全記事エクスポート<br>• 個別記事ページ → 個別 + 全記事エクスポート',
    guidanceLinkText: 'ロドストにアクセス',

    // Article info
    articleInfoHeader: '記事情報',
    articleTitle: 'タイトル: ',
    articleBody: '本文: ',
    articleImages: '画像: ',
    articleLikes: 'いいね: ',
    articleComments: 'コメント: ',
    chars: '文字',
    件: '件',

    // Background script messages
    blogListMoved: '1ページ目に移動しました。拡張機能を開き直してエクスポートを開始してください。',
    exportDataNotFound: 'エクスポート用のデータが見つかりません',

    // Content script messages
    noArticlesToExport: 'エクスポートする記事がありません。',
    articleDataNotFound: '記事データを取得できませんでした',
    markdownConversionFailed: 'Markdownへの変換に失敗しました',
    exportProcessError: 'エクスポート処理中にエラーが発生しました: ',
    articleProcessError: 'エクスポート処理中にエラーが発生しました: ',

    // Warning messages
    doNotClosePopup: '処理中です。ポップアップを閉じずにお待ちください。',

    // Progress format strings
    progressPage: 'ページ',
    progressArticleCount: '記事数',
    progressImageCount: '画像数',
    progressArticles: '記事',
    progressImages: '画像',
    collectingImageList: '画像一覧を収集中',
  },
  en: {
    // Extension info
    extensionName: 'SyncStone - Stardustmemoir',
    lodestoneExportDescription: 'Export your Lodestone diary entries in Markdown format.',

    // Settings
    accessIntervalLabel: 'Access Interval:',

    // Buttons
    exportAllArticlesButton: 'Export All Articles',
    exportAllArticlesButtonFirstPage: 'Go to Page 1 to Start Export',
    exportCurrentArticleButton: 'Export This Article',
    yesButton: 'Yes',
    noButton: 'No',
    cancelExport: 'Cancel Export',

    // Confirmation dialog
    confirmationText: ' articles found. Export them?',
    confirmationOwnBlog: '(Your articles)',
    confirmationOthersBlog: "(Other player's articles - only images within articles)",

    // Progress messages
    downloadingImages: 'Processing Images',
    exportingArticles: 'Processing Articles',
    exportComplete: 'ZIP file is ready. Please save it in the download dialog.',
    startingExport: 'Processing...',
    startingDownload: 'Processing...',
    exportCancelled: 'Export cancelled',
    collectingArticles: 'Collecting Articles',
    imageDownloadHeader: 'Image Processing',
    articleProcessHeader: 'Article Processing',
    imageDownloadComplete: 'Image processing complete',
    articleProcessComplete: 'Article processing complete',
    completed: 'Complete',

    // Success/Error messages
    singleArticleExported: 'ZIP file is ready. Please save it in the download dialog.',
    failedToExportArticle: 'Failed to export: ',
    failedToExport: 'Failed to export: ',
    couldNotRetrieveTitle: 'Could not retrieve',
    contentScriptNotAvailable: 'Communication with page failed. Please reload and try again.',
    notOnBlogListPageError: 'Please run this on a Lodestone blog page.',
    connectionError: 'Communication with page failed. Please reload the page.',

    // Guidance
    guidanceTitle: 'Please navigate to a Lodestone blog page',
    guidanceDetails: '• Blog list page → Export all articles<br>• Individual article page → Individual + Export all',
    guidanceLinkText: 'Go to Lodestone',

    // Article info
    articleInfoHeader: 'Article Info',
    articleTitle: 'Title: ',
    articleBody: 'Body: ',
    articleImages: 'Images: ',
    articleLikes: 'Likes: ',
    articleComments: 'Comments: ',
    chars: ' chars',
    件: ' items',

    // Background script messages
    blogListMoved: 'Navigated to page 1. Please reopen the extension to start export.',
    exportDataNotFound: 'Export data not found',

    // Content script messages
    noArticlesToExport: 'No articles to export.',
    articleDataNotFound: 'Could not retrieve article data',
    markdownConversionFailed: 'Failed to convert to Markdown',
    exportProcessError: 'Error occurred during export: ',
    articleProcessError: 'Error occurred during article processing: ',

    // Warning messages
    doNotClosePopup: 'Processing in progress. Please keep this popup open.',

    // Progress format strings
    progressPage: 'Page',
    progressArticleCount: 'Articles',
    progressImageCount: 'Images',
    progressArticles: 'Articles',
    progressImages: 'Images',
    collectingImageList: 'Collecting Images',
  },
};

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'ja';
