import { ExportState } from '@/types';

interface PopupElements {
  delayInput: HTMLInputElement;
  exportButton: HTMLButtonElement;
  exportCurrentArticleButton: HTMLButtonElement;
  confirmationDialog: HTMLElement;
  confirmationText: HTMLElement;
  confirmYesButton: HTMLButtonElement;
  confirmNoButton: HTMLButtonElement;
  
  // New Settings Elements
  languageSelect: HTMLSelectElement;
  developerMode: HTMLInputElement;
  
  // Progress Elements
  progressSection: HTMLElement;
  exportControlContainer: HTMLElement;
  cancelExportButton: HTMLButtonElement;
  imageProgressContainer: HTMLElement;
  imageProgressHeader: HTMLElement;
  imageProgressText: HTMLElement;
  imageProgressBar: HTMLElement;
  articleProgressContainer: HTMLElement;
  articleProgressHeader: HTMLElement;
  articleProgressText: HTMLElement;
  articleProgressBar: HTMLElement;
  
  // Legacy elements (for backward compatibility)
  progressBarContainer?: HTMLElement;
  progressText?: HTMLElement;
  progressBar?: HTMLElement;
  
  articleInfoContainer: HTMLElement;
  articleTitle: HTMLElement;
  articleStats: HTMLElement;
  statusMessage: HTMLElement;
}

let elements: PopupElements;
let currentLanguage = 'ja';
let isDeveloperMode = false;

// Language messages
const messages: { [key: string]: { [key: string]: string } } = {
  ja: {
    extensionName: 'SyncStone',
    lodestoneExportDescription: 'ロドストのブログ記事をMarkdown形式でエクスポートします',
    accessIntervalLabel: 'アクセス間隔:',
    exportAllArticlesButton: '全記事エクスポート',
    exportAllArticlesButtonFirstPage: '1ページ目へ移動 → 全記事エクスポート',
    exportCurrentArticleButton: 'この記事をエクスポート',
    yesButton: 'はい',
    noButton: 'いいえ',
    confirmationText: '件の記事が見つかりました。エクスポートしますか？',
    downloadingImages: '画像をダウンロード中',
    exportingArticles: '記事をエクスポート中',
    exportComplete: 'エクスポート完了！',
    startingExport: 'エクスポートを開始しています...',
    cancelExport: '⛔ エクスポートをキャンセル',
    developerModeLabel: '🛠️ 開発者モード (最大5記事)',
    languageLabel: '🌐 Language:'
  },
  en: {
    extensionName: 'SyncStone',
    lodestoneExportDescription: 'Export your Lodestone diaries.',
    accessIntervalLabel: 'Access Interval:',
    exportAllArticlesButton: 'Export All Articles',
    exportAllArticlesButtonFirstPage: 'Go to Page 1 and Export All',
    exportCurrentArticleButton: 'Export Current Article',
    yesButton: 'Yes',
    noButton: 'No',
    confirmationText: ' articles will be exported. Continue?',
    downloadingImages: 'Downloading Images',
    exportingArticles: 'Exporting Articles',
    exportComplete: 'Export Complete!',
    startingExport: 'Starting Export...',
    cancelExport: '⛔ Cancel Export',
    developerModeLabel: '🛠️ Developer Mode (Max 5 articles)',
    languageLabel: '🌐 Language:'
  }
};

