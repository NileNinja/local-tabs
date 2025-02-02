import { showNotification } from './notification-system.js';
import { exportGroups, importGroups } from './file-operations.js';
import { organizeTabsByGroup } from './group-manager.js';
// Remove circular dependency
let loadAllGroups;
let loadSavedGroups;

export function initializeLoaders(allGroupsLoader, savedGroupsLoader) {
  loadAllGroups = allGroupsLoader;
  loadSavedGroups = savedGroupsLoader;
}

const PLACEHOLDER_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIGZpbGw9IiNFNEU0RTQiLz48L3N2Zz4=';

export function setupEventListeners(allGroupsLoader, savedGroupsLoader) {
  // Initialize loaders
  initializeLoaders(allGroupsLoader, savedGroupsLoader);
  document.getElementById('syncGroups').addEventListener('click', syncGroups);
  document.getElementById('exportGroups').addEventListener('click', exportGroups);
  document.getElementById('importGroups').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      importGroups(file);
      event.target.value = ''; // Reset the input
    }
  });
  
  setupSettingsPanel();
}

export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'groupsUpdated') {
      loadSavedGroups();
    }
  });
}

function setupSettingsPanel() {
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsToggle = document.getElementById('settingsToggle');

  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
  });
}

async function syncGroups() {
  try {

    const windows = await chrome.windows.getAll({ populate: true });
    const groups = await chrome.tabGroups.query({});
    
    let currentGroups = {};
    for (const window of windows) {
      const groupedTabs = organizeTabsByGroup(window.tabs, groups, window);
      currentGroups = { ...currentGroups, ...groupedTabs };
    }

    // Filter out ungrouped tabs
    currentGroups = Object.entries(currentGroups).reduce((acc, [key, group]) => {
      if (!key.startsWith('ungrouped_')) {
        acc[key] = group;
      }
      return acc;
    }, {});
    
    // Get existing saved groups
    const { savedGroups } = await chrome.storage.local.get('savedGroups');
    const existingGroups = savedGroups || {};
    
    // Update timestamps and prepare for sync
    const timestamp = new Date().toISOString();
    Object.keys(currentGroups).forEach(key => {
      if (key !== 'ungrouped') {
        currentGroups[key].savedAt = timestamp;
      }
    });
    
    // Merge current groups with existing, keeping the most recent version
    const mergedGroups = { ...existingGroups };
    for (const [groupId, group] of Object.entries(currentGroups)) {
      if (groupId === 'ungrouped') continue;
      
      // Ensure the group has a valid ID and title
      if (groupId && group.title) {
        const sanitizedTitle = group.title
          .trim()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
          .replace(/[^a-zA-Z0-9\-_]/g, '_')  // Only allow alphanumeric, hyphen and underscore
          .replace(/_+/g, '_')               // Collapse multiple underscores
          .replace(/^_+|_+$/g, '')           // Remove leading/trailing underscores
          .replace(/-+/g, '-')               // Collapse multiple hyphens
          .slice(0, 50)                      // Increase length limit
          .trim();
        
        if (!sanitizedTitle) {
          console.warn('Skipping group with invalid title:', group.title);
          continue;
        }
        
        const groupKey = `${sanitizedTitle}_${Date.now()}`;
        mergedGroups[groupKey] = {
          ...group,
          title: sanitizedTitle
        };
      }
    }
    
    // Save to storage
    await chrome.storage.local.set({ 'savedGroups': mergedGroups });
    showNotification('Groups synced successfully!', 'success');
    await loadAllGroups();
  } catch (error) {
    console.error('Error syncing groups:', error);
    showNotification('Failed to sync groups: ' + (error?.message || 'Unknown error'), 'error');
  }
}
