import { exec } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import { glob as globAsync } from "glob";
import type { Tool } from "./types.js";

const execAsync = promisify(exec);

async function detectProjectType(cwd: string): Promise<string> {
  const files = await fs.readdir(cwd).catch((): string[] => []);
  if (files.includes("package.json")) {
    const pkg = JSON.parse(await fs.readFile(path.join(cwd, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["next"]) return "nextjs";
    if (deps["react"] && !deps["next"]) return "react";
    if (deps["vue"]) return "vue";
    if (deps["svelte"]) return "svelte";
    if (deps["express"]) return "express";
    if (deps["fastify"]) return "fastify";
    if (deps["nestjs"]) return "nestjs";
    return "node";
  }
  if (files.includes("Cargo.toml")) return "rust";
  if (files.includes("go.mod")) return "go";
  if (files.includes("requirements.txt") || files.includes("pyproject.toml") || files.includes("setup.py")) return "python";
  if (files.includes("Gemfile")) return "ruby";
  if (files.includes("pom.xml") || files.includes("build.gradle")) return "java";
  if (files.includes("Package.swift")) return "swift";
  if (files.includes("pubspec.yaml")) return "dart";
  if (files.includes("CMakeLists.txt") || files.includes("Makefile")) return "c-cpp";
  return "unknown";
}

async function runCommandSafe(command: string, cwd: string, timeout = 30000): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 });
    return [stdout, stderr].filter(Boolean).join("\n").trim() || "(no output)";
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
  }
}

export const lintTool: Tool = {
  requiresConfirmation: false,
  definition: {
    name: "lint",
    description: "Run the project's linter (eslint, pylint, golint, clippy, etc.) and report issues.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional file or directory to lint. Lints entire project if omitted." },
        fix: { type: "boolean", description: "Attempt to auto-fix issues. Default false." },
      },
    },
  },
  async run(input, ctx) {
    const target = String(input.path ?? ".");
    const fix = Boolean(input.fix);
    const projectType = await detectProjectType(ctx.cwd);

    const commands: Record<string, { lint: string; fix: string }> = {
      node: { lint: "npx eslint .", fix: "npx eslint . --fix" },
      nextjs: { lint: "npx next lint", fix: "npx next lint --fix" },
      react: { lint: "npx eslint .", fix: "npx eslint . --fix" },
      python: { lint: "python -m flake8 .", fix: "python -m autopep8 --in-place -r ." },
      rust: { lint: "cargo clippy -- -D warnings", fix: "cargo clippy --fix --allow-dirty" },
      go: { lint: "golangci-lint run ./...", fix: "golangci-lint run --fix ./..." },
      ruby: { lint: "bundle exec rubocop", fix: "bundle exec rubocop -A" },
      java: { lint: "mvn checkstyle:check", fix: "mvn checkstyle:check-style" },
      "c-cpp": { lint: "cppcheck --enable=all .", fix: "" },
    };

    const cmds = commands[projectType];
    if (!cmds) return `No linter configured for project type: ${projectType}. Detected: ${target}`;

    const cmd = fix && cmds.fix ? cmds.fix : cmds.lint;
    return `Project type: ${projectType}\nCommand: ${cmd}\n\n${await runCommandSafe(cmd, ctx.cwd)}`;
  },
};

export const typecheckTool: Tool = {
  requiresConfirmation: false,
  definition: {
    name: "typecheck",
    description: "Run type checking (tsc, mypy, cargo check, go vet, etc.) and report type errors.",
    inputSchema: {
      type: "object",
      properties: {
        strict: { type: "boolean", description: "Enable strict mode. Default false." },
      },
    },
  },
  async run(input, ctx) {
    const strict = Boolean(input.strict);
    const projectType = await detectProjectType(ctx.cwd);

    const commands: Record<string, string> = {
      node: "npx tsc --noEmit",
      nextjs: "npx tsc --noEmit",
      react: "npx tsc --noEmit",
      python: strict ? "python -m mypy --strict ." : "python -m mypy .",
      rust: "cargo check",
      go: "go vet ./...",
      ruby: "bundle exec steep check",
      java: "mvn compile",
      "c-cpp": "make check" ,
    };

    const cmd = commands[projectType];
    if (!cmd) return `No type checker configured for project type: ${projectType}`;

    return `Project type: ${projectType}\nCommand: ${cmd}\n\n${await runCommandSafe(cmd, ctx.cwd)}`;
  },
};

