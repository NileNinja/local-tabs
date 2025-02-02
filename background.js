// Handle storage operations and message broadcasting
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveFile') {
    handleFileSave(message, sendResponse);
    return true;
  }
});

// Enhanced storage listener for real-time updates
chrome.storage.onChanged.addListener((changes) => {
  if (changes.savedGroups) {
    // Broadcast to all open popups
    chrome.runtime.sendMessage({
      type: 'groupsUpdated',
      groups: changes.savedGroups.newValue
    });
  }
});

async function handleFileSave(message, sendResponse) {
  try {
    // Create timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedGroupName = message.groupName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `tab-groups/${sanitizedGroupName}_${timestamp}.json`;

    // Convert content to data URL
    const jsonString = message.content;
    const dataUrl = `data:application/json;base64,${btoa(unescape(encodeURIComponent(jsonString)))}`;
    
    try {
      await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false
      });

      sendResponse({ success: true, path: filename });
    } catch (downloadError) {
      console.error('Download error:', downloadError);
      sendResponse({ error: downloadError.message });
    }
  } catch (error) {
    console.error('Error saving file:', error);
    sendResponse({ error: error.message });
  }
}
