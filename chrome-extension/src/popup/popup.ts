import { ExportState, PopupMessage, GetArticleInfoResponse } from "@/types";
import { messages, SupportedLanguage, DEFAULT_LANGUAGE } from "@/locales/messages";
import { CONFIG } from "@/utils/constants";

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
  exportWarningContainer: HTMLElement;
  settingsContainer: HTMLElement;
}

let elements: PopupElements;
let currentLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

// Helper to get current language messages
function msg() {
  return messages[currentLanguage];
}

// Initialize internationalization messages
function applyI18nMessages(): void {
  const msgs = messages[currentLanguage];

  document.getElementById("extensionTitle")!.textContent = msgs.extensionName;
  document.getElementById("extensionDescription")!.textContent = msgs.lodestoneExportDescription;
  document.getElementById("accessIntervalLabel")!.textContent = msgs.accessIntervalLabel;
  document.getElementById("exportButton")!.textContent = msgs.exportAllArticlesButton;
  document.getElementById("exportCurrentArticleButton")!.textContent = msgs.exportCurrentArticleButton;
  document.getElementById("confirmYes")!.textContent = msgs.yesButton;
  document.getElementById("confirmNo")!.textContent = msgs.noButton;
  document.getElementById("cancelExportButton")!.textContent = msgs.cancelExport;

  // Update progress headers
  const imageProgressHeader = document.getElementById("imageProgressHeader");
  if (imageProgressHeader) {
    imageProgressHeader.textContent = msgs.imageDownloadHeader;
  }

  const articleProgressHeader = document.getElementById("articleProgressHeader");
  if (articleProgressHeader) {
    articleProgressHeader.textContent = msgs.articleProcessHeader;
  }
}

// Initialize settings with defaults (no persistence)
function initializeSettings(): void {
  // Auto-detect language based on browser settings
  currentLanguage = navigator.language.startsWith("ja") ? "ja" : "en";

  elements.languageSelect.value = currentLanguage;
  elements.delayInput.value = String(CONFIG.DEFAULT_EXPORT_DELAY);

  applyI18nMessages();
}

// Restore export state from background script
function restoreExportState(): void {
  chrome.runtime.sendMessage({ action: "getExportState" }, (response: ExportState) => {
    if (!response) return;

    if (response.isExporting) {
      if (response.showingConfirmation) {
        elements.confirmationText.innerText = `${response.total}${messages[currentLanguage].confirmationText}`;
        elements.confirmationDialog.style.display = "block";
      }

      if (response.showingProgress) {
        if (elements.progressBarContainer) {
          elements.progressBarContainer.style.display = "block";
        }
        if (elements.progressBar) {
          const percentage = (response.current / response.total) * 100;
          elements.progressBar.style.width = `${percentage}%`;
        }

        if (elements.progressText) {
          let progressTypeMessage: string;
          if (response.type === "images") {
            progressTypeMessage = messages[currentLanguage].downloadingImages;
          } else {
            progressTypeMessage = messages[currentLanguage].exportingArticles;
          }
          elements.progressText.innerText = `${progressTypeMessage}: ${response.current} / ${response.total} (${(
            (response.current / response.total) *
            100
          ).toFixed(1)}%)`;
        }
      }
    }
  });
}

