document.addEventListener('DOMContentLoaded', async () => {
  await loadAllGroups();
  setupEventListeners();
  setupMessageListener();
});

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'groupsUpdated') {
      loadSavedGroups();
    }
  });
}

async function loadAllGroups() {
  await Promise.all([
    loadCurrentTabs(),
    loadSavedGroups()
  ]);
}

async function loadCurrentTabs() {
  const windows = await chrome.windows.getAll({ populate: true });
  const tabGroups = await chrome.tabGroups.query({});
  
  const container = document.getElementById('current-groups');
  container.innerHTML = '';
  
  for (const window of windows) {
    const groupedTabs = organizeTabsByGroup(window.tabs, tabGroups, window);
    displayGroups(groupedTabs, container, true);
  }
}

async function loadSavedGroups() {
  const container = document.getElementById('saved-groups');
  container.innerHTML = '';
  
  const data = await chrome.storage.local.get('savedGroups');
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
}

const PLACEHOLDER_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIGZpbGw9IiNFNEU0RTQiLz48L3N2Zz4=';

function organizeTabsByGroup(tabs, groups, window) {
  const groupedTabs = {};
  
  groups.forEach(group => {
    groupedTabs[group.id] = {
      title: group.title || 'New Tab Group',
      tabs: []
    };
  });
  
  const ungroupedTabs = [];
  tabs.forEach(tab => {
    if (tab.groupId !== -1) {
      const groupId = tab.groupId;
      if (!groupedTabs[groupId]) {
        groupedTabs[groupId] = {
          title: 'New Tab Group',
          tabs: []
        };
      }
      groupedTabs[groupId].tabs.push({
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl || PLACEHOLDER_ICON,
        id: tab.id
      });
    } else {
      ungroupedTabs.push({
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl || PLACEHOLDER_ICON,
        id: tab.id
      });
    }
  });

  if (ungroupedTabs.length > 0) {
    const firstTab = ungroupedTabs[0];
    const remainingCount = ungroupedTabs.length - 1;
    const groupTitle = remainingCount > 0 
      ? `${firstTab.title} and ${remainingCount} more`
      : firstTab.title;

    groupedTabs[`ungrouped_${window.id}`] = {
      title: groupTitle,
      tabs: ungroupedTabs,
      isUngrouped: true
    };
  }
  
  return groupedTabs;
}

function displayGroups(groupedTabs, container, isCurrentWindow) {
  Object.entries(groupedTabs).forEach(([groupId, group]) => {
    const groupElement = createGroupElement(groupId, group, isCurrentWindow);
    container.appendChild(groupElement);
  });
}

