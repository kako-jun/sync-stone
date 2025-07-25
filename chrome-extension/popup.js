// popup.js
// 国際化メッセージを適用する関数
function applyI18nMessages() {
  // タイトルと説明を設定
  document.getElementById('extensionTitle').textContent = chrome.i18n.getMessage('extensionName');
  document.getElementById('extensionDescription').textContent = chrome.i18n.getMessage('lodestoneExportDescription');
  document.getElementById('accessIntervalLabel').textContent = chrome.i18n.getMessage('accessIntervalLabel');
  
  // ボタンテキストを設定
  document.getElementById('exportButton').textContent = chrome.i18n.getMessage('exportAllArticlesButton');
  document.getElementById('exportCurrentArticleButton').textContent = chrome.i18n.getMessage('exportCurrentArticleButton');
  document.getElementById('confirmYes').textContent = chrome.i18n.getMessage('yesButton');
  document.getElementById('confirmNo').textContent = chrome.i18n.getMessage('noButton');
}

// エクスポート状態を復元する関数
function restoreExportState() {
  chrome.runtime.sendMessage({ action: 'getExportState' }, (response) => {
    if (response && response.state) {
      const state = response.state;
      
      if (state.isExporting) {
        // 確認ダイアログが表示されている場合
        if (state.showingConfirmation) {
          confirmationText.innerText = `${state.totalArticles}${chrome.i18n.getMessage('confirmationText')}`;
          confirmationDialog.style.display = 'block';
        }
        
        // 進捗バーが表示されている場合
        if (state.showingProgress) {
          progressBarContainer.style.display = 'block';
          const percentage = (state.current / state.total) * 100;
          progressBar.style.width = `${percentage}%`;
          
          let progressTypeMessage;
          if (state.type === 'images') {
            progressTypeMessage = chrome.i18n.getMessage('downloadingImages');
          } else if (state.type === 'collecting') {
            progressTypeMessage = `Collecting pages (${state.articles || 0} articles)`;
          } else {
            progressTypeMessage = chrome.i18n.getMessage('exportingArticles');
          }
          progressText.innerText = `${progressTypeMessage}: ${state.current} / ${state.total} (${percentage.toFixed(1)}%)`;
        }
      }
    }
  });
}

// DOMContentLoadedでi18nメッセージを適用
document.addEventListener('DOMContentLoaded', () => {
  applyI18nMessages();
  restoreExportState();
  checkCurrentArticle(); // 現在の記事情報を取得
});

const delayInput = document.getElementById('delayInput');

// 入力フィールドのバリデーション
delayInput.addEventListener('input', function() {
  let value = parseInt(this.value, 10);
  
  // 入力値が範囲外の場合、適切な値に修正
  if (value < 2000) {
    this.value = 2000;
  } else if (value > 10000) {
    this.value = 10000;
  }
});

// フォーカスアウト時の最終チェック
delayInput.addEventListener('blur', function() {
  let value = parseInt(this.value, 10);
  
  // 空の場合やNaNの場合はデフォルト値を設定
  if (isNaN(value) || value < 2000) {
    this.value = 2000;
  } else if (value > 10000) {
    this.value = 10000;
  }
});

// 常にデフォルト値を設定
delayInput.value = 2000;

document.getElementById('exportButton').addEventListener('click', () => {
  const exportDelay = Math.max(parseInt(delayInput.value, 10), 2000); // 最小値を2000に強制
  delayInput.value = exportDelay; // 入力値を修正された値に更新
  chrome.runtime.sendMessage({ action: 'startExport', exportDelay: exportDelay });
});

document.getElementById('exportCurrentArticleButton').addEventListener('click', () => {
  showStatusMessage('Starting download...', 'info');
  // ボタンを無効化して重複クリックを防ぐ
  document.getElementById('exportCurrentArticleButton').disabled = true;
  chrome.runtime.sendMessage({ action: 'exportCurrentArticle' });
});

// Confirmation dialog elements
const confirmationDialog = document.getElementById('confirmationDialog');
const confirmationText = document.getElementById('confirmationText');
const confirmYesButton = document.getElementById('confirmYes');
const confirmNoButton = document.getElementById('confirmNo');

// Progress bar elements
const progressBarContainer = document.getElementById('progressBarContainer');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showExportConfirmation') {
    confirmationText.innerText = `${request.totalArticles}${chrome.i18n.getMessage('confirmationText')}`;
    confirmationDialog.style.display = 'block';
  } else if (request.action === 'updateProgress') {
    progressBarContainer.style.display = 'block';
    const percentage = (request.current / request.total) * 100;
    progressBar.style.width = `${percentage}%`;
    let progressTypeMessage;
    if (request.type === 'images') {
      progressTypeMessage = chrome.i18n.getMessage('downloadingImages');
    } else if (request.type === 'collecting') {
      progressTypeMessage = `Collecting pages (${request.articles || 0} articles)`;
    } else {
      progressTypeMessage = chrome.i18n.getMessage('exportingArticles');
    }
    progressText.innerText = `${progressTypeMessage}: ${request.current} / ${request.total} (${percentage.toFixed(1)}%)`;
  } else if (request.action === 'exportComplete') {
    progressText.innerText = chrome.i18n.getMessage('exportComplete');
    progressBar.style.width = '100%';
    showStatusMessage('Export completed!', 'success');
  } else if (request.action === 'showError') {
    showStatusMessage(request.message, 'error');
    // エラー時はボタンを再有効化
    document.getElementById('exportCurrentArticleButton').disabled = false;
  } else if (request.action === 'exportSuccess') {
    showStatusMessage(request.message || 'Export completed!', 'success');
    // 成功時はボタンを再有効化
    document.getElementById('exportCurrentArticleButton').disabled = false;
  } else if (request.action === 'articleInfo') {
    displayArticleInfo(request.title, request.bodyLength, request.imageCount, request.likes, request.commentsCount);
  }
});