// Initialize DOM elements
function initializeElements(): void {
  elements = {
    delayInput: document.getElementById("delayInput") as HTMLInputElement,
    exportButton: document.getElementById("exportButton") as HTMLButtonElement,
    exportCurrentArticleButton: document.getElementById("exportCurrentArticleButton") as HTMLButtonElement,
    confirmationDialog: document.getElementById("confirmationDialog") as HTMLElement,
    confirmationText: document.getElementById("confirmationText") as HTMLElement,
    confirmYesButton: document.getElementById("confirmYes") as HTMLButtonElement,
    confirmNoButton: document.getElementById("confirmNo") as HTMLButtonElement,

    // New Settings Elements
    languageSelect: document.getElementById("languageSelect") as HTMLSelectElement,

    // New Progress Elements
    progressSection: document.getElementById("progressSection") as HTMLElement,
    exportControlContainer: document.getElementById("exportControlContainer") as HTMLElement,
    cancelExportButton: document.getElementById("cancelExportButton") as HTMLButtonElement,
    imageProgressContainer: document.getElementById("imageProgressContainer") as HTMLElement,
    imageProgressHeader: document.getElementById("imageProgressHeader") as HTMLElement,
    imageProgressText: document.getElementById("imageProgressText") as HTMLElement,
    imageProgressBar: document.getElementById("imageProgressBar") as HTMLElement,
    articleProgressContainer: document.getElementById("articleProgressContainer") as HTMLElement,
    articleProgressHeader: document.getElementById("articleProgressHeader") as HTMLElement,
    articleProgressText: document.getElementById("articleProgressText") as HTMLElement,
    articleProgressBar: document.getElementById("articleProgressBar") as HTMLElement,

    // Legacy elements for backward compatibility
    progressBarContainer: document.getElementById("progressBarContainer") as HTMLElement | undefined,
    progressText: document.getElementById("progressText") as HTMLElement | undefined,
    progressBar: document.getElementById("progressBar") as HTMLElement | undefined,

    articleInfoContainer: document.getElementById("articleInfoContainer") as HTMLElement,
    articleTitle: document.getElementById("articleTitle") as HTMLElement,
    articleStats: document.getElementById("articleStats") as HTMLElement,
    statusMessage: document.getElementById("statusMessage") as HTMLElement,
    exportWarningContainer: document.getElementById("exportWarningContainer") as HTMLElement,
    settingsContainer: document.getElementById("settingsContainer") as HTMLElement,
  };
}

