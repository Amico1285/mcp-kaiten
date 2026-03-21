# Changelog

## [1.1.0] - 2026-03-21

### Added
- **Checklists:** create, view, delete checklists; add and update checklist items
- **Tags:** list workspace tags, add and remove tags from cards
- **Subtasks:** list, attach, and detach child cards
- **Files:** list, upload, and delete card attachments
- **Custom fields:** view custom properties per space
- **MCP resources:** instant access to workspace spaces and boards without tool calls
- **MCP prompts:** guided workflows for card creation, time reports, and board overviews

### Fixed
- Adding tags to cards now works correctly
- File upload to cards now works correctly

### Changed
- Tool descriptions now guide the AI on where to find required IDs and allowed values
- Detaching a subtask is no longer flagged as a destructive operation

## [1.0.2] - 2026-03-21

### Fixed
- Card listing in spaces and boards now sorted correctly

### Changed
- Card types are now listed globally, no board ID required
- Condition filter supports "all" option for active, archived, or both

## [1.0.1] - 2026-03-20

### Fixed
- Card creation, search, and listing endpoints corrected
- Time-log creation now correctly requires a role
- Time-log deletion works reliably

### Added
- Russian README

## [1.0.0] - 2026-03-20

### Initial Release

- **Cards:** get, search, list by space/board, create, update, delete
- **Comments:** list, create, update, delete
- **Time Logs:** get by user/card, create, update, delete
- **Spaces & Boards:** list spaces/boards/columns/lanes/card types, get space, get board
- **Users:** current user, list users, user roles
- Search with 15+ filters, dates, pagination
- 4 verbosity levels to control response size
- Automatic retries on network errors and rate limits
- Reference data caching for faster responses
- Large response truncation to protect AI context