// Initialize internationalization messages
function applyI18nMessages(): void {
  const msgs = messages[currentLanguage];
  
  document.getElementById('extensionTitle')!.textContent = msgs.extensionName;
  document.getElementById('extensionDescription')!.textContent = msgs.lodestoneExportDescription;
  document.getElementById('accessIntervalLabel')!.textContent = msgs.accessIntervalLabel;
  document.getElementById('exportButton')!.textContent = msgs.exportAllArticlesButton;
  document.getElementById('exportCurrentArticleButton')!.textContent = msgs.exportCurrentArticleButton;
  document.getElementById('confirmYes')!.textContent = msgs.yesButton;
  document.getElementById('confirmNo')!.textContent = msgs.noButton;
  document.getElementById('cancelExportButton')!.textContent = msgs.cancelExport;
  
  // Update developer mode label
  const devModeLabel = document.querySelector('label:has(#developerMode)');
  if (devModeLabel) {
    const checkbox = devModeLabel.querySelector('#developerMode');
    if (checkbox) {
      devModeLabel.innerHTML = '';
      devModeLabel.appendChild(checkbox);
      devModeLabel.appendChild(document.createTextNode(' ' + msgs.developerModeLabel));
    }
  }
  
  updateButtonsForDeveloperMode();
}

// Initialize settings with defaults (no persistence)
function initializeSettings(): void {
  currentLanguage = 'ja';
  isDeveloperMode = false;
  
  elements.languageSelect.value = currentLanguage;
  elements.developerMode.checked = isDeveloperMode;
  elements.delayInput.value = '2000';
  
  applyI18nMessages();
}

// Restore export state from background script
function restoreExportState(): void {
  chrome.runtime.sendMessage({ action: 'getExportState' }, (response: ExportState) => {
    if (!response) return;

    if (response.isExporting) {
      if (response.showingConfirmation) {
        elements.confirmationText.innerText = `${response.total}${chrome.i18n.getMessage('confirmationText')}`;
        elements.confirmationDialog.style.display = 'block';
      }

      if (response.showingProgress) {
        if (elements.progressBarContainer) {
          elements.progressBarContainer.style.display = 'block';
        }
        if (elements.progressBar) {
          const percentage = (response.current / response.total) * 100;
          elements.progressBar.style.width = `${percentage}%`;
        }

        if (elements.progressText) {
          let progressTypeMessage: string;
          if (response.type === 'images') {
            progressTypeMessage = chrome.i18n.getMessage('downloadingImages');
          } else {
            progressTypeMessage = chrome.i18n.getMessage('exportingArticles');
          }
          elements.progressText.innerText = `${progressTypeMessage}: ${response.current} / ${response.total} (${(response.current / response.total * 100).toFixed(1)}%)`;
        }
      }
    }
  });
}

// Initialize DOM elements
function initializeElements(): void {
  elements = {
    delayInput: document.getElementById('delayInput') as HTMLInputElement,
    exportButton: document.getElementById('exportButton') as HTMLButtonElement,
    exportCurrentArticleButton: document.getElementById('exportCurrentArticleButton') as HTMLButtonElement,
    confirmationDialog: document.getElementById('confirmationDialog') as HTMLElement,
    confirmationText: document.getElementById('confirmationText') as HTMLElement,
    confirmYesButton: document.getElementById('confirmYes') as HTMLButtonElement,
    confirmNoButton: document.getElementById('confirmNoButton') as HTMLButtonElement,
    
    // New Settings Elements
    languageSelect: document.getElementById('languageSelect') as HTMLSelectElement,
    developerMode: document.getElementById('developerMode') as HTMLInputElement,
    
    // New Progress Elements
    progressSection: document.getElementById('progressSection') as HTMLElement,
    exportControlContainer: document.getElementById('exportControlContainer') as HTMLElement,
    cancelExportButton: document.getElementById('cancelExportButton') as HTMLButtonElement,
    imageProgressContainer: document.getElementById('imageProgressContainer') as HTMLElement,
    imageProgressHeader: document.getElementById('imageProgressHeader') as HTMLElement,
    imageProgressText: document.getElementById('imageProgressText') as HTMLElement,
    imageProgressBar: document.getElementById('imageProgressBar') as HTMLElement,
    articleProgressContainer: document.getElementById('articleProgressContainer') as HTMLElement,
    articleProgressHeader: document.getElementById('articleProgressHeader') as HTMLElement,
    articleProgressText: document.getElementById('articleProgressText') as HTMLElement,
    articleProgressBar: document.getElementById('articleProgressBar') as HTMLElement,
    
    // Legacy elements for backward compatibility
    progressBarContainer: document.getElementById('progressBarContainer') as HTMLElement | undefined,
    progressText: document.getElementById('progressText') as HTMLElement | undefined,
    progressBar: document.getElementById('progressBar') as HTMLElement | undefined,
    
    articleInfoContainer: document.getElementById('articleInfoContainer') as HTMLElement,
    articleTitle: document.getElementById('articleTitle') as HTMLElement,
    articleStats: document.getElementById('articleStats') as HTMLElement,
    statusMessage: document.getElementById('statusMessage') as HTMLElement
  };
}

