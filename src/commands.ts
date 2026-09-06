export interface SlashCommand {
  name: string;
  description: string;
  local?: boolean;
}

// This is deliberately a small data catalog: commands can be discoverable before
// every integration has a local implementation.
const slashCommandRows = [
  // ─── Core (local) ──────────────────────────────────────────────────
  ["clear", "Clear the visible conversation and model history", true],
  ["compact", "Trim old history to reduce token usage", true],
  ["help", "List Garuda slash commands", true],
  ["guide", "Show the first-time installation and provider guide", true],
  ["status", "Show the active provider, model, and context estimate", true],
  ["context", "Show the current context estimate", true],
  ["skills", "List bundled coding skills by category", true],
  ["tools", "List tools available to the agent", true],
  ["exit", "Exit Garuda", true],
  ["quit", "Exit Garuda", true],

  // ─── Core Frontend ──────────────────────────────────────────────────
  ["js", "ES6+ JavaScript: closures, promises, async/await, modules"],
  ["ts", "TypeScript strict mode: generics, utility types, type guards"],
  ["react", "React hooks, context, memo, ref, useEffect patterns"],
  ["nextjs", "Next.js App Router: SSR/SSG, server components, API routes"],
  ["css", "Modern CSS: Grid, Flexbox, container queries, :has(), animations"],
  ["tailwind", "Tailwind CSS: utility classes, theming, responsive design"],
  ["state", "State management: Zustand, Redux Toolkit, Jotai, signals"],
  ["fetch", "Data fetching: React Query / SWR, caching, suspense"],

  // ─── 3D / WebGL / Creative Web ──────────────────────────────────────
  ["threejs", "Three.js: scenes, cameras, lights, materials, loaders"],
  ["webgl", "WebGL fundamentals: render pipeline, buffers, textures"],
  ["r3f", "React Three Fiber: declarative Three.js in React"],
  ["drei", "Drei helpers: controls, environments, text, shaders"],
  ["glsl", "GLSL shaders: vertex/fragment, uniforms, noise, lighting"],
  ["gltf", "GLTF/GLB: loading, Draco compression, texture optimization"],
  ["3d-perf", "3D performance: instancing, LOD, draw calls, batching"],
  ["postfx", "Post-processing: bloom, SSAO, tone mapping, DOF"],
  ["physics3d", "3D physics: Rapier / Cannon.js, colliders, joints"],
  ["3d-anim", "3D animation: keyframes, morph targets, GSAP + Three.js"],
  ["threejs-audit", "Audit Three.js project for performance issues"],
  ["shader-audit", "Audit GLSL shaders for performance issues"],

  // ─── Motion & Interaction ───────────────────────────────────────────
  ["gsap", "GSAP: timelines, ScrollTrigger, stagger, easing"],
  ["framer", "Framer Motion: layout animations, gestures, variants"],
  ["css-anim", "CSS animations: @keyframes, transitions, scroll-driven"],
  ["scroll", "Scroll experiences: Lenis, locomotive, parallax"],
  ["page-trans", "Page transitions: route transitions, shared layouts"],
  ["lottie", "Lottie / Rive: lightweight vector animations"],
  ["easing", "Easing & timing: cubic-bezier, spring physics"],

  // ─── UI / UX Professional ───────────────────────────────────────────
  ["designsys", "Design systems: tokens, components, consistency"],
  ["typography", "Typography & spacing: type scale, rhythm, fluid type"],
  ["color", "Color & contrast: accessible palettes, WCAG ratios"],
  ["responsive", "Responsive design: mobile-first, container queries"],
  ["a11y", "Accessibility: WCAG 2.1, ARIA, keyboard, screen readers"],
  ["micro", "Micro-interactions: hover, focus, loading states"],
  ["figma", "Figma-to-code: inspect designs, extract tokens"],
  ["ux-flow", "User flows: navigation hierarchy, information architecture"],
  ["skeleton", "Performance perception: skeleton loaders, optimistic UI"],
  ["a11y-audit", "Audit code for accessibility issues"],

  // ─── Backend (Python + FastAPI) ──────────────────────────────────────
  ["python", "Python: type hints, async/await, dataclasses, protocols"],
  ["fastapi", "FastAPI: routes, Pydantic, dependency injection, middleware"],
  ["pyasync", "Async Python: asyncio, httpx, asyncpg, background tasks"],
  ["pyauth", "Python auth: JWT, OAuth2, session management, API keys"],
  ["pydb", "Databases: PostgreSQL, SQLAlchemy, Alembic, connection pooling"],
  ["pyapi", "API design: REST versioning, error handling, pagination"],
  ["pyval", "Validation: Pydantic models, custom validators, serialization"],
  ["pytest", "Python testing: pytest, httpx TestClient, fixtures, mocking"],
  ["pydeploy", "Python deployment: Docker, Gunicorn, Uvicorn, Railway"],
  ["fastapi-audit", "Audit FastAPI project for issues and anti-patterns"],

  // ─── Full-stack & Engineering ────────────────────────────────────────
  ["git", "Git workflow: branching, rebasing, conventional commits"],
  ["testing", "Testing strategy: unit + integration, RTL, Playwright"],
  ["cicd", "CI/CD: GitHub Actions, build/test/deploy pipelines"],
  ["perf", "Performance: Lighthouse, Web Vitals, bundle analysis"],
  ["sec", "Security: XSS, CSRF, secrets, CORS, CSP, auditing"],
  ["observe", "Observability: logging, error tracking, metrics"],
  ["arch-full", "Clean architecture: separation of concerns, DI"],
  ["docs", "Documentation: README, API docs, ADRs, inline comments"],
  ["perf-budget", "Analyze bundle size and performance budget"],

  // ─── SDE Job Skills (Interview + Career) ──────────────────────────
  ["dsa", "Data structures & algorithms: arrays, trees, graphs, DP, sorting"],
  ["sysdesign", "System design: load balancers, caching, databases, microservices"],
  ["oop", "OOP principles: SOLID, design patterns, encapsulation, polymorphism"],
  ["dbdesign", "Database design: normalization, indexing, query optimization"],
  ["networking", "Networking: HTTP, TCP/IP, DNS, WebSockets, REST, gRPC"],
  ["os-concepts", "OS concepts: processes, threads, memory, concurrency"],
  ["cloud", "Cloud & infra: AWS/GCP/Azure, Docker, Kubernetes, serverless"],
  ["caching-strat", "Caching strategies: Redis, CDN, browser cache, invalidation"],
  ["msg-queue", "Message queues: Kafka, RabbitMQ, pub/sub, event-driven"],
  ["search-eng", "Search engineering: Elasticsearch, full-text search, ranking"],
  ["ml-basics", "ML basics for SDE: recommendation, NLP, model serving"],
  ["behavioral", "Behavioral interview: STAR method, leadership, conflict resolution"],
  ["code-review", "Code review mastery: reading code, spotting bugs, feedback"],
  ["debug-strat", "Debugging strategies: binary search, profiling, root cause"],
  ["refactor-pro", "Refactoring at scale: tech debt, code smells, strangler fig"],
  ["product-sense", "Product sense: user needs, metrics, A/B testing, trade-offs"],
  ["estimation", "Estimation skills: time, scope, capacity, risk assessment"],
  ["leetcode-hard", "LeetCode patterns: sliding window, BFS/DFS, trie, union-find"],
  ["interview-prep", "Interview prep: mock interviews, whiteboard, edge cases"],
  ["resume-build", "Resume building: quantified impact, ATS optimization"],

  // ─── Legacy core (backward compat) ──────────────────────────────────
  ["debug", "Trace a failure and verify the fix"],
  ["review", "Review code for correctness and regressions"],
  ["security", "Inspect code for security risks"],
  ["performance", "Find hot paths and unnecessary work"],
  ["refactor", "Improve structure while preserving behavior"],
  ["test", "Design focused tests for the current task"],
  ["document", "Write concise project documentation"],
  ["lint", "Run linter and fix code style issues"],
  ["typecheck", "Run type checking and fix type errors"],
  ["complexity", "Analyze cyclomatic complexity"],
  ["deadcode", "Find unused exports and dead code"],
  ["dependency", "Audit dependencies for vulnerabilities"],
  ["arch", "Analyze project architecture"],
  ["migrate", "Plan and execute code migrations"],
  ["design", "Suggest design patterns and API contracts"],
  ["decompose", "Break monolithic code into modules"],
  ["ci", "Design or fix CI/CD pipelines"],
  ["docker", "Create or debug Docker configurations"],
  ["deploy", "Plan deployment strategies"],
  ["monitor", "Add logging, metrics, and health checks"],
  ["sql", "Write or optimize SQL queries"],
  ["schema", "Design data schemas and validation"],
  ["cache", "Design caching strategies"],
  ["api", "Design or debug REST/GraphQL/gRPC APIs"],
  ["auth", "Implement authentication and authorization"],

  // ─── System commands ────────────────────────────────────────────────
  ["model", "Show or request a model change"],
  ["provider", "Show or request a provider change"],
  ["sessions", "List saved conversations"],
  ["resume", "Resume a saved conversation"],
  ["diff", "View uncommitted changes"],
  ["plan", "Create or inspect an implementation plan"],
  ["mcp", "Manage MCP servers"],
  ["models", "List available models"],
  ["config", "Open configuration"],
  ["doctor", "Diagnose Garuda configuration"],
  ["update", "Check for Garuda updates"],
] as const;

export const SLASH_COMMANDS: SlashCommand[] = slashCommandRows.map(([name, description, local]) => ({
  name,
  description,
  local,
}));

export function getSlashCommand(name: string): SlashCommand | undefined {
  const aliases: Record<string, string> = {
    p: "provider",
    m: "model",
    h: "help",
    q: "exit",
  };
  name = aliases[name] ?? name;
  return SLASH_COMMANDS.find((command) => command.name === name);
}
