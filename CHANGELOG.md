# Changelog

All notable changes to the Save Tabs extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-02

### Added
- Initial release
- Save tab groups locally with timestamps
- Custom save location selection
- Favicon support with fallback icons
- Import/Export functionality
- Group management features:
  - Save individual groups
  - Save all groups
  - Delete groups
  - Rename groups
  - Remove individual tabs
- Settings panel with save location configuration
- Automatic timestamp generation
- Unique file naming to prevent overwrites
- JSON file format for saved groups
- Chrome storage integration
- Error handling and user feedback
- Responsive popup UI

### Technical Features
- Chrome Extension Manifest V3 support
- Chrome API integrations:
  - Tabs API
  - Tab Groups API
  - Storage API
  - Downloads API
- File system operations
- Message passing system
- State management
- Error handling system

## [Unreleased]

### Planned
- Cloud sync support
- Custom group colors
- Search functionality
- Keyboard shortcuts
- Batch operations
- Auto-save functionality
- Dark mode support
- Drag-and-drop interface
- Performance optimizations

---

## Version History Guide

### Version Number Format
- MAJOR.MINOR.PATCH
  - MAJOR: Incompatible API changes
  - MINOR: Backwards-compatible functionality
  - PATCH: Backwards-compatible bug fixes

### Change Categories
- Added: New features
- Changed: Changes in existing functionality
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Fixed: Bug fixes
- Security: Vulnerability fixes

### Example Entry
```
## [1.1.0] - YYYY-MM-DD

### Added
- New feature description

### Changed
- Change in existing functionality

### Fixed
- Bug fix description