// Setup event listeners
function setupEventListeners(): void {
  // Delay input validation
  elements.delayInput.addEventListener('input', function(this: HTMLInputElement) {
    let value = parseInt(this.value, 10);
    
    if (value < 2000) {
      this.value = '2000';
    } else if (value > 10000) {
      this.value = '10000';
    }
  });

  elements.delayInput.addEventListener('blur', function(this: HTMLInputElement) {
    let value = parseInt(this.value, 10);
    
    if (isNaN(value) || value < 2000) {
      this.value = '2000';
    } else if (value > 10000) {
      this.value = '10000';
    }
  });

  // Set default delay value
  elements.delayInput.value = '2000';

  // Export all articles button
  elements.exportButton.addEventListener('click', () => {
    const exportDelay = Math.max(parseInt(elements.delayInput.value, 10), 2000);
    elements.delayInput.value = exportDelay.toString();
    
    // Set the export delay and developer mode, then start export
    chrome.runtime.sendMessage({ 
      action: 'setExportDelay', 
      delay: exportDelay,
      developerMode: isDeveloperMode 
    }, () => {
      chrome.runtime.sendMessage({ action: 'exportAllArticles' });
    });
  });

  // Export current article button
  elements.exportCurrentArticleButton.addEventListener('click', () => {
    showStatusMessage('Starting download...', 'info');
    elements.exportCurrentArticleButton.disabled = true;
    
    const exportDelay = Math.max(parseInt(elements.delayInput.value, 10), 2000);
    // Set the export delay first, then start export
    chrome.runtime.sendMessage({ action: 'setExportDelay', delay: exportDelay }, () => {
      chrome.runtime.sendMessage({ action: 'exportSingleArticle' });
    });
  });

  // Confirmation dialog buttons
  elements.confirmYesButton.addEventListener('click', () => {
    const exportDelay = Math.max(parseInt(elements.delayInput.value, 10), 2000);
    elements.delayInput.value = exportDelay.toString();
    
    // Set the export delay first, then confirm export
    chrome.runtime.sendMessage({ action: 'setExportDelay', delay: exportDelay }, () => {
      chrome.runtime.sendMessage({ action: 'confirmExportAll' });
    });
    
    elements.confirmationDialog.style.display = 'none';
    
    // Show starting message
    showStatusMessage('エクスポートを開始しています...', 'info');
    
    // Legacy support
    if (elements.progressBarContainer && elements.progressText) {
      elements.progressBarContainer.style.display = 'block';
      elements.progressText.innerText = chrome.i18n.getMessage('startingExport');
    }
  });

  elements.confirmNoButton.addEventListener('click', () => {
    elements.confirmationDialog.style.display = 'none';
    window.close();
  });

  // Cancel export button
  elements.cancelExportButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'cancelExport' });
    elements.exportControlContainer.style.display = 'none';
    const cancelMsg = messages[currentLanguage].exportComplete.replace('完了', 'キャンセル');
    showStatusMessage('エクスポートをキャンセルしました', 'info');
    resetProgress();
  });

  // Language selector
  elements.languageSelect.addEventListener('change', () => {
    currentLanguage = elements.languageSelect.value;
    applyI18nMessages();
  });

  // Developer mode checkbox
  elements.developerMode.addEventListener('change', () => {
    isDeveloperMode = elements.developerMode.checked;
    updateButtonsForDeveloperMode();
  });
}

