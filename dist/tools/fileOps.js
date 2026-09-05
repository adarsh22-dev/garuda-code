import { promises as fs } from "node:fs";
import path from "node:path";
function resolveInCwd(cwd, filePath) {
    return path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
}
export const readFileTool = {
    requiresConfirmation: false,
    definition: {
        name: "read_file",
        description: "Read the contents of a file. Returns line-numbered content.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file, relative to the working directory." },
            },
            required: ["path"],
        },
    },
    async run(input, ctx) {
        const filePath = resolveInCwd(ctx.cwd, String(input.path ?? ""));
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        return lines.map((l, i) => `${String(i + 1).padStart(5)}\t${l}`).join("\n");
    },
};
export const writeFileTool = {
    requiresConfirmation: true,
    definition: {
        name: "write_file",
        description: "Create a new file or overwrite an existing file with the given content.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file, relative to the working directory." },
                content: { type: "string", description: "Full content to write to the file." },
            },
            required: ["path", "content"],
        },
    },
    async run(input, ctx) {
        const filePath = resolveInCwd(ctx.cwd, String(input.path ?? ""));
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, String(input.content ?? ""), "utf-8");
        return `Wrote ${filePath}`;
    },
};
export const editFileTool = {
    requiresConfirmation: true,
    definition: {
        name: "edit_file",
        description: "Replace an exact, unique substring within a file. old_str must match the file's " +
            "current content exactly and appear exactly once; widen it with surrounding lines " +
            "if it isn't unique.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string" },
                old_str: { type: "string", description: "Exact text to find and replace." },
                new_str: { type: "string", description: "Replacement text." },
            },
            required: ["path", "old_str", "new_str"],
        },
    },
    async run(input, ctx) {
        const filePath = resolveInCwd(ctx.cwd, String(input.path ?? ""));
        const oldStr = String(input.old_str ?? "");
        const newStr = String(input.new_str ?? "");
        const content = await fs.readFile(filePath, "utf-8");
        const occurrences = content.split(oldStr).length - 1;
        if (occurrences === 0)
            return `Error: old_str not found in ${filePath}`;
        if (occurrences > 1)
            return `Error: old_str matches ${occurrences} times in ${filePath}; must be unique.`;
        const updated = content.replace(oldStr, newStr);
        await fs.writeFile(filePath, updated, "utf-8");
        return `Edited ${filePath}`;
    },
};
export const listDirTool = {
    requiresConfirmation: false,
    definition: {
        name: "list_dir",
        description: "List files and directories at a given path (non-recursive).",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory path, relative to the working directory. Defaults to '.'" },
            },
        },
    },
    async run(input, ctx) {
        const dirPath = resolveInCwd(ctx.cwd, String(input.path ?? "."));
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
            .sort()
            .join("\n");
    },
};
