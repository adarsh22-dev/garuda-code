import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface GarudaConfig {
  defaultProvider: string;
  maxHistoryMessages?: number;
  providerOverrides?: Record<string, { model?: string; baseUrl?: string; apiKey?: string }>;
  customProviders?: Array<{
    id: string;
    label: string;
    baseUrl: string;
    envKey: string;
    defaultModel: string;
  }>;
  mcpServers?: Array<{
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

const DEFAULT_CONFIG: GarudaConfig = {
  defaultProvider: "anthropic",
  maxHistoryMessages: 40,
};

function configDir(): string {
  return process.env.GARUDA_CONFIG_DIR ?? path.join(os.homedir(), ".garuda");
}

function configPath(): string {
  return path.join(configDir(), "config.json");
}

export async function loadConfig(): Promise<GarudaConfig> {
  try {
    const raw = await fs.readFile(configPath(), "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(cfg: GarudaConfig): Promise<void> {
  await fs.mkdir(configDir(), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

export function getConfigDir(): string {
  return configDir();
}
