import { showNotification } from './modules/notification-system.js';
import { organizeTabsByGroup } from './modules/group-manager.js';
import { displayGroups } from './modules/ui-components.js';
import { setupEventListeners, setupMessageListener } from './modules/event-handlers.js';

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
    showNotification('Failed to load current tabs: ' + error.message);
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
    if (data.savedGroups) {
      const sortedGroups = Object.entries(data.savedGroups)
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
    }
  } catch (error) {
    console.error('Error loading saved groups:', error);
    showNotification('Failed to load saved groups: ' + error.message);
  }
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAllGroups();
    setupEventListeners(loadAllGroups, loadSavedGroups);
    setupMessageListener();
  } catch (error) {
    console.error('Error initializing:', error);
    showNotification('Failed to initialize: ' + error.message);
  }
});

// Export functions needed by other modules
export { loadAllGroups, loadSavedGroups };
