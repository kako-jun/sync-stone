// UI notification functions for content script

const NOTIFICATION_ID = 'sync-stone-notification';
const STYLE_ID = 'sync-stone-notification-style';
const AUTO_DISMISS_DELAY = 8000;
const ANIMATION_DURATION = 300;

/**
 * Create notification animation styles
 */
function createAnimationStyle(): HTMLStyleElement {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    #${NOTIFICATION_ID} {
      animation: slideDown 0.5s ease-out, pulse 2s infinite 1s;
    }
  `;
  return style;
}

/**
 * Create notification banner element
 */
function createNotificationBanner(): HTMLDivElement {
  const notification = document.createElement('div');
  notification.id = NOTIFICATION_ID;
  notification.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #4a7bbb 0%, #6b9bd1 50%, #87b5e5 100%);
    color: white;
    padding: 15px 20px;
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideDown 0.5s ease-out;
    border-bottom: 3px solid rgba(255, 255, 255, 0.5);
  `;
  return notification;
}

/**
 * Create notification content with icons
 */
function createNotificationContent(message: string): HTMLDivElement {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 10px;';

  const leftIcon = document.createElement('span');
  leftIcon.style.fontSize = '20px';
  leftIcon.textContent = '\u{1F4CB}'; // clipboard emoji

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;

  const rightIcon = document.createElement('span');
  rightIcon.style.fontSize = '20px';
  rightIcon.textContent = '\u{1F4E5}'; // inbox tray emoji

  content.appendChild(leftIcon);
  content.appendChild(messageSpan);
  content.appendChild(rightIcon);

  return content;
}

/**
 * Dismiss notification with animation
 */
function dismissNotification(notification: HTMLElement): void {
  notification.style.animation = 'slideDown 0.3s ease-in reverse';
  setTimeout(() => notification.remove(), ANIMATION_DURATION);
}

/**
 * Show export notification banner at top of page
 */
export function showExportNotification(message: string): void {
  // Remove existing notification if any
  const existingNotification = document.getElementById(NOTIFICATION_ID);
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create and add animation styles (only if not already added)
  if (!document.getElementById(STYLE_ID)) {
    document.head.appendChild(createAnimationStyle());
  }

  // Create notification banner
  const notification = createNotificationBanner();
  notification.appendChild(createNotificationContent(message));

  // Click to dismiss
  notification.addEventListener('click', () => {
    dismissNotification(notification);
  });

  // Auto-dismiss after delay
  setTimeout(() => {
    if (notification.parentNode) {
      dismissNotification(notification);
    }
  }, AUTO_DISMISS_DELAY);

  document.body.insertBefore(notification, document.body.firstChild);
}