export const complexityTool: Tool = {
  requiresConfirmation: false,
  definition: {
    name: "complexity",
    description: "Analyze cyclomatic complexity of source files and flag high-complexity functions.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File or directory to analyze. Defaults to src/ or current dir." },
        threshold: { type: "number", description: "Complexity threshold. Functions above this are flagged. Default 15." },
      },
    },
  },
  async run(input, ctx) {
    const target = String(input.path ?? ".");
    const threshold = typeof input.threshold === "number" ? input.threshold : 15;

    // Simple regex-based complexity estimator for JS/TS files
    const resolved = path.isAbsolute(target) ? target : path.join(ctx.cwd, target);
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat) return `Path not found: ${target}`;

    let files: string[] = [];
    if (stat.isDirectory()) {
      files = await globAsync("**/*.{ts,tsx,js,jsx,py,rs,go}", {
        cwd: resolved,
        nodir: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      });
      files = files.map((f) => path.join(resolved, f));
    } else {
      files = [resolved];
    }

    const results: string[] = [];
    const branchPatterns = /\b(if|else if|elif|else|for|while|do|switch|case|catch|&&|\|\||\?\?|\?)\b/g;

    for (const file of files.slice(0, 50)) {
      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        const funcRegex = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:async\s+)?(?:\w+\s*)?\([^)]*\)\s*(?::\s*\w+\s*)?=>|def\s+\w+|fn\s+\w+|func\s+\w+|func\s+\([^)]*\)\s*\w+)/g;

        let match;
        while ((match = funcRegex.exec(content)) !== null) {
          const funcStart = content.substring(0, match.index).split("\n").length;
          let depth = 0;
          let funcEnd = funcStart;
          for (let i = funcStart - 1; i < lines.length; i++) {
            for (const ch of lines[i]) {
              if (ch === "{" || ch === ":") depth++;
              if (ch === "}" || ch === ":") depth--;
            }
            if (depth <= 0 && i > funcStart) { funcEnd = i + 1; break; }
          }
          const funcBody = lines.slice(funcStart - 1, funcEnd).join("\n");
          const complexity = 1 + (funcBody.match(branchPatterns)?.length ?? 0);
          if (complexity >= threshold) {
            const relPath = path.relative(ctx.cwd, file);
            results.push(`${relPath}:${funcStart} - complexity ${complexity} (threshold: ${threshold})`);
          }
        }
      } catch { continue; }
    }

    return results.length
      ? `High complexity functions (>= ${threshold}):\n${results.join("\n")}`
      : `No functions found with complexity >= ${threshold}.`;
  },
};

export const deadcodeTool: Tool = {
  requiresConfirmation: false,
  definition: {
    name: "deadcode",
    description: "Find potentially unused exports, variables, and imports in the codebase.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory to analyze. Defaults to src/." },
      },
    },
  },
  async run(input, ctx) {
    const target = String(input.path ?? "src");
    const resolved = path.isAbsolute(target) ? target : path.join(ctx.cwd, target);

    const files = await globAsync("**/*.{ts,tsx,js,jsx}", {
      cwd: resolved,
      nodir: true,
      ignore: ["**/node_modules/**", "**/dist/**", "**/*.d.ts"],
    });

    if (!files.length) return "(no source files found)";

    // Collect all exports and their usages
    const exportMap = new Map<string, { file: string; line: number }>();
    const usageCounts = new Map<string, number>();

    for (const file of files) {
      const content = await fs.readFile(path.join(resolved, file), "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        // Named exports
        const namedExport = lines[i].match(/export\s+(?:const|function|class|interface|type|enum|let)\s+(\w+)/);
        if (namedExport) {
          const name = namedExport[1];
          exportMap.set(`${name}:${file}`, { file, line: i + 1 });
          usageCounts.set(name, (usageCounts.get(name) ?? 0) + 0);
        }
        // Default exports
        const defaultExport = lines[i].match(/export\s+default\s+(\w+)/);
        if (defaultExport) {
          const name = defaultExport[1];
          exportMap.set(`default:${file}`, { file, line: i + 1 });
          usageCounts.set(name, (usageCounts.get(name) ?? 0) + 0);
        }
      }
    }

    // Count usages across all files
    for (const file of files) {
      const content = await fs.readFile(path.join(resolved, file), "utf-8");
      for (const [key] of exportMap) {
        const name = key.split(":")[0];
        if (name === "default") continue;
        const regex = new RegExp(`\\b${name}\\b`, "g");
        const matches = content.match(regex);
        if (matches) {
          usageCounts.set(name, (usageCounts.get(name) ?? 0) + matches.length);
        }
      }
    }

    // Find unused (exported but never referenced elsewhere)
    const unused: string[] = [];
    for (const [key, loc] of exportMap) {
      const name = key.split(":")[0];
      const count = usageCounts.get(name) ?? 0;
      // 1 reference = the export itself
      if (count <= 1) {
        unused.push(`${loc.file}:${loc.line} - ${name}`);
      }
    }

    return unused.length
      ? `Potentially unused exports (${unused.length}):\n${unused.slice(0, 50).join("\n")}`
      : "(no obviously unused exports found)";
  },
};

export const dependencyTool: Tool = {
  requiresConfirmation: false,
  definition: {
    name: "dependency",
    description: "Audit project dependencies for outdated packages, security vulnerabilities, and license issues.",
    inputSchema: {
      type: "object",
      properties: {
        check: { type: "string", description: "Check type: 'outdated', 'vulnerable', 'licenses', or 'all'. Default 'all'." },
      },
    },
  },
  async run(input, ctx) {
    const check = String(input.check ?? "all");
    const projectType = await detectProjectType(ctx.cwd);

    const results: string[] = [];

    if (projectType === "node" || projectType === "nextjs" || projectType === "react") {
      if (check === "outdated" || check === "all") {
        results.push("=== Outdated Packages ===");
        results.push(await runCommandSafe("npm outdated --json 2>/dev/null || npm outdated", ctx.cwd));
      }
      if (check === "vulnerable" || check === "all") {
        results.push("\n=== Security Audit ===");
        results.push(await runCommandSafe("npm audit --json 2>/dev/null | head -100 || npm audit", ctx.cwd, 60000));
      }
    } else if (projectType === "python") {
      results.push("=== Outdated Packages ===");
      results.push(await runCommandSafe("pip list --outdated 2>/dev/null || pip3 list --outdated", ctx.cwd));
    } else if (projectType === "rust") {
      results.push("=== Outdated Dependencies ===");
      results.push(await runCommandSafe("cargo outdated 2>/dev/null || cargo update --dry-run", ctx.cwd));
    } else if (projectType === "go") {
      results.push("=== Outdated Dependencies ===");
      results.push(await runCommandSafe("go list -m -u all 2>/dev/null", ctx.cwd));
    }

    return results.length ? results.join("\n") : `No dependency audit available for project type: ${projectType}`;
  },
};
