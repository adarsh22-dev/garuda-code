#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import chalk from "chalk";
import React from "react";
import { render } from "ink";
import readline from "node:readline/promises";
import { App } from "./ui/App.js";
import { loadConfig, saveConfig, getConfigDir } from "./config/config.js";
import { PROVIDER_PRESETS, buildProvider, resolvePreset } from "./providers/registry.js";
import { AgentLoop } from "./agent/loop.js";
import { ALL_TOOLS, type Tool } from "./tools/index.js";
import { loadMcpTools } from "./mcp/toolWrapper.js";
import { createSession, loadSession, saveSession, listSessions, type SessionData } from "./session/session.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageVersion = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf-8")
).version as string;

async function resolveTools(): Promise<{ tools: Tool[]; closeAll: () => void }> {
  const cfg = await loadConfig();
  if (!cfg.mcpServers?.length) return { tools: ALL_TOOLS, closeAll: () => {} };
  const { tools: mcpTools, closeAll } = await loadMcpTools(cfg.mcpServers);
  return { tools: [...ALL_TOOLS, ...mcpTools], closeAll };
}

// readline's chained `question()` calls can race and drop answers when stdin
// delivers multiple lines in one chunk (piped/scripted input). This manual
// async-iterator wrapper reads lines strictly in order instead.
function createPrompter(rl: readline.Interface) {
  const it = rl[Symbol.asyncIterator]();
  return async (prompt: string): Promise<string> => {
    process.stdout.write(prompt);
    const { value, done } = await it.next();
    return done ? "" : String(value ?? "").trim();
  };
}

const program = new Command();

program
  .name("garuda")
  .description("Garuda Code — a multi-provider, tool-using AI coding agent for the terminal.")
  .version(packageVersion);

async function resolveProviderAndModel(opts: { provider?: string; model?: string }) {
  const cfg = await loadConfig();
  const providerId = opts.provider ?? cfg.defaultProvider;

  const custom = cfg.customProviders?.find((p) => p.id === providerId);
  const preset = custom
    ? { id: custom.id, label: custom.label, kind: "openai-compatible" as const, baseUrl: custom.baseUrl, envKey: custom.envKey, defaultModel: custom.defaultModel }
    : resolvePreset(providerId);

  const override = cfg.providerOverrides?.[providerId];
  const model = opts.model ?? override?.model ?? preset.defaultModel;
  const apiKey = override?.apiKey ?? process.env[preset.envKey];

  if (preset.kind === "anthropic" && !apiKey) {
    console.warn(chalk.yellow(`Missing ${preset.envKey}. The TUI will open so you can switch with /provider or configure a key.`));
  }

  const provider = buildProvider(
    { id: preset.id, apiKey: apiKey ?? "not-configured", baseUrl: override?.baseUrl ?? preset.baseUrl, model },
    preset.kind
  );

  return { provider, providerId: preset.id, model, maxHistoryMessages: cfg.maxHistoryMessages };
}

async function resolveProviderIds(): Promise<string[]> {
  const cfg = await loadConfig();
  return [...PROVIDER_PRESETS.map((preset) => preset.id), ...(cfg.customProviders ?? []).map((preset) => preset.id)];
}

async function resolveProviderOptions(): Promise<Array<{ id: string; label: string; configured: boolean; defaultModel: string }>> {
  const cfg = await loadConfig();
  const builtIns = PROVIDER_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    configured: Boolean(process.env[preset.envKey] || cfg.providerOverrides?.[preset.id]?.apiKey),
    defaultModel: preset.defaultModel,
  }));
  const custom = (cfg.customProviders ?? []).map((preset) => ({
    id: preset.id,
    label: preset.label,
    configured: Boolean(process.env[preset.envKey] || cfg.providerOverrides?.[preset.id]?.apiKey),
    defaultModel: preset.defaultModel,
  }));
  return [...builtIns, ...custom];
}

