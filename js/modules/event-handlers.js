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
  const selectedSavePath = document.getElementById('selectedSavePath');
  const actualPath = document.getElementById('actualPath');
  const chooseSavePathBtn = document.getElementById('chooseSavePathBtn');
  const resetSavePathBtn = document.getElementById('resetSavePathBtn');

  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
  });

  // Load saved path from storage
  chrome.storage.local.get('savePath', (data) => {
    if (data.savePath) {
      selectedSavePath.textContent = data.savePath;
      const folderName = data.savePath.split('\\').pop();
      actualPath.textContent = `Actual save location: Downloads/${folderName}`;
    }
  });

  // Reset save path to default
  resetSavePathBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove('savePath');
    selectedSavePath.textContent = 'Using default: Downloads/local-tabs';
    actualPath.textContent = 'Actual save location: Downloads/local-tabs';
    showNotification('Save path reset to default', 'success');
  });

  // Choose new save path
  chooseSavePathBtn.addEventListener('click', async () => {
    try {
      // Create a test file to get the selected folder path
      const testContent = 'test';
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const testUrl = URL.createObjectURL(testBlob);
      
      // First download to get user's preferred location
      const downloadId = await chrome.downloads.download({
        url: testUrl,
        filename: 'select_folder.txt',
        saveAs: true
      });

      // Wait for user to select location
      const downloadItem = await new Promise((resolve, reject) => {
        const listener = (delta) => {
          if (delta.id === downloadId) {
            if (delta.state?.current === 'complete') {
              chrome.downloads.onChanged.removeListener(listener);
              chrome.downloads.search({ id: downloadId }, ([item]) => {
                resolve(item);
              });
            } else if (delta.error) {
              chrome.downloads.onChanged.removeListener(listener);
              reject(new Error(`Download failed: ${delta.error.current}`));
            }
          }
        };
        chrome.downloads.onChanged.addListener(listener);
      });

      if (!downloadItem?.filename) {
        throw new Error('Failed to get selected folder path');
      }

      // Extract folder path and clean it up
      const folderPath = downloadItem.filename
        .substring(0, downloadItem.filename.lastIndexOf('\\'))
        .replace(/\//g, '\\')
        .replace(/\\+$/, ''); // Remove trailing slashes

      // Clean up test file
      await chrome.downloads.removeFile(downloadId);
      await chrome.downloads.erase({ id: downloadId });
      URL.revokeObjectURL(testUrl);

      // Save the path
      selectedSavePath.textContent = folderPath;
      const folderName = folderPath.split('\\').pop();
      actualPath.textContent = `Actual save location: Downloads/${folderName}`;
      await chrome.storage.local.set({ savePath: folderPath });
      showNotification(`Files will be saved in Downloads/${folderName}`, 'success');
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
        showNotification('Failed to select folder: ' + error.message);
      }
    }
  });
}

async function syncGroups() {
  try {
    const { savePath } = await chrome.storage.local.get('savePath');
    const targetPath = savePath || 'local-tabs';

    // Normalize folder path for display
    const displayPath = targetPath.replace(/[/\\]+/g, '/');
    const folderName = displayPath.split('/').pop();
    if (!confirm(`This will save all tab groups to: Downloads/${folderName}\nContinue?`)) {
      return;
    }

    console.log('Using save path:', targetPath);

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
    
    // Sync with files
    let syncErrors = [];
    for (const [groupId, group] of Object.entries(mergedGroups)) {
      const groupData = {
        title: group.title,
        savedAt: group.savedAt,
        tabs: group.tabs.map(tab => ({
          title: tab.title || 'Untitled',
          url: tab.url,
          favicon: tab.favicon || PLACEHOLDER_ICON
        }))
      };

      try {
        const response = await new Promise((resolve) => {
          console.log('Sending saveFile message for group:', group.title);
          chrome.runtime.sendMessage({
            action: 'saveFile',
            groupName: group.title,
            content: JSON.stringify(groupData, null, 2),
            savePath: targetPath
          }, resolve);
        });

        if (!response) {
          throw new Error('No response received from background script');
        }

        console.log('Save response for group:', group.title, response);

        if (response?.error) {
          console.error(`Error syncing group ${group.title}:`, response.error);
          syncErrors.push(`${group.title}: ${response.error}`);
        }
      } catch (error) {
        console.error(`Error saving group ${group.title}:`, error);
        syncErrors.push(`${group.title}: ${error.message || 'Unknown error'}`);
      }
    }
    
    if (syncErrors.length > 0) {
      showNotification(`Sync completed with errors:\n${syncErrors.join('\n')}`);
    } else {
      showNotification('Groups synced successfully!', 'success');
    }
    
    await loadAllGroups();
  } catch (error) {
    console.error('Error syncing groups:', error);
    showNotification(`Failed to sync groups: ${error?.message || error || 'Unknown error'}`);
  }
}
