# Save Tabs - Development Guide

This document provides technical details and guidelines for developing the Save Tabs Chrome extension.

## Development Environment Setup

1. **Prerequisites**
   - Node.js (latest LTS version)
   - Chrome browser
   - Git
   - VS Code (recommended)

2. **VS Code Extensions**
   - Chrome Debugger
   - ESLint
   - Prettier

3. **Initial Setup**
   ```bash
   git clone <repository-url>
   cd local-tabs
   ```

## Architecture Overview

### Component Structure

1. **Popup (popup.js, popup.html)**
   - Main user interface
   - Tab group management
   - Settings interface
   - Event handlers for user interactions

2. **Background Service (background.js)**
   - File system operations
   - Chrome API interactions
   - State management
   - Message handling

### Data Flow

1. **Tab Group Management**
   ```
   User Action → popup.js → chrome.runtime.sendMessage → background.js → File System/Storage
   ```

2. **Settings Management**
   ```
   User Settings → chrome.storage.local → background.js → File Operations
   ```

3. **File Operations**
   ```
   Save Request → background.js → chrome.downloads API → Local File System
   ```

## Core Components

### 1. Group Management

```javascript
// Group Structure
{
  id: string,
  title: string,
  savedAt: ISO8601 string,
  tabs: Array<{
    title: string,
    url: string,
    favicon: string
  }>
}
```

### 2. Storage Management

- Uses `chrome.storage.local` for persistent data
- Key-value structure:
  ```javascript
  {
    savedGroups: Object<groupId, groupData>,
    saveDirectory: string
  }
  ```

### 3. File System Operations

- Uses Chrome's download API
- Handles file naming and directory structure
- Manages file conflicts and versioning

## API Reference

### Chrome APIs Used

1. **Tabs API**
   ```javascript
   chrome.tabs.query()
   chrome.tabs.create()
   chrome.tabs.remove()
   ```

2. **Tab Groups API**
   ```javascript
   chrome.tabGroups.query()
   chrome.tabGroups.update()
   ```

3. **Storage API**
   ```javascript
   chrome.storage.local.get()
   chrome.storage.local.set()
   ```

4. **Downloads API**
   ```javascript
   chrome.downloads.download()
   chrome.downloads.search()
   ```

### Custom Message Types

1. **Save File**
   ```javascript
   {
     action: 'saveFile',
     groupName: string,
     content: string
   }
   ```

2. **Directory Management**
   ```javascript
   {
     action: 'setSaveDirectory' | 'getSaveDirectory',
     directory?: string
   }
   ```

## Testing

### Manual Testing Checklist

1. **Group Operations**
   - [ ] Create new group
   - [ ] Save group
   - [ ] Rename group
   - [ ] Delete group
   - [ ] Import/Export

2. **Tab Management**
   - [ ] Add tabs to group
   - [ ] Remove tabs
   - [ ] Open saved tabs
   - [ ] Check favicon loading

3. **File Operations**
   - [ ] Save to custom directory
   - [ ] Handle file conflicts
   - [ ] Check file format
   - [ ] Verify timestamps

### Common Test Cases

```javascript
// Example test case structure
async function testGroupSave() {
  // 1. Set up test data
  const testGroup = {
    title: "Test Group",
    tabs: [/* test tabs */]
  };

  // 2. Perform operation
  await saveGroup(groupId, testGroup);

  // 3. Verify results
  const saved = await chrome.storage.local.get('savedGroups');
  assert(saved.savedGroups[groupId]);
}
```

## Debugging

### Common Issues

1. **Storage Quota**
   ```javascript
   chrome.storage.local.getBytesInUse(null, (bytes) => {
     console.log(`Storage used: ${bytes} bytes`);
   });
   ```

2. **Message Handling**
   ```javascript
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     console.log('Message received:', message);
     // Handle message
   });
   ```

3. **File System Errors**
   ```javascript
   try {
     await saveFile(data);
   } catch (error) {
     console.error('File system error:', error);
     // Handle error
   }
   ```

### Development Tools

1. **Chrome Extension Developer Tools**
   - Background page console
   - Storage inspector
   - Network monitor

2. **VS Code Debug Configuration**
   ```json
   {
     "type": "chrome",
     "request": "launch",
     "name": "Debug Extension",
     "url": "chrome://extensions",
     "webRoot": "${workspaceFolder}"
   }
   ```

## Code Style Guide

### JavaScript

- Use ES6+ features
- Async/await for asynchronous operations
- Clear error handling
- Descriptive variable names

### File Organization

```
src/
├── popup/
│   ├── components/
│   └── utils/
├── background/
│   ├── services/
│   └── utils/
└── shared/
    ├── constants.js
    └── types.js
```

### Naming Conventions

- Files: kebab-case
- Classes: PascalCase
- Functions/Variables: camelCase
- Constants: UPPER_SNAKE_CASE

## Version Control

### Branch Strategy

- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `release/*`: Release preparation

### Commit Messages

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Tests
- chore: Maintenance

## Release Process

1. **Preparation**
   - Update version in manifest.json
   - Update changelog
   - Run tests
   - Update documentation

2. **Building**
   ```bash
   # Example build process
   npm run build
   ```

3. **Testing**
   - Load unpacked extension
   - Test all features
   - Verify documentation

4. **Publishing**
   - Create release tag
   - Update Chrome Web Store
   - Notify users

## Future Development

### Planned Features

1. **Cloud Integration**
   - Google Drive sync
   - Cross-device sync
   - Backup/restore

2. **UI Improvements**
   - Dark mode
   - Custom themes
   - Drag-and-drop

3. **Performance**
   - Lazy loading
   - Compression
   - Caching

### Technical Debt

- Refactor message handling
- Improve error handling
- Add unit tests
- Optimize storage usage

---

Last updated: February 2025
