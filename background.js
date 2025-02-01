let defaultSaveDirectory = '';

// Get default save directory based on OS
function getDefaultSaveDirectory() {
  if (navigator.platform.toLowerCase().includes('win')) {
    return `${process.env.USERPROFILE}\\Documents\\saved-tabs`;
  } else {
    return `${process.env.HOME}/saved-tabs`;
  }
}

// Initialize default directory
chrome.runtime.onInstalled.addListener(() => {
  defaultSaveDirectory = getDefaultSaveDirectory();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chooseDirectory') {
    chrome.fileSystem.chooseEntry({
      type: 'openDirectory',
      suggestedName: defaultSaveDirectory
    }, (entry) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      if (entry) {
        entry.getDirectory(entry.fullPath, {}, (dirEntry) => {
          defaultSaveDirectory = dirEntry.fullPath;
          sendResponse({ success: true, directory: defaultSaveDirectory });
        }, (error) => {
          sendResponse({ error: error.message });
        });
      }
    });
    return true;
  }
  
  if (request.action === 'saveFile') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      const filename = request.filename.replace('.json', `_${timestamp}.json`);
      const fullPath = defaultSaveDirectory ? 
        `${defaultSaveDirectory}/${filename}` : 
        filename;
      
      const blob = new Blob([request.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: fullPath,
        saveAs: !defaultSaveDirectory // Only show save dialog if no default directory
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          URL.revokeObjectURL(url);
          return;
        }

        chrome.downloads.onChanged.addListener(function listener(delta) {
          if (delta.id === downloadId) {
            if (delta.state?.current === 'complete') {
              chrome.downloads.onChanged.removeListener(listener);
              sendResponse({ success: true, path: fullPath });
            } else if (delta.error) {
              chrome.downloads.onChanged.removeListener(listener);
              sendResponse({ error: delta.error.current });
            }
            URL.revokeObjectURL(url);
          }
        });
      });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true;
  }

  if (request.action === 'getDefaultDirectory') {
    sendResponse({ directory: defaultSaveDirectory });
    return false;
  }
});
