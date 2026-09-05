import React, { useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { AgentLoop } from "../agent/loop.js";
import type { Provider, Message } from "../providers/types.js";
import type { Tool } from "../tools/types.js";
import { getSlashCommand, SLASH_COMMANDS } from "../commands.js";
import { BUILTIN_SKILLS } from "../skills/registry.js";

const GOLD = "#D4A017";
const ORANGE = "#E8740C";
const INDIGO = "#2C3E7B";
const GARUDA_MARK = "◆◢";

const GARUDA_LOGO: { text: string; color: string }[] = [
  { text: "              /\\              ", color: GOLD },
  { text: "             /  \\             ", color: GOLD },
  { text: "            / ◤  ◥\\            ", color: GOLD },
  { text: "           /  /\\  \\           ", color: GOLD },
  { text: "     /\\   /  /  \\  \\   /\\     ", color: ORANGE },
  { text: "    /  \\ /  /    \\  \\ /  \\    ", color: ORANGE },
  { text: "   / ◤ ◥/  /  ▲▲  \\  \\ ◤ ◥   ", color: ORANGE },
  { text: "  /  /\\ /  / ◢██◣  \\  \\ /\\  ", color: ORANGE },
  { text: " /  / / \\  / ████  \\ / \\ \\  ", color: INDIGO },
  { text: " \\  \\ \\ /  \\ ████  / \\ / /  ", color: INDIGO },
  { text: "  \\  \\  /    \\███/    \\  \\  / ", color: INDIGO },
  { text: "   \\  \\/  ▲   ▀▀▀   ▲  \\/   ", color: INDIGO },
  { text: "    \\ /   █▄▄▄▄▄▄▄▄█   \\ /  ", color: ORANGE },
  { text: "     V    ▀▀▀▀▀▀▀▀▀▀▀    V   ", color: ORANGE },
];

const GARUDA_BANNER = [
  "   ██████╗  █████╗ ██████╗ ██╗   ██╗██████╗  █████╗",
  "  ██╔════╝ ██╔══██╗██╔══██╗██║   ██║██╔══██╗██╔══██╗",
  "  ██║  ███╗███████║██████╔╝██║   ██║██║  ██║███████║",
  "  ██║   ██║██╔══██║██╔══██╗██║   ██║██║  ██║██╔══██║",
  "  ╚██████╔╝██║  ██║██║  ██║╚██████╔╝██████╔╝██║  ██║",
  "   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝",
];

interface LogEntry {
  kind: "user" | "assistant" | "tool" | "system";
  text: string;
}

interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
}

