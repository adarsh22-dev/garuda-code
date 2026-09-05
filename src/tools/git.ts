import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

export const gitTool: Tool = {
  requiresConfirmation: true, // commit/push are mutating; status/diff/log are read-only but we keep it simple and gate the whole tool
  definition: {
    name: "git",
    description:
      "Run a git subcommand (status, diff, log, add, commit, branch, checkout, etc.) in the working directory.",
    inputSchema: {
      type: "object",
      properties: {
        args: { type: "string", description: "Arguments to pass to git, e.g. 'diff --stat' or 'commit -m \"msg\"'." },
      },
      required: ["args"],
    },
  },
  async run(input, ctx) {
    const args = String(input.args ?? "");
    try {
      const { stdout, stderr } = await execAsync(`git ${args}`, { cwd: ctx.cwd, maxBuffer: 10 * 1024 * 1024 });
      return [stdout, stderr].filter(Boolean).join("\n").trim() || "(no output)";
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return `git command failed:\n${[e.stdout, e.stderr, e.message].filter(Boolean).join("\n")}`;
    }
  },
};