function createGroupElement(groupId, group, isCurrentWindow) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'group-container';
  
  const header = document.createElement('div');
  header.className = 'group-header';
  
  const titleContainer = document.createElement('div');
  titleContainer.className = 'title-container';
  
  const title = document.createElement('input');
  title.type = 'text';
  title.value = group.title || 'New Tab Group';
  title.className = 'group-title';
  titleContainer.appendChild(title);
  
  if (group.savedAt) {
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date(group.savedAt).toLocaleString();
    titleContainer.appendChild(timestamp);
  }
  
  title.addEventListener('change', async () => {
    const newTitle = title.value.trim() || 'New Tab Group';
    title.value = newTitle;
    
    try {
      if (isCurrentWindow && groupId !== 'ungrouped') {
        const numericGroupId = parseInt(groupId);
        if (!isNaN(numericGroupId)) {
          try {
            const groups = await chrome.tabGroups.query({});
            const groupExists = groups.some(g => g.id === numericGroupId);
            if (groupExists) {
              await chrome.tabGroups.update(numericGroupId, { title: newTitle });
            }
          } catch (tabGroupError) {
            console.error('Error updating tab group:', tabGroupError);
          }
        }
      }
      
      const data = await chrome.storage.local.get('savedGroups');
      const savedGroups = data.savedGroups || {};
      if (savedGroups[groupId]) {
        savedGroups[groupId].title = newTitle;
        await chrome.storage.local.set({ 'savedGroups': savedGroups });
      }
    } catch (error) {
      console.error('Error updating group name:', error);
      title.value = group.title || 'New Tab Group';
    }
  });
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  
  const actionButton = document.createElement('button');
  actionButton.className = 'action-button';
  actionButton.title = isCurrentWindow ? 'Save Group' : 'Open Group';
  actionButton.innerHTML = isCurrentWindow ? 
    '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm2 16H5V5h11.17L19 7.83V19zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>' : 
    '<svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
  actionButton.addEventListener('click', () => {
    if (isCurrentWindow) {
      const selectedTabs = Array.from(groupDiv.querySelectorAll('.tab-item'))
        .filter(item => item.querySelector('.tab-checkbox').checked)
        .map(item => ({
          title: item.querySelector('.tab-title').textContent,
          url: item.querySelector('.tab-url').textContent,
          favicon: item.querySelector('.tab-favicon').src
        }));
      
      saveGroup(groupId, { 
        ...group, 
        title: title.value,
        tabs: selectedTabs
      });
    } else {
      openSavedGroup(groupId, { ...group, title: title.value });
    }
  });
  buttonContainer.appendChild(actionButton);
  
  if (!isCurrentWindow && group.savedAt) {
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.title = 'Delete Group';
    deleteButton.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
      </svg>
    `;
    deleteButton.addEventListener('click', () => deleteGroup(groupId));
    buttonContainer.appendChild(deleteButton);
  }
  
  header.appendChild(titleContainer);
  header.appendChild(buttonContainer);
  groupDiv.appendChild(header);
  
  const tabList = document.createElement('div');
  tabList.className = 'tab-list';
  
  group.tabs.forEach((tab, index) => {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-item';
    
    if (isCurrentWindow && !group?.savedAt) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.className = 'tab-checkbox';
      tabDiv.appendChild(checkbox);
    }
    
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favicon || PLACEHOLDER_ICON;
    favicon.onerror = () => {
      favicon.src = PLACEHOLDER_ICON;
    };
    tabDiv.appendChild(favicon);
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'tab-content';
    
    const tabTitle = document.createElement('div');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = tab.title || 'Untitled';
    contentDiv.appendChild(tabTitle);
    
    const tabUrl = document.createElement('div');
    tabUrl.className = 'tab-url';
    tabUrl.textContent = tab.url;
    contentDiv.appendChild(tabUrl);
    
    tabDiv.appendChild(contentDiv);
    
    const tabActions = document.createElement('div');
    tabActions.className = 'tab-actions';
    
    if ((!isCurrentWindow && group.savedAt) || (isCurrentWindow && groupId !== 'ungrouped' && group.savedAt)) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.title = 'Remove tab';
      removeBtn.innerHTML = `
        <svg class="trash-icon" viewBox="0 0 24 24">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      `;
      
      if (isCurrentWindow) {
        removeBtn.addEventListener('click', () => removeTabFromGroup(tab.id, groupId));
      } else {
        removeBtn.addEventListener('click', () => removeTabFromSaved(groupId, index));
      }
      
      tabActions.appendChild(removeBtn);
    }
    
    tabDiv.appendChild(tabActions);
    tabList.appendChild(tabDiv);
  });
  
  groupDiv.appendChild(tabList);
  return groupDiv;
}

function setupEventListeners() {
  document.getElementById('syncGroups').addEventListener('click', syncGroups);
  document.getElementById('exportGroups').addEventListener('click', exportGroups);
  document.getElementById('importGroups').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importGroups);
  
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsToggle = document.getElementById('settingsToggle');
  const selectedFolder = document.getElementById('selectedFolder');
  const chooseFolderBtn = document.getElementById('chooseFolderBtn');

  settingsToggle.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
  });

  chrome.storage.local.get('folderLocation', (data) => {
    if (data.folderLocation) {
      selectedFolder.textContent = data.folderLocation;
    }
  });

  chooseFolderBtn.addEventListener('click', async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const folderPath = dirHandle.name;
      selectedFolder.textContent = folderPath;
      await chrome.storage.local.set({ folderLocation: folderPath });
      alert(`Sync folder set to: ${folderPath}\nFiles will be saved to: ${folderPath}/tab_groups/`);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error selecting folder:', error);
        alert('Failed to select folder: ' + error.message);
      }
    }
  });
}

async function syncGroups() {
  try {
    const { folderLocation } = await chrome.storage.local.get('folderLocation');
    if (!folderLocation) {
      alert('Please set a sync folder location in settings first');
      return;
    }

    if (!confirm(`This will save all tab groups to: ${folderLocation}/tab_groups/\nContinue?`)) {
      return;
    }

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
          .replace(/[^a-zA-Z0-9]/g, '_')  // Replace any non-alphanumeric char with underscore
          .replace(/_+/g, '_')            // Collapse multiple underscores
          .replace(/^_+|_+$/g, '')        // Remove leading/trailing underscores
          .slice(0, 30);                  // Limit length

        if (!sanitizedTitle) continue;     // Skip if title is invalid after sanitization
        
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

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'saveFile',
          groupName: group.title,
          content: JSON.stringify(groupData, null, 2),
          folderLocation: folderLocation
        }, resolve);
      });

      if (response?.error) {
        console.error(`Error syncing group ${group.title}:`, response.error);
      }
    }
    
    alert('Groups synced successfully!');
    await loadAllGroups();
  } catch (error) {
    console.error('Error syncing groups:', error);
    alert(`Failed to sync groups: ${error?.message || error || 'Unknown error'}`);
  }
}

async function saveGroup(groupId, group) {
  try {
    if (!group.title || !group.tabs || group.tabs.length === 0) {
      throw new Error('Invalid group data');
    }

    const data = await chrome.storage.local.get('savedGroups');
    const savedGroups = data.savedGroups || {};
    
    // Add timestamp to group
    group.savedAt = new Date().toISOString();
    
    // Sanitize the title
    const sanitizedTitle = group.title
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '_')  // Replace any non-alphanumeric char with underscore
      .replace(/_+/g, '_')            // Collapse multiple underscores
      .replace(/^_+|_+$/g, '')        // Remove leading/trailing underscores
      .slice(0, 30);                  // Limit length

    if (!sanitizedTitle) {
      throw new Error('Invalid group title after sanitization');
    }
    
    const savedGroupId = `${sanitizedTitle}_${Date.now()}`;
    
    // Store the group with its sanitized title
    const savedGroup = {
      ...group,
      title: sanitizedTitle
    };
    savedGroups[savedGroupId] = savedGroup;
    
    // Save to chrome.storage.local
    await chrome.storage.local.set({ 'savedGroups': savedGroups });
    
    // Prepare group data for file
    const groupData = {
      title: sanitizedTitle,
      savedAt: group.savedAt,
      tabs: group.tabs.map(tab => ({
        title: tab.title || 'Untitled',
        url: tab.url,
        favicon: tab.favicon || PLACEHOLDER_ICON
      }))
    };
    
    const { folderLocation } = await chrome.storage.local.get('folderLocation');
    if (!folderLocation) {
      alert('Please set a sync folder location in settings first');
      return;
    }

    if (!confirm(`This will save the group to: ${folderLocation}/tab_groups/\nContinue?`)) {
      return;
    }

    // Send message to background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'saveFile',
        groupName: sanitizedTitle,
        content: JSON.stringify(groupData, null, 2),
        folderLocation: folderLocation
      }, resolve);
    });

    if (!response) {
      throw new Error('No response from background script');
    }

    if (response?.error) {
      throw new Error(response.error);
    }
    
    alert('Group saved successfully!');
    await loadAllGroups();
  } catch (error) {
    console.error('Error saving group:', error);
    alert(`Failed to save group: ${error?.message || error || 'Unknown error'}`);
  }
}

async function deleteGroup(groupId) {
  if (!confirm('Are you sure you want to delete this group?')) return;
  
  try {
    const data = await chrome.storage.local.get('savedGroups');
    const savedGroups = data.savedGroups || {};
    
    delete savedGroups[groupId];
    await chrome.storage.local.set({ 'savedGroups': savedGroups });
    
    await loadAllGroups();
  } catch (error) {
    console.error('Error deleting group:', error);
    alert(`Failed to delete group: ${error?.message || error || 'Unknown error'}`);
  }
}

async function removeTabFromGroup(tabId, groupId) {
  if (confirm('Remove this tab from the group?')) {
    await chrome.tabs.ungroup(tabId);
    loadAllGroups();
  }
}

async function openSavedGroup(groupId, group) {
  const window = await chrome.windows.create({});
  
  const tabs = await Promise.all(
    group.tabs.map(tab => 
      chrome.tabs.create({
        url: tab.url,
        windowId: window.id
      })
    )
  );
  
  const groupIds = await chrome.tabs.group({
    tabIds: tabs.map(tab => tab.id)
  });
  
  await chrome.tabGroups.update(groupIds, {
    title: group.title
  });
  
  const [firstTab] = await chrome.tabs.query({ windowId: window.id });
  if (firstTab) {
    await chrome.tabs.remove(firstTab.id);
  }
}

async function removeTabFromSaved(groupId, tabIndex) {
  if (confirm('Remove this tab from the saved group?')) {
    const data = await chrome.storage.local.get('savedGroups');
    const savedGroups = data.savedGroups || {};
    
    if (savedGroups[groupId]) {
      savedGroups[groupId].tabs.splice(tabIndex, 1);
      
      if (savedGroups[groupId].tabs.length === 0) {
        delete savedGroups[groupId];
      }
      
      await chrome.storage.local.set({ 'savedGroups': savedGroups });
      await loadAllGroups();
    }
  }
}

async function exportGroups() {
  try {
    const data = await chrome.storage.local.get('savedGroups');
    if (!data.savedGroups) {
      alert('No groups to export');
      return;
    }

    const zip = new JSZip();
    const timestamp = getTimestamp();
    
    const allGroupsData = {};
    
    for (const [groupId, group] of Object.entries(data.savedGroups)) {
      allGroupsData[groupId] = {
        title: group.title,
        savedAt: group.savedAt,
        tabs: group.tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon
        }))
      };
    }
    
    zip.file('tab-groups.json', JSON.stringify(allGroupsData, null, 2));
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    
    const downloadId = await chrome.downloads.download({
      url: zipUrl,
      filename: `tab-groups-${timestamp}.zip`,
      saveAs: true
    });
    
    URL.revokeObjectURL(zipUrl);
    
  } catch (error) {
    console.error('Error exporting groups:', error);
    alert(`Failed to export groups: ${error?.message || error || 'Unknown error'}`);
  }
}

async function importGroups(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let groupData;
      
      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(e.target.result);
        const jsonFile = zipContent.file('tab-groups.json');
        
        if (!jsonFile) {
          throw new Error('Invalid ZIP file format: tab-groups.json not found');
        }
        
        const jsonContent = await jsonFile.async('text');
        groupData = JSON.parse(jsonContent);
      } else {
        groupData = JSON.parse(e.target.result);
      }
      
      Object.keys(groupData).forEach(key => {
        if (!groupData[key].savedAt) {
          groupData[key].savedAt = new Date().toISOString();
        }
      });
      
      const data = await chrome.storage.local.get('savedGroups');
      const existing = data.savedGroups || {};
      const merged = { ...existing, ...groupData };
      await chrome.storage.local.set({ 'savedGroups': merged });
      
      chrome.runtime.sendMessage({ type: 'groupsUpdated' });
      alert(`Successfully imported ${Object.keys(groupData).length} groups!`);
      
      event.target.value = '';
      
    } catch (error) {
      console.error('Error importing groups:', error);
      alert('Error importing groups: ' + error.message);
    }
  };
  
  if (file.name.endsWith('.zip')) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
}

function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}${second}`;
}