program
  .command("chat", { isDefault: true })
  .description("Start an interactive chat session with Garuda in this directory.")
  .option("-p, --provider <id>", "Provider to use (see `garuda providers`)")
  .option("-m, --model <name>", "Model name override")
  .option("--yolo", "Skip confirmation prompts for tool calls (dangerous)", false)
  .option("--resume <sessionId>", "Resume a specific saved session by id")
  .option("-c, --continue", "Resume the most recently updated session for this directory", false)
  .action(async (opts) => {
    const { provider, providerId, model, maxHistoryMessages } = await resolveProviderAndModel(opts);
    const { tools, closeAll } = await resolveTools();
    const cwd = process.cwd();

    let session: SessionData;
    if (opts.resume) {
      session = await loadSession(opts.resume);
    } else if (opts.continue) {
      const existing = (await listSessions()).find((s) => s.cwd === cwd);
      session = existing ?? (await createSession(cwd, providerId));
    } else {
      session = await createSession(cwd, providerId);
    }
    await saveSession(session);

    process.on("exit", closeAll);

    render(
      React.createElement(App, {
        provider,
        providerId,
        model,
        cwd,
        yolo: Boolean(opts.yolo),
        tools,
        sessionId: session.id,
        initialMessages: session.messages,
        maxHistoryMessages,
        providerIds: await resolveProviderIds(),
        providerOptions: await resolveProviderOptions(),
        onProviderChange: async (nextProviderId, nextModel) => {
          const next = await resolveProviderAndModel({ provider: nextProviderId, model: nextModel });
          session.providerId = next.providerId;
          return next;
        },
        onProviderProfileSave: async (nextProviderId, nextModel, apiKey) => {
          const cfg = await loadConfig();
          cfg.providerOverrides = {
            ...(cfg.providerOverrides ?? {}),
            [nextProviderId]: { ...(cfg.providerOverrides?.[nextProviderId] ?? {}), model: nextModel, apiKey },
          };
          cfg.defaultProvider = nextProviderId;
          await saveConfig(cfg);
          return resolveProviderAndModel({ provider: nextProviderId, model: nextModel });
        },
        onHistoryChange: (messages) => {
          session.messages = messages;
          void saveSession(session);
        },
      })
    );
  });

program
  .command("sessions")
  .description("List saved sessions for this and other directories.")
  .action(async () => {
    const sessions = await listSessions();
    if (!sessions.length) {
      console.log("No saved sessions yet.");
      return;
    }
    for (const s of sessions) {
      console.log(`${chalk.yellow(s.id)}  ${s.updatedAt}  ${s.messages.length} msgs  ${chalk.gray(s.cwd)}`);
    }
    console.log(chalk.gray("\nResume with: garuda chat --resume <id>"));
  });

program
  .command("run <prompt...>")
  .description("Run a single non-interactive prompt and print the result (good for scripts/CI).")
  .option("-p, --provider <id>", "Provider to use")
  .option("-m, --model <name>", "Model name override")
  .option("--yolo", "Skip confirmation prompts for tool calls", true)
  .action(async (promptParts: string[], opts) => {
    const { provider } = await resolveProviderAndModel(opts);
    const { tools, closeAll } = await resolveTools();
    const agent = new AgentLoop({ provider, cwd: process.cwd(), yolo: Boolean(opts.yolo), tools });
    try {
      await agent.send(promptParts.join(" "), {
        onAssistantText: (t) => console.log(t),
        onToolCall: (name, input) => console.log(chalk.gray(`→ ${name}(${JSON.stringify(input)})`)),
        onToolResult: (name, result, isError) =>
          console.log(isError ? chalk.red(`✗ ${name}: ${result}`) : chalk.gray(`✓ ${name}`)),
      });
    } finally {
      closeAll();
    }
  });

const providersCmd = program
  .command("providers")
  .description("List available providers and which have API keys configured.")
  .action(async () => {
    const cfg = await loadConfig();

    const isConfigured = (p: (typeof PROVIDER_PRESETS)[0]) =>
      Boolean(process.env[p.envKey] || cfg.providerOverrides?.[p.id]?.apiKey);

    const configured = PROVIDER_PRESETS.filter(isConfigured);
    const available = PROVIDER_PRESETS.filter((p) => !isConfigured(p));

    console.log(chalk.bold("\n  Configured providers:"));
    if (configured.length) {
      for (const p of configured) {
        const isDefault = p.id === cfg.defaultProvider ? chalk.yellow(" (default)") : "";
        console.log(`    ${chalk.green("*")} ${p.id.padEnd(16)} ${p.label}${isDefault}`);
      }
    } else {
      console.log(chalk.gray("    None. Run `garuda providers setup` to add keys."));
    }

    console.log(chalk.bold("\n  Available providers:"));
    for (const p of available) {
      console.log(`    ${chalk.gray("-")} ${p.id.padEnd(16)} ${chalk.gray(p.label)}`);
    }

    console.log(chalk.gray("\n  Commands:"));
    console.log(chalk.gray("    garuda providers setup        Configure API keys"));
    console.log(chalk.gray("    garuda config set-default     Set default provider"));
    console.log(chalk.gray("    garuda config add-provider    Add custom provider\n"));
  });

