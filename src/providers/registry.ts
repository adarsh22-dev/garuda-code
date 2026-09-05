import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";
import type { Provider, ProviderConfig } from "./types.js";

export interface ProviderPreset {
  id: string;
  label: string;
  kind: "anthropic" | "openai-compatible";
  baseUrl?: string;
  envKey: string; // env var name to look up the API key
  defaultModel: string;
}

// Presets for launch. Any OpenAI-compatible endpoint can be added by the user
// via `garuda config add-provider` without touching code.
//
// Providers left OUT of this list on purpose (add via `garuda config add-provider`
// once you have the details, rather than us guessing a URL that could be wrong):
//   - Azure OpenAI        (base URL is your own resource + deployment name)
//   - Cloudflare Workers AI (base URL is scoped to your account id)
//   - Bedrock / Vertex / Foundry (cloud-specific auth, not a simple API key)
//   - GitHub Models/Copilot, Codex OAuth, xAI OAuth (OAuth flows, not key-based)
//   - MiniMax, LongCat, Kimi Code, OpenCode Zen/Go, ClinePass, Hicap, AI/ML API
//     (their docs didn't give us a confirmed base URL — don't want to ship a
//     guessed one and have it silently fail; add these with `add-provider` once
//     you have the exact endpoint from the provider's own docs)
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: "anthropic", label: "Anthropic", kind: "anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-6" },
  { id: "openai", label: "OpenAI", kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", envKey: "OPENAI_API_KEY", defaultModel: "gpt-4o" },
  { id: "gemini", label: "Google Gemini", kind: "openai-compatible", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", envKey: "GEMINI_API_KEY", defaultModel: "gemini-2.0-flash" },
  { id: "groq", label: "Groq", kind: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1", envKey: "GROQ_API_KEY", defaultModel: "llama-3.3-70b-versatile" },
  { id: "deepseek", label: "DeepSeek", kind: "openai-compatible", baseUrl: "https://api.deepseek.com/v1", envKey: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat" },
  { id: "mistral", label: "Mistral", kind: "openai-compatible", baseUrl: "https://api.mistral.ai/v1", envKey: "MISTRAL_API_KEY", defaultModel: "mistral-large-latest" },
  { id: "together", label: "Together AI", kind: "openai-compatible", baseUrl: "https://api.together.xyz/v1", envKey: "TOGETHER_API_KEY", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { id: "fireworks", label: "Fireworks", kind: "openai-compatible", baseUrl: "https://api.fireworks.ai/inference/v1", envKey: "FIREWORKS_API_KEY", defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct" },
  { id: "openrouter", label: "OpenRouter", kind: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1", envKey: "OPENROUTER_API_KEY", defaultModel: "anthropic/claude-sonnet-4.6" },
  { id: "xai", label: "xAI (Grok)", kind: "openai-compatible", baseUrl: "https://api.x.ai/v1", envKey: "XAI_API_KEY", defaultModel: "grok-2-latest" },
  { id: "venice", label: "Venice", kind: "openai-compatible", baseUrl: "https://api.venice.ai/api/v1", envKey: "VENICE_API_KEY", defaultModel: "llama-3.3-70b" },
  { id: "opengateway", label: "Gitlawb Opengateway", kind: "openai-compatible", baseUrl: "https://opengateway.gitlawb.com/v1", envKey: "OPENGATEWAY_API_KEY", defaultModel: "auto" },
  { id: "nearai", label: "NEAR AI", kind: "openai-compatible", baseUrl: "https://cloud-api.near.ai/v1", envKey: "NEARAI_API_KEY", defaultModel: "claude-sonnet-4-6" },
  { id: "bankr", label: "Bankr", kind: "openai-compatible", baseUrl: "https://llm.bankr.bot/v1", envKey: "BNKR_API_KEY", defaultModel: "gpt-4o" },
  { id: "atlascloud", label: "Atlas Cloud", kind: "openai-compatible", baseUrl: "https://api.atlascloud.ai/v1", envKey: "ATLAS_CLOUD_API_KEY", defaultModel: "llama-3.3-70b" },
  { id: "apismart", label: "ApiSmart", kind: "openai-compatible", baseUrl: "https://gw.apismart.ai/v1", envKey: "APISMART_API_KEY", defaultModel: "DEEPSEEK_V4_FLASH" },
  { id: "nvidia", label: "NVIDIA NIM", kind: "openai-compatible", baseUrl: "https://integrate.api.nvidia.com/v1", envKey: "NVIDIA_API_KEY", defaultModel: "meta/llama-3.3-70b-instruct" },
  { id: "xiaomimimo", label: "Xiaomi MiMo", kind: "openai-compatible", baseUrl: "https://api.xiaomimimo.com/v1", envKey: "MIMO_API_KEY", defaultModel: "mimo-v2.5-pro" },
  { id: "ollama", label: "Ollama (local)", kind: "openai-compatible", baseUrl: "http://localhost:11434/v1", envKey: "OLLAMA_API_KEY", defaultModel: "llama3.3" },
  { id: "lmstudio", label: "LM Studio (local)", kind: "openai-compatible", baseUrl: "http://localhost:1234/v1", envKey: "LMSTUDIO_API_KEY", defaultModel: "local-model" },
  { id: "atomicchat", label: "Atomic Chat (local)", kind: "openai-compatible", baseUrl: "http://127.0.0.1:1337/v1", envKey: "ATOMICCHAT_API_KEY", defaultModel: "local-model" },
  { id: "cerebras", label: "Cerebras", kind: "openai-compatible", baseUrl: "https://api.cerebras.ai/v1", envKey: "CEREBRAS_API_KEY", defaultModel: "llama-3.3-70b" },
  { id: "deepinfra", label: "Deep Infra", kind: "openai-compatible", baseUrl: "https://api.deepinfra.com/v1/openai", envKey: "DEEPINFRA_API_KEY", defaultModel: "meta-llama/Llama-3.3-70B-Instruct" },
  { id: "moonshot", label: "Moonshot AI (Kimi)", kind: "openai-compatible", baseUrl: "https://api.moonshot.ai/v1", envKey: "MOONSHOT_API_KEY", defaultModel: "kimi-k2-0711-preview" },
  { id: "huggingface", label: "Hugging Face", kind: "openai-compatible", baseUrl: "https://router.huggingface.co/v1", envKey: "HUGGINGFACE_API_KEY", defaultModel: "moonshotai/Kimi-K2-Instruct" },
  { id: "dashscope", label: "Alibaba DashScope (Qwen)", kind: "openai-compatible", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", envKey: "DASHSCOPE_API_KEY", defaultModel: "qwen-max" },
  { id: "302ai", label: "302.AI", kind: "openai-compatible", baseUrl: "https://api.302.ai/v1", envKey: "302AI_API_KEY", defaultModel: "gpt-4o" },
  { id: "baseten", label: "Baseten", kind: "openai-compatible", baseUrl: "https://inference.baseten.co/v1", envKey: "BASETEN_API_KEY", defaultModel: "llama-3.3-70b-instruct" },
  { id: "edenai", label: "Eden AI", kind: "openai-compatible", baseUrl: "https://api.edenai.run/v3", envKey: "EDENAI_API_KEY", defaultModel: "openai/gpt-4o" },
  { id: "helicone", label: "Helicone", kind: "openai-compatible", baseUrl: "https://ai-gateway.helicone.ai", envKey: "HELICONE_API_KEY", defaultModel: "gpt-4o" },
  { id: "minimax", label: "MiniMax", kind: "openai-compatible", baseUrl: "https://api.minimax.io/v1", envKey: "MINIMAX_API_KEY", defaultModel: "MiniMax-Text-01" },
  { id: "nebius", label: "Nebius Token Factory", kind: "openai-compatible", baseUrl: "https://api.tokenfactory.nebius.ai/v1", envKey: "NEBIUS_API_KEY", defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct" },
  { id: "ovhcloud", label: "OVHcloud AI Endpoints", kind: "openai-compatible", baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1", envKey: "OVHCLOUD_API_KEY", defaultModel: "gpt-oss-120b" },
  { id: "scaleway", label: "Scaleway", kind: "openai-compatible", baseUrl: "https://api.scaleway.ai/v1", envKey: "SCALEWAY_API_KEY", defaultModel: "gpt-oss-120b" },
  { id: "zai", label: "Z.AI", kind: "openai-compatible", baseUrl: "https://api.z.ai/api/paas/v4", envKey: "ZAI_API_KEY", defaultModel: "glm-4.7" },
  { id: "vercel", label: "Vercel AI Gateway", kind: "openai-compatible", baseUrl: "https://ai-gateway.vercel.sh/v1", envKey: "AI_GATEWAY_API_KEY", defaultModel: "openai/gpt-4o" },
  { id: "zenmux", label: "ZenMux", kind: "openai-compatible", baseUrl: "https://zenmux.ai/api/v1", envKey: "ZENMUX_API_KEY", defaultModel: "openai/gpt-4o" },
];

export function resolvePreset(id: string): ProviderPreset {
  const preset = PROVIDER_PRESETS.find((p) => p.id === id);
  if (!preset) {
    throw new Error(
      `Unknown provider "${id}". Known providers: ${PROVIDER_PRESETS.map((p) => p.id).join(", ")}`
    );
  }
  return preset;
}

export function buildProvider(cfg: ProviderConfig, kind: "anthropic" | "openai-compatible"): Provider {
  if (kind === "anthropic") return new AnthropicProvider(cfg);
  return new OpenAICompatibleProvider(cfg);
}
