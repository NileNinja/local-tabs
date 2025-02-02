import { showNotification } from './notification-system.js';
import { saveGroup, deleteGroup, removeTabFromGroup, openSavedGroup, removeTabFromSaved, openSavedTab } from './group-manager.js';

const PLACEHOLDER_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIGZpbGw9IiNFNEU0RTQiLz48L3N2Zz4=';

export function displayGroups(groupedTabs, container, isCurrentWindow) {
  const entries = Object.entries(groupedTabs);
  
  if (entries.length === 0 && !isCurrentWindow) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.48 2.54l2.6 1.53c.56-1.24.88-2.62.88-4.07 0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53C16.17 17.98 14.21 19 12 19z"/>
      </svg>
      <div class="empty-state-text">No saved groups yet. Save a group of tabs to see them here.</div>
    `;
    
    container.appendChild(emptyState);
    return;
  }

  entries.forEach(([groupId, group]) => {
    const groupElement = createGroupElement(groupId, group, isCurrentWindow);
    container.appendChild(groupElement);
  });
}

export function createGroupElement(groupId, group, isCurrentWindow) {
  const groupDiv = document.createElement('div');
  groupDiv.className = 'group-container';
  
  const header = createGroupHeader(groupId, group, isCurrentWindow, groupDiv);
  groupDiv.appendChild(header);
  
  const tabList = createTabList(group, isCurrentWindow, groupId);
  groupDiv.appendChild(tabList);
  
  return groupDiv;
}

function createGroupHeader(groupId, group, isCurrentWindow, groupDiv) {
  const header = document.createElement('div');
  header.className = 'group-header';
  
  const titleContainer = document.createElement('div');
  titleContainer.className = 'title-container';
  
  const title = createTitleInput(groupId, group, isCurrentWindow);
  titleContainer.appendChild(title);
  
  if (group.savedAt) {
    const timestamp = document.createElement('div');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date(group.savedAt).toLocaleString();
    titleContainer.appendChild(timestamp);
  }
  
  const buttonContainer = createButtonContainer(groupId, group, isCurrentWindow, groupDiv);
  
  header.appendChild(titleContainer);
  header.appendChild(buttonContainer);
  
  return header;
}

function createTitleInput(groupId, group, isCurrentWindow) {
  const title = document.createElement('input');
  title.type = 'text';
  title.value = group.title || 'New Tab Group';
  title.className = 'group-title';
  
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
            showNotification('Failed to update tab group title: ' + tabGroupError.message);
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
      showNotification('Failed to update group name: ' + error.message);
      title.value = group.title || 'New Tab Group';
    }
  });
  
  return title;
}

function createButtonContainer(groupId, group, isCurrentWindow, groupDiv) {
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
        title: groupDiv.querySelector('.group-title').value,
        tabs: selectedTabs
      });
    } else {
      openSavedGroup(groupId, { 
        ...group, 
        title: groupDiv.querySelector('.group-title').value 
      });
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
  
  return buttonContainer;
}

function createTabList(group, isCurrentWindow, groupId) {
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
    
    const tabActions = createTabActions(tab, index, groupId, isCurrentWindow, group);
    if (tabActions) {
      tabDiv.appendChild(tabActions);
    }
    
    tabList.appendChild(tabDiv);
  });
  
  return tabList;
}

function createTabActions(tab, index, groupId, isCurrentWindow, group) {
  if ((!isCurrentWindow && group.savedAt) || (isCurrentWindow && groupId !== 'ungrouped' && group.savedAt)) {
    const tabActions = document.createElement('div');
    tabActions.className = 'tab-actions';

    if (!isCurrentWindow) {
      const openTabBtn = document.createElement('button');
      openTabBtn.className = 'open-tab-btn';
      openTabBtn.title = 'Open tab';
      openTabBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
        </svg>
      `;
      openTabBtn.addEventListener('click', () => openSavedTab(tab));
      tabActions.appendChild(openTabBtn);
    }
    
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
    return tabActions;
  }
  
  return null;
}
