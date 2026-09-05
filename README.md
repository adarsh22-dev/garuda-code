# Garuda Code

A multi-provider, tool-using AI coding agent for the terminal — an open, from-scratch build in the shape of Claude Code / OpenClaude.

Named for Garuda, Vishnu's mount in Hindu mythology: a fast, powerful bird — the intended feel of the agent.

## What actually works right now (v0.1.1)

This is a genuine, tested v1, not a stub. What's built and verified:

- **CLI**: `garuda chat` (interactive TUI), `garuda run "<prompt>"` (scriptable one-shot), `garuda providers` / `garuda providers setup`, `garuda config set-default`, `garuda config add-provider`
- **Agent loop**: full tool-calling loop (send → tool_use → execute → tool_result → repeat until end_turn), max 50 turns per message, in `src/agent/loop.ts`
- **Providers**: Anthropic (native Messages API) plus an OpenAI-compatible adapter, with a growing catalog of key-based providers and local endpoints. `garuda providers setup` walks through the catalog in one pass; `config add-provider` registers any other OpenAI-compatible endpoint without touching code.
- **Tools** (all tested directly, see below): `bash`, `read_file`, `write_file`, `edit_file` (unique-string replace), `list_dir`, `glob`, `grep`, `git`
- **MCP client**: stdio-transport JSON-RPC client (`initialize`, `tools/list`, `tools/call`), wired into the agent's tool list — verified live against the official `@modelcontextprotocol/server-filesystem` package (14 tools loaded, `read_file` round-tripped real file content through the agent's tool interface)
- **TUI**: Ink-based chat interface, gold/indigo theme, confirmation prompts for mutating tools, active session metadata, navigable slash-command palette, coding skills, live token/context estimates, provider switching, and model discovery
- **Token control**: Recent history is bounded by default to 40 messages. Use `/compact` in chat or `garuda config set-history <12-500>` to tune the limit.
- **Skills**: `/debug`, `/security`, `/performance`, `/refactor`, `/test`, and `/document` provide focused coding workflows while preserving the normal agent tools and confirmations.
- **Config**: `~/.garuda/config.json` for default provider, per-provider model/baseUrl overrides, custom providers, registered MCP servers
- **Sessions**: save/load/list conversation history as JSON, wired into `chat` via `--resume <id>` and `-c/--continue` (resumes the most recent session for the current directory), autosaved after every model turn and every tool result — verified with a direct create→save→list→load round-trip through the filesystem

Compiles clean with `tsc --strict`. Every claim above was exercised directly (not just typed against interfaces) during the build — see the commands below.

```bash
# Tools
node dist/index.js run "read /path/to/file"

# Sessions
garuda chat                    # starts a new session, autosaves as you go
garuda sessions                # lists saved sessions with id, timestamp, msg count
garuda chat --continue         # resumes the most recent session in this directory
garuda chat --resume <id>      # resumes a specific session

# MCP
garuda config add-mcp-server   # register a stdio MCP server (name, command, args)
garuda config list-mcp-servers
garuda chat                    # MCP tools now appear alongside built-ins, namespaced "<server>__<tool>"
```

## Providers deliberately left out

These need per-account config or an OAuth flow rather than a fixed API-key + base-URL, so they weren't hardcoded — register them yourself with `garuda config add-provider` once you have the details, rather than trusting a guessed URL:

- **Azure OpenAI** — base URL is your own resource + deployment name
- **Cloudflare Workers AI** — base URL is scoped to your Cloudflare account id
- **Bedrock / Vertex / Foundry** — cloud IAM auth, not a simple API key
- **GitHub Models/Copilot, Codex OAuth (ChatGPT), xAI OAuth** — browser OAuth flows, not key-based
- **MiniMax (Anthropic-compatible endpoint), LongCat, Moonshot's Kimi Code *subscription* endpoint (its direct API is included as `moonshot`), OpenCode Zen/Go, ClinePass, Hicap, AI/ML API** — their setup docs didn't give a confirmed, stable base URL at the time this was built; adding a guessed one risked silently pointing at the wrong endpoint

## Known gaps (honest list, not marketing)

- **A real bug was found and fixed during this build**: the original `garuda providers setup` / `add-provider` / `add-mcp-server` wizards chained `rl.question()` calls, which drops answers when stdin delivers multiple lines faster than each `question()` call attaches its listener (reproducible by piping a multi-line answer file). Fixed by switching to a manual async-iterator over the readline interface (`createPrompter` in `src/index.ts`) — re-tested with the exact scenario that broke it, and it now correctly saves the entered keys and skips the rest.

