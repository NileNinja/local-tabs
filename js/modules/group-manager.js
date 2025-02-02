import { showNotification } from './notification-system.js';

const PLACEHOLDER_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIGZpbGw9IiNFNEU0RTQiLz48L3N2Zz4=';

export async function saveGroup(groupId, group) {
  try {
    if (!group.title || !group.tabs || group.tabs.length === 0) {
      throw new Error('Invalid group data');
    }

    const data = await chrome.storage.local.get('savedGroups');
    const savedGroups = data.savedGroups || {};
    
    // Add timestamp to group
    group.savedAt = new Date().toISOString();
    
    // Sanitize the title
    const sanitizedTitle = sanitizeTitle(group.title);
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
      showNotification('Please set a sync folder location in settings first');
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
    
    showNotification('Group saved successfully!', 'success');
    return true;
  } catch (error) {
    console.error('Error saving group:', error);
    showNotification(`Failed to save group: ${error?.message || error || 'Unknown error'}`);
    return false;
  }
}

export async function deleteGroup(groupId) {
  if (!confirm('Are you sure you want to delete this group?')) return false;
  
  try {
    const data = await chrome.storage.local.get('savedGroups');
    const savedGroups = data.savedGroups || {};
    
    delete savedGroups[groupId];
    await chrome.storage.local.set({ 'savedGroups': savedGroups });
    
    showNotification('Group deleted successfully!', 'success');
    return true;
  } catch (error) {
    console.error('Error deleting group:', error);
    showNotification(`Failed to delete group: ${error?.message || error || 'Unknown error'}`);
    return false;
  }
}

export async function removeTabFromGroup(tabId, groupId) {
  if (!confirm('Remove this tab from the group?')) return false;
  
  try {
    await chrome.tabs.ungroup(tabId);
    showNotification('Tab removed from group', 'success');
    return true;
  } catch (error) {
    console.error('Error removing tab from group:', error);
    showNotification(`Failed to remove tab: ${error.message}`);
    return false;
  }
}

export async function openSavedGroup(groupId, group) {
  try {
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
    
    showNotification('Group opened successfully!', 'success');
    return true;
  } catch (error) {
    console.error('Error opening group:', error);
    showNotification(`Failed to open group: ${error.message}`);
    return false;
  }
}

export async function removeTabFromSaved(groupId, tabIndex) {
  if (!confirm('Remove this tab from the saved group?')) return false;
  
  try {
    const data = await chrome.storage.local.get('savedGroups');
    const savedGroups = data.savedGroups || {};
    
    if (savedGroups[groupId]) {
      savedGroups[groupId].tabs.splice(tabIndex, 1);
      
      if (savedGroups[groupId].tabs.length === 0) {
        delete savedGroups[groupId];
      }
      
      await chrome.storage.local.set({ 'savedGroups': savedGroups });
      showNotification('Tab removed successfully!', 'success');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error removing tab:', error);
    showNotification(`Failed to remove tab: ${error.message}`);
    return false;
  }
}

export function organizeTabsByGroup(tabs, groups, window) {
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

function sanitizeTitle(title) {
  return title
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '_')  // Replace any non-alphanumeric char with underscore
    .replace(/_+/g, '_')            // Collapse multiple underscores
    .replace(/^_+|_+$/g, '')        // Remove leading/trailing underscores
    .slice(0, 30);                  // Limit length
}
