# Phase 5: AI Integration

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

Implementation status as of 2026-05-02: implemented enough to move on with AI rail UI, Settings-based provider/model/API-key setup, OS keychain-backed cloud keys, streaming native command paths for Ollama/OpenAI/Anthropic, request-id cancellation, browser-dev real-Ollama execution with offline fallback, Monaco diff preview, response copy, Apply/Cancel, Ctrl/Cmd+K opening, per-document SQLite AI history, and AI snapshots on apply. Real local Ollama was programmatically verified through the browser-dev UI with `qwen2.5-coder:14b` across all six capabilities. Remaining provider validation is native Tauri-window Ollama GUI smoke plus opt-in OpenAI/Anthropic verification.

## Goal

Add useful, reviewable AI assistance without compromising local-first privacy.

## User Value

A user can generate, fix, explain, convert, and restyle Mermaid diagrams using local Ollama by default, or opt into cloud providers with their own keys.

## Providers

- Ollama local provider at `http://localhost:11434`
- Anthropic provider with user-supplied key
- OpenAI provider with user-supplied key

Cloud providers must be off until explicitly configured.

## Required Backend Work

- provider trait/interface in Rust
- Ollama client
- Anthropic client
- OpenAI client
- streaming token channel to frontend
- API key storage through OS keychain or approved Tauri/keyring integration
- network allowlist limited to Ollama localhost and configured cloud APIs
- canonical system prompt in `src-tauri/src/ai/prompts.rs`

## Required UI

- collapsible AI panel
- provider/model selector
- prompt input
- streaming response area
- Monaco diff preview
- Apply and Cancel controls
- "Fix" action shown when parser reports an error
- Cmd/Ctrl+K edit-selection flow
- per-document chat history

## Required Capabilities

- generate from prompt
- fix Mermaid syntax errors
- edit selected code
- explain current diagram
- convert to another diagram type
- restyle with `classDef`, `class`, or `style` lines

## Safety Requirements

- AI output is never auto-applied.
- User reviews diff and clicks Apply.
- API keys are never logged.
- Prompt, response, and selected provider are stored only in local SQLite history.
- Network failures produce actionable UI messages.

## Exit Criteria

- All six AI capabilities work with Ollama.
- Cloud provider calls work when a valid user key is configured.
- Streaming can be cancelled.
- Apply creates an immediate snapshot labeled from the prompt.
- Invalid AI Mermaid output appears as a diff with diagnostics, not as a destructive replacement.

## Current Implementation Notes

- Backend commands: `run_ai_request`, `cancel_ai_request`, `save_ai_api_key`, `get_ai_api_key`, `delete_ai_api_key`, `save_ai_history`, and `list_ai_history`.
- Canonical prompt lives in `src-tauri/src/ai/prompts.rs`.
- Ollama uses `http://localhost:11434/api/generate` with `stream: true`.
- OpenAI and Anthropic use streaming API calls against their official endpoints and resolve cloud keys from the OS keychain.
- AI stream events emit start, chunk, done, cancelled, and error states to the frontend.
- Frontend browser-dev mode uses real local Ollama for the Ollama provider when reachable and falls back to deterministic responses when Ollama is unavailable.
- The AI rail includes capability buttons, prompt input, response area, Monaco diff preview, Apply and Cancel controls, and recent local history.
- Provider/model/API-key setup lives in Settings; the API-key field appears only for cloud providers.
- Native AI history is stored per document in SQLite; browser-dev mode uses localStorage as a fallback because it has no native SQLite/keychain access.
- Applying a proposal updates the document and creates an `ai` snapshot labeled from the prompt.
- Verified through Chrome CDP with real local Ollama and UI-selected `qwen2.5-coder:14b`: Generate, Edit, Explain, Convert, Restyle, and Fix completed with non-fallback responses; code-producing features showed diffs, applied cleanly, rendered SVG, and created snapshots.
- Remaining validation: native Tauri-window Ollama GUI pass and opt-in cloud-provider verification, plus future polish for new/delete chat controls.
