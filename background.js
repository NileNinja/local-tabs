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
    // Validate required fields
    if (!message.groupName || !message.content) {
      throw new Error('Missing required data: groupName or content');
    }

    // Sanitize the filename - strict alphanumeric only
    let sanitizedName = message.groupName
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace any non-alphanumeric char with underscore
      .replace(/_+/g, '_')           // Collapse multiple underscores
      .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
      .slice(0, 30);                 // Limit length

    if (!sanitizedName) {
      sanitizedName = 'unnamed_group';
    }

    // Create a simple timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/[T.Z]/g, '_')
      .slice(0, 15);
    
    // Create filename with folder location
    const filename = message.folderLocation ? 
      `${message.folderLocation}/tab_groups/${sanitizedName}_${timestamp}.json` :
      `tab_groups/${sanitizedName}_${timestamp}.json`;

    try {
      // Convert content to data URL
      const jsonString = message.content;
      const dataUrl = `data:application/json;base64,${btoa(unescape(encodeURIComponent(jsonString)))}`;

      // Attempt the download
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: message.saveAs || false,
        conflictAction: 'uniquify'
      });

      if (!downloadId) {
        throw new Error('Download operation failed to start');
      }

      sendResponse({ 
        success: true, 
        path: filename,
        sanitizedName,
        timestamp 
      });
    } catch (downloadError) {
      throw new Error(`Download failed: ${downloadError.message}`);
    }
  } catch (error) {
    console.error('Error in handleFileSave:', error);
    sendResponse({ 
      error: error.message,
      details: {
        message: error.message,
        stack: error.stack
      }
    });
  }
}
