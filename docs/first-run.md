# First-Run Guide

Garuda Code works in PowerShell, macOS/Linux terminals, and the VS Code integrated terminal.

## Install

After the npm package is published:

```bash
npm install --global garuda-code
garuda --help
```

For a repository checkout instead:

```bash
git clone https://github.com/adarsh22-dev/garuda-code.git
cd garuda-code
npm install
npm run build
npm link
```

Requires Node.js 18 or newer.

## Configure a provider

Run the guided setup wizard. Press Enter to skip providers you do not use:

```bash
garuda providers setup
```

The wizard stores keys in `~/.garuda/config.json`. You can also use environment variables in a `.env` file in your project. Start from `.env.example` and never commit `.env`.

Common choices:

| Provider | Environment variable | Where to create a key |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
| OpenAI | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| OpenRouter | `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Google Gemini | `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Groq | `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| DeepSeek | `DEEPSEEK_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com/) |

Then choose a default:

```bash
garuda config set-default openrouter
garuda chat
```

Before npm publication, install the public GitHub archive directly:

```powershell
npm install --global https://github.com/adarsh22-dev/garuda-code/archive/refs/heads/master.tar.gz
garuda chat
```

This archive form is recommended on Windows with npm 11. Some npm versions leave a temporary junction behind when installing a Git URL globally (`git+https://...`); the archive URL avoids that npm behavior.

Local models do not need a cloud key:

```bash
ollama serve
garuda config set-default ollama
garuda chat
```

## Use the TUI

When `garuda chat` starts, Garuda shows its original banner and the active provider, model, and workspace. Confirm with `Y` only for a folder you created or trust; press `N` or `Esc` to exit. This gate appears before file tools or model prompts are enabled.

After accepting the workspace, type `/` to open the command palette. Type more letters to filter, use Up/Down to select, and Tab to complete. Useful commands include `/help`, `/provider`, `/models`, `/plan`, `/review`, `/compact`, and `/exit`.

Use `@` file references and `!` shell commands as ordinary prompt text for now; dedicated file-reference and shell-prefix parsing are planned roadmap features.

## VS Code

Open the project folder in VS Code and use **Terminal > New Terminal**. The same `garuda` command works there. Set `GARUDA_CONFIG_DIR` if you want a separate configuration directory for a workspace or machine.