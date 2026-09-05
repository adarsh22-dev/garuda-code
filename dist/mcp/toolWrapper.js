import { McpStdioClient } from "./client.js";
/**
 * Connects to each configured MCP stdio server, lists its tools, and wraps
 * each one as a native Tool. Tool names are namespaced as "<serverName>__<toolName>"
 * to avoid collisions across servers and with built-in tools.
 */
export async function loadMcpTools(configs) {
    const clients = [];
    const tools = [];
    for (const cfg of configs) {
        try {
            const client = new McpStdioClient(cfg);
            await client.initialize();
            const remoteTools = await client.listTools();
            clients.push(client);
            for (const rt of remoteTools) {
                const namespacedName = `${cfg.name}__${rt.name}`;
                tools.push({
                    requiresConfirmation: true, // MCP tools can do anything server-side; confirm by default
                    definition: {
                        name: namespacedName,
                        description: `[MCP: ${cfg.name}] ${rt.description ?? rt.name}`,
                        inputSchema: rt.inputSchema ?? { type: "object", properties: {} },
                    },
                    async run(input) {
                        return client.callTool(rt.name, input);
                    },
                });
            }
        }
        catch (err) {
            // A single misbehaving MCP server shouldn't take down the whole agent.
            console.error(`[garuda] Failed to load MCP server "${cfg.name}": ${err.message}`);
        }
    }
    return {
        tools,
        closeAll: () => clients.forEach((c) => c.close()),
    };
}