// Setup event listeners
function setupEventListeners(): void {
  // Delay input validation
  elements.delayInput.addEventListener("input", function (this: HTMLInputElement) {
    let value = parseInt(this.value, 10);

    if (value < CONFIG.MIN_EXPORT_DELAY) {
      this.value = String(CONFIG.MIN_EXPORT_DELAY);
    } else if (value > CONFIG.MAX_EXPORT_DELAY) {
      this.value = String(CONFIG.MAX_EXPORT_DELAY);
    }
  });

  elements.delayInput.addEventListener("blur", function (this: HTMLInputElement) {
    let value = parseInt(this.value, 10);

    if (isNaN(value) || value < CONFIG.MIN_EXPORT_DELAY) {
      this.value = String(CONFIG.MIN_EXPORT_DELAY);
    } else if (value > CONFIG.MAX_EXPORT_DELAY) {
      this.value = String(CONFIG.MAX_EXPORT_DELAY);
    }
  });

  // Set default delay value
  elements.delayInput.value = String(CONFIG.DEFAULT_EXPORT_DELAY);

  // Export all articles button
  elements.exportButton.addEventListener("click", () => {
    // ボタンを無効化
    elements.exportButton.disabled = true;
    elements.exportButton.style.cursor = "not-allowed";

    const exportDelay = Math.max(parseInt(elements.delayInput.value, 10), CONFIG.MIN_EXPORT_DELAY);
    elements.delayInput.value = exportDelay.toString();

    // Check if we're on first page first
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) {
        elements.exportButton.disabled = false;
        elements.exportButton.style.cursor = "pointer";
        return;
      }

      const currentUrl = tab.url;
      const isBlogListFirstPage =
        currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/) &&
        (!currentUrl.includes("page=") || currentUrl.includes("page=1"));

      if (isBlogListFirstPage) {
        // We're on first page - set delay and start export
        chrome.runtime.sendMessage(
          {
            action: "setExportDelay",
            delay: exportDelay,
            language: currentLanguage,
          },
          () => {
            chrome.runtime.sendMessage({ action: "exportAllArticles" });
            showExportWarning(true);
          }
        );
      } else {
        // Not on first page - just navigate (don't set delay)
        chrome.runtime.sendMessage({ action: "exportAllArticles" });
        showExportWarning(true);
      }
    });
  });

  // Export current article button
  elements.exportCurrentArticleButton.addEventListener("click", () => {
    showStatusMessage(messages[currentLanguage].startingDownload, "info");
    elements.exportCurrentArticleButton.disabled = true;

    const exportDelay = Math.max(parseInt(elements.delayInput.value, 10), CONFIG.MIN_EXPORT_DELAY);

    // Send directly to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "exportSingleArticle" },
          (response) => {
            // Handle response from content script
            if (chrome.runtime.lastError) {
              showStatusMessage(messages[currentLanguage].contentScriptNotAvailable, "error");
              elements.exportCurrentArticleButton.disabled = false;
            } else if (response?.success) {
              showStatusMessage(messages[currentLanguage].singleArticleExported, "success");
              elements.exportCurrentArticleButton.disabled = false;
            } else {
              showStatusMessage(messages[currentLanguage].failedToExportArticle + (response?.message || ""), "error");
              elements.exportCurrentArticleButton.disabled = false;
            }
          }
        );
      } else {
        showStatusMessage(messages[currentLanguage].contentScriptNotAvailable, "error");
        elements.exportCurrentArticleButton.disabled = false;
      }
    });
  });

  // Confirmation dialog buttons
  elements.confirmYesButton.addEventListener("click", () => {
    const exportDelay = Math.max(parseInt(elements.delayInput.value, 10), CONFIG.MIN_EXPORT_DELAY);
    elements.delayInput.value = exportDelay.toString();

    // Set the export delay first, then confirm export
    chrome.runtime.sendMessage(
      {
        action: "setExportDelay",
        delay: exportDelay,
        language: currentLanguage,
      },
      () => {
        chrome.runtime.sendMessage({ action: "confirmExportAll" });
      }
    );

    elements.confirmationDialog.style.display = "none";

    // Show starting message
    showStatusMessage(messages[currentLanguage].startingExport, "info");

    // Legacy support
    if (elements.progressBarContainer && elements.progressText) {
      elements.progressBarContainer.style.display = "block";
      elements.progressText.innerText = messages[currentLanguage].startingExport;
    }
  });

  elements.confirmNoButton.addEventListener("click", () => {
    elements.confirmationDialog.style.display = "none";
    window.close();
  });

  // Cancel export button
  elements.cancelExportButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "cancelExport" });
    elements.exportControlContainer.style.display = "none";
    elements.exportButton.disabled = false;
    elements.exportButton.style.cursor = "pointer";
    showStatusMessage(messages[currentLanguage].exportCancelled, "info");
    resetProgress();
  });

  // Cancel button hover effects (CSP compliant)
  elements.cancelExportButton.addEventListener("mouseenter", () => {
    elements.cancelExportButton.style.backgroundColor = "#d32f2f";
  });

  elements.cancelExportButton.addEventListener("mouseleave", () => {
    elements.cancelExportButton.style.backgroundColor = "#f44336";
  });

  // Language selector
  elements.languageSelect.addEventListener("change", () => {
    currentLanguage = elements.languageSelect.value as SupportedLanguage;
    applyI18nMessages();

    // Update guidance message if it's currently displayed
    const guidanceMessage = document.getElementById("guidanceMessage");
    if (guidanceMessage && guidanceMessage.style.display !== "none") {
      updateGuidanceMessage();
    }

    checkCurrentArticle(); // Re-check to update button texts
  });
}

