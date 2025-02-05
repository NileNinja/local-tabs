# Local Tabs - Chrome Extension

A powerful Chrome extension that allows you to save and organize your browser tabs locally. Save your tab groups with favicons and timestamps, and easily restore them later.

## Features

- 🎯 Save individual tab groups or all groups at once
- 🕒 Automatic timestamping of saved groups
- 🖼️ Save favicons for easy visual recognition
- 🔄 Import/Export functionality
- 🗑️ Easy deletion of saved groups
- 📝 Rename groups on the fly
- 🔍 View full URLs and titles

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `local-tabs` directory

## Usage

### Basic Operations

1. **Saving Tab Groups**
   - Click the extension icon to open the popup
   - Current tab groups will be shown at the top
   - Click "Save Group" on any group to save it
   - Click "Save All Groups" to save all groups at once

2. **Managing Saved Groups**
   - View all saved groups in the "Saved Groups" section
   - Each group shows:
     - Group name (editable)
     - Save timestamp
     - List of tabs with favicons and URLs
   - Use "Delete Group" to remove a saved group
   - Use "Open Group" to restore tabs in a new window

### Advanced Features

1. **Import/Export**
   - Use "Export" to save all groups to ZIP files in your browser's default download location
   - Use "Import" to restore previously exported groups
   - Groups are exported with timestamps and all metadata preserved

2. **Language Settings**
   - Switch between English and Arabic interfaces
   - Language preference is saved automatically
   - Access language settings through the ⚙️ settings menu

3. **Group Management**
   - Rename groups by clicking the group title
   - Remove individual tabs using the trash icon
   - Groups are automatically sorted by save time

## File Structure

```
local-tabs/
├── manifest.json           # Extension configuration (Manifest V3)
├── popup.html             # Main UI
├── background.js          # Service worker for background processes
├── js/
│   ├── popup.js          # Main popup logic
│   └── modules/          # Modular JavaScript components
│       ├── event-handlers.js
│       ├── file-operations.js
│       ├── group-manager.js
│       ├── notification-system.js
│       ├── translations.js
│       └── ui-components.js
├── lib/
│   └── jszip.min.js      # ZIP file handling library
├── styles/
│   └── popup.css         # UI styling
└── icons/
    ├── cat.svg           # UI icons
    └── icon48.svg        # Extension icon
```

## Saved Data Format

Each group is saved as a JSON file with the following structure:

```json
{
  "title": "Group Name",
  "savedAt": "2025-02-02T00:00:00.000Z",
  "tabs": [
    {
      "title": "Tab Title",
      "url": "https://example.com",
      "favicon": "data:image/..."
    }
    // ... more tabs
  ]
}
```

## Development

### Prerequisites

- Chrome browser
- Basic knowledge of JavaScript
- Text editor (VS Code recommended)

### Technical Details

- Built using Manifest V3
- Uses service workers for background processes
- Implements JSZip for file compression
- Modular JavaScript architecture for maintainability

### Local Development

1. Make changes to the source files
2. Reload the extension in Chrome:
   - Go to `chrome://extensions/`
   - Find the extension
   - Click the refresh icon

### Debugging

1. Click "Inspect views" in `chrome://extensions/`
2. Use Chrome DevTools to:
   - View console logs
   - Debug JavaScript
   - Inspect UI elements

## Common Issues

1. **Missing Favicons**
   - Some websites may not provide favicons
   - A placeholder icon will be used automatically
   - Cached favicons may become invalid

3. **Group Management**
   - Groups are stored in Chrome's local storage
   - Clear extension data to reset if needed
   - Export important groups before clearing data

## Future Development

Planned features and improvements:

- [ ] Cloud sync support
- [ ] Search functionality
- [ ] Keyboard shortcuts
- [ ] Batch operations
- [ ] Auto-save functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and feature requests, please:
1. Check the documentation
2. Look for similar issues in the issue tracker
3. Create a new issue with detailed information

---

Last updated: February 2025