export function App({
  provider,
  providerId,
  model,
  cwd,
  yolo,
  tools,
  sessionId,
  initialMessages,
  onHistoryChange,
  maxHistoryMessages = 40,
  providerIds = [],
  providerOptions = [],
  onProviderChange,
  onProviderProfileSave,
}: {
  provider: Provider;
  providerId: string;
  model: string;
  cwd: string;
  yolo: boolean;
  tools?: Tool[];
  sessionId?: string;
  initialMessages?: Message[];
  onHistoryChange?: (messages: Message[]) => void;
  maxHistoryMessages?: number;
  providerIds?: string[];
  providerOptions?: ProviderOption[];
  onProviderChange?: (providerId: string, model?: string) => Promise<{ provider: Provider; providerId: string; model: string }>;
  onProviderProfileSave?: (providerId: string, model: string, apiKey: string) => Promise<{ provider: Provider; providerId: string; model: string }>;
}) {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [workspaceTrusted, setWorkspaceTrusted] = useState(false);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [providerManagerMode, setProviderManagerMode] = useState<"menu" | "profiles" | "presets">("menu");
  const [selectedProvider, setSelectedProvider] = useState(0);
  const [providerWizard, setProviderWizard] = useState<{ presetId: string; label: string; stage: "model" | "key"; model: string } | null>(null);
  const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0, estimatedContextTokens: 0 });
  const [activeProviderId, setActiveProviderId] = useState(providerId);
  const [activeModel, setActiveModel] = useState(model);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const slashSuggestions = input.startsWith("/")
    ? SLASH_COMMANDS.filter((command) => command.name.startsWith(input.slice(1).split(/\s/, 1)[0].toLowerCase()))
    : [];
  const visibleSuggestions = slashSuggestions.slice(0, 16);
  const [log, setLog] = useState<LogEntry[]>(
    () =>
      (initialMessages ?? [])
        .filter((m) => m.role !== "tool")
        .flatMap((m): LogEntry[] =>
          m.content
            .filter((b): b is { type: "text"; text: string } => b.type === "text" && Boolean(b.text.trim()))
            .map((b) => ({ kind: m.role === "user" ? "user" : "assistant", text: b.text }))
        )
  );
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const [agent] = useState(
    () =>
      new AgentLoop({
        provider,
        cwd,
        yolo,
        tools,
        initialHistory: initialMessages,
        onHistoryChange,
        maxHistoryMessages,
        confirm: (message) =>
          new Promise<boolean>((resolve) => {
            setPendingConfirm({ message, resolve });
          }),
      })
  );

  useInput((inputChar, key) => {
    if (!workspaceTrusted) {
      if (inputChar.toLowerCase() === "y" || inputChar === "1" || key.return) {
        setWorkspaceTrusted(true);
      } else if (inputChar.toLowerCase() === "n" || inputChar === "2" || key.escape) {
        exit();
      }
      return;
    }
    if (providerWizard) {
      if (key.escape) {
        if (providerWizard.stage === "key") {
          setProviderWizard({ ...providerWizard, stage: "model" });
          setInput(providerWizard.model);
        } else {
          setProviderWizard(null);
          setInput("");
        }
      }
      return;
    }
    if (providerPickerOpen) {
      if (key.escape) {
        setProviderPickerOpen(false);
      } else if (key.upArrow || key.downArrow) {
        const limit = providerManagerMode === "menu" ? 2 : Math.max(providerOptions.length - 1, 0);
        setSelectedProvider((index) => key.upArrow ? Math.max(0, index - 1) : Math.min(limit, index + 1));
      } else if (key.return) {
        if (providerManagerMode === "menu") {
          if (selectedProvider === 0) {
            setProviderManagerMode("presets");
            setSelectedProvider(0);
          } else if (selectedProvider === 1) {
            setProviderManagerMode("profiles");
            setSelectedProvider(Math.max(0, providerOptions.findIndex((option) => option.id === activeProviderId)));
          } else {
            setProviderPickerOpen(false);
          }
        } else if (providerManagerMode === "presets" && providerOptions[selectedProvider]) {
          const option = providerOptions[selectedProvider];
          setProviderPickerOpen(false);
          setProviderWizard({ presetId: option.id, label: option.label, stage: "model", model: option.defaultModel });
          setInput(option.defaultModel);
        } else if (providerManagerMode === "profiles" && providerOptions[selectedProvider] && onProviderChange) {
          const option = providerOptions[selectedProvider];
          setBusy(true);
          void onProviderChange(option.id).then((next) => {
            agent.setProvider(next.provider);
            setActiveProviderId(next.providerId);
            setActiveModel(next.model);
            setProviderPickerOpen(false);
            setLog((items) => [...items, { kind: "system", text: `Switched to ${next.providerId}:${next.model}.` }]);
          }).catch((err) => {
            setLog((items) => [...items, { kind: "system", text: `Provider switch failed: ${(err as Error).message}` }]);
          }).finally(() => setBusy(false));
        }
      }
      return;
    }
    if (pendingConfirm) {
      if (inputChar.toLowerCase() === "y") {
        pendingConfirm.resolve(true);
        setPendingConfirm(null);
      } else if (inputChar.toLowerCase() === "n" || key.escape) {
        pendingConfirm.resolve(false);
        setPendingConfirm(null);
      }
      return;
    }
    if (key.ctrl && inputChar === "c") exit();
    if (key.upArrow && visibleSuggestions.length > 0) {
      setSelectedSuggestion((index) => Math.max(0, index - 1));
    }
    if (key.downArrow && visibleSuggestions.length > 0) {
      setSelectedSuggestion((index) => Math.min(visibleSuggestions.length - 1, index + 1));
    }
    if (key.tab && visibleSuggestions.length > 0) {
      setInput(`/${visibleSuggestions[selectedSuggestion]?.name ?? visibleSuggestions[0].name} `);
      setSelectedSuggestion(0);
    }
  });

  const handleSubmit = useCallback(
    async (value: string) => {
      const text = value.trim();
      if (!text || busy) return;
      setInput("");
      if (providerWizard) {
        if (providerWizard.stage === "model") {
          setProviderWizard({ ...providerWizard, stage: "key", model: text });
          return;
        }
        if (!onProviderProfileSave) return;
        setBusy(true);
        try {
          const next = await onProviderProfileSave(providerWizard.presetId, providerWizard.model, text);
          agent.setProvider(next.provider);
          setActiveProviderId(next.providerId);
          setActiveModel(next.model);
          setProviderWizard(null);
          setLog((items) => [...items, { kind: "system", text: `Provider profile saved: ${next.providerId}:${next.model}.` }]);
        } catch (err) {
          setLog((items) => [...items, { kind: "system", text: `Profile setup failed: ${(err as Error).message}` }]);
        } finally {
          setBusy(false);
        }
        return;
      }
      if (text === "/exit" || text === "/quit") {
        exit();
        return;
      }
      if (text.startsWith("/")) {
        const [rawName] = text.slice(1).trim().split(/\s+/, 1);
        const command = getSlashCommand(rawName?.toLowerCase() ?? "");
        if (!command) {
          setLog((l) => [...l, { kind: "system", text: `Unknown command: /${rawName}. Try /help.` }]);
          return;
        }
        if (command.name === "clear") {
          agent.clearHistory();
          setLog([]);
          setUsage(agent.getUsage());
          return;
        }
        if (command.name === "compact") {
          agent.compactHistory();
          setLog((l) => [...l, { kind: "system", text: `Context compacted to about ${agent.getUsage().estimatedContextTokens} tokens.` }]);
          setUsage(agent.getUsage());
          return;
        }
        if (command.name === "help") {
          setLog((l) => [...l, { kind: "system", text: SLASH_COMMANDS.map((item) => `/${item.name} - ${item.description}`).join("\n") }]);
          return;
        }
        if (command.name === "status" || command.name === "context") {
          const current = agent.getUsage();
          setLog((l) => [...l, { kind: "system", text: `${activeProviderId}:${activeModel} | context ~${current.estimatedContextTokens} tokens | input ${current.inputTokens} | output ${current.outputTokens}` }]);
          return;
        }
        if (command.name === "provider" || command.name === "model") {
          const args = text.slice((rawName?.length ?? 0) + 1).trim().split(/\s+/).filter(Boolean);
          if (command.name === "provider" && args[0] === "add") {
            setProviderManagerMode("presets");
            setSelectedProvider(0);
            setProviderPickerOpen(true);
            return;
          }
          if (!args.length) {
            if (command.name === "provider") {
              setSelectedProvider(Math.max(0, providerOptions.findIndex((option) => option.id === activeProviderId)));
              setProviderManagerMode("menu");
              setSelectedProvider(0);
              setProviderPickerOpen(true);
            } else {
              setLog((l) => [...l, { kind: "system", text: `Active model: ${activeModel}\nUsage: /model <model-name>` }]);
            }
            return;
          }
          if (!onProviderChange) {
            setLog((l) => [...l, { kind: "system", text: "Provider switching is unavailable in this session." }]);
            return;
          }
          const requestedProvider = command.name === "provider" ? args[0] : activeProviderId;
          const requestedModel = command.name === "provider" ? args[1] : args[0];
          setBusy(true);
          try {
            const next = await onProviderChange(requestedProvider, requestedModel);
            agent.setProvider(next.provider);
            setActiveProviderId(next.providerId);
            setActiveModel(next.model);
            setLog((l) => [...l, { kind: "system", text: `Switched to ${next.providerId}:${next.model}.` }]);
          } catch (err) {
            setLog((l) => [...l, { kind: "system", text: `Provider switch failed: ${(err as Error).message}` }]);
          } finally {
            setBusy(false);
          }
          return;
        }
        if (command.name === "models") {
          setBusy(true);
          try {
            const models = await agent.listModels();
            setLog((l) => [...l, { kind: "system", text: models.length ? models.join("\n") : "The active provider does not expose a model catalog." }]);
          } catch (err) {
            setLog((l) => [...l, { kind: "system", text: `Model lookup failed: ${(err as Error).message}` }]);
          } finally {
            setBusy(false);
          }
          return;
        }
        if (command.name === "skills") {
          setLog((l) => [...l, { kind: "system", text: BUILTIN_SKILLS.map((skill) => `/${skill.id} - ${skill.description}`).join("\n") }]);
          return;
        }
        if (command.name === "tools") {
          setLog((l) => [...l, { kind: "system", text: (tools ?? []).map((tool) => tool.definition.name).join(", ") || "No tools loaded." }]);
          return;
        }
        if (["debug", "security", "performance", "refactor", "test", "document"].includes(command.name)) {
          setLog((l) => [...l, { kind: "system", text: `Activating ${command.name} skill...` }]);
          setBusy(true);
          try {
            await agent.send(`${command.description}. Apply this skill to the following task: ${text.slice(command.name.length + 1).trim() || "the current codebase"}`, {
              onAssistantText: (t) => setLog((l) => [...l, { kind: "assistant", text: t }]),
              onToolCall: (name, toolInput) => setLog((l) => [...l, { kind: "tool", text: `→ ${name}(${JSON.stringify(toolInput)})` }]),
              onToolResult: (name, result, isError) => setLog((l) => [...l, { kind: "tool", text: `${isError ? "✗" : "✓"} ${name}: ${result.slice(0, 300)}` }]),
              onUsage: setUsage,
            });
          } catch (err) {
            setLog((l) => [...l, { kind: "system", text: `Error: ${(err as Error).message}` }]);
          } finally {
            setBusy(false);
          }
          return;
        }
        if (["plan", "review", "security-review", "diff", "doctor", "diagnostics"].includes(command.name)) {
          setLog((l) => [...l, { kind: "system", text: `Running ${command.name} workflow...` }]);
          setBusy(true);
          try {
            await agent.send(`Run a ${command.name} workflow for this repository. Inspect the relevant files and tools first, then provide concrete findings or a plan. User details: ${text.slice(command.name.length + 1).trim() || "none"}`, {
              onAssistantText: (t) => setLog((l) => [...l, { kind: "assistant", text: t }]),
              onToolCall: (name, toolInput) => setLog((l) => [...l, { kind: "tool", text: `→ ${name}(${JSON.stringify(toolInput)})` }]),
              onToolResult: (name, result, isError) => setLog((l) => [...l, { kind: "tool", text: `${isError ? "✗" : "✓"} ${name}: ${result.slice(0, 300)}` }]),
              onUsage: setUsage,
            });
          } catch (err) {
            setLog((l) => [...l, { kind: "system", text: `Error: ${(err as Error).message}` }]);
          } finally {
            setBusy(false);
          }
          return;
        }
        setLog((l) => [...l, { kind: "system", text: `/${command.name} is recognized, but this integration is not wired into the local CLI yet.` }]);
        return;
      }
      setLog((l) => [...l, { kind: "user", text }]);
      setBusy(true);
      try {
        await agent.send(text, {
          onAssistantText: (t) => setLog((l) => [...l, { kind: "assistant", text: t }]),
          onToolCall: (name, toolInput) =>
            setLog((l) => [...l, { kind: "tool", text: `→ ${name}(${JSON.stringify(toolInput)})` }]),
          onToolResult: (name, result, isError) =>
            setLog((l) => [
              ...l,
              { kind: "tool", text: `${isError ? "✗" : "✓"} ${name}: ${result.slice(0, 300)}` },
            ]),
            onUsage: setUsage,
        });
      } catch (err) {
        setLog((l) => [...l, { kind: "system", text: `Error: ${(err as Error).message}` }]);
      } finally {
        setBusy(false);
      }
    },
    [activeModel, activeProviderId, agent, busy, exit, onProviderChange, onProviderProfileSave, providerIds, providerOptions, providerWizard]
  );

  return (
    <Box flexDirection="column" padding={1}>
      {!workspaceTrusted ? (
        <>
          <Box flexDirection="column" marginBottom={1}>
            {GARUDA_LOGO.map((line, i) => <Text key={`logo-${i}`} color={line.color}>{line.text}</Text>)}
            {GARUDA_BANNER.map((line) => <Text key={line} color={GOLD} bold>{line}</Text>)}
            <Text color="gray">{`  ${GARUDA_MARK}  AI coding terminal for teams that ship.`}</Text>
          </Box>
          <Box flexDirection="column" borderStyle="double" borderColor={GOLD} paddingX={1} marginBottom={1}>
            <Text color={GOLD} bold>GARUDA SESSION</Text>
            <Text>Provider  <Text color={GOLD}>{activeProviderId}</Text></Text>
            <Text>Model     <Text color={GOLD}>{activeModel}</Text></Text>
            <Text>Workspace <Text color={INDIGO}>{cwd}</Text></Text>
            <Text color="green">● local runtime ready</Text>
          </Box>
          <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
            <Text color="yellow" bold>Workspace access</Text>
            <Text>Garuda may read, edit, and execute tools in this folder.</Text>
            <Text color="gray">Only continue if you created or trust this project.</Text>
            <Text color={GOLD}>[Y] Trust folder    [N] Exit</Text>
          </Box>
        </>
      ) : (
        <Box borderStyle="round" borderColor={GOLD} paddingX={1} marginBottom={1}>
          <Text color={GOLD} bold>{GARUDA_MARK} GARUDA CODE{"  "}</Text>
          <Text color={INDIGO}>
            {activeProviderId}:{activeModel} · {cwd}
            {sessionId ? ` · session ${sessionId}` : ""}
          </Text>
        </Box>
      )}

      {workspaceTrusted && <Box flexDirection="column" marginBottom={1}>
        {log.slice(-200).map((entry, i) => (
          <Box key={i} marginBottom={entry.kind === "assistant" ? 1 : 0}>
            {entry.kind === "user" && <Text color="white">{"> "}{entry.text}</Text>}
            {entry.kind === "assistant" && <Text color={GOLD}>{entry.text}</Text>}
            {entry.kind === "tool" && <Text color="gray">  {entry.text}</Text>}
            {entry.kind === "system" && <Text color="red">{entry.text}</Text>}
          </Box>
        ))}
      </Box>}

      {!workspaceTrusted ? null : providerWizard ? (
        <Box flexDirection="column" borderStyle="double" borderColor={GOLD} paddingX={1}>
          <Text color={GOLD} bold>Create provider profile</Text>
          <Text>{providerWizard.label}</Text>
          <Text color="gray">{providerWizard.stage === "model" ? "Default model (Enter to continue)" : "API key (stored in ~/.garuda/config.json)"}</Text>
          <Box><Text color={INDIGO}>❯ </Text><TextInput value={input} onChange={setInput} onSubmit={handleSubmit} mask={providerWizard.stage === "key" ? "*" : undefined} /></Box>
          <Text color="gray">Enter continues · Ctrl+C exits</Text>
        </Box>
      ) : providerPickerOpen ? (
        <Box flexDirection="column" borderStyle="double" borderColor={GOLD} paddingX={1}>
          <Text color={GOLD} bold>Provider manager</Text>
          <Text color="gray">Active profile: {activeProviderId}:{activeModel}</Text>
          <Text color="gray">Choose a provider profile. Up/Down selects · Enter switches · Esc closes</Text>
          {providerManagerMode === "menu" && ["Add provider profile", "Set active provider", "Done"].map((label, index) => <Text key={label} color={index === selectedProvider ? GOLD : "gray"}>{index === selectedProvider ? "› " : "  "}{index + 1}. {label}</Text>)}
          {providerManagerMode !== "menu" && providerOptions.slice(0, 18).map((option, index) => <Text key={option.id} color={index === selectedProvider ? GOLD : "gray"}>{index === selectedProvider ? "› " : "  "}{option.label} ({option.id}) {option.configured ? "● configured" : "○ setup needed"}</Text>)}
          {!providerOptions.length && <Text color="yellow">No provider profiles are available.</Text>}
        </Box>
      ) : pendingConfirm ? (
        <Box borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow">{pendingConfirm.message} [y/n] </Text>
        </Box>
      ) : (
        <Box flexDirection="column" borderStyle="round" borderColor={busy ? "gray" : INDIGO} paddingX={1}>
          {slashSuggestions.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              {visibleSuggestions.map((suggestion, index) => (
                <Text key={suggestion.name} color={index === selectedSuggestion ? GOLD : "gray"}>
                  {index === selectedSuggestion ? "› " : "  "}{`/${suggestion.name}`} <Text color="gray">{suggestion.description}</Text>
                </Text>
              ))}
              <Text color="gray">
                {slashSuggestions.length > visibleSuggestions.length
                  ? `Showing ${visibleSuggestions.length} of ${slashSuggestions.length}. Type to filter. `
                  : `${slashSuggestions.length} command${slashSuggestions.length === 1 ? "" : "s"}. `}
                Up/Down selects · Tab completes · Enter runs
              </Text>
            </Box>
          )}
          <Box>
          <Text color={INDIGO}>{"❯ "}</Text>
          <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} showCursor={!busy} />
          </Box>
        </Box>
      )}
      {busy && <Text color="gray">Garuda is working… (Ctrl+C to force quit)</Text>}
      <Text color="gray">context ~{usage.estimatedContextTokens} tokens · in {usage.inputTokens} · out {usage.outputTokens}</Text>
    </Box>
  );
}
