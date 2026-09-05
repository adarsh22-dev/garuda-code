import OpenAI from "openai";
function toOpenAIMessages(systemPrompt, messages) {
    const out = [
        { role: "system", content: systemPrompt },
    ];
    for (const m of messages) {
        if (m.role === "tool") {
            for (const b of m.content) {
                if (b.type === "tool_result") {
                    out.push({
                        role: "tool",
                        tool_call_id: b.toolCallId,
                        content: b.content,
                    });
                }
            }
            continue;
        }
        const textParts = m.content.filter((b) => b.type === "text");
        const toolUses = m.content.filter((b) => b.type === "tool_use");
        if (m.role === "assistant" && toolUses.length) {
            out.push({
                role: "assistant",
                content: textParts.map((t) => t.text).join("\n") || null,
                tool_calls: toolUses.map((t) => ({
                    id: t.id,
                    type: "function",
                    function: { name: t.name, arguments: JSON.stringify(t.input) },
                })),
            });
        }
        else {
            out.push({
                role: m.role === "assistant" ? "assistant" : "user",
                content: textParts.map((t) => t.text).join("\n"),
            });
        }
    }
    return out;
}
function toOpenAITools(tools) {
    return tools.map((t) => ({
        type: "function",
        function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
        },
    }));
}
export class OpenAICompatibleProvider {
    id;
    client;
    model;
    constructor(cfg) {
        this.id = cfg.id;
        this.client = new OpenAI({ apiKey: cfg.apiKey ?? "not-needed", baseURL: cfg.baseUrl });
        this.model = cfg.model;
    }
    async complete(req) {
        const resp = await this.client.chat.completions.create({
            model: this.model,
            max_tokens: req.maxTokens ?? 4096,
            messages: toOpenAIMessages(req.systemPrompt, req.messages),
            tools: req.tools.length ? toOpenAITools(req.tools) : undefined,
        });
        const choice = resp.choices[0];
        const content = [];
        if (choice.message.content) {
            content.push({ type: "text", text: choice.message.content });
        }
        if (choice.message.tool_calls) {
            for (const tc of choice.message.tool_calls) {
                let input = {};
                try {
                    input = JSON.parse(tc.function.arguments);
                }
                catch {
                    input = {};
                }
                content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
            }
        }
        const stopReason = choice.finish_reason === "tool_calls"
            ? "tool_use"
            : choice.finish_reason === "length"
                ? "max_tokens"
                : "end_turn";
        return {
            content,
            stopReason,
            usage: resp.usage
                ? { inputTokens: resp.usage.prompt_tokens, outputTokens: resp.usage.completion_tokens }
                : undefined,
        };
    }
    async listModels() {
        const models = await this.client.models.list();
        return models.data.map((model) => model.id).sort();
    }
}
