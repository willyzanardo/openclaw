import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { parseBooleanValue } from "../utils/boolean.js";

const log = createSubsystemLogger("agent/tool-compact");

type PayloadWithTools = {
  tools?: Array<{
    name: string;
    description?: string;
    input_schema?: unknown;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

function compactPayloadTools(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const obj = payload as PayloadWithTools;

  if (!Array.isArray(obj.tools)) {
    return payload;
  }

  // Compact each tool to minimal definition
  const compactedTools = obj.tools.map((tool) => {
    let shortDescription = tool.description || "";

    // Truncate to first sentence or 100 chars
    if (shortDescription.length > 100) {
      const firstSentence = shortDescription.split(/\.\s+/)[0];
      if (firstSentence && firstSentence.length < 100) {
        shortDescription = firstSentence + ".";
      } else {
        shortDescription = shortDescription.slice(0, 97) + "...";
      }
    }

    if (shortDescription) {
      shortDescription += " Read tools.md for full schema.";
    }

    return {
      name: tool.name,
      description: shortDescription,
      input_schema: {
        type: "object",
        properties: {},
        description: "Read tools.md for full parameter schema",
      },
    };
  });

  return {
    ...obj,
    tools: compactedTools,
  };
}

export type ToolCompactWrapper = {
  enabled: true;
  wrapStreamFn: (streamFn: StreamFn) => StreamFn;
};

export function createToolCompactWrapper(params: {
  env?: NodeJS.ProcessEnv;
}): ToolCompactWrapper | null {
  const env = params.env ?? process.env;
  const enabled = parseBooleanValue(env.OPENCLAW_COMPACT_TOOLS) ?? false;

  if (!enabled) {
    return null;
  }

  log.info("tool compaction enabled");

  const wrapStreamFn: ToolCompactWrapper["wrapStreamFn"] = (streamFn) => {
    const wrapped: StreamFn = (model, context, options) => {
      // Intercept and modify the payload before sending
      const nextOnPayload = (payload: unknown) => {
        const compactedPayload = compactPayloadTools(payload);
        options?.onPayload?.(compactedPayload);
      };

      return streamFn(model, context, {
        ...options,
        onPayload: nextOnPayload,
      });
    };
    return wrapped;
  };

  return { enabled: true, wrapStreamFn };
}
