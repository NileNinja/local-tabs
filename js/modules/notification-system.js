// Notification system for displaying user feedback
export function showNotification(message, type = 'error') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.add('show');

  setTimeout(() => {
    notification.classList.remove('show');
  }, 5000);
}
