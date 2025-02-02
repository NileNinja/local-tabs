let saveDirectory = 'C:/Users/Azazy/Documents/saved-tabs';

// Initialize save directory from storage with default
chrome.storage.local.get('saveDirectory', (data) => {
  saveDirectory = data.saveDirectory || 'C:/Users/Azazy/Documents/saved-tabs';
  if (!data.saveDirectory) {
    chrome.storage.local.set({ saveDirectory });
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedGroupName = request.groupName.replace(/[^a-zA-Z0-9-]/g, '_');
      
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
        const enhancedTabs = request.content.tabs.map(tab => ({
          ...tab,
          favIconUrl: tab.favIconUrl || 'placeholder-icon.png',
          savedAt: new Date().toISOString()
        }));

        const groupData = {
          ...request.content,
          tabs: enhancedTabs,
          savedAt: new Date().toISOString(),
          path: saveDirectory
        };

        chrome.fileSystem.getWritableEntry(saveDirectory, (directoryEntry) => {
          if (!directoryEntry) {
            sendResponse({ error: 'No valid directory selected' });
            return;
          }

          directoryEntry.getFile(uniqueFilename, { create: true }, (fileEntry) => {
            fileEntry.createWriter((writer) => {
              writer.onwriteend = () => {
                sendResponse({ success: true, path: fileEntry.fullPath });
              };
              
              writer.onerror = (error) => {
                sendResponse({ error: error.toString() });
              };

              const blob = new Blob([JSON.stringify(groupData)], { type: 'application/json' });
              writer.write(blob);
            });
          });
        });
      }).then(() => {
        chrome.runtime.sendMessage({type: 'groupsUpdated'});
      });
    } catch (error) {
      sendResponse({ error: error.message });
    }
    return true;
  }

  if (request.action === 'deleteGroup') {
    if (!saveDirectory) {
      sendResponse({ error: 'No save directory configured' });
      return false;
    }

    const filePath = `${saveDirectory}/${request.filename}`;
    
    chrome.fileSystem.getWritableEntry(filePath, (entry) => {
      if (!entry) {
        sendResponse({ error: 'File not found' });
        return;
      }

      entry.remove(() => {
        sendResponse({ success: true });
      }, (error) => {
        sendResponse({ error: error.message });
      });
    });
    return true;
  }
});
