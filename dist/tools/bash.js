import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);
export const bashTool = {
    requiresConfirmation: true,
    definition: {
        name: "bash",
        description: "Run a shell command in the project's working directory. Use for running tests, " +
            "build tools, git commands, or anything not covered by a dedicated tool. " +
            "Output (stdout+stderr) is truncated to ~8000 characters.",
        inputSchema: {
            type: "object",
            properties: {
                command: { type: "string", description: "The shell command to execute." },
                timeout_ms: { type: "number", description: "Optional timeout in milliseconds (default 60000)." },
            },
            required: ["command"],
        },
    },
    async run(input, ctx) {
        const command = String(input.command ?? "");
        const timeout = typeof input.timeout_ms === "number" ? input.timeout_ms : 60_000;
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: ctx.cwd,
                timeout,
                maxBuffer: 10 * 1024 * 1024,
            });
            const combined = [stdout, stderr].filter(Boolean).join("\n").trim() || "(no output)";
            return combined.length > 8000 ? combined.slice(0, 8000) + "\n...[truncated]" : combined;
        }
        catch (err) {
            const e = err;
            const combined = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
            return `Command failed:\n${combined || "unknown error"}`;
        }
    },
};