providersCmd
  .command("setup")
  .description("Walk through providers and save API keys that you have.")
  .option("--all", "Show all providers including already-configured ones", false)
  .action(async (opts) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = createPrompter(rl);
    const cfg = await loadConfig();
    cfg.providerOverrides = cfg.providerOverrides ?? {};

    const CATEGORY_LABELS: Record<string, string> = {
      major: "Major Providers",
      local: "Local (no key needed)",
      cloud: "Cloud / API Providers",
    };

    const PROVIDER_CATEGORIES: Record<string, string[]> = {
      major: ["anthropic", "openai", "gemini", "groq", "deepseek", "mistral", "openrouter"],
      local: ["ollama", "lmstudio", "atomicchat"],
      cloud: ["together", "fireworks", "xai", "venice", "cerebras", "deepinfra", "moonshot", "huggingface", "dashscope", "nvidia", "minimax", "nebius"],
    };

    const categorized = new Set(Object.values(PROVIDER_CATEGORIES).flat());
    const uncategorized = PROVIDER_PRESETS.filter((p) => !categorized.has(p.id));

    const isConfigured = (id: string, envKey: string) =>
      Boolean(process.env[envKey] || cfg.providerOverrides![id]?.apiKey);

    const setupProviders = async (providers: typeof PROVIDER_PRESETS) => {
      let count = 0;
      for (const p of providers) {
        const already = isConfigured(p.id, p.envKey);
        if (already && !opts.all) continue;
        const status = already ? chalk.green(" [configured]") : "";
        const answer = await ask(`${chalk.yellow(p.id.padEnd(16))} ${p.label}${status}  API key (Enter to skip): `);
        if (answer) {
          cfg.providerOverrides![p.id] = { ...cfg.providerOverrides![p.id], apiKey: answer };
          count++;
        }
      }
      return count;
    };

    console.log(chalk.bold("\n  Garuda Provider Setup\n"));
    console.log(chalk.gray("  Providers are grouped by category. Enter a number to configure that group."));
    console.log(chalk.gray("  Press Enter without a number to finish.\n"));

    const menuItems = [
      ...Object.keys(PROVIDER_CATEGORIES).map((key) => ({ key, label: CATEGORY_LABELS[key] })),
      ...(uncategorized.length ? [{ key: "other", label: `Other Providers (${uncategorized.length})` }] : []),
      { key: "all", label: "All Providers" },
      { key: "done", label: "Done" },
    ];

    let totalConfigured = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      console.log(chalk.bold("  Categories:"));
      menuItems.forEach((item, i) => {
        const isDone = item.key === "done";
        console.log(`    ${isDone ? chalk.green : chalk.yellow} ${i + 1}. ${item.label}`);
      });

      const choice = await ask(chalk.bold("\n  Select category (number or name): "));
      if (!choice || choice.toLowerCase() === "done" || choice === String(menuItems.length)) {
        break;
      }

      const idx = parseInt(choice, 10) - 1;
      const selected = menuItems[idx];

      if (!selected || selected.key === "done") break;

      let providers: typeof PROVIDER_PRESETS;
      if (selected.key === "all") {
        providers = PROVIDER_PRESETS;
      } else if (selected.key === "other") {
        providers = uncategorized;
      } else {
        const ids = PROVIDER_CATEGORIES[selected.key] ?? [];
        providers = PROVIDER_PRESETS.filter((p) => ids.includes(p.id));
      }

      console.log(chalk.gray(`\n  Configuring ${selected.label}...`));
      console.log(chalk.gray("  Press Enter to skip any you don't have.\n"));
      totalConfigured += await setupProviders(providers);
      console.log();
    }

    rl.close();
    await saveConfig(cfg);

    console.log(chalk.bold("\n  Setup Complete\n"));
    console.log(chalk.green(`  Saved keys for ${totalConfigured} provider(s).`));
    console.log(chalk.gray(`  Config: ${getConfigDir()}/config.json\n`));

    // Show configured providers summary
    const configured = PROVIDER_PRESETS.filter((p) => isConfigured(p.id, p.envKey));
    if (configured.length) {
      console.log(chalk.bold("  Configured providers:"));
      for (const p of configured) {
        console.log(`    ${chalk.green("*")} ${p.id.padEnd(16)} ${p.label} ${chalk.gray(`(${p.defaultModel})`)}`);
      }
    }

    console.log(chalk.gray("\n  Next steps:"));
    console.log(chalk.gray("    garuda config set-default <provider>   Set your default"));
    console.log(chalk.gray("    garuda chat                            Start chatting\n"));
  });

