document.addEventListener('DOMContentLoaded', async () => {
  await loadAllGroups();
  setupEventListeners();
  setupMessageListener();
});

function setupMessageListener() {
  // Add real-time updates through message listeners
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'groupsUpdated') {
      // Reload only saved groups to avoid disrupting current window view
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
    const windowDiv = document.createElement('div');
    windowDiv.className = 'window-container';
    
    const windowTitle = document.createElement('div');
    windowTitle.className = 'section-title';
    windowTitle.textContent = window.title || `Window ${window.id}`;
    windowDiv.appendChild(windowTitle);
    
    const groupedTabs = organizeTabsByGroup(window.tabs, tabGroups);
    displayGroups(groupedTabs, windowDiv, true);
    
    container.appendChild(windowDiv);
  }
}

async function loadSavedGroups() {
  const container = document.getElementById('saved-groups');
  container.innerHTML = '';
  
  const data = await chrome.storage.local.get('savedGroups');
  if (data.savedGroups) {
    // Sort groups by timestamp, newest first
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

function organizeTabsByGroup(tabs, groups) {
  const groupedTabs = {};
  
  // Initialize groups
  groups.forEach(group => {
    groupedTabs[group.id] = {
      title: group.title || 'Unnamed Group',
      tabs: []
    };
  });
  
  // Add ungrouped tabs
  groupedTabs['ungrouped'] = {
    title: 'Ungrouped Tabs',
    tabs: []
  };
  
  // Organize tabs into groups
  tabs.forEach(tab => {
    const groupId = tab.groupId !== -1 ? tab.groupId : 'ungrouped';
    if (!groupedTabs[groupId]) {
      groupedTabs[groupId] = {
        title: 'New Group',
        tabs: []
      };
    }
    groupedTabs[groupId].tabs.push({
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl || PLACEHOLDER_ICON
    });
  });
  
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
  title.value = group.title || 'Unnamed Group';
  title.className = 'group-title';
  titleContainer.appendChild(title);
  
  if (group.savedAt) {
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date(group.savedAt).toLocaleString();
    titleContainer.appendChild(timestamp);
  }
  
  // Handle group renaming
  title.addEventListener('change', async () => {
    const newTitle = title.value.trim() || 'Unnamed Group';
    title.value = newTitle;
    
    try {
      if (isCurrentWindow && groupId !== 'ungrouped') {
        await chrome.tabGroups.update(parseInt(groupId), { title: newTitle });
      }
      
      const data = await chrome.storage.local.get('savedGroups');
      const savedGroups = data.savedGroups || {};
      if (savedGroups[groupId]) {
        savedGroups[groupId].title = newTitle;
        await chrome.storage.local.set({ 'savedGroups': savedGroups });
      }
    } catch (error) {
      console.error('Error updating group name:', error);
      title.value = group.title || 'Unnamed Group';
    }
  });
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  
  const actionButton = document.createElement('button');
  actionButton.textContent = isCurrentWindow ? 'Save Group' : 'Open Group';
  actionButton.className = 'action-button';
  actionButton.addEventListener('click', () => {
    if (isCurrentWindow) {
      // Get selected tabs from checkboxes
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
  
  // Only show delete button for saved groups (groups with savedAt timestamp)
  if (!isCurrentWindow && group.savedAt) {
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete Group';
    deleteButton.className = 'delete-button';
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
    
    // Only show remove button for saved groups
    if ((isCurrentWindow && groupId !== 'ungrouped') || (!isCurrentWindow && group.savedAt)) {
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
  document.getElementById('saveAll').addEventListener('click', saveAllGroups);
  document.getElementById('refreshGroups').addEventListener('click', loadAllGroups);
  document.getElementById('exportGroups').addEventListener('click', exportGroups);
  document.getElementById('importGroups').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importGroups);
  
  // Settings panel
  const settingsPanel = document.getElementById('settingsPanel');
  const toggleSettings = document.getElementById('toggleSettings');

  toggleSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
  });
}

async function saveAllGroups() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const groups = await chrome.tabGroups.query({});
    
    let allGroups = {};
    for (const window of windows) {
      const groupedTabs = organizeTabsByGroup(window.tabs, groups);
      allGroups = { ...allGroups, ...groupedTabs };
    }
    
    // Add timestamp to all groups
    Object.keys(allGroups).forEach(key => {
      allGroups[key].savedAt = new Date().toISOString();
    });
    
    // Save to chrome.storage.local
    await chrome.storage.local.set({ 'savedGroups': allGroups });
    
    // Save each group to a separate file
    for (const [groupId, group] of Object.entries(allGroups)) {
      const groupData = {
        title: group.title,
        savedAt: group.savedAt,
        tabs: group.tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon
        }))
      };

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'saveFile',
          groupName: group.title || 'unnamed-group',
          content: JSON.stringify(groupData, null, 2)
        }, resolve);
      });

      if (response?.error) {
        console.error(`Error saving group ${group.title}:`, response.error);
      }
    }
    
    alert('Groups saved successfully!');
    await loadAllGroups();
  } catch (error) {
    console.error('Error saving groups:', error);
    alert(`Failed to save groups: ${error?.message || error || 'Unknown error'}`);
  }
}

