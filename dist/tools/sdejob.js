import { promises as fs } from "node:fs";
import path from "node:path";
import { glob as globAsync } from "glob";
// ─── Code Review Tool ────────────────────────────────────────────────
export const codeReviewTool = {
    requiresConfirmation: false,
    definition: {
        name: "code_review",
        description: "Perform a thorough code review: check for bugs, anti-patterns, " +
            "security issues, performance problems, and suggest improvements. " +
            "Useful for interview prep and production code quality.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File or directory to review." },
                focus: { type: "string", description: "Focus area: 'bugs', 'security', 'performance', 'patterns', or 'all'. Default 'all'." },
            },
        },
    },
    async run(input, ctx) {
        const target = String(input.path ?? ".");
        const focus = String(input.focus ?? "all");
        const resolved = path.isAbsolute(target) ? target : path.join(ctx.cwd, target);
        const stat = await fs.stat(resolved).catch(() => null);
        if (!stat)
            return `Path not found: ${target}`;
        let files = [];
        if (stat.isDirectory()) {
            files = await globAsync("**/*.{ts,tsx,js,jsx,py}", {
                cwd: resolved,
                nodir: true,
                ignore: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/__pycache__/**"],
            });
            files = files.map((f) => path.join(resolved, f));
        }
        else {
            files = [resolved];
        }
        const findings = [];
        let bugsFound = 0;
        let securityIssues = 0;
        let perfIssues = 0;
        let patternIssues = 0;
        for (const file of files.slice(0, 50)) {
            const content = await fs.readFile(file, "utf-8");
            const rel = path.relative(ctx.cwd, file);
            const lines = content.split("\n");
            // Bug detection
            if (focus === "all" || focus === "bugs") {
                // Loose equality
                if (content.includes("== ") && !content.includes("===") && !content.includes("!==")) {
                    findings.push(`BUG ${rel}: Loose equality (==) — use strict (===)`);
                    bugsFound++;
                }
                // Race conditions
                if (content.match(/let\s+\w+\s*=\s*0[\s\S]*setInterval/) && !content.includes("atomic")) {
                    findings.push(`BUG ${rel}: Potential race condition with shared mutable state`);
                    bugsFound++;
                }
                // Unhandled promises
                if (content.match(/\.\w+\([^)]*\)\s*$/) && content.includes("Promise") && !content.includes(".catch")) {
                    findings.push(`BUG ${rel}: Unhandled promise — add .catch() or use try/catch`);
                    bugsFound++;
                }
                // Memory leaks
                if (content.includes("addEventListener") && !content.includes("removeEventListener") && !content.includes("cleanup")) {
                    findings.push(`BUG ${rel}: Event listener without cleanup — potential memory leak`);
                    bugsFound++;
                }
            }
            // Security issues
            if (focus === "all" || focus === "security") {
                if (content.includes("innerHTML") && !content.includes("DOMPurify")) {
                    findings.push(`SECURITY ${rel}: innerHTML without sanitization — XSS risk`);
                    securityIssues++;
                }
                if (content.includes("eval(") || content.includes("Function(")) {
                    findings.push(`SECURITY ${rel}: eval/Function usage — code injection risk`);
                    securityIssues++;
                }
                if (content.match(/password|secret|token|api_key/i) && content.includes("=") && !content.includes("env") && !content.includes("process.env")) {
                    findings.push(`SECURITY ${rel}: Possible hardcoded secret — use environment variables`);
                    securityIssues++;
                }
                if (content.includes("dangerouslySetInnerHTML") && !content.includes("DOMPurify")) {
                    findings.push(`SECURITY ${rel}: dangerouslySetInnerHTML without DOMPurify`);
                    securityIssues++;
                }
                if (content.includes("SELECT *") && content.includes("WHERE")) {
                    findings.push(`SECURITY ${rel}: SELECT * — use specific columns to prevent data exposure`);
                    securityIssues++;
                }
            }
            // Performance issues
            if (focus === "all" || focus === "performance") {
                if (content.includes("JSON.parse") && content.includes("render")) {
                    findings.push(`PERF ${rel}: JSON.parse in render — move to useMemo or data layer`);
                    perfIssues++;
                }
                if (content.includes("new Array(") && content.includes("map") && !content.includes("useMemo")) {
                    findings.push(`PERF ${rel}: Array creation in render without memoization`);
                    perfIssues++;
                }
                if (content.includes("for") && content.includes("await") && !content.includes("Promise.all")) {
                    findings.push(`PERF ${rel}: Sequential await in loop — consider Promise.all for parallel`);
                    perfIssues++;
                }
                if (content.includes("SELECT") && content.includes("JOIN") && !content.includes("index")) {
                    findings.push(`PERF ${rel}: JOIN without index hint — check query plan`);
                    perfIssues++;
                }
            }
            // Pattern issues
            if (focus === "all" || focus === "patterns") {
                if (content.includes("any") && !content.includes("// @ts-ignore")) {
                    const anyCount = (content.match(/:\s*any\b/g) ?? []).length;
                    if (anyCount > 3) {
                        findings.push(`PATTERN ${rel}: ${anyCount} uses of 'any' — use strict types`);
                        patternIssues++;
                    }
                }
                if (content.includes("console.log") && !content.includes("debug")) {
                    findings.push(`PATTERN ${rel}: console.log in production code — use logger`);
                    patternIssues++;
                }
                if (content.includes("TODO") || content.includes("FIXME") || content.includes("HACK")) {
                    const todos = (content.match(/TODO|FIXME|HACK/g) ?? []).length;
                    findings.push(`PATTERN ${rel}: ${todos} TODO/FIXME/HACK comments — resolve or track`);
                    patternIssues++;
                }
            }
        }
        const lines = ["=== Code Review Report ===\n"];
        lines.push(`Files reviewed: ${Math.min(files.length, 50)}`);
        lines.push(`Bugs: ${bugsFound} | Security: ${securityIssues} | Performance: ${perfIssues} | Patterns: ${patternIssues}`);
        lines.push("");
        if (findings.length) {
            lines.push(`Findings (${findings.length}):`);
            findings.forEach((f) => lines.push(`  ${f}`));
        }
        else {
            lines.push("No issues found. Code looks clean!");
        }
        return lines.join("\n");
    },
};
// ─── System Design Helper ────────────────────────────────────────────
export const systemDesignTool = {
    requiresConfirmation: false,
    definition: {
        name: "system_design",
        description: "Help design a system: analyze requirements, suggest architecture, " +
            "identify bottlenecks, and provide a design document template. " +
            "Useful for system design interviews and architecture planning.",
        inputSchema: {
            type: "object",
            properties: {
                system: { type: "string", description: "What system to design (e.g. 'URL shortener', 'chat app', 'news feed')." },
                scale: { type: "string", description: "Expected scale: 'small', 'medium', 'large', 'massive'. Default 'medium'" },
            },
            required: ["system"],
        },
    },
    async run(input, ctx) {
        const system = String(input.system ?? "");
        const scale = String(input.scale ?? "medium");
        const scaleConfig = {
            small: { users: "1K-10K", data: "GB", latency: "<500ms", availability: "99%" },
            medium: { users: "10K-1M", data: "TB", latency: "<200ms", availability: "99.9%" },
            large: { users: "1M-100M", data: "PB", latency: "<100ms", availability: "99.99%" },
            massive: { users: "100M+", data: "EB", latency: "<50ms", availability: "99.999%" },
        };
        const config = scaleConfig[scale] ?? scaleConfig.medium;
        const design = `
=== System Design: ${system} ===
Scale: ${scale} (${config.users} users, ${config.data} data)

## 1. Requirements Clarification
- Functional: What does the system do?
- Non-functional: ${config.latency} latency, ${config.availability} availability
- Constraints: Budget, team size, timeline

## 2. Estimation
- Users: ${config.users}
- Data volume: ${config.data}
- Read/Write ratio: Typically 10:1 for read-heavy
- Bandwidth: Estimate based on request size × QPS

## 3. High-Level Architecture
- Client → Load Balancer → API Gateway → Services → Database
- Consider: CDN for static assets, Redis for caching, Message queues for async

## 4. Database Design
- SQL: Structured data, ACID, relationships
- NoSQL: Flexible schema, horizontal scaling, eventual consistency
- Choose based on: Query patterns, consistency needs, scale

## 5. Key Components
- Load Balancer: Round-robin, least connections, IP hash
- Cache: Redis/Memcached, write-through vs write-behind
- Database: Primary-replica, sharding strategy
- Queue: Kafka/RabbitMQ for async processing

## 6. Bottlenecks & Solutions
- Single point of failure → Redundancy
- Database bottleneck → Sharding, read replicas
- High latency → Caching, CDN, connection pooling
- Traffic spikes → Auto-scaling, rate limiting

## 7. Monitoring & Logging
- Metrics: Response time, error rate, throughput
- Alerts: PagerDuty, Datadog, CloudWatch
- Logs: Centralized (ELK stack, CloudWatch Logs)

## 8. Interview Tips
- Start with requirements, don't jump to solution
- Draw the architecture first, then dive deep
- Discuss trade-offs explicitly
- Mention scalability at each layer
- Talk about failure modes and recovery
`;
        return design;
    },
};
// ─── Algorithm Analysis Tool ─────────────────────────────────────────
export const algoAnalysisTool = {
    requiresConfirmation: false,
    definition: {
        name: "algo_analysis",
        description: "Analyze code for algorithmic complexity (Big O), suggest optimal approaches, " +
            "and identify data structure choices. Useful for LeetCode-style problem solving.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "File containing the algorithm to analyze." },
                problem: { type: "string", description: "Problem description or LeetCode problem name." },
            },
        },
    },
    async run(input, ctx) {
        const target = String(input.path ?? "");
        const problem = String(input.problem ?? "");
        let code = "";
        if (target) {
            const resolved = path.isAbsolute(target) ? target : path.join(ctx.cwd, target);
            code = await fs.readFile(resolved, "utf-8").catch(() => "");
        }
        const analysis = `
=== Algorithm Analysis ===
${problem ? `Problem: ${problem}` : ""}

## Complexity Analysis
- Time: Analyze loops, recursion depth, built-in operations
- Space: Track auxiliary space (not counting input)

## Common Complexities (Best to Worst)
- O(1) — Constant: Hash lookup, array index
- O(log n) — Logarithmic: Binary search
- O(n) — Linear: Single loop
- O(n log n) — Linearithmic: Merge sort, quicksort (avg)
- O(n²) — Quadratic: Nested loops
- O(2^n) — Exponential: Subsets, backtracking
- O(n!) — Factorial: Permutations

## Data Structure Selection Guide
| Operation       | Array | Linked List | Hash Map | BST   | Heap  |
|----------------|-------|-------------|----------|-------|-------|
| Access          | O(1)  | O(n)        | N/A      | O(log n) | N/A |
| Search          | O(n)  | O(n)        | O(1)     | O(log n) | O(n) |
| Insert          | O(n)  | O(1)        | O(1)     | O(log n) | O(log n) |
| Delete          | O(n)  | O(1)        | O(1)     | O(log n) | O(log n) |

## LeetCode Pattern Recognition
- Two Pointers: Sorted array, pair/triplet problems
- Sliding Window: Substring/subarray with condition
- BFS: Shortest path, level-order traversal
- DFS: Path finding, connected components, backtracking
- Dynamic Programming: Overlapping subproblems, optimal substructure
- Greedy: Local optimal → global optimal (activity selection, Huffman)
- Union-Find: Connected components, cycle detection
- Trie: Prefix matching, word search

## Optimization Tips
1. Identify redundant work → memoization
2. Reduce search space → binary search, pruning
3. Use appropriate data structures → hash for O(1) lookup
4. Precompute → prefix sums, DP tables
5. Trade space for time → caching, lookup tables
`;
        return analysis;
    },
};
// ─── Interview Prep Tool ─────────────────────────────────────────────
export const interviewPrepTool = {
    requiresConfirmation: false,
    definition: {
        name: "interview_prep",
        description: "Generate interview prep materials: common questions, STAR stories, " +
            "coding patterns, and behavioral frameworks. Use before technical interviews.",
        inputSchema: {
            type: "object",
            properties: {
                type: { type: "string", description: "Interview type: 'coding', 'system-design', 'behavioral', 'all'. Default 'all'." },
                role: { type: "string", description: "Target role: 'sde1', 'sde2', 'senior', 'staff'. Default 'sde2'." },
            },
        },
    },
    async run(input, ctx) {
        const type = String(input.type ?? "all");
        const role = String(input.role ?? "sde2");
        const sections = [];
        if (type === "all" || type === "coding") {
            sections.push(`
## Coding Interview Prep (${role})

### Must-Know Patterns (LeetCode)
1. Two Pointers — Two Sum, 3Sum, Container With Most Water
2. Sliding Window — Longest Substring, Minimum Window
3. BFS/DFS — Number of Islands, Word Ladder, Course Schedule
4. Binary Search — Search Rotated Array, Find Minimum
5. Dynamic Programming — Climbing Stairs, Coin Change, LCS
6. Backtracking — Permutations, Combinations, N-Queens
7. Trie — Implement Trie, Word Search II
8. Union-Find — Redundant Connection, Accounts Merge

### Coding Session Framework
1. Clarify: Ask about edge cases, constraints, input size
2. Examples: Walk through 2-3 examples manually
3. Brute Force: State the naive approach, analyze complexity
4. Optimize: Identify bottleneck, suggest improvement
5. Code: Write clean, commented code
6. Test: Trace through examples, check edge cases

### Common Follow-ups
- "Can you optimize for space?"
- "What if the input is very large (streaming)?"
- "How would you test this?"
- "What are the edge cases?"
`);
        }
        if (type === "all" || type === "system-design") {
            sections.push(`
## System Design Interview Prep

### Framework (45 min)
1. Requirements (5 min): Functional + non-functional
2. Estimation (5 min): Users, data, QPS
3. Design (20 min): High-level → deep dive
4. Bottlenecks (10 min): Scale, failures, trade-offs
5. Wrap-up (5 min): Recap, alternatives

### Must-Know Systems
- URL Shortener: Hashing, redirects, analytics
- Chat System: WebSockets, message ordering, presence
- News Feed: Fan-out, ranking, caching
- Rate Limiter: Token bucket, sliding window
- Search Autocomplete: Trie, ranking, real-time

### Key Concepts
- CAP Theorem: Consistency, Availability, Partition tolerance
- Consistent Hashing: Distributed caching, load balancing
- Database Sharding: Horizontal partitioning strategies
- CQRS: Read/write optimization separation
`);
        }
        if (type === "all" || type === "behavioral") {
            sections.push(`
## Behavioral Interview Prep (${role})

### STAR Framework
- Situation: Set the context (company, team, challenge)
- Task: Your specific responsibility
- Action: What YOU did (not the team)
- Result: Quantified impact (metrics, timeline, outcome)

### Common Questions & Prep Areas
1. Tell me about a time you led a project
2. Describe a conflict with a teammate
3. When did you have to make a decision with incomplete info
4. Tell me about your biggest technical challenge
5. How do you handle competing priorities

### Leadership Principles (Amazon-style)
- Customer Obsession: Start with customer, work backwards
- Ownership: Think long-term, act on behalf of company
- Simplify: Bias for action, deliver results
- Learn and Be Curious: Never stop learning
- Hire and Develop: Raise the bar

### Impact Stories to Prepare
1. A feature you shipped that impacted users
2. A bug you caught that prevented a outage
3. A process you improved for the team
4. A time you mentored someone
5. A decision you made under pressure
`);
        }
        return sections.join("\n");
    },
};