// Message listener for background script communication
chrome.runtime.onMessage.addListener((request: PopupMessage, sender, sendResponse) => {
  switch (request.action) {
    case "showExportConfirmation":
      // 記事数収集の進捗表示をクリア
      elements.statusMessage.style.display = "none";
      const blogTypeText = request.isOwnBlog
        ? messages[currentLanguage].confirmationOwnBlog
        : messages[currentLanguage].confirmationOthersBlog;
      elements.confirmationText.innerText = `${request.totalArticles}${messages[currentLanguage].confirmationText}${blogTypeText}`;
      elements.confirmationDialog.style.display = "block";
      break;

    case "updateProgress":
      // Show cancel button when export starts
      if (request.current === 1 && request.total > 1) {
        elements.exportControlContainer.style.display = "block";
      }

      // Use new progress display functions
      if (request.type === "images") {
        showImageProgress(request.current, request.total, request.pageInfo, request.currentItem);
      } else if (request.type === "articles") {
        // 記事エクスポート開始時に画像進捗を完了状態にする（非表示にはしない）
        if (request.current === 1) {
          completeImageProgress();
        }
        showArticleProgress(request.current, request.total, request.pageInfo, request.currentItem);
      } else if (request.type === "pages") {
        // 記事数収集の進捗を表示
        showPageCollectionProgress(request.current, request.total, request.pageInfo);
      } else if (request.type === "collecting") {
        // 記事詳細収集の進捗を表示（記事進捗バーを使用）
        showArticleProgress(request.current, request.total, request.pageInfo, request.currentItem);
      }

      // Legacy support for old progress bar
      if (elements.progressBarContainer && elements.progressBar && elements.progressText && request.type !== "pages") {
        elements.progressBarContainer.style.display = "block";
        const percentage = (request.current / request.total) * 100;
        elements.progressBar.style.width = `${percentage}%`;

        let progressTypeMessage: string;
        if (request.type === "images") {
          progressTypeMessage = messages[currentLanguage].downloadingImages;
        } else {
          progressTypeMessage = messages[currentLanguage].exportingArticles;
        }
        elements.progressText.innerText = `${progressTypeMessage}: ${request.current} / ${
          request.total
        } (${percentage.toFixed(1)}%)`;
      }
      break;

    case "exportComplete":
      // Hide cancel button
      elements.exportControlContainer.style.display = "none";

      // Complete both progress bars
      completeImageProgress();
      completeArticleProgress();
      elements.exportButton.disabled = false;
      elements.exportButton.style.cursor = "pointer";
      showStatusMessage(messages[currentLanguage].exportComplete, "success");

      // Legacy support
      if (elements.progressText && elements.progressBar) {
        elements.progressText.innerText = messages[currentLanguage].exportComplete;
        elements.progressBar.style.width = "100%";
      }
      break;

    case "showError":
      // Hide cancel button and warning on error
      elements.exportControlContainer.style.display = "none";
      showExportWarning(false);

      // Translate common error messages
      let errorMessage = request.message;
      if (errorMessage.includes("Could not establish connection. Receiving end does not exist.")) {
        errorMessage = messages[currentLanguage].failedToExportArticle + messages[currentLanguage].connectionError;
      } else if (errorMessage.includes("Failed to export article:")) {
        errorMessage = errorMessage.replace(
          "Failed to export article:",
          messages[currentLanguage].failedToExportArticle
        );
      }

      showStatusMessage(errorMessage, "error");
      elements.exportCurrentArticleButton.disabled = false;
      elements.exportButton.disabled = false;
      elements.exportButton.style.cursor = "pointer";
      break;

    case "exportSuccess":
      showStatusMessage(request.message || messages[currentLanguage].exportComplete, "success");
      elements.exportCurrentArticleButton.disabled = false;
      break;

    case "articleInfo":
      displayArticleInfo(request.title, request.bodyLength, request.imageCount, request.likes, request.commentsCount);
      break;

    case "exportCancelled":
      // Handle cancel signal from background script
      elements.exportControlContainer.style.display = "none";
      showExportWarning(false);
      elements.exportButton.disabled = false;
      elements.exportButton.style.cursor = "pointer";
      showStatusMessage(messages[currentLanguage].exportCancelled, "info");
      resetProgress();
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

    // Check if URL is a Lodestone character blog URL
    const isLodestoneCharacterUrl = /^https:\/\/(jp|na|eu|fr|de)\.finalfantasyxiv\.com\/lodestone\/character\//.test(currentUrl);

    if (!isLodestoneCharacterUrl) {
      // Not a Lodestone character page at all - show guidance
      elements.exportButton.style.display = "none";
      elements.exportCurrentArticleButton.style.display = "none";
      elements.articleInfoContainer.style.display = "none";
      elements.settingsContainer.style.display = "none";
      showGuidanceMessage();
      return;
    }

    const hasBlog = currentUrl.includes("/blog/");
    const hasEdit = currentUrl.includes("/edit");
    const isIndividualArticle = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/\d+/) && !hasEdit;
    const isBlogListPattern = currentUrl.match(/\/lodestone\/character\/\d+\/blog\/?(\?.*)?$/);

    const isBlogListPage = hasBlog && !hasEdit && !isIndividualArticle && isBlogListPattern;
    const isValidBlogPage = hasBlog && isIndividualArticle;

    if (isBlogListPage) {
      // Blog list page: show only export all button
      elements.exportButton.style.display = "block";
      elements.exportCurrentArticleButton.style.display = "none";
      elements.articleInfoContainer.style.display = "none";
      elements.settingsContainer.style.display = "block";

      // Check if this is page 1 or later pages
      const pageMatch = currentUrl.match(/[?&]page=(\d+)/);
      const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const isFirstPage = pageNumber === 1;

      elements.exportButton.textContent = isFirstPage
        ? messages[currentLanguage].exportAllArticlesButton
        : messages[currentLanguage].exportAllArticlesButtonFirstPage;
    } else if (isValidBlogPage) {
      // Individual article page: show both buttons
      elements.exportButton.style.display = "block";
      elements.exportCurrentArticleButton.style.display = "block";
      elements.settingsContainer.style.display = "block";

      // Update button text to clarify the two-step process
      elements.exportButton.textContent = messages[currentLanguage].exportAllArticlesButtonFirstPage;

      // Get article information
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "getArticleInfo" }, (response: GetArticleInfoResponse) => {
          if (chrome.runtime.lastError) {
            return;
          }
          if (response?.success) {
            displayArticleInfo(
              response.title,
              response.bodyLength,
              response.imageCount,
              response.likes,
              response.commentsCount
            );
          }
        });
      }
    } else {
      // Lodestone character page but not a blog page - show guidance
      elements.exportButton.style.display = "none";
      elements.exportCurrentArticleButton.style.display = "none";
      elements.articleInfoContainer.style.display = "none";
      elements.settingsContainer.style.display = "none";
      showGuidanceMessage();
    }
  });
}

