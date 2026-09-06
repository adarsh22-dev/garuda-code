import { promises as fs } from "node:fs";
import path from "node:path";
import { glob as globAsync } from "glob";
import { exec } from "node:child_process";
import { promisify } from "node:util";
const execAsync = promisify(exec);
// ─── 3D / WebGL / Three.js Analysis ──────────────────────────────────
export const threejsAuditTool = {
    requiresConfirmation: false,
    definition: {
        name: "threejs_audit",
        description: "Audit a Three.js / React Three Fiber project for performance issues: " +
            "draw calls, unoptimized textures, missing disposal, geometry duplication, " +
            "missing instancing, and anti-patterns.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Project directory to audit. Defaults to cwd." },
            },
        },
    },
    async run(input, ctx) {
        const dir = String(input.path ?? ".");
        const resolved = path.isAbsolute(dir) ? dir : path.join(ctx.cwd, dir);
        const files = await globAsync("**/*.{ts,tsx,js,jsx}", {
            cwd: resolved,
            nodir: true,
            ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        });
        const issues = [];
        let meshesFound = 0;
        let materialsFound = 0;
        let texturesFound = 0;
        let disposalsFound = 0;
        let instancedFound = 0;
        for (const file of files) {
            const content = await fs.readFile(path.join(resolved, file), "utf-8");
            const rel = path.relative(ctx.cwd, path.join(resolved, file));
            // Check for unoptimized patterns
            const meshMatches = content.match(/new\s+Mesh\s*\(/g);
            meshesFound += meshMatches?.length ?? 0;
            const matMatches = content.match(/new\s+(Mesh|MeshStandard|MeshPhysical|MeshBasic|MeshPhong|MeshLambert)Material/g);
            materialsFound += matMatches?.length ?? 0;
            const texMatches = content.match(/new\s+TextureLoader|\.load\s*\(/g);
            texturesFound += texMatches?.length ?? 0;
            const disposeMatches = content.match(/\.dispose\s*\(\)/g);
            disposalsFound += disposeMatches?.length ?? 0;
            const instMatches = content.match(/InstancedMesh|useInstances/g);
            instancedFound += instMatches?.length ?? 0;
            // Anti-pattern detection
            if (content.includes("new Mesh(") && !content.includes("useMemo")) {
                issues.push(`${rel}: Mesh created outside useMemo — will re-create every render`);
            }
            if (content.includes("new MeshStandardMaterial") && !content.includes("useMemo")) {
                issues.push(`${rel}: Material created outside useMemo — will re-create every render`);
            }
            if (content.match(/\.load\s*\(/) && !content.includes("useLoader") && !content.includes("useGLTF") && !content.includes("useTexture")) {
                issues.push(`${rel}: Raw .load() call — prefer useLoader / useGLTF / useTexture for automatic caching + disposal`);
            }
            if (content.includes("addEventListener") && !content.includes("useEffect")) {
                issues.push(`${rel}: addEventListener outside useEffect — potential memory leak`);
            }
            if (content.match(/Canvas[\s\S]*camera/) && !content.includes("frameloop")) {
                issues.push(`${rel}: Canvas missing frameloop prop — consider "demand" for static scenes`);
            }
            if (content.includes("shadowMap") && !content.includes("shadowMapType")) {
                issues.push(`${rel}: shadowMap enabled but shadowMapType not set — use PCFSoftShadowMap`);
            }
        }
        const lines = ["=== Three.js / R3F Project Audit ===\n"];
        lines.push(`Files scanned: ${files.length}`);
        lines.push(`Meshes: ${meshesFound} | Materials: ${materialsFound} | Textures: ${texturesFound}`);
        lines.push(`Disposals: ${disposalsFound} | Instanced meshes: ${instancedFound}`);
        lines.push("");
        if (meshesFound > 50 && instancedFound === 0) {
            issues.push("Many meshes but no instancing — consider InstancedMesh for repeated geometry");
        }
        if (texturesFound > 0 && disposalsFound === 0) {
            issues.push("Textures loaded but no dispose() calls — potential GPU memory leak");
        }
        if (issues.length) {
            lines.push(`Issues found (${issues.length}):`);
            issues.forEach((issue) => lines.push(`  ⚠ ${issue}`));
        }
        else {
            lines.push("No obvious issues found.");
        }
        return lines.join("\n");
    },
};
export const shaderAuditTool = {
    requiresConfirmation: false,
    definition: {
        name: "shader_audit",
        description: "Analyze GLSL shader code for performance issues: " +
            "texture lookups, branch divergence, precision, unused varyings, and complexity.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File or directory containing shaders." },
            },
        },
    },
    async run(input, ctx) {
        const target = String(input.path ?? ".");
        const resolved = path.isAbsolute(target) ? target : path.join(ctx.cwd, target);
        const files = await globAsync("**/*.{glsl,vert,frag,shader}", {
            cwd: resolved,
            nodir: true,
            ignore: ["**/node_modules/**"],
        });
        // Also check for inline shaders in TS/JS files
        const tsFiles = await globAsync("**/*.{ts,tsx,js,jsx}", {
            cwd: resolved,
            nodir: true,
            ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        });
        const issues = [];
        let totalLines = 0;
        let textureLookups = 0;
        let branches = 0;
        // Analyze standalone shader files
        for (const file of files) {
            const content = await fs.readFile(path.join(resolved, file), "utf-8");
            const rel = path.relative(ctx.cwd, path.join(resolved, file));
            const lines = content.split("\n");
            totalLines += lines.length;
            textureLookups += (content.match(/texture2D|texture\(/g) ?? []).length;
            branches += (content.match(/\b(if|else|for|while)\b/g) ?? []).length;
            if (!content.includes("precision")) {
                issues.push(`${rel}: No precision qualifier — add precision mediump float; or highp`);
            }
            if (content.match(/texture2D.*texture2D.*texture2D/)) {
                issues.push(`${rel}: 3+ texture lookups in one statement — consider batching`);
            }
            if (content.includes("gl_FragColor") && content.includes("discard")) {
                issues.push(`${rel}: Using discard — breaks early-z optimizations`);
            }
            if (content.match(/varying\s+\w+\s+\w+;/) && !content.includes("varying")) {
                issues.push(`${rel}: Unused varying detected`);
            }
            if (lines.length > 100) {
                issues.push(`${rel}: Long shader (${lines.length} lines) — consider splitting`);
            }
        }
        // Check for inline shaders in TS/JS
        for (const file of tsFiles) {
            const content = await fs.readFile(path.join(resolved, file), "utf-8");
            const rel = path.relative(ctx.cwd, path.join(resolved, file));
            if (content.includes("gl_Position") || content.includes("gl_FragColor")) {
                const rel2 = path.relative(ctx.cwd, path.join(resolved, file));
                issues.push(`${rel2}: Inline GLSL found — consider moving to .glsl files for better tooling`);
            }
            if (content.includes("uniform") && content.includes("shaderMaterial") && !content.includes("uniformsRef")) {
                issues.push(`${rel}: ShaderMaterial with uniforms — use ref to avoid re-compilation`);
            }
        }
        const lines = ["=== Shader Audit ===\n"];
        lines.push(`Shader files: ${files.length} | Total lines: ${totalLines}`);
        lines.push(`Texture lookups: ${textureLookups} | Branches: ${branches}`);
        lines.push("");
        if (issues.length) {
            lines.push(`Issues (${issues.length}):`);
            issues.forEach((i) => lines.push(`  ⚠ ${i}`));
        }
        else {
            lines.push("No obvious shader issues found.");
        }
        return lines.join("\n");
    },
};
// ─── React / Next.js Analysis ────────────────────────────────────────
export const reactAuditTool = {
    requiresConfirmation: false,
    definition: {
        name: "react_audit",
        description: "Audit React / Next.js code for anti-patterns: " +
            "missing keys, unstable references, unnecessary re-renders, " +
            "missing error boundaries, and App Router violations.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Project directory to audit." },
            },
        },
    },
    async run(input, ctx) {
        const dir = String(input.path ?? ".");
        const resolved = path.isAbsolute(dir) ? dir : path.join(ctx.cwd, dir);
        const files = await globAsync("**/*.{tsx,jsx}", {
            cwd: resolved,
            nodir: true,
            ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        });
        const issues = [];
        let componentsFound = 0;
        let hooksFound = 0;
        let errorBoundaries = 0;
        for (const file of files) {
            const content = await fs.readFile(path.join(resolved, file), "utf-8");
            const rel = path.relative(ctx.cwd, path.join(resolved, file));
            componentsFound += (content.match(/export\s+(default\s+)?function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|React\.memo)/g) ?? []).length;
            hooksFound += (content.match(/\b(useState|useEffect|useCallback|useMemo|useRef|useContext|useReducer)\b/g) ?? []).length;
            errorBoundaries += content.includes("ErrorBoundary") || content.includes("componentDidCatch") ? 1 : 0;
            // Anti-patterns
            if (content.includes("className={`") && !content.includes("clsx") && !content.includes("cn(") && !content.includes("classNames(")) {
                issues.push(`${rel}: String template classNames — consider clsx/cn utility`);
            }
            if (content.match(/useEffect\(\s*\(\)\s*=>/)) {
                const effectBody = content.substring(content.indexOf("useEffect("));
                if (!effectBody.includes("return") || !effectBody.includes("cleanup")) {
                    // Only flag if it has side effects that need cleanup
                    if (effectBody.includes("addEventListener") || effectBody.includes("setInterval") || effectBody.includes("subscribe")) {
                        issues.push(`${rel}: useEffect with event listeners/intervals but no cleanup return`);
                    }
                }
            }
            if (content.includes("JSON.parse") && content.includes("useState")) {
                issues.push(`${rel}: JSON.parse in useState — use lazy initializer: useState(() => JSON.parse(...))`);
            }
            if (content.includes("<img ") && !content.includes("next/image") && !content.includes("Image from")) {
                issues.push(`${rel}: Using <img> — prefer next/image for optimization`);
            }
            if (file.includes("/page.tsx") || file.includes("/layout.tsx")) {
                if (content.includes("'use client'") || content.includes("\"use client\"")) {
                    if (content.includes("cookies()") || content.includes("headers()") || content.includes("params")) {
                        issues.push(`${rel}: Client component accessing server APIs — move to server component or use Suspense`);
                    }
                }
            }
            if (file.includes("page.tsx") && !file.includes("loading.tsx") && !file.includes("error.tsx")) {
                const dir2 = path.dirname(file);
                if (!files.some((f) => f.includes(dir2) && (f.includes("loading.tsx") || f.includes("error.tsx")))) {
                    issues.push(`${path.dirname(rel)}: No loading.tsx or error.tsx for this route`);
                }
            }
        }
        const lines = ["=== React / Next.js Audit ===\n"];
        lines.push(`Components: ${componentsFound} | Hooks used: ${hooksFound} | Error boundaries: ${errorBoundaries}`);
        lines.push("");
        if (errorBoundaries === 0 && componentsFound > 5) {
            issues.push("No error boundaries found — add for graceful error handling");
        }
        if (issues.length) {
            lines.push(`Issues (${issues.length}):`);
            issues.forEach((i) => lines.push(`  ⚠ ${i}`));
        }
        else {
            lines.push("No obvious React/Next.js issues found.");
        }
        return lines.join("\n");
    },
};
// ─── FastAPI / Python Analysis ───────────────────────────────────────
export const fastapiAuditTool = {
    requiresConfirmation: false,
    definition: {
        name: "fastapi_audit",
        description: "Audit a FastAPI / Python project for issues: " +
            "missing validation, N+1 queries, async blocking, missing auth, " +
            "improper error handling, and OpenAPI gaps.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Project directory to audit." },
            },
        },
    },
    async run(input, ctx) {
        const dir = String(input.path ?? ".");
        const resolved = path.isAbsolute(dir) ? dir : path.join(ctx.cwd, dir);
        const files = await globAsync("**/*.py", {
            cwd: resolved,
            nodir: true,
            ignore: ["**/node_modules/**", "**/__pycache__/**", "**/.venv/**", "**/venv/**"],
        });
        const issues = [];
        let routesFound = 0;
        let modelsFound = 0;
        let asyncRoutes = 0;
        for (const file of files) {
            const content = await fs.readFile(path.join(resolved, file), "utf-8");
            const rel = path.relative(ctx.cwd, path.join(resolved, file));
            routesFound += (content.match(/@(app|router)\.(get|post|put|delete|patch)\s*\(/g) ?? []).length;
            modelsFound += (content.match(/class\s+\w+\(BaseModel\)/g) ?? []).length;
            asyncRoutes += (content.match(/async\s+def\s+\w+/g) ?? []).length;
            // Anti-patterns
            if (content.includes("@app.post") || content.includes("@app.get")) {
                if (!content.includes("response_model") && !content.includes("Response")) {
                    issues.push(`${rel}: Route without response_model — add for OpenAPI docs and validation`);
                }
            }
            if (content.includes("Depends(") && !content.includes("def ")) {
                issues.push(`${rel}: Uses Depends but no dependency functions defined`);
            }
            if (content.includes("await") && (content.includes("time.sleep") || content.includes("requests.get") || content.includes("requests.post"))) {
                issues.push(`${rel}: Sync blocking call in async context — use httpx or async equivalents`);
            }
            if (content.includes("JWT") || content.includes("jwt") || content.includes("token")) {
                if (!content.includes("HTTPBearer") && !content.includes("OAuth2PasswordBearer") && !content.includes("Depends")) {
                    issues.push(`${rel}: Token handling without proper auth dependency`);
                }
            }
            if (content.includes("print(") && !content.includes("logging")) {
                issues.push(`${rel}: print() found — use logging module instead`);
            }
            if (content.includes("SQLAlchemy") || content.includes("AsyncSession")) {
                if (!content.includes("async with") && !content.includes("sessionmaker")) {
                    issues.push(`${rel}: SQLAlchemy session not using context manager`);
                }
            }
            if (file.includes("main.py") && content.includes("app = FastAPI")) {
                if (!content.includes("middleware") && !content.includes("CORSMiddleware")) {
                    issues.push(`${rel}: FastAPI app without CORS middleware — frontend requests will fail`);
                }
            }
        }
        const lines = ["=== FastAPI / Python Audit ===\n"];
        lines.push(`Files: ${files.length} | Routes: ${routesFound} | Pydantic models: ${modelsFound}`);
        lines.push(`Async functions: ${asyncRoutes}`);
        lines.push("");
        if (issues.length) {
            lines.push(`Issues (${issues.length}):`);
            issues.forEach((i) => lines.push(`  ⚠ ${i}`));
        }
        else {
            lines.push("No obvious FastAPI/Python issues found.");
        }
        return lines.join("\n");
    },
};
// ─── Performance Budget ──────────────────────────────────────────────
export const perfBudgetTool = {
    requiresConfirmation: false,
    definition: {
        name: "perf_budget",
        description: "Analyze bundle size and performance budget: " +
            "check for large dependencies, missing code splitting, " +
            "unoptimized images, and Lighthouse-ready checks.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Project directory." },
            },
        },
    },
    async run(input, ctx) {
        const dir = String(input.path ?? ".");
        const resolved = path.isAbsolute(dir) ? dir : path.join(ctx.cwd, dir);
        const issues = [];
        const stats = [];
        // Check package.json for known heavy dependencies
        try {
            const pkg = JSON.parse(await fs.readFile(path.join(resolved, "package.json"), "utf-8"));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            const heavyDeps = {
                "moment": "Consider date-fns or dayjs (smaller)",
                "lodash": "Consider lodash-es or individual imports",
                "antd": "Very heavy — consider radix-ui or shadcn/ui",
                "@mui/material": "Heavy — consider tailwind or radix",
                "redux": "Consider zustand or jotai (smaller)",
                "axios": "Consider fetch or ky (smaller, native)",
                "jquery": "Not needed with React/Next.js",
            };
            for (const [dep, suggestion] of Object.entries(heavyDeps)) {
                if (allDeps[dep]) {
                    issues.push(`${dep}: ${suggestion}`);
                }
            }
            stats.push(`Dependencies: ${Object.keys(pkg.dependencies ?? {}).length}`);
            stats.push(`DevDependencies: ${Object.keys(pkg.devDependencies ?? {}).length}`);
        }
        catch {
            stats.push("No package.json found");
        }
        // Check for unoptimized assets
        const imageFiles = await globAsync("**/*.{jpg,jpeg,png,gif}", {
            cwd: resolved,
            nodir: true,
            ignore: ["**/node_modules/**"],
        });
        if (imageFiles.length > 0) {
            issues.push(`${imageFiles.length} raster images found — convert to WebP/AVIF for production`);
        }
        // Check for next.config
        const hasNextConfig = await fs.readFile(path.join(resolved, "next.config.js"), "utf-8").catch(() => null)
            || await fs.readFile(path.join(resolved, "next.config.mjs"), "utf-8").catch(() => null)
            || await fs.readFile(path.join(resolved, "next.config.ts"), "utf-8").catch(() => null);
        if (hasNextConfig) {
            if (!hasNextConfig.includes("images") || !hasNextConfig.includes("formats")) {
                issues.push("next.config missing image optimization — add formats: ['avif', 'webp']");
            }
        }
        const lines = ["=== Performance Budget ===\n"];
        lines.push(stats.join(" | "));
        lines.push("");
        if (issues.length) {
            lines.push(`Recommendations (${issues.length}):`);
            issues.forEach((i) => lines.push(`  💡 ${i}`));
        }
        else {
            lines.push("Looking good!");
        }
        return lines.join("\n");
    },
};
// ─── Accessibility Audit ─────────────────────────────────────────────
export const a11yAuditTool = {
    requiresConfirmation: false,
    definition: {
        name: "a11y_audit",
        description: "Audit code for accessibility issues: " +
            "missing alt text, ARIA roles, keyboard navigation, " +
            "color contrast hints, and semantic HTML.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Project directory." },
            },
        },
    },
    async run(input, ctx) {
        const dir = String(input.path ?? ".");
        const resolved = path.isAbsolute(dir) ? dir : path.join(ctx.cwd, dir);
        const files = await globAsync("**/*.{tsx,jsx,html}", {
            cwd: resolved,
            nodir: true,
            ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        });
        const issues = [];
        for (const file of files) {
            const content = await fs.readFile(path.join(resolved, file), "utf-8");
            const rel = path.relative(ctx.cwd, path.join(resolved, file));
            if (content.includes("<img ") && !content.includes("alt=")) {
                issues.push(`${rel}: <img> missing alt attribute`);
            }
            if (content.includes("<a ") && !content.includes("href=") && !content.includes("aria-")) {
                issues.push(`${rel}: <a> without href — use <button> or add role="button"`);
            }
            if (content.includes("onClick") && !content.includes("onKeyDown") && !content.includes("onKeyPress") && !content.includes("role=") && !content.includes("<button")) {
                issues.push(`${rel}: onClick without keyboard handler — add onKeyDown or use <button>`);
            }
            if (content.includes("tabIndex") && content.includes("-1")) {
                issues.push(`${rel}: tabIndex={-1} — removes from tab order, ensure intentional`);
            }
            if (content.includes("outline: none") || content.includes("outline: 0")) {
                issues.push(`${rel}: outline removed — add alternative focus indicator`);
            }
            if (content.includes("color:") && !content.includes("--") && !content.includes("theme")) {
                issues.push(`${rel}: Hardcoded color — ensure sufficient contrast (4.5:1 for text)`);
            }
            if (content.includes("<div") && content.includes("onClick") && !content.includes("role=")) {
                issues.push(`${rel}: Clickable <div> without role — add role="button" and tabIndex={0}`);
            }
        }
        const lines = ["=== Accessibility Audit ===\n"];
        lines.push(`Files scanned: ${files.length}`);
        lines.push("");
        if (issues.length) {
            lines.push(`Issues (${issues.length}):`);
            issues.forEach((i) => lines.push(`  ♿ ${i}`));
        }
        else {
            lines.push("No obvious accessibility issues found.");
        }
        return lines.join("\n");
    },
};