confirmYesButton.addEventListener('click', () => {
  const exportDelay = Math.max(parseInt(delayInput.value, 10), 2000); // 最小値を2000に強制
  delayInput.value = exportDelay; // 入力値を修正された値に更新
  chrome.runtime.sendMessage({ action: 'confirmExport', exportDelay: exportDelay });
  confirmationDialog.style.display = 'none';
  // Show progress bar immediately
  progressBarContainer.style.display = 'block';
  progressText.innerText = chrome.i18n.getMessage('startingExport');
});

confirmNoButton.addEventListener('click', () => {
  confirmationDialog.style.display = 'none';
  window.close();
});

// 現在の記事情報をチェックする関数
function checkCurrentArticle() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const currentUrl = tabs[0].url;
      
      // ページが変わった時にダイアログ状態をリセット
      resetDialogStates();
      
      // ページタイプを判定
      const hasLodestone = currentUrl.includes('/lodestone/character/');
      const hasBlog = currentUrl.includes('/blog/');
      const hasEdit = currentUrl.includes('/edit');
      const isIndividualArticle = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/\d+/);
      const isBlogListPattern = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/);
      
      const isBlogListPage = hasLodestone && hasBlog && !hasEdit && !isIndividualArticle && isBlogListPattern;
      const isValidBlogPage = hasLodestone && hasBlog && (hasEdit || isIndividualArticle);
      
      // ボタンの表示制御
      const exportAllButton = document.getElementById('exportButton');
      const exportCurrentButton = document.getElementById('exportCurrentArticleButton');
      const articleInfoContainer = document.getElementById('articleInfoContainer');
      
      if (isBlogListPage) {
        // 目次ページ: 全体エクスポートのみ
        exportAllButton.style.display = 'block';
        exportCurrentButton.style.display = 'none';
        articleInfoContainer.style.display = 'none';
      } else if (isValidBlogPage) {
        // 個別記事ページ: 両方のボタンを表示
        exportAllButton.style.display = 'block';
        exportCurrentButton.style.display = 'block';
        
        // 記事情報を取得
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getArticleInfo' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Content script not available:', chrome.runtime.lastError.message);
            return;
          }
          if (response && response.success) {
            displayArticleInfo(response.title, response.bodyLength, response.imageCount, response.likes, response.commentsCount);
          }
        });
      } else {
        // その他のページ: 両方非表示
        exportAllButton.style.display = 'none';
        exportCurrentButton.style.display = 'none';
        articleInfoContainer.style.display = 'none';
      }
    }
  });
}

// ダイアログ状態をリセットする関数
function resetDialogStates() {
  const confirmationDialog = document.getElementById('confirmationDialog');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const statusMessage = document.getElementById('statusMessage');
  const exportCurrentButton = document.getElementById('exportCurrentArticleButton');
  
  // 確認ダイアログを非表示
  confirmationDialog.style.display = 'none';
  
  // 進捗バーを非表示
  progressBarContainer.style.display = 'none';
  
  // ステータスメッセージを非表示
  statusMessage.style.display = 'none';
  
  // ボタンを再有効化
  if (exportCurrentButton) {
    exportCurrentButton.disabled = false;
  }
}

// 記事情報を表示する関数
function displayArticleInfo(title, bodyLength, imageCount, likes, commentsCount) {
  const articleInfoContainer = document.getElementById('articleInfoContainer');
  const articleTitle = document.getElementById('articleTitle');
  const articleStats = document.getElementById('articleStats');
  
  articleTitle.textContent = 'Title: ' + (title || 'Could not retrieve');
  articleStats.textContent = 'Body: ' + (bodyLength || 0) + ' chars | Images: ' + (imageCount || 0) + ' | Likes: ' + (likes || 0) + ' | Comments: ' + (commentsCount || 0);
  
  articleInfoContainer.style.display = 'block';
}

// ステータスメッセージを表示する関数
function showStatusMessage(message, type) {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.textContent = message;
  statusMessage.style.display = 'block';
  
  // スタイルを設定
  statusMessage.style.backgroundColor = type === 'error' ? '#ffebee' : 
                                       type === 'success' ? '#e8f5e8' : 
                                       '#e3f2fd';
  statusMessage.style.color = type === 'error' ? '#c62828' : 
                             type === 'success' ? '#2e7d32' : 
                             '#1565c0';
  statusMessage.style.border = `1px solid ${type === 'error' ? '#ef9a9a' : 
                                            type === 'success' ? '#a5d6a7' : 
                                            '#90caf9'}`;
  
  // 成功メッセージは自動で消さない
}