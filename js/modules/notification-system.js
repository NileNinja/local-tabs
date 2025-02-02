// Notification system for displaying user feedback
import { t } from './translations.js';

export function showNotification(messageKey, type = 'error', ...args) {
  const message = typeof messageKey === 'string' ? t(messageKey, ...args) : messageKey;
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 5000);
}
