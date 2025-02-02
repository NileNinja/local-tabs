import { showNotification } from './notification-system.js';
import { t } from './translations.js';

export async function exportGroups() {
  try {
    const data = await chrome.storage.local.get('savedGroups');
    if (!data.savedGroups) {
      showNotification('noGroupsToExport');
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
    
    try {
      // Generate base64 data
      const zipBase64 = await zip.generateAsync({ type: 'base64' });
      const dataUrl = 'data:application/zip;base64,' + zipBase64;
      
      // Get user's preferred save path from storage
      const { savePath } = await chrome.storage.local.get('savePath');
      
      let downloadId;
      if (savePath) {
        // First try the full path
        const fullPath = `${savePath.replace(/\\/g, '/')}`;
        try {
          downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename: `${fullPath}/tab-groups-${timestamp}.zip`,
            saveAs: false,
            conflictAction: 'uniquify'
          });
          console.log('Successfully saved to full path:', fullPath);
        } catch (error) {
          // If full path fails, fall back to Downloads subfolder
          console.log('Full path save failed, falling back to Downloads:', error);
          const folderName = savePath.split(/[/\\]/).pop();
          downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename: `local-tabs/tab-groups-${timestamp}.zip`,
            saveAs: false,
            conflictAction: 'uniquify'
          });
        }
      } else {
        downloadId = await chrome.downloads.download({
          url: dataUrl,
          filename: `local-tabs/tab-groups-${timestamp}.zip`,
          saveAs: false,
          conflictAction: 'uniquify'
        });
      }
      showNotification('groupsExported', 'success');
      
    } catch (blobError) {
      console.error('Blob/URL handling error:', blobError);
      throw new Error(t('zipError', blobError.message || 'Unknown error'));
    }
    
  } catch (error) {
    console.error('Error exporting groups:', error);
    showNotification('exportError', 'error', error?.message || 'Unknown error');
  }
}

export async function importGroups(file) {
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let groupData;
      
      if (file.name.endsWith('.zip')) {
        try {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(e.target.result);
          const jsonFile = zipContent.file('tab-groups.json');
          
          if (!jsonFile) {
            throw new Error(t('invalidZip'));
          }
          
          const jsonContent = await jsonFile.async('text');
          groupData = JSON.parse(jsonContent);
        } catch (zipError) {
          console.error('ZIP processing error:', zipError);
          throw new Error(t('zipError', zipError.message || 'Unknown error'));
        }
      } else {
        try {
          groupData = JSON.parse(e.target.result);
        } catch (jsonError) {
          throw new Error(t('jsonError', jsonError.message || 'Unknown error'));
        }
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
      showNotification('groupsImported', 'success', Object.keys(groupData).length);
      
      return true;
    } catch (error) {
      console.error('Error importing groups:', error);
      showNotification('importError', 'error', error.message);
      return false;
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
