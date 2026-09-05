import { ALL_TOOLS } from "../tools/index.js";
import { buildSystemPrompt } from "./systemPrompt.js";
export class AgentLoop {
    history = [];
    provider;
    cwd;
    confirm;
    yolo;
    tools;
    onHistoryChange;
    maxHistoryMessages;
    usage = { inputTokens: 0, outputTokens: 0 };
    constructor(opts) {
        this.provider = opts.provider;
        this.cwd = opts.cwd;
        this.yolo = opts.yolo ?? false;
        this.confirm = opts.confirm ?? (async () => true);
        this.tools = opts.tools ?? ALL_TOOLS;
        this.history = opts.initialHistory ?? [];
        this.onHistoryChange = opts.onHistoryChange;
        this.maxHistoryMessages = Math.max(12, opts.maxHistoryMessages ?? 40);
    }
    getToolByName(name) {
        return this.tools.find((t) => t.definition.name === name);
    }
    getHistory() {
        return this.history;
    }
    loadHistory(messages) {
        this.history = messages;
    }
    setProvider(provider) {
        this.provider = provider;
    }
    async listModels() {
        return this.provider.listModels ? this.provider.listModels() : [];
    }
    async send(userText, events = {}) {
        this.compactHistory();
        this.history.push({ role: "user", content: [{ type: "text", text: userText }] });
        const toolCtx = { cwd: this.cwd, confirm: this.confirm };
        const systemPrompt = buildSystemPrompt(this.cwd);
        const toolDefs = this.tools.map((t) => t.definition);
        this.onHistoryChange?.(this.history);
        // Loop until the model stops asking for tools.
        for (let turn = 0; turn < 50; turn++) {
            const response = await this.provider.complete({
                systemPrompt,
                messages: this.history,
                tools: toolDefs,
            });
            if (response.usage) {
                this.usage.inputTokens += response.usage.inputTokens;
                this.usage.outputTokens += response.usage.outputTokens;
            }
            events.onUsage?.({ ...this.usage, estimatedContextTokens: this.estimateTokens() });
            this.history.push({ role: "assistant", content: response.content });
            this.onHistoryChange?.(this.history);
            for (const block of response.content) {
                if (block.type === "text" && block.text.trim()) {
                    events.onAssistantText?.(block.text);
                }
            }
            if (response.stopReason !== "tool_use") {
                return; // done — final answer given
            }
            const toolUses = response.content.filter((b) => b.type === "tool_use");
            const resultBlocks = [];
            for (const call of toolUses) {
                events.onToolCall?.(call.name, call.input);
                const tool = this.getToolByName(call.name);
                if (!tool) {
                    resultBlocks.push({
                        type: "tool_result",
                        toolCallId: call.id,
                        content: `Unknown tool: ${call.name}`,
                        isError: true,
                    });
                    events.onToolResult?.(call.name, "Unknown tool", true);
                    continue;
                }
                if (tool.requiresConfirmation && !this.yolo) {
                    const approved = await this.confirm(`Run tool "${call.name}" with input ${JSON.stringify(call.input)}?`);
                    if (!approved) {
                        resultBlocks.push({
                            type: "tool_result",
                            toolCallId: call.id,
                            content: "User declined to run this tool.",
                            isError: true,
                        });
                        events.onToolResult?.(call.name, "declined by user", true);
                        continue;
                    }
                }
                try {
                    const result = await tool.run(call.input, toolCtx);
                    resultBlocks.push({ type: "tool_result", toolCallId: call.id, content: result });
                    events.onToolResult?.(call.name, result, false);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    resultBlocks.push({ type: "tool_result", toolCallId: call.id, content: message, isError: true });
                    events.onToolResult?.(call.name, message, true);
                }
            }
            this.history.push({ role: "tool", content: resultBlocks });
            this.onHistoryChange?.(this.history);
        }
        events.onAssistantText?.("(stopped: reached max tool-call turns for this message)");
    }
    compactHistory() {
        if (this.history.length <= this.maxHistoryMessages)
            return;
        const start = this.history.length - this.maxHistoryMessages;
        const firstUser = this.history.findIndex((message, index) => index >= start && message.role === "user");
        this.history = this.history.slice(firstUser >= 0 ? firstUser : start);
        this.onHistoryChange?.(this.history);
    }
    clearHistory() {
        this.history = [];
        this.onHistoryChange?.(this.history);
    }
    getUsage() {
        return { ...this.usage, estimatedContextTokens: this.estimateTokens() };
    }
    estimateTokens() {
        return Math.ceil(JSON.stringify(this.history).length / 4);
    }
}