async function saveGroup(groupId, group) {
  try {
    const data = await chrome.storage.local.get(['savedGroups', 'saveDirectory']);
    const savedGroups = data.savedGroups || {};
    
    // Add timestamp to group
    group.savedAt = new Date().toISOString();
    
    // Generate a unique ID for the group if it's being saved for the first time
    const savedGroupId = `${groupId}_${Date.now()}`;
    savedGroups[savedGroupId] = group;
    
    // Save to chrome.storage.local
    await chrome.storage.local.set({ 'savedGroups': savedGroups });
    
    // Prepare group data for file
    const groupData = {
      title: group.title,
      savedAt: group.savedAt,
      tabs: group.tabs.map(tab => ({
        title: tab.title,
        url: tab.url,
        favicon: tab.favicon
      }))
    };
    
    // Save to file
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'saveFile',
        groupName: group.title || 'unnamed-group',
        content: JSON.stringify(groupData, null, 2)
      }, resolve);
    });

    if (response?.error) {
      throw new Error(response.error);
    }
    
    if (response.path) {
      alert(`Group saved successfully!\nSaved to: Downloads/${response.path}`);
    } else {
      alert('Group saved successfully!');
    }
    
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
  
  // Remove the empty tab created with the new window
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
      
      // Save the updated groups
      await chrome.storage.local.set({ 'savedGroups': savedGroups });
      
      // Force a complete reload of all groups
      await loadAllGroups();
    }
  }
}

async function exportGroups() {
  try {
    const data = await chrome.storage.local.get('savedGroups');
    if (!data.savedGroups) return;

    // Export each group to a separate file
    for (const [groupId, group] of Object.entries(data.savedGroups)) {
      const groupData = {
        title: group.title,
        savedAt: group.savedAt,
        tabs: group.tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon
        }))
      };

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'saveFile',
          groupName: group.title || 'unnamed-group',
          content: JSON.stringify(groupData, null, 2)
        }, resolve);
      });

      if (response?.error) {
        console.error(`Error exporting group ${group.title}:`, response.error);
      }
    }
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
      const groupData = JSON.parse(e.target.result);
      
      // Add timestamps to imported groups if they don't have one
      Object.keys(groupData).forEach(key => {
        if (!groupData[key].savedAt) {
          groupData[key].savedAt = new Date().toISOString();
        }
      });
      
      const {groups: existing} = await chrome.storage.local.get('groups');
      const merged = {...existing, ...groupData};
      await chrome.storage.local.set({ 'savedGroups': merged });
      chrome.runtime.sendMessage({ type: 'groupsUpdated' });
      alert(`Successfully imported ${Object.keys(groupData).length} groups!`);
    } catch (error) {
      alert('Error importing groups: ' + error.message);
    }
  };
  reader.readAsText(file);
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
