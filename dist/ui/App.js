import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import { AgentLoop } from "../agent/loop.js";
import { getSlashCommand, SLASH_COMMANDS } from "../commands.js";
import { BUILTIN_SKILLS, SKILL_CATEGORIES } from "../skills/registry.js";
import { FIRST_RUN_GUIDE } from "../guide.js";
const GOLD = "#D4A017";
const INDIGO = "#2C3E7B";
const GARUDA_ATTRIBUTION = "Designed and built by Adarsh VinodKumar Singh";
export function App({ provider, providerId, model, cwd, yolo, tools, sessionId, initialMessages, onHistoryChange, maxHistoryMessages = 40, providerIds = [], providerOptions = [], onProviderChange, onProviderProfileSave, updateNotice, }) {
    const { exit } = useApp();
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [workspaceTrusted, setWorkspaceTrusted] = useState(false);
    const [providerPickerOpen, setProviderPickerOpen] = useState(false);
    const [providerManagerMode, setProviderManagerMode] = useState("menu");
    const [selectedProvider, setSelectedProvider] = useState(0);
    const [providerWizard, setProviderWizard] = useState(null);
    const [usage, setUsage] = useState({ inputTokens: 0, outputTokens: 0, estimatedContextTokens: 0 });
    const [activeProviderId, setActiveProviderId] = useState(providerId);
    const [activeModel, setActiveModel] = useState(model);
    const [selectedSuggestion, setSelectedSuggestion] = useState(0);
    const slashSuggestions = input.startsWith("/")
        ? SLASH_COMMANDS.filter((command) => command.name.startsWith(input.slice(1).split(/\s/, 1)[0].toLowerCase()))
        : [];
    const visibleSuggestions = slashSuggestions.slice(0, 16);
    const [log, setLog] = useState(() => (initialMessages ?? [])
        .filter((m) => m.role !== "tool")
        .flatMap((m) => m.content
        .filter((b) => b.type === "text" && Boolean(b.text.trim()))
        .map((b) => ({ kind: m.role === "user" ? "user" : "assistant", text: b.text }))));
    useEffect(() => {
        if (updateNotice)
            setLog((items) => [...items, { kind: "system", text: updateNotice }]);
    }, [updateNotice]);
    const [pendingConfirm, setPendingConfirm] = useState(null);
    const [agent] = useState(() => new AgentLoop({
        provider,
        cwd,
        yolo,
        tools,
        initialHistory: initialMessages,
        onHistoryChange,
        maxHistoryMessages,
        confirm: (message) => new Promise((resolve) => {
            setPendingConfirm({ message, resolve });
        }),
    }));
    useInput((inputChar, key) => {
        if (!workspaceTrusted) {
            if (inputChar.toLowerCase() === "y" || inputChar === "1" || key.return) {
                setWorkspaceTrusted(true);
            }
            else if (inputChar.toLowerCase() === "n" || inputChar === "2" || key.escape) {
                exit();
            }
            return;
        }
        if (providerWizard) {
            if (key.escape) {
                if (providerWizard.stage === "key") {
                    setProviderWizard({ ...providerWizard, stage: "model" });
                    setInput(providerWizard.model);
                }
                else {
                    setProviderWizard(null);
                    setInput("");
                }
            }
            return;
        }
        if (providerPickerOpen) {
            if (key.escape) {
                setProviderPickerOpen(false);
            }
            else if (key.upArrow || key.downArrow) {
                const limit = providerManagerMode === "menu" ? 2 : Math.max(providerOptions.length - 1, 0);
                setSelectedProvider((index) => key.upArrow ? Math.max(0, index - 1) : Math.min(limit, index + 1));
            }
            else if (key.return) {
                if (providerManagerMode === "menu") {
                    if (selectedProvider === 0) {
                        setProviderManagerMode("presets");
                        setSelectedProvider(0);
                    }
                    else if (selectedProvider === 1) {
                        setProviderManagerMode("profiles");
                        setSelectedProvider(Math.max(0, providerOptions.findIndex((option) => option.id === activeProviderId)));
                    }
                    else {
                        setProviderPickerOpen(false);
                    }
                }
                else if (providerManagerMode === "presets" && providerOptions[selectedProvider]) {
                    const option = providerOptions[selectedProvider];
                    setProviderPickerOpen(false);
                    setProviderWizard({ presetId: option.id, label: option.label, stage: "model", model: option.defaultModel });
                    setInput(option.defaultModel);
                }
                else if (providerManagerMode === "profiles" && providerOptions[selectedProvider] && onProviderChange) {
                    const option = providerOptions[selectedProvider];
                    setBusy(true);
                    void onProviderChange(option.id).then((next) => {
                        agent.setProvider(next.provider);
                        setActiveProviderId(next.providerId);
                        setActiveModel(next.model);
                        setProviderPickerOpen(false);
                        setLog((items) => [...items, { kind: "system", text: `Switched to ${next.providerId}:${next.model}.` }]);
                    }).catch((err) => {
                        setLog((items) => [...items, { kind: "system", text: `Provider switch failed: ${err.message}` }]);
                    }).finally(() => setBusy(false));
                }
            }
            return;
        }
        if (pendingConfirm) {
            if (inputChar.toLowerCase() === "y") {
                pendingConfirm.resolve(true);
                setPendingConfirm(null);
            }
            else if (inputChar.toLowerCase() === "n" || key.escape) {
                pendingConfirm.resolve(false);
                setPendingConfirm(null);
            }
            return;
        }
        if (key.ctrl && inputChar === "c")
            exit();
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
    const handleSubmit = useCallback(async (value) => {
        const text = value.trim();
        if (!text || busy)
            return;
        setInput("");
        if (providerWizard) {
            if (providerWizard.stage === "model") {
                setProviderWizard({ ...providerWizard, stage: "key", model: text });
                return;
            }
            if (!onProviderProfileSave)
                return;
            setBusy(true);
            try {
                const next = await onProviderProfileSave(providerWizard.presetId, providerWizard.model, text);
                agent.setProvider(next.provider);
                setActiveProviderId(next.providerId);
                setActiveModel(next.model);
                setProviderWizard(null);
                setLog((items) => [...items, { kind: "system", text: `Provider profile saved: ${next.providerId}:${next.model}.` }]);
            }
            catch (err) {
                setLog((items) => [...items, { kind: "system", text: `Profile setup failed: ${err.message}` }]);
            }
            finally {
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
            if (command.name === "guide") {
                setLog((l) => [...l, { kind: "system", text: FIRST_RUN_GUIDE }]);
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
                    }
                    else {
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
                }
                catch (err) {
                    setLog((l) => [...l, { kind: "system", text: `Provider switch failed: ${err.message}` }]);
                }
                finally {
                    setBusy(false);
                }
                return;
            }
            if (command.name === "models") {
                setBusy(true);
                try {
                    const models = await agent.listModels();
                    setLog((l) => [...l, { kind: "system", text: models.length ? models.join("\n") : "The active provider does not expose a model catalog." }]);
                }
                catch (err) {
                    setLog((l) => [...l, { kind: "system", text: `Model lookup failed: ${err.message}` }]);
                }
                finally {
                    setBusy(false);
                }
                return;
            }
            if (command.name === "skills") {
                const grouped = BUILTIN_SKILLS.reduce((acc, skill) => {
                    const cat = skill.category || "other";
                    if (!acc[cat])
                        acc[cat] = [];
                    acc[cat].push(skill);
                    return acc;
                }, {});
                const lines = [];
                for (const [cat, skills] of Object.entries(grouped)) {
                    lines.push(`\n${SKILL_CATEGORIES[cat] ?? cat}:`);
                    for (const skill of skills) {
                        lines.push(`  /${skill.id.padEnd(14)} ${skill.description}`);
                    }
                }
                setLog((l) => [...l, { kind: "system", text: lines.join("\n") }]);
                return;
            }
            if (command.name === "tools") {
                setLog((l) => [...l, { kind: "system", text: (tools ?? []).map((tool) => tool.definition.name).join(", ") || "No tools loaded." }]);
                return;
            }
            if (["debug", "security", "performance", "refactor", "test", "document", "lint", "typecheck", "complexity", "deadcode", "dependency", "arch", "migrate", "design", "decompose", "ci", "docker", "deploy", "monitor", "sql", "schema", "cache", "api", "auth", "js", "ts", "react", "nextjs", "css", "tailwind", "state", "fetch", "threejs", "webgl", "r3f", "drei", "glsl", "gltf", "3d-perf", "postfx", "physics3d", "3d-anim", "gsap", "framer", "css-anim", "scroll", "page-trans", "lottie", "easing", "designsys", "typography", "color", "responsive", "a11y", "micro", "figma", "ux-flow", "skeleton", "python", "fastapi", "pyasync", "pyauth", "pydb", "pyapi", "pyval", "pytest", "pydeploy", "git", "testing", "cicd", "perf", "sec", "observe", "arch-full", "docs", "dsa", "sysdesign", "oop", "dbdesign", "networking", "os-concepts", "cloud", "caching-strat", "msg-queue", "search-eng", "ml-basics", "behavioral", "code-review", "debug-strat", "refactor-pro", "product-sense", "estimation", "leetcode-hard", "interview-prep", "resume-build"].includes(command.name)) {
                setLog((l) => [...l, { kind: "system", text: `Activating ${command.name} skill...` }]);
                setBusy(true);
                try {
                    await agent.send(`${command.description}. Apply this skill to the following task: ${text.slice(command.name.length + 1).trim() || "the current codebase"}`, {
                        onAssistantText: (t) => setLog((l) => [...l, { kind: "assistant", text: t }]),
                        onToolCall: (name, toolInput) => setLog((l) => [...l, { kind: "tool", text: `→ ${name}(${JSON.stringify(toolInput)})` }]),
                        onToolResult: (name, result, isError) => setLog((l) => [...l, { kind: "tool", text: `${isError ? "✗" : "✓"} ${name}: ${result.slice(0, 300)}` }]),
                        onUsage: setUsage,
                    });
                }
                catch (err) {
                    setLog((l) => [...l, { kind: "system", text: `Error: ${err.message}` }]);
                }
                finally {
                    setBusy(false);
                }
                return;
            }
            if (["plan", "review", "security-review", "diff", "doctor", "diagnostics", "threejs-audit", "shader-audit", "react-audit", "fastapi-audit", "perf-budget", "a11y-audit", "code-review", "system-design", "algo-analysis", "interview-prep"].includes(command.name)) {
                setLog((l) => [...l, { kind: "system", text: `Running ${command.name} workflow...` }]);
                setBusy(true);
                try {
                    await agent.send(`Run a ${command.name} workflow for this repository. Inspect the relevant files and tools first, then provide concrete findings or a plan. User details: ${text.slice(command.name.length + 1).trim() || "none"}`, {
                        onAssistantText: (t) => setLog((l) => [...l, { kind: "assistant", text: t }]),
                        onToolCall: (name, toolInput) => setLog((l) => [...l, { kind: "tool", text: `→ ${name}(${JSON.stringify(toolInput)})` }]),
                        onToolResult: (name, result, isError) => setLog((l) => [...l, { kind: "tool", text: `${isError ? "✗" : "✓"} ${name}: ${result.slice(0, 300)}` }]),
                        onUsage: setUsage,
                    });
                }
                catch (err) {
                    setLog((l) => [...l, { kind: "system", text: `Error: ${err.message}` }]);
                }
                finally {
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
                onToolCall: (name, toolInput) => setLog((l) => [...l, { kind: "tool", text: `→ ${name}(${JSON.stringify(toolInput)})` }]),
                onToolResult: (name, result, isError) => setLog((l) => [
                    ...l,
                    { kind: "tool", text: `${isError ? "✗" : "✓"} ${name}: ${result.slice(0, 300)}` },
                ]),
                onUsage: setUsage,
            });
        }
        catch (err) {
            setLog((l) => [...l, { kind: "system", text: `Error: ${err.message}` }]);
        }
        finally {
            setBusy(false);
        }
    }, [activeModel, activeProviderId, agent, busy, exit, onProviderChange, onProviderProfileSave, providerIds, providerOptions, providerWizard]);
    return (React.createElement(Box, { flexDirection: "column", padding: 1 },
        !workspaceTrusted ? (React.createElement(React.Fragment, null,
            React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
                React.createElement(Text, { color: GOLD, bold: true }, "GARUDA CODE"),
                React.createElement(Text, { color: "gray" }, "AI coding terminal for teams that ship."),
                React.createElement(Text, { color: INDIGO, bold: true }, `  ${GARUDA_ATTRIBUTION}`)),
            React.createElement(Box, { flexDirection: "column", borderStyle: "double", borderColor: GOLD, paddingX: 1, marginBottom: 1 },
                React.createElement(Text, { color: GOLD, bold: true }, "GARUDA SESSION"),
                React.createElement(Text, null,
                    "Provider  ",
                    React.createElement(Text, { color: GOLD }, activeProviderId)),
                React.createElement(Text, null,
                    "Model     ",
                    React.createElement(Text, { color: GOLD }, activeModel)),
                React.createElement(Text, null,
                    "Workspace ",
                    React.createElement(Text, { color: INDIGO }, cwd)),
                React.createElement(Text, { color: "green" }, "\u25CF local runtime ready")),
            React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: "yellow", paddingX: 1 },
                React.createElement(Text, { color: "yellow", bold: true }, "Workspace access"),
                React.createElement(Text, null, "Garuda may read, edit, and execute tools in this folder."),
                React.createElement(Text, { color: "gray" }, "Only continue if you created or trust this project."),
                React.createElement(Text, { color: GOLD }, "[Y] Trust folder    [N] Exit")))) : (React.createElement(Box, { borderStyle: "round", borderColor: GOLD, paddingX: 1, marginBottom: 1 },
            React.createElement(Text, { color: GOLD, bold: true },
                "GARUDA CODE",
                "  "),
            React.createElement(Text, { color: INDIGO },
                activeProviderId,
                ":",
                activeModel,
                " \u00B7 ",
                cwd,
                sessionId ? ` · session ${sessionId}` : ""),
            React.createElement(Text, { color: "gray" }, " \u00B7 by Adarsh VinodKumar Singh"))),
        workspaceTrusted && React.createElement(Box, { flexDirection: "column", marginBottom: 1 }, log.slice(-200).map((entry, i) => (React.createElement(Box, { key: i, marginBottom: entry.kind === "assistant" ? 1 : 0 },
            entry.kind === "user" && React.createElement(Text, { color: "white" },
                "> ",
                entry.text),
            entry.kind === "assistant" && React.createElement(Text, { color: GOLD }, entry.text),
            entry.kind === "tool" && React.createElement(Text, { color: "gray" },
                "  ",
                entry.text),
            entry.kind === "system" && React.createElement(Text, { color: "red" }, entry.text))))),
        !workspaceTrusted ? null : providerWizard ? (React.createElement(Box, { flexDirection: "column", borderStyle: "double", borderColor: GOLD, paddingX: 1 },
            React.createElement(Text, { color: GOLD, bold: true }, "Create provider profile"),
            React.createElement(Text, null, providerWizard.label),
            React.createElement(Text, { color: "gray" }, providerWizard.stage === "model" ? "Default model (Enter to continue)" : "API key (stored in ~/.garuda/config.json)"),
            React.createElement(Box, null,
                React.createElement(Text, { color: INDIGO }, "\u276F "),
                React.createElement(TextInput, { value: input, onChange: setInput, onSubmit: handleSubmit, mask: providerWizard.stage === "key" ? "*" : undefined })),
            React.createElement(Text, { color: "gray" }, "Enter continues \u00B7 Ctrl+C exits"))) : providerPickerOpen ? (React.createElement(Box, { flexDirection: "column", borderStyle: "double", borderColor: GOLD, paddingX: 1 },
            React.createElement(Text, { color: GOLD, bold: true }, "Provider manager"),
            React.createElement(Text, { color: "gray" },
                "Active profile: ",
                activeProviderId,
                ":",
                activeModel),
            React.createElement(Text, { color: "gray" }, "Choose a provider profile. Up/Down selects \u00B7 Enter switches \u00B7 Esc closes"),
            providerManagerMode === "menu" && ["Add provider profile", "Set active provider", "Done"].map((label, index) => React.createElement(Text, { key: label, color: index === selectedProvider ? GOLD : "gray" },
                index === selectedProvider ? "› " : "  ",
                index + 1,
                ". ",
                label)),
            providerManagerMode !== "menu" && providerOptions.slice(0, 18).map((option, index) => React.createElement(Text, { key: option.id, color: index === selectedProvider ? GOLD : "gray" },
                index === selectedProvider ? "› " : "  ",
                option.label,
                " (",
                option.id,
                ") ",
                option.configured ? "● configured" : "○ setup needed")),
            !providerOptions.length && React.createElement(Text, { color: "yellow" }, "No provider profiles are available."))) : pendingConfirm ? (React.createElement(Box, { borderStyle: "round", borderColor: "yellow", paddingX: 1 },
            React.createElement(Text, { color: "yellow" },
                pendingConfirm.message,
                " [y/n] "))) : (React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: busy ? "gray" : INDIGO, paddingX: 1 },
            slashSuggestions.length > 0 && (React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
                visibleSuggestions.map((suggestion, index) => (React.createElement(Text, { key: suggestion.name, color: index === selectedSuggestion ? GOLD : "gray" },
                    index === selectedSuggestion ? "› " : "  ",
                    `/${suggestion.name}`,
                    " ",
                    React.createElement(Text, { color: "gray" }, suggestion.description)))),
                React.createElement(Text, { color: "gray" },
                    slashSuggestions.length > visibleSuggestions.length
                        ? `Showing ${visibleSuggestions.length} of ${slashSuggestions.length}. Type to filter. `
                        : `${slashSuggestions.length} command${slashSuggestions.length === 1 ? "" : "s"}. `,
                    "Up/Down selects \u00B7 Tab completes \u00B7 Enter runs"))),
            React.createElement(Box, null,
                React.createElement(Text, { color: INDIGO }, "❯ "),
                React.createElement(TextInput, { value: input, onChange: setInput, onSubmit: handleSubmit, showCursor: !busy })))),
        busy && React.createElement(Text, { color: "gray" }, "Garuda is working\u2026 (Ctrl+C to force quit)"),
        React.createElement(Text, { color: "gray" },
            "context ~",
            usage.estimatedContextTokens,
            " tokens \u00B7 in ",
            usage.inputTokens,
            " \u00B7 out ",
            usage.outputTokens)));
}
