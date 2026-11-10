# Phase 7: Post-v1 Stretch

Source of truth: `specs/MERMAID_LOCAL_UPDATED_SPEC.md`

## Goal

Capture useful post-v1 ideas without letting them distract from the local desktop editor.

## Candidate Features

- project workspaces with multiple diagrams in tabs
- diagram-to-diagram links
- plugin API
- local CLI renderer, for example `mermaid-local render input.mmd --out diagram.png`
- AI tool-use mode for multi-step edits
- collaborative cursors over WebRTC with no central server
- read-only mobile companion

## Constraints

- Do not introduce cloud sync as a hidden dependency.
- Do not weaken privacy defaults.
- Keep `.mmd` compatibility.
- Preserve local snapshot semantics.

## Entry Criteria

Start Phase 7 only after v1 acceptance passes and the app is packaged on all target operating systems.
