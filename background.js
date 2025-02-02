// Handle storage operations and message broadcasting
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'verifyFolder') {
    // Verify folder exists and is writable
    verifyFolder(message.path)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true;
  }
  
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

// Verify folder exists and is writable, create if doesn't exist
async function verifyFolder(path) {
  try {
    if (!path) {
      throw new Error('No folder path provided');
    }

    // Validate and normalize the path for Windows
    const normalizedPath = path
      .trim()
      .replace(/[/\\]+/g, '\\') // Convert all slashes to backslashes
      .replace(/\\+$/, ''); // Remove trailing slashes

    // Basic path validation
    if (!/^[a-zA-Z]:\\/.test(normalizedPath)) {
      throw new Error('Invalid folder path format');
    }

    console.log('Verifying folder:', normalizedPath);
    
    // Create a test file in the directory using a data URL with proper encoding
    const testContent = 'test';
    const testEncoder = new TextEncoder();
    const testData = testEncoder.encode(testContent);
    const testUrl = `data:text/plain;base64,${btoa(String.fromCharCode(...testData))}`;
    
    // Create a valid test filename
    const timestamp = Date.now();
    const testPath = `${normalizedPath}\\test_${timestamp}.txt`.replace(/[<>:"|?*]/g, '_');
    console.log('Testing with path:', testPath);
    
    // Convert Windows absolute path to relative path for Chrome downloads
    const relativePath = testPath.replace(/^([A-Za-z]):\\/, '');
    console.log('Using relative path:', relativePath);
    
    const downloadId = await chrome.downloads.download({
      url: testUrl,
      filename: relativePath.replace(/\\/g, '/'), // Chrome downloads API expects forward slashes
      conflictAction: 'uniquify',
      saveAs: false
    });

    if (!downloadId) {
      throw new Error('Download failed to initialize');
    }

    // Wait for download to complete
    await new Promise((resolve, reject) => {
      chrome.downloads.onChanged.addListener(function listener(delta) {
        if (delta.id === downloadId) {
          if (delta.state?.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            resolve();
          } else if (delta.error) {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error(`Download failed: ${delta.error.current}`));
          }
        }
      });
    });

    // Clean up test file
    await chrome.downloads.removeFile(downloadId);
    await chrome.downloads.erase({ id: downloadId });

    return true;
  } catch (error) {
    console.error('Folder verification failed:', error);
    throw new Error(`Unable to access folder: ${error.message}`);
  }
}

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

    // Enhanced filename sanitization for Windows compatibility
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
    
    // Validate and normalize base path
    const basePath = message.folderLocation || '';
    if (!basePath) {
      throw new Error('Save location not set. Please set a folder location in settings first.');
    }

    // Validate and normalize the path for Windows
    const normalizedPath = basePath
      .trim()
      .replace(/[/\\]+/g, '\\') // Convert all slashes to backslashes
      .replace(/\\+$/, ''); // Remove trailing slashes

    // Basic path validation
    if (!/^[a-zA-Z]:\\/.test(normalizedPath)) {
      throw new Error('Invalid folder path format');
    }

    const groupsFolderName = 'tab_groups';
    const groupsPath = `${normalizedPath}\\${groupsFolderName}`;

    // Log paths for debugging
    console.log('Base path:', basePath);
    console.log('Normalized path:', normalizedPath);
    console.log('Groups path:', groupsPath);

    // First create a test file in the tab_groups directory to ensure it exists
    const testContent = 'test';
    const testEncoder = new TextEncoder();
    const testData = testEncoder.encode(testContent);
    const testUrl = `data:text/plain;base64,${btoa(String.fromCharCode(...testData))}`;
    
    const testPath = `${groupsPath}\\test_${Date.now()}.txt`.replace(/[<>:"|?*]/g, '_');
    console.log('Creating test file to verify directory:', testPath);
    
    // Convert Windows absolute path to relative path for Chrome downloads
    const relativeTestPath = testPath.replace(/^([A-Za-z]):\\/, '');
    console.log('Using relative test path:', relativeTestPath);
    
    const testDownloadId = await chrome.downloads.download({
      url: testUrl,
      filename: relativeTestPath.replace(/\\/g, '/'),
      saveAs: false,
      conflictAction: 'uniquify'
    });

    // Wait for test file to complete
    await new Promise((resolve, reject) => {
      chrome.downloads.onChanged.addListener(function listener(delta) {
        if (delta.id === testDownloadId) {
          if (delta.state?.current === 'complete') {
            chrome.downloads.onChanged.removeListener(listener);
            resolve();
          } else if (delta.error) {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error(`Failed to create directory: ${delta.error.current}`));
          }
        }
      });
    });

    // Clean up test file
    await chrome.downloads.removeFile(testDownloadId);
    await chrome.downloads.erase({ id: testDownloadId });

    // Now save the actual file
    const filename = `${groupsPath}\\${sanitizedName}_${timestamp}.json`.replace(/[<>:"|?*]/g, '_');
    console.log('Saving file to:', filename);

    // Create data URL for the file with proper encoding
    const contentEncoder = new TextEncoder();
    const contentData = contentEncoder.encode(message.content);
    const dataUrl = `data:application/json;base64,${btoa(String.fromCharCode(...contentData))}`;
    
    // Save the file
    // Convert Windows absolute path to relative path for Chrome downloads
    const relativeFilename = filename.replace(/^([A-Za-z]):\\/, '');
    console.log('Using relative filename:', relativeFilename);
    
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: relativeFilename.replace(/\\/g, '/'),
      saveAs: false,
      conflictAction: 'uniquify'
    });

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
