import { glob as globAsync } from "glob";
import { promises as fs } from "node:fs";
import path from "node:path";
export const globTool = {
    requiresConfirmation: false,
    definition: {
        name: "glob",
        description: "Find files matching a glob pattern (e.g. 'src/**/*.ts').",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string" },
            },
            required: ["pattern"],
        },
    },
    async run(input, ctx) {
        const pattern = String(input.pattern ?? "");
        const matches = await globAsync(pattern, { cwd: ctx.cwd, nodir: true, ignore: ["**/node_modules/**", "**/.git/**"] });
        return matches.length ? matches.join("\n") : "(no matches)";
    },
};
export const grepTool = {
    requiresConfirmation: false,
    definition: {
        name: "grep",
        description: "Search file contents for a regular expression pattern across a glob of files.",
        inputSchema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Regular expression to search for." },
                glob: { type: "string", description: "Glob of files to search. Defaults to '**/*'." },
                max_results: { type: "number", description: "Max matching lines to return. Default 200." },
            },
            required: ["pattern"],
        },
    },
    async run(input, ctx) {
        const pattern = String(input.pattern ?? "");
        const globPattern = String(input.glob ?? "**/*");
        const maxResults = typeof input.max_results === "number" ? input.max_results : 200;
        let regex;
        try {
            regex = new RegExp(pattern);
        }
        catch (e) {
            return `Invalid regex: ${e.message}`;
        }
        const files = await globAsync(globPattern, {
            cwd: ctx.cwd,
            nodir: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
        });
        const results = [];
        for (const file of files) {
            if (results.length >= maxResults)
                break;
            let content;
            try {
                content = await fs.readFile(path.join(ctx.cwd, file), "utf-8");
            }
            catch {
                continue;
            }
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                    results.push(`${file}:${i + 1}:${lines[i]}`);
                    if (results.length >= maxResults)
                        break;
                }
            }
        }
        return results.length ? results.join("\n") : "(no matches)";
    },
};
