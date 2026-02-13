import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { parseBooleanValue } from "../utils/boolean.js";

const log = createSubsystemLogger("agent/request");

function safeJsonStringify(value: unknown, maxDepth = 10): string {
  const seen = new WeakSet();
  
  const replacer = (depth: number) => (_key: string, val: unknown): unknown => {
    if (depth > maxDepth) {
      return "[Max Depth Reached]";
    }
    
    if (typeof val === "bigint") {
      return val.toString();
    }
    if (typeof val === "function") {
      return "[Function]";
    }
    if (val instanceof Error) {
      return { name: val.name, message: val.message };
    }
    if (val instanceof Uint8Array) {
      return `[Uint8Array(${val.length})]`;
    }
    if (val && typeof val === "object") {
      if (seen.has(val)) {
        return "[Circular]";
      }
      seen.add(val);
    }
    return val;
  };

  try {
    return JSON.stringify(value, replacer(0), 2);
  } catch {
    return "[Stringify Error]";
  }
}

export type RequestLogger = {
  enabled: true;
  wrapStreamFn: (streamFn: StreamFn) => StreamFn;
};

export function createRequestLogger(params: {
  env?: NodeJS.ProcessEnv;
  runId?: string;
  sessionId?: string;
  provider?: string;
  modelId?: string;
}): RequestLogger | null {
  const env = params.env ?? process.env;
  const enabled = parseBooleanValue(env.OPENCLAW_LOG_REQUESTS) ?? false;
  
  if (!enabled) {
    return null;
  }

  log.info("request logger enabled", {
    provider: params.provider,
    modelId: params.modelId,
    runId: params.runId,
  });

  const wrapStreamFn: RequestLogger["wrapStreamFn"] = (streamFn) => {
    const wrapped: StreamFn = (model, context, options) => {
      const nextOnPayload = (payload: unknown) => {
        console.log("\n" + "=".repeat(80));
        console.log("🔍 AI PROVIDER REQUEST");
        console.log("=".repeat(80));
        console.log(`Provider: ${params.provider}`);
        console.log(`Model: ${params.modelId}`);
        console.log(`Run ID: ${params.runId}`);
        console.log(`Session ID: ${params.sessionId}`);
        console.log("-".repeat(80));
        console.log("Full Request Payload:");
        console.log(safeJsonStringify(payload));
        console.log("=".repeat(80) + "\n");
        
        options?.onPayload?.(payload);
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