// Message listener for background script communication
chrome.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
  switch (request.action) {
    case 'showExportConfirmation':
      elements.confirmationText.innerText = `${request.totalArticles}${chrome.i18n.getMessage('confirmationText')}`;
      elements.confirmationDialog.style.display = 'block';
      break;

    case 'updateProgress':
      // Show cancel button when export starts
      if (request.current === 1 && request.total > 1) {
        elements.exportControlContainer.style.display = 'block';
      }
      
      // Use new progress display functions
      if (request.type === 'images') {
        showImageProgress(request.current, request.total, request.pageInfo, request.currentItem);
      } else if (request.type === 'articles') {
        showArticleProgress(request.current, request.total, request.pageInfo, request.currentItem);
      } else if (request.type === 'pages') {
        // ページ読み込み進捗は画像進捗として表示
        showImageProgress(request.current, request.total, request.pageInfo, request.currentItem);
      }
      
      // Legacy support for old progress bar
      if (elements.progressBarContainer && elements.progressBar && elements.progressText) {
        elements.progressBarContainer.style.display = 'block';
        const percentage = (request.current / request.total) * 100;
        elements.progressBar.style.width = `${percentage}%`;
        
        let progressTypeMessage: string;
        if (request.type === 'images') {
          progressTypeMessage = chrome.i18n.getMessage('downloadingImages');
        } else {
          progressTypeMessage = chrome.i18n.getMessage('exportingArticles');
        }
        elements.progressText.innerText = `${progressTypeMessage}: ${request.current} / ${request.total} (${percentage.toFixed(1)}%)`;
      }
      break;

    case 'exportComplete':
      // Hide cancel button
      elements.exportControlContainer.style.display = 'none';
      
      // Complete both progress bars
      completeImageProgress();
      completeArticleProgress();
      showStatusMessage('エクスポートが完了しました！', 'success');
      
      // Legacy support
      if (elements.progressText && elements.progressBar) {
        elements.progressText.innerText = chrome.i18n.getMessage('exportComplete');
        elements.progressBar.style.width = '100%';
      }
      break;

    case 'showError':
      // Hide cancel button on error
      elements.exportControlContainer.style.display = 'none';
      showStatusMessage(request.message, 'error');
      elements.exportCurrentArticleButton.disabled = false;
      break;

    case 'exportSuccess':
      showStatusMessage(request.message || 'Export completed!', 'success');
      elements.exportCurrentArticleButton.disabled = false;
      break;

    case 'articleInfo':
      displayArticleInfo(request.title, request.bodyLength, request.imageCount, request.likes, request.commentsCount);
      break;
  }
});

