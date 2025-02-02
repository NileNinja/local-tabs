let saveDirectory = '';

// Initialize save directory from storage
chrome.storage.local.get('saveDirectory', (data) => {
  if (data.saveDirectory) {
    saveDirectory = data.saveDirectory;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setSaveDirectory') {
    saveDirectory = request.directory;
    chrome.storage.local.set({ saveDirectory });
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'getSaveDirectory') {
    sendResponse({ directory: saveDirectory });
    return false;
  }

  if (request.action === 'saveFile') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      const sanitizedGroupName = request.groupName.replace(/[^a-zA-Z0-9-]/g, '_');
      
      // Create a unique filename by including a counter if needed
      let counter = 1;
      let filename = `${sanitizedGroupName}_${timestamp}.json`;
      
      const checkFileExists = (filename) => {
        return new Promise((resolve) => {
          chrome.downloads.search({ filename }, (results) => {
            resolve(results.length > 0);
          });
        });
      };
      
      const getUniqueFilename = async () => {
        while (await checkFileExists(filename)) {
          filename = `${sanitizedGroupName}_${timestamp}_${counter++}.json`;
        }
        return filename;
      };
      
      getUniqueFilename().then(uniqueFilename => {
        const blob = new Blob([request.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadOptions = {
          url: url,
          filename: saveDirectory ? `${saveDirectory}/${uniqueFilename}` : uniqueFilename,
          saveAs: !saveDirectory // Only show save dialog if no directory is set
        };

        chrome.downloads.download(downloadOptions, (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            URL.revokeObjectURL(url);
            return;
          }

          chrome.downloads.onChanged.addListener(function listener(delta) {
            if (delta.id === downloadId) {
              if (delta.state?.current === 'complete') {
                chrome.downloads.onChanged.removeListener(listener);
                sendResponse({ success: true, path: downloadOptions.filename });
              } else if (delta.error) {
                chrome.downloads.onChanged.removeListener(listener);
                // If saving to directory fails, try again with save dialog
                if (!downloadOptions.saveAs) {
                  downloadOptions.saveAs = true;
                  downloadOptions.filename = uniqueFilename;
                  chrome.downloads.download(downloadOptions);
                } else {
                  sendResponse({ error: delta.error.current });
                }
              }
              URL.revokeObjectURL(url);
            }
          });
        });
      });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true;
  }
});
