import { promises as fs } from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { getConfigDir } from "../config/config.js";
import type { Message } from "../providers/types.js";

export interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  cwd: string;
  providerId: string;
  messages: Message[];
}

function sessionsDir(): string {
  return path.join(getConfigDir(), "sessions");
}

export async function createSession(cwd: string, providerId: string): Promise<SessionData> {
  const now = new Date().toISOString();
  return { id: nanoid(10), createdAt: now, updatedAt: now, cwd, providerId, messages: [] };
}

export async function saveSession(session: SessionData): Promise<void> {
  await fs.mkdir(sessionsDir(), { recursive: true });
  session.updatedAt = new Date().toISOString();
  await fs.writeFile(path.join(sessionsDir(), `${session.id}.json`), JSON.stringify(session, null, 2), "utf-8");
}

export async function loadSession(id: string): Promise<SessionData> {
  const raw = await fs.readFile(path.join(sessionsDir(), `${id}.json`), "utf-8");
  return JSON.parse(raw);
}

export async function listSessions(): Promise<SessionData[]> {
  try {
    const files = await fs.readdir(sessionsDir());
    const sessions = await Promise.all(
      files.filter((f) => f.endsWith(".json")).map((f) => loadSession(f.replace(".json", "")))
    );
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}