// Reset dialog states
function resetDialogStates(): void {
  elements.confirmationDialog.style.display = "none";
  elements.statusMessage.style.display = "none";
  elements.exportCurrentArticleButton.disabled = false;
  elements.exportButton.disabled = false;
  elements.exportButton.style.cursor = "pointer";

  // Reset new progress displays
  resetProgress();

  // Legacy support
  if (elements.progressBarContainer) {
    elements.progressBarContainer.style.display = "none";
  }
}

// Update guidance message content
function updateGuidanceMessage(): void {
  const guidanceMessage = document.getElementById("guidanceMessage");
  if (guidanceMessage) {
    guidanceMessage.innerHTML = `
      <div style="margin-bottom: 10px;">
        <span style="font-size: 24px;">ℹ️</span>
      </div>
      <div style="font-weight: bold; margin-bottom: 8px;">
        ${messages[currentLanguage].guidanceTitle}
      </div>
      <div style="font-size: 12px; opacity: 0.9; margin-bottom: 12px;">
        ${messages[currentLanguage].guidanceDetails}
      </div>
      <div style="text-align: center;">
        <a href="https://jp.finalfantasyxiv.com/lodestone/" target="_blank" id="guidanceLink" style="
          display: inline-block;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
          ${messages[currentLanguage].guidanceLinkText}
        </a>
      </div>
    `;

    // Add event listeners for hover effects (CSP-compliant)
    const guidanceLink = document.getElementById("guidanceLink");
    if (guidanceLink) {
      guidanceLink.addEventListener("mouseenter", () => {
        guidanceLink.style.transform = "translateY(-1px)";
        guidanceLink.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
      });

      guidanceLink.addEventListener("mouseleave", () => {
        guidanceLink.style.transform = "translateY(0)";
        guidanceLink.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
      });
    }
  }
}

