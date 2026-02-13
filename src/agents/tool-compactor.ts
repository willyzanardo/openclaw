import type { AgentTool } from "@mariozechner/pi-agent-core";

/**
 * Compact tool definitions to reduce token usage in API requests.
 * Truncates long descriptions and adds a note to read full docs from tools.md.
 *
 * Uses a generic type to work with both AgentTool and ToolDefinition types.
 */
export function compactToolsForRequest<T extends { name: string; description: string }>(
  tools: T[],
): T[] {
  return tools.map((tool) => {
    // Keep the first sentence or up to 100 chars of the description
    let shortDescription = tool.description;
    if (shortDescription && shortDescription.length > 100) {
      const firstSentence = shortDescription.split(/\.\s+/)[0];
      if (firstSentence && firstSentence.length < 100) {
        shortDescription = firstSentence + ".";
      } else {
        shortDescription = shortDescription.slice(0, 97) + "...";
      }
    }
    shortDescription += " Read tools.md for full details.";
    return {
      name: tool.name,
      description: shortDescription,
    } as T;
  });
}

/**
 * Check if tool compaction is enabled via environment variable.
 */
export function isToolCompactionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.OPENCLAW_COMPACT_TOOLS?.toLowerCase().trim();
  return value === "1" || value === "true" || value === "yes";
}
