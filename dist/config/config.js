import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
const DEFAULT_CONFIG = {
    defaultProvider: "anthropic",
    maxHistoryMessages: 40,
};
function configDir() {
    return process.env.GARUDA_CONFIG_DIR ?? path.join(os.homedir(), ".garuda");
}
function configPath() {
    return path.join(configDir(), "config.json");
}
export async function loadConfig() {
    try {
        const raw = await fs.readFile(configPath(), "utf-8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
    catch {
        return DEFAULT_CONFIG;
    }
}
export async function saveConfig(cfg) {
    await fs.mkdir(configDir(), { recursive: true });
    await fs.writeFile(configPath(), JSON.stringify(cfg, null, 2), "utf-8");
}
export function getConfigDir() {
    return configDir();
}
