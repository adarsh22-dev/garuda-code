import Anthropic from "@anthropic-ai/sdk";
import type {
  CompletionRequest,
  CompletionResponse,
  ContentBlock,
  Message,
  Provider,
  ProviderConfig,
  ToolDefinition,
} from "./types.js";

function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      // Tool results are folded into a user message as tool_result blocks
      return {
        role: "user",
        content: m.content.map((b) => {
          if (b.type === "tool_result") {
            return {
              type: "tool_result",
              tool_use_id: b.toolCallId,
              content: b.content,
              is_error: b.isError ?? false,
            } as Anthropic.ToolResultBlockParam;
          }
          return { type: "text", text: "" } as Anthropic.TextBlockParam;
        }),
      };
    }
    return {
      role: m.role,
      content: m.content.map((b) => {
        if (b.type === "text") return { type: "text", text: b.text } as Anthropic.TextBlockParam;
        if (b.type === "tool_use")
          return {
            type: "tool_use",
            id: b.id,
            name: b.name,
            input: b.input,
          } as Anthropic.ToolUseBlockParam;
        return { type: "text", text: "" } as Anthropic.TextBlockParam;
      }),
    };
  });
}

function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
  }));
}

function fromAnthropicContent(content: Anthropic.ContentBlock[]): ContentBlock[] {
  return content.map((b): ContentBlock => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "tool_use")
      return {
        type: "tool_use",
        id: b.id,
        name: b.name,
        input: b.input as Record<string, unknown>,
      };
    return { type: "text", text: "" };
  });
}

export class AnthropicProvider implements Provider {
  id = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(cfg: ProviderConfig) {
    this.client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });
    this.model = cfg.model;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 4096,
      system: req.systemPrompt,
      messages: toAnthropicMessages(req.messages),
      tools: req.tools.length ? toAnthropicTools(req.tools) : undefined,
    });

    const stopReason =
      resp.stop_reason === "tool_use"
        ? "tool_use"
        : resp.stop_reason === "max_tokens"
        ? "max_tokens"
        : "end_turn";

    return {
      content: fromAnthropicContent(resp.content),
      stopReason,
      usage: {
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
      },
    };
  }
}
