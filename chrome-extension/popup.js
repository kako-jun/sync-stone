// popup.js
const delayInput = document.getElementById('delayInput');

// Load saved delay setting
chrome.storage.local.get(['exportDelay'], (result) => {
  if (result.exportDelay) {
    delayInput.value = Math.max(result.exportDelay, 2000); // Enforce minimum 2000ms
  } else {
    delayInput.value = 2000; // Default to 2000ms
  }
});

document.getElementById('exportButton').addEventListener('click', () => {
  const exportDelay = Math.max(parseInt(delayInput.value, 10), 2000); // Enforce minimum 2000ms
  chrome.storage.local.set({ exportDelay: exportDelay });
  chrome.runtime.sendMessage({ action: 'startExport', exportDelay: exportDelay });
});

document.getElementById('exportCurrentArticleButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'exportCurrentArticle' });
  window.close(); // ポップアップを閉じる
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
    confirmationText.innerText = `${request.totalArticles}件の記事をエクスポートします。続行しますか？`;
    confirmationDialog.style.display = 'block';
  } else if (request.action === 'updateProgress') {
    progressBarContainer.style.display = 'block';
    const percentage = (request.current / request.total) * 100;
    progressBar.style.width = `${percentage}%`;
    progressText.innerText = `${request.type === 'images' ? '画像をダウンロード中' : '記事をエクスポート中'}: ${request.current} / ${request.total} (${percentage.toFixed(1)}%)`;
  } else if (request.action === 'exportComplete') {
    progressText.innerText = 'エクスポートが完了しました！';
    progressBar.style.width = '100%';
    setTimeout(() => {
      window.close();
    }, 1500);
  }
});

confirmYesButton.addEventListener('click', () => {
  const exportDelay = Math.max(parseInt(delayInput.value, 10), 2000); // Enforce minimum 2000ms
  chrome.runtime.sendMessage({ action: 'confirmExport', exportDelay: exportDelay });
  confirmationDialog.style.display = 'none';
  // Show progress bar immediately
  progressBarContainer.style.display = 'block';
  progressText.innerText = 'エクスポートを開始します...';
});

confirmNoButton.addEventListener('click', () => {
  confirmationDialog.style.display = 'none';
  window.close();
});