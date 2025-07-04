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
  chrome.runtime.sendMessage({ action: 'exportCurrentArticle' });
  // エラーメッセージが表示される可能性があるため、すぐにポップアップを閉じない
  // window.close(); // ポップアップを閉じる
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
    const progressTypeMessage = request.type === 'images' ? chrome.i18n.getMessage('downloadingImages') : chrome.i18n.getMessage('exportingArticles');
    progressText.innerText = `${progressTypeMessage}: ${request.current} / ${request.total} (${percentage.toFixed(1)}%)`;
  } else if (request.action === 'exportComplete') {
    progressText.innerText = chrome.i18n.getMessage('exportComplete');
    progressBar.style.width = '100%';
    
    setTimeout(() => {
      window.close();
    }, 1500);
  } else if (request.action === 'showError') {
    alert(request.message);
  } else if (request.action === 'exportSuccess') {
    alert(request.message || 'エクスポートが完了しました！');
    
    setTimeout(() => {
      window.close();
    }, 500);
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