const configCmd = program.command("config").description("Manage Garuda configuration.");

configCmd
  .command("set-default <providerId>")
  .description("Set the default provider used when --provider is not passed.")
  .action(async (providerId: string) => {
    const cfg = await loadConfig();
    cfg.defaultProvider = providerId;
    await saveConfig(cfg);
    console.log(chalk.green(`Default provider set to ${providerId}`));
  });

configCmd
  .command("set-history <messages>")
  .description("Set the maximum number of recent messages retained in model context.")
  .action(async (messages: string) => {
    const value = Number.parseInt(messages, 10);
    if (!Number.isInteger(value) || value < 12 || value > 500) {
      console.error(chalk.red("History must be an integer between 12 and 500 messages."));
      process.exitCode = 1;
      return;
    }
    const cfg = await loadConfig();
    cfg.maxHistoryMessages = value;
    await saveConfig(cfg);
    console.log(chalk.green(`History limit set to ${value} messages.`));
  });

configCmd
  .command("add-provider")
  .description("Interactively register a custom OpenAI-compatible provider endpoint.")
  .action(async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = createPrompter(rl);
    const id = await ask("Provider id (short, e.g. my-llm): ");
    const label = await ask("Display label: ");
    const baseUrl = await ask("Base URL (OpenAI-compatible /v1): ");
    const envKey = await ask("Env var name holding the API key: ");
    const defaultModel = await ask("Default model name: ");
    rl.close();

    const cfg = await loadConfig();
    cfg.customProviders = [...(cfg.customProviders ?? []).filter((p) => p.id !== id), { id, label, baseUrl, envKey, defaultModel }];
    await saveConfig(cfg);
    console.log(chalk.green(`Added provider "${id}". Set ${envKey} in your environment to use it.`));
  });

configCmd
  .command("add-mcp-server")
  .description("Register an MCP stdio server so its tools are available to the agent.")
  .action(async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = createPrompter(rl);
    const name = await ask("Server name (used as a tool-name prefix, e.g. filesystem): ");
    const command = await ask("Command to launch the server (e.g. npx): ");
    const argsLine = await ask("Args, space-separated (e.g. -y @modelcontextprotocol/server-filesystem /path): ");
    rl.close();

    const cfg = await loadConfig();
    cfg.mcpServers = [
      ...(cfg.mcpServers ?? []).filter((s) => s.name !== name),
      { name, command, args: argsLine ? argsLine.split(/\s+/) : [] },
    ];
    await saveConfig(cfg);
    console.log(chalk.green(`Added MCP server "${name}". Its tools will be namespaced as ${name}__<tool>.`));
  });

configCmd
  .command("list-mcp-servers")
  .description("List registered MCP stdio servers.")
  .action(async () => {
    const cfg = await loadConfig();
    if (!cfg.mcpServers?.length) {
      console.log("No MCP servers registered. Add one with `garuda config add-mcp-server`.");
      return;
    }
    for (const s of cfg.mcpServers) {
      console.log(`  ${chalk.yellow(s.name)}  ${s.command} ${(s.args ?? []).join(" ")}`);
    }
  });

program.parseAsync(process.argv);
