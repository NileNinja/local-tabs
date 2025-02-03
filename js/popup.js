import { showNotification } from './modules/notification-system.js';
import { organizeTabsByGroup } from './modules/group-manager.js';
import { displayGroups } from './modules/ui-components.js';
import { setupEventListeners, setupMessageListener } from './modules/event-handlers.js';
import { setLanguage, getCurrentLanguage, t, initializeLanguage } from './modules/translations.js';

async function loadAllGroups() {
  await Promise.all([
    loadCurrentTabs(),
    loadSavedGroups()
  ]);
}

async function loadCurrentTabs() {
  try {
    console.log('Loading current tabs...');
    const windows = await chrome.windows.getAll({ populate: true });
    console.log('Got windows:', windows);
    const tabGroups = await chrome.tabGroups.query({});
    console.log('Got tab groups:', tabGroups);
    
    const container = document.getElementById('current-groups');
    if (!container) {
      throw new Error('Current groups container not found');
    }
    container.innerHTML = '';
    
    for (const window of windows) {
      const groupedTabs = organizeTabsByGroup(window.tabs, tabGroups, window);
      displayGroups(groupedTabs, container, true);
    }
  } catch (error) {
    console.error('Error loading current tabs:', error);
    showNotification('loadError', 'error', error.message);
  }
}

async function loadSavedGroups() {
  try {
    console.log('Loading saved groups...');
    const container = document.getElementById('saved-groups');
    if (!container) {
      throw new Error('Saved groups container not found');
    }
    container.innerHTML = '';
    
    const data = await chrome.storage.local.get('savedGroups');
    console.log('Got saved groups:', data);
    const savedGroups = data.savedGroups || {};
    
    const sortedGroups = Object.entries(savedGroups)
      .sort(([, a], [, b]) => {
        const timeA = new Date(a.savedAt || 0).getTime();
        const timeB = new Date(b.savedAt || 0).getTime();
        return timeB - timeA;
      })
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    
    displayGroups(sortedGroups, container, false);
  } catch (error) {
    console.error('Error loading saved groups:', error);
    showNotification('loadError', 'error', error.message);
  }
}

function updateUIText() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = t(key);
  });

  // Update all elements with data-i18n-title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.title = t(key);
  });

  // Update spans inside buttons (for button text)
  document.querySelectorAll('button[data-i18n] span[data-i18n]').forEach(span => {
    const key = span.getAttribute('data-i18n');
    span.textContent = t(key);
  });
}

function setupLanguageSelector() {
  const languageSelect = document.getElementById('languageSelect');
  if (!languageSelect) return;
  
  // Set initial value
  languageSelect.value = getCurrentLanguage();
  
  languageSelect.addEventListener('change', async () => {
    const newLang = languageSelect.value;
    await chrome.storage.local.set({ language: newLang });
    setLanguage(newLang);
    updateUIText();
    await loadAllGroups(); // Reload groups to update all dynamic text
  });
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize language first
    await initializeLanguage();
    
    // Setup language selector after language is initialized
    setupLanguageSelector();
    
    // Update UI with the initialized language
    updateUIText();

    // Initialize event handlers with the loader functions
    setupEventListeners(loadAllGroups, loadSavedGroups);
    setupMessageListener();

    // Load groups after event handlers are set up
    await loadAllGroups();
  } catch (error) {
    console.error('Error initializing:', error);
    showNotification('initError', 'error', error.message);
  }
});

// Export functions needed by other modules
export { loadAllGroups, loadSavedGroups };
