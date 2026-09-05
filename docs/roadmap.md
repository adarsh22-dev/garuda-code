# Garuda Code Roadmap

This roadmap is deliberately staged around user value and reliability. Dates are intentionally omitted; each phase ships when its checks and documentation are ready.

## Phase 1: Installable foundation

- Publish signed, reproducible npm releases.
- Add Windows, macOS, and Linux smoke tests.
- Add provider health checks and clearer authentication errors.
- Keep sessions, credentials, and generated files out of packages and Git.

## Phase 2: TUI parity

- Finish the command palette with searchable grouped commands and keyboard shortcuts.
- Add message editing, history navigation, cancellation, scrollback, and copy-friendly output.
- Render tool calls as collapsible cards with timing, status, and safe result truncation.
- Add a first-run onboarding screen and configurable themes.

## Phase 3: Better coding loop

- Add plan, execute, verify as explicit agent stages.
- Replace exact-string editing with unified patches, fuzzy anchors, and rollback.
- Add test discovery and automatic focused validation after edits.
- Add diff review before destructive or broad changes.

## Phase 4: Project intelligence

- Build an incremental file and symbol index with ignore-file support.
- Add `@file`, `@symbol`, and project-context references.
- Add durable project memory with explicit user controls and redaction.
- Cache safe read-only context without persisting secrets.

## Phase 5: Extensibility and scale

- Support plugin and skill packages with permissions and versioning.
- Add Streamable HTTP MCP alongside stdio.
- Add subagents with bounded concurrency and visible budgets.
- Add provider fallback, model routing, and per-task cost controls.

Every phase should retain the core guarantees: explicit tool permissions, no fabricated results, no credential logging, focused tests, and a documented migration path.