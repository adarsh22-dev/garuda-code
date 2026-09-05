# Slash Commands

Type `/` inside `garuda chat` to open the searchable command palette. Up/Down selects a command, Tab completes it, and Enter runs it.

Common short aliases are supported: `/p` for `/provider`, `/m` for `/model`, `/h` for `/help`, and `/q` for `/exit`. For example, `/p openrouter` switches providers without requiring the full command name.

## Session and context

`/clear`, `/compact`, `/context`, `/status`, `/sessions`, `/resume`, `/export`, `/copy`, `/continue`, `/session`, `/files`, `/ctx`, `/cost`, `/request-size`, `/cache-stats`, `/exit`

## Providers and models

`/provider`, `/model`, `/models`, `/connect`, `/usage`, `/effort`, `/set-context-window`, `/clear-context-window`, `/smartroute`

`/provider` opens the provider manager. Choose `Add provider profile` to select a preset, enter its default model, and enter its API key. Choose `Set active provider` to switch saved profiles. Configured profiles are marked `configured`; Up/Down plus Enter controls the menus. `/provider add` opens the preset step directly. Run `garuda providers setup` when you prefer the batch wizard.

## Coding workflows

`/plan`, `/review`, `/security-review`, `/diff`, `/debug`, `/security`, `/performance`, `/refactor`, `/test`, `/document`, `/doctor`, `/diagnostics`, `/tools`, `/skills`

## Project and integrations

`/init`, `/memory`, `/dream`, `/knowledge`, `/wiki`, `/mcp`, `/lsp`, `/ide`, `/plugin`, `/reload-plugins`, `/agents`, `/hooks`, `/permissions`

## UI and diagnostics

`/help`, `/theme`, `/logo`, `/color`, `/keybindings`, `/vim`, `/statusline`, `/terminal-setup`, `/stats`, `/insights`, `/release-notes`, `/feedback`, `/update`, `/privacy-settings`

Commands marked as available in the palette are either implemented locally or routed through the agent. Integration placeholders are kept visible so the public command surface is honest while those subsystems are built.