// Show guidance message for unsupported pages
function showGuidanceMessage(): void {
  let guidanceMessage = document.getElementById("guidanceMessage");

  if (!guidanceMessage) {
    guidanceMessage = document.createElement("div");
    guidanceMessage.id = "guidanceMessage";
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

    // Insert after extension description first
    const description = document.getElementById("extensionDescription");
    if (description && description.parentNode) {
      description.parentNode.insertBefore(guidanceMessage, description.nextSibling);
    }

    // Set content using the shared function after DOM insertion
    updateGuidanceMessage();
  } else {
    guidanceMessage.style.display = "block";
    // Update content when showing existing message
    updateGuidanceMessage();
  }
}

// Display article information
function displayArticleInfo(
  title?: string,
  bodyLength?: number,
  imageCount?: number,
  likes?: number,
  commentsCount?: number
): void {
  const msgs = messages[currentLanguage];

  // Update article info header
  const articleInfoHeader = elements.articleInfoContainer.querySelector("h3");
  if (articleInfoHeader) {
    articleInfoHeader.textContent = msgs.articleInfoHeader;
  }

  elements.articleTitle.textContent = msgs.articleTitle + (title || msgs.couldNotRetrieveTitle);
  elements.articleStats.textContent = `${msgs.articleBody}${bodyLength || 0}${msgs.chars} | ${msgs.articleImages}${
    imageCount || 0
  }${msgs.件} | ${msgs.articleLikes}${likes || 0}${msgs.件} | ${msgs.articleComments}${commentsCount || 0}${msgs.件}`;
  elements.articleInfoContainer.style.display = "block";
}

// Progress Management Functions
function showPageCollectionProgress(
  current: number,
  total: number,
  pageInfo?: { currentPage: number; totalPages: number }
): void {
  const msgs = messages[currentLanguage];
  let progressText = "";

  if (pageInfo) {
    progressText = `${msgs.collectingArticles} - ${msgs.progressPage} ${pageInfo.currentPage}/${pageInfo.totalPages} - ${msgs.progressArticleCount}: ${current}${msgs.件}`;
  } else {
    progressText = `${msgs.collectingArticles} - ${msgs.progressArticleCount}: ${current}${msgs.件}`;
  }

  showStatusMessage(progressText, "info");
}

function showImageProgress(
  current: number,
  total: number,
  pageInfo?: { currentPage: number; totalPages: number },
  currentItem?: string
): void {
  elements.imageProgressContainer.style.display = "block";

  const msgs = messages[currentLanguage];
  let progressText = "";
  const percentage = total > 0 ? (current / total) * 100 : 0;
  elements.imageProgressBar.style.width = `${percentage}%`;
  elements.imageProgressBar.textContent = `${percentage.toFixed(1)}%`;

  if (pageInfo) {
    progressText = `${msgs.collectingImageList} - ${msgs.progressPage} ${pageInfo.currentPage}/${pageInfo.totalPages} - ${msgs.progressImageCount}: ${current}${msgs.件}`;
  } else {
    progressText = `${msgs.progressImages}: ${current}/${total}${msgs.件}`;

    if (currentItem) {
      const truncatedItem = currentItem.length > 20 ? currentItem.substring(0, 20) + "..." : currentItem;
      progressText += ` | ${truncatedItem}`;
    }
  }

  elements.imageProgressText.textContent = progressText;
}

