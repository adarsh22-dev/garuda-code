import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Minimal MCP client over the stdio transport: spawns the server process,
 * frames JSON-RPC messages with Content-Length headers, and exposes
 * initialize / listTools / callTool. This intentionally covers the stdio
 * transport only for v1 — Streamable HTTP/SSE servers are not yet supported.
 */
export class McpStdioClient {
  private proc: ChildProcessWithoutNullStreams;
  private pending = new Map<string | number, PendingRequest>();
  private buffer = "";

  constructor(private cfg: McpServerConfig) {
    this.proc = spawn(cfg.command, cfg.args ?? [], {
      env: { ...process.env, ...cfg.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.proc.stdout.on("data", (chunk: Buffer) => this.onData(chunk));
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf-8");
    // MCP stdio servers send newline-delimited JSON (JSON-RPC 2.0), one message per line.
    let idx: number;
    while ((idx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error.message ?? "MCP error"));
          else p.resolve(msg.result);
        }
      } catch {
        // ignore malformed lines (e.g. server-side logging on stdout)
      }
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = randomUUID();
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(payload);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP request "${method}" timed out`));
        }
      }, 30_000);
    });
  }

  async initialize(): Promise<unknown> {
    return this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "garuda-code", version: "0.1.6" },
    });
  }

  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>> {
    const result = (await this.request("tools/list", {})) as { tools?: unknown[] };
    return (result?.tools as Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>) ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.request("tools/call", { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textParts = (result?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "");
    return textParts.join("\n") || JSON.stringify(result);
  }

  close(): void {
    this.proc.kill();
  }
}