- **No multi-agent orchestration, no skills system, no browser/Playwright testing, no visual QA** — this is a single-agent core loop, not the full AstraBharat-scale platform. Those are separate, larger projects.
- **Only the stdio MCP transport exists** — no Streamable HTTP or SSE.
- **`edit_file` requires an exact unique match** — no fuzzy matching, no diff-based patching yet.
- **Session log replay in the TUI is text-only** — resuming a session repopulates the chat log with prior user/assistant text but doesn't replay tool-call/tool-result lines (they're in the saved history sent to the model, just not re-rendered in the UI).
- **MCP tools default to requiring confirmation** — reasonable since they can do anything server-side, but there's no per-tool trust list yet, so `--yolo` is all-or-nothing.
## Install

After the npm release is published:

```bash
npm install --global garuda-code
garuda --help
garuda chat
```

Until the npm release is available, the reliable Windows install is the public GitHub archive:

```powershell
npm install --global https://github.com/adarsh22-dev/garuda-code/archive/refs/heads/master.tar.gz
garuda chat
```

The package exposes the `garuda` command and works in PowerShell, macOS/Linux terminals, and the VS Code integrated terminal. For the current GitHub source:

```bash
git clone https://github.com/adarsh22-dev/garuda-code.git
cd garuda-code
npm install
npm run build
npm link
garuda chat
```

On Windows, configure providers without entering a key for every provider:

```powershell
npm run setup
garuda providers
garuda chat
```

`npm start` launches chat directly. For a local Ollama setup, use `garuda config set-default ollama` before starting chat.

Read the complete [first-run guide](docs/first-run.md), [slash-command guide](docs/commands.md), and [roadmap](docs/roadmap.md).

For compatibility and public-release provenance, see [docs/provenance.md](docs/provenance.md). Garuda can offer similar terminal workflows to other coding agents, but its source, TUI, commands, and branding are independently implemented.

## Usage

```bash
export ANTHROPIC_API_KEY=sk-...
garuda chat                          # interactive TUI in the current directory
garuda run "list the files in src/"  # one-shot, good for scripts
garuda providers                     # see which providers have keys set
garuda providers setup               # walk through built-in providers and save keys you have
garuda config set-default openai
garuda config add-provider           # register a custom OpenAI-compatible endpoint
garuda config set-history 40         # cap retained conversation history
```

Pass `--provider <id>` and `--model <name>` to override the default per-invocation. Pass `--yolo` to `chat` to skip confirmation prompts on mutating tools (bash, write_file, edit_file, git) — off by default for safety.

Inside the TUI, type `/` to open the command palette. Use Up/Down to select, Tab to complete, and Enter to run. `/provider` lists available providers, `/provider openrouter` switches providers, `/models` discovers models, and `/model gpt-4o` changes the active model. If the default provider has no key, Garuda still opens the TUI so you can switch to a configured provider; a normal prompt before configuration returns the provider authentication error.

## Architecture

```
src/
  index.ts              CLI entry (commander)
  ui/App.tsx             Ink TUI
  agent/
    loop.ts              core send→tool_use→execute→repeat loop
    systemPrompt.ts
  providers/
    types.ts              normalized Message/Tool/CompletionRequest schema
    anthropic.ts           native Anthropic Messages API adapter
    openaiCompatible.ts    generic OpenAI-compatible adapter
    registry.ts            provider presets + base URLs
  tools/
    bash.ts, fileOps.ts, search.ts, git.ts, index.ts
  mcp/
    client.ts             stdio JSON-RPC client
  config/config.ts        ~/.garuda/config.json
  session/session.ts       JSON session persistence
```

The provider layer normalizes every backend to one `Message`/`ContentBlock` schema so the agent loop and tools never need to know which LLM they're talking to — adding a new OpenAI-compatible provider is a config entry, not a code change.

## Publishing and provenance

The project is MIT-licensed and the Garuda source, command catalog, skills, and UI are original implementation work. The provider names and endpoint metadata are compatibility references; each provider remains subject to its own terms. Before publishing, run `npm run build` and `npm pack --dry-run`, review the package contents, and do not include `.env`, API keys, session data, or generated files that are not part of the intended release. See [docs/provenance.md](docs/provenance.md) for the asset and compatibility policy.
