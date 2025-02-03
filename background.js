// Handle storage operations and message broadcasting
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveFile') {
    // Immediately acknowledge receipt of message
    sendResponse({ received: true });
    
    // Process the save operation
    handleFileSave(message)
      .then(result => {
        // Send result through a new message since the original connection might be gone
        chrome.runtime.sendMessage({
          type: 'saveFileComplete',
          groupTitle: message.groupTitle,
          result: { success: true, ...result }
        }).catch(() => {
          // Ignore errors from sending completion message
          // The popup will handle timeouts
        });
      })
      .catch(error => {
        console.error('Error in handleFileSave:', error);
        const errorMessage = error.message || (error.details?.message) || 
          (typeof error === 'string' ? error : 'Unknown error');
        
        chrome.runtime.sendMessage({
          type: 'saveFileComplete',
          groupTitle: message.groupTitle,
          result: {
            error: errorMessage,
            details: {
              message: errorMessage,
              stack: error.stack
            }
          }
        }).catch(() => {
          // Ignore errors from sending completion message
          // The popup will handle timeouts
        });
      });
    
    return true; // Keep the message channel open for the immediate acknowledgment
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

async function handleFileSave(message) {
  try {
    // Validate required fields
    if (!message.groupName || !message.content) {
      throw new Error('Missing required data: groupName or content');
    }

    // Sanitize filename for Windows compatibility
    let sanitizedName = message.groupName
      .trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      // Replace Windows invalid characters and common problematic characters
      .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')
      // Allow hyphens and underscores, replace other non-alphanumerics
      .replace(/[^a-zA-Z0-9\-_]/g, '_')
      // Collapse multiple underscores/hyphens
      .replace(/[-_]+/g, '_')
      // Remove leading/trailing underscores/hyphens
      .replace(/^[-_]+|[-_]+$/g, '')
      // Convert to lowercase for consistency
      .toLowerCase()
      // Increase length limit
      .slice(0, 50)
      // Final trim in case normalization added spaces
      .trim();

    if (!sanitizedName) {
      console.warn('Generated empty filename for group:', message.groupName);
      sanitizedName = `unnamed_group_${Date.now()}`;
    }

    // Handle empty or invalid names
    if (!sanitizedName) {
      sanitizedName = 'unnamed_group';
    }

    // Handle Windows reserved names
    const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
    if (reservedNames.test(sanitizedName)) {
      sanitizedName = `tab_${sanitizedName}`;
    }

    // Create a simple timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/[T.Z]/g, '_')
      .slice(0, 15);
    
    // Create data URL for the file with proper encoding
    const contentEncoder = new TextEncoder();
    const contentData = contentEncoder.encode(message.content);
    const dataUrl = `data:application/json;base64,${btoa(String.fromCharCode(...contentData))}`;
    
    // Prepare and save the file in local-tabs folder
    const filename = `local-tabs/${sanitizedName}_${timestamp}.json`;
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });
    console.log('Saving file:', filename);

    if (!downloadId) {
      throw new Error('Failed to initialize file download');
    }

    // Wait for file save to complete
    const finalPath = await new Promise((resolve, reject) => {
      chrome.downloads.onChanged.addListener(function listener(delta) {
        if (delta.id === downloadId) {
          if (delta.state?.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            chrome.downloads.search({ id: downloadId }, ([item]) => {
              resolve(item.filename);
            });
          } else if (delta.error) {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error(`File save failed: ${delta.error.current}`));
          }
        }
      });
    });

    console.log('File saved successfully at:', finalPath);
    return { 
      success: true, 
      path: finalPath,
      sanitizedName,
      timestamp 
    };
  } catch (error) {
    console.error('Error in handleFileSave:', error);
    throw {
      error: error.message,
      details: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}