// Check current article information
function checkCurrentArticle(): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) return;

    resetDialogStates();

    const currentUrl = tab.url;
    const hasLodestone = currentUrl.includes('/lodestone/character/');
    const hasBlog = currentUrl.includes('/blog/');
    const hasEdit = currentUrl.includes('/edit');
    const isIndividualArticle = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/\d+/);
    const isBlogListPattern = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/);

    const isBlogListPage = hasLodestone && hasBlog && !hasEdit && !isIndividualArticle && isBlogListPattern;
    const isValidBlogPage = hasLodestone && hasBlog && (hasEdit || isIndividualArticle);

    if (isBlogListPage) {
      // Blog list page: show only export all button
      elements.exportButton.style.display = 'block';
      elements.exportCurrentArticleButton.style.display = 'none';
      elements.articleInfoContainer.style.display = 'none';
      
      // Check if this is page 1 or later pages
      const isFirstPage = !currentUrl.includes('page=') || currentUrl.includes('page=1');
      elements.exportButton.textContent = isFirstPage 
        ? chrome.i18n.getMessage('exportAllArticlesButton')
        : chrome.i18n.getMessage('exportAllArticlesButtonFirstPage');
    } else if (isValidBlogPage) {
      // Individual article page: show both buttons
      elements.exportButton.style.display = 'block';
      elements.exportCurrentArticleButton.style.display = 'block';
      
      // Update button text to clarify the two-step process
      elements.exportButton.textContent = chrome.i18n.getMessage('exportAllArticlesButtonFirstPage');

      // Get article information
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'getArticleInfo' }, (response: any) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not available:', chrome.runtime.lastError.message);
            return;
          }
          if (response?.success) {
            displayArticleInfo(response.title, response.bodyLength, response.imageCount, response.likes, response.commentsCount);
          }
        });
      }
    } else {
      // Other pages: hide both buttons but show guidance
      elements.exportButton.style.display = 'none';
      elements.exportCurrentArticleButton.style.display = 'none';
      elements.articleInfoContainer.style.display = 'none';
      
      // Show guidance message
      showGuidanceMessage();
    }
  });
}

// Reset dialog states
function resetDialogStates(): void {
  elements.confirmationDialog.style.display = 'none';
  elements.statusMessage.style.display = 'none';
  elements.exportCurrentArticleButton.disabled = false;
  
  // Reset new progress displays
  resetProgress();
  
  // Legacy support
  if (elements.progressBarContainer) {
    elements.progressBarContainer.style.display = 'none';
  }
  
  // Hide guidance message if it exists
  const guidanceMessage = document.getElementById('guidanceMessage');
  if (guidanceMessage) {
    guidanceMessage.style.display = 'none';
  }
}

