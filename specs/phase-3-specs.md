# Phase 3: Local Snapshot System

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

Implementation status as of 2026-05-01: baseline implemented with `rusqlite`, zstd-compressed full/diff snapshots, history preview/restore UI, browser-dev snapshot verification, and pending native GUI/stress verification.

## Goal

Add the local history system that makes Mermaid Local meaningfully better than a plain code editor: every edit creates a recoverable point, restore is fast, and nothing leaves the machine.

## User Value

A user can experiment freely, use AI or visual edits without fear, and roll back to any useful prior version instantly.

## Required Backend Work

- SQLite integration through Tauri SQL plugin or Rust `rusqlite`
- `documents` table
- `snapshots` table
- `settings` table
- `recents` table
- migrations with deterministic schema setup
- async snapshot write command
- snapshot restore command
- snapshot list command with pagination
- snapshot prune command

## Required Snapshot Behavior

- full snapshot every 50 snapshots by default
- diff snapshots between full snapshots
- zstd compression at level 3
- triggers:
  - debounced edit after 800ms idle
  - file open
  - file save
  - visual edit placeholder
  - AI apply placeholder
  - manual snapshot
- restore creates a new snapshot before replacing current content

## Required UI

- history panel opened from a clock icon
- newest-first timeline
- timestamp, trigger badge, label, and size metadata
- restore button
- read-only preview mode for selected history entry
- thumbnail field in schema, generated lazily if thumbnail rendering is not complete in this phase

## Performance Targets

- snapshot write: under 10ms p95 after debounce
- restore from any point in last 1000 snapshots: under 200ms
- opening history panel with 1000 entries: under 500ms

## Out of Scope

- AI message persistence
- polished pruning controls
- full settings UI
- export
- bidirectional AST edits

## Exit Criteria

- 1000 editor changes produce recoverable snapshots.
- Restore works without losing the current state.
- User can label a manual snapshot.
- App recovers the latest document content from SQLite after restart.
- Snapshot failures do not block in-memory editing.

## Current Implementation Notes

- Backend storage uses `rusqlite` rather than the Tauri SQL plugin.
- Tables are created deterministically for `documents`, `snapshots`, `settings`, and `recents`.
- Snapshot payloads use zstd compression; native storage writes full snapshots plus compressed diff snapshots between full entries.
- Frontend triggers include debounced edit, open, save/save-as, manual snapshot, and restore.
- The history panel is available from the top bar and supports newest-first browsing, metadata, read-only preview, and restore.
- Browser-dev mode uses a localStorage fallback so the history UI can be verified outside Tauri.
- Remaining Phase 3 validation: native GUI snapshot workflow and 1000-snapshot stress/performance checks.