function showArticleProgress(
  current: number,
  total: number,
  pageInfo?: { currentPage: number; totalPages: number },
  currentItem?: string
): void {
  elements.articleProgressContainer.style.display = "block";

  const msgs = messages[currentLanguage];
  const percentage = total > 0 ? (current / total) * 100 : 0;
  elements.articleProgressBar.style.width = `${percentage}%`;
  elements.articleProgressBar.textContent = `${percentage.toFixed(1)}%`;

  let progressText = "";
  if (pageInfo) {
    progressText = `${msgs.progressPage} ${pageInfo.currentPage}/${pageInfo.totalPages} - ${msgs.progressArticleCount}: ${current}/${total}${msgs.件}`;
  } else {
    progressText = `${msgs.progressArticles}: ${current}/${total}${msgs.件}`;
  }

  if (currentItem) {
    const truncatedItem = currentItem.length > 25 ? currentItem.substring(0, 25) + "..." : currentItem;
    progressText += ` | ${truncatedItem}`;
  }

  elements.articleProgressText.textContent = progressText;
}

function completeImageProgress(): void {
  if (elements.imageProgressContainer.style.display !== "none") {
    elements.imageProgressBar.style.width = "100%";
    elements.imageProgressBar.textContent = messages[currentLanguage].completed;
    elements.imageProgressText.textContent = messages[currentLanguage].imageDownloadComplete;
    // Keep the container visible to show completion
  }
}

function completeArticleProgress(): void {
  if (elements.articleProgressContainer.style.display !== "none") {
    elements.articleProgressBar.style.width = "100%";
    elements.articleProgressBar.textContent = messages[currentLanguage].completed;
    elements.articleProgressText.textContent = messages[currentLanguage].articleProcessComplete;
  }
}

function resetProgress(): void {
  elements.exportControlContainer.style.display = "none";
  elements.imageProgressContainer.style.display = "none";
  elements.articleProgressContainer.style.display = "none";
  elements.imageProgressBar.style.width = "0%";
  elements.articleProgressBar.style.width = "0%";
  elements.imageProgressBar.textContent = "";
  elements.articleProgressBar.textContent = "";
}

// Function to show/hide export warning
function showExportWarning(show: boolean): void {
  if (show) {
    const warningText = document.getElementById("exportWarningText") as HTMLElement;
    warningText.textContent = messages[currentLanguage].doNotClosePopup;
  }
  elements.exportWarningContainer.style.display = show ? "block" : "none";
}

// Show status message
function showStatusMessage(message: string, type: "error" | "success" | "info"): void {
  elements.statusMessage.textContent = message;
  elements.statusMessage.style.display = "block";

  // Set styles based on type - ガラス調半透明背景 + 色の特徴保持
  const styles = {
    error: { 
      bg: "rgba(255, 235, 238, 0.7)", // 赤っぽい半透明背景
      color: "#c62828", 
      border: "rgba(239, 154, 154, 0.5)" 
    },
    success: { 
      bg: "rgba(232, 245, 232, 0.7)", // 緑っぽい半透明背景
      color: "#2e7d32", 
      border: "rgba(165, 214, 167, 0.5)" 
    },
    info: { 
      bg: "rgba(232, 245, 232, 0.7)", // 緑っぽい半透明背景
      color: "#2e7d32", 
      border: "rgba(165, 214, 167, 0.5)" 
    },
  };

  const style = styles[type];
  elements.statusMessage.style.backgroundColor = style.bg;
  elements.statusMessage.style.color = style.color;
  elements.statusMessage.style.border = `1px solid ${style.border}`;
}

// Developer mode functionality removed - no longer needed

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initializeElements();
  initializeSettings();
  setupEventListeners();
  restoreExportState();
  checkCurrentArticle();
});