// Show guidance message for unsupported pages
function showGuidanceMessage(): void {
  let guidanceMessage = document.getElementById('guidanceMessage');
  
  if (!guidanceMessage) {
    guidanceMessage = document.createElement('div');
    guidanceMessage.id = 'guidanceMessage';
    guidanceMessage.style.cssText = `
      margin-top: 15px;
      padding: 15px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border-radius: 8px;
      color: white;
      text-align: center;
      font-size: 14px;
      line-height: 1.5;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    
    guidanceMessage.innerHTML = `
      <div style="margin-bottom: 10px;">
        <span style="font-size: 24px;">📍</span>
      </div>
      <div style="font-weight: bold; margin-bottom: 8px;">
        ロドストのブログページに移動してください
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        • 記事一覧ページ → 全記事エクスポート<br>
        • 個別記事ページ → 個別 + 全記事エクスポート
      </div>
    `;
    
    // Insert after extension description
    const description = document.getElementById('extensionDescription');
    if (description && description.parentNode) {
      description.parentNode.insertBefore(guidanceMessage, description.nextSibling);
    }
  } else {
    guidanceMessage.style.display = 'block';
  }
}

// Display article information
function displayArticleInfo(title: string, bodyLength: number, imageCount: number, likes: number, commentsCount: number): void {
  elements.articleTitle.textContent = 'Title: ' + (title || 'Could not retrieve');
  elements.articleStats.textContent = `Body: ${bodyLength || 0} chars | Images: ${imageCount || 0} | Likes: ${likes || 0} | Comments: ${commentsCount || 0}`;
  elements.articleInfoContainer.style.display = 'block';
}

// Progress Management Functions
function showImageProgress(current: number, total: number, pageInfo?: { currentPage: number, totalPages: number }, currentItem?: string): void {
  elements.imageProgressContainer.style.display = 'block';
  
  const percentage = total > 0 ? (current / total) * 100 : 0;
  elements.imageProgressBar.style.width = `${percentage}%`;
  elements.imageProgressBar.textContent = `${percentage.toFixed(1)}%`;
  
  let progressText = '';
  if (pageInfo) {
    progressText = `ページ ${pageInfo.currentPage}/${pageInfo.totalPages} - 画像数: ${current}/${total}件`;
  } else {
    progressText = `画像: ${current}/${total}件`;
  }
  
  // 現在処理中のアイテム情報を追加（20文字まで）
  if (currentItem) {
    const truncatedItem = currentItem.length > 20 ? currentItem.substring(0, 20) + '...' : currentItem;
    progressText += ` | ${truncatedItem}`;
  }
  
  elements.imageProgressText.textContent = progressText;
}

function showArticleProgress(current: number, total: number, pageInfo?: { currentPage: number, totalPages: number }, currentItem?: string): void {
  elements.articleProgressContainer.style.display = 'block';
  
  const percentage = total > 0 ? (current / total) * 100 : 0;
  elements.articleProgressBar.style.width = `${percentage}%`;
  elements.articleProgressBar.textContent = `${percentage.toFixed(1)}%`;
  
  let progressText = '';
  if (pageInfo) {
    progressText = `ページ ${pageInfo.currentPage}/${pageInfo.totalPages} - 記事数: ${current}/${total}件`;
  } else {
    progressText = `記事: ${current}/${total}件`;
  }
  
  // 現在処理中のアイテム情報を追加（30文字まで）
  if (currentItem) {
    const truncatedItem = currentItem.length > 30 ? currentItem.substring(0, 30) + '...' : currentItem;
    progressText += ` | ${truncatedItem}`;
  }
  
  elements.articleProgressText.textContent = progressText;
}

function completeImageProgress(): void {
  if (elements.imageProgressContainer.style.display !== 'none') {
    elements.imageProgressBar.style.width = '100%';
    elements.imageProgressBar.textContent = '完了';
    elements.imageProgressText.textContent = '画像ダウンロード完了';
    // Keep the container visible to show completion
  }
}

function completeArticleProgress(): void {
  if (elements.articleProgressContainer.style.display !== 'none') {
    elements.articleProgressBar.style.width = '100%';
    elements.articleProgressBar.textContent = '完了';
    elements.articleProgressText.textContent = '記事処理完了';
  }
}

function resetProgress(): void {
  elements.exportControlContainer.style.display = 'none';
  elements.imageProgressContainer.style.display = 'none';
  elements.articleProgressContainer.style.display = 'none';
  elements.imageProgressBar.style.width = '0%';
  elements.articleProgressBar.style.width = '0%';
  elements.imageProgressBar.textContent = '';
  elements.articleProgressBar.textContent = '';
}

// Show status message
function showStatusMessage(message: string, type: 'error' | 'success' | 'info'): void {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.display = 'block';

  // Set styles based on type
  const styles = {
    error: { bg: '#ffebee', color: '#c62828', border: '#ef9a9a' },
    success: { bg: '#e8f5e8', color: '#2e7d32', border: '#a5d6a7' },
    info: { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' }
  };

  const style = styles[type];
  elements.statusMessage.style.backgroundColor = style.bg;
  elements.statusMessage.style.color = style.color;
  elements.statusMessage.style.border = `1px solid ${style.border}`;
}

// Update buttons for developer mode
function updateButtonsForDeveloperMode(): void {
  const msgs = messages[currentLanguage];
  if (isDeveloperMode) {
    const devSuffix = currentLanguage === 'ja' ? ' (開発用: 最大5件)' : ' (Dev: Max 5)';
    elements.exportButton.textContent = msgs.exportAllArticlesButton + devSuffix;
    elements.exportButton.style.backgroundColor = '#ff9800';
    elements.exportButton.style.color = 'white';
  } else {
    elements.exportButton.textContent = msgs.exportAllArticlesButton;
    elements.exportButton.style.backgroundColor = '';
    elements.exportButton.style.color = '';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  initializeSettings();
  setupEventListeners();
  restoreExportState();
  checkCurrentArticle();
});