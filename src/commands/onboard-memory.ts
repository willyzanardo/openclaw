import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { upsertSharedEnvVar } from "../infra/env-file.js";
import { formatApiKeyPreview } from "./auth-choice.api-key.js";

/**
 * Prompt user to configure memory embeddings (OpenAI or local model).
 * Called during onboarding after model provider selection.
 */
export async function setupMemoryEmbeddings(
  config: OpenClawConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  let nextConfig = { ...config };

  const wantOpenAi = await prompter.confirm({
    message: "Do you want to add an OpenAI key for memory embeddings now?",
    initialValue: false,
  });

  if (wantOpenAi) {
    const existingEnvKey = process.env.OPENAI_API_KEY?.trim();
    let apiKey: string | undefined;

    if (existingEnvKey) {
      const useExisting = await prompter.confirm({
        message: `Use existing OPENAI_API_KEY from environment (${formatApiKeyPreview(existingEnvKey)})?`,
        initialValue: true,
      });

      if (useExisting) {
        apiKey = existingEnvKey;
      }
    }

    if (!apiKey) {
      const keyInput = await prompter.text({
        message: "OpenAI API key for memory embeddings",
        placeholder: "sk-...",
        validate: (value) => {
          const trimmed = value?.trim();
          if (!trimmed) {
            return "API key is required";
          }
          if (!trimmed.startsWith("sk-")) {
            return "OpenAI API keys start with sk-";
          }
          return undefined;
        },
      });
      apiKey = keyInput.trim();
    }

    if (apiKey) {
      // Store the key using the same pattern as other API keys
      const result = upsertSharedEnvVar({
        key: "OPENAI_API_KEY",
        value: apiKey,
      });

      // Update process.env for immediate availability
      if (!process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = apiKey;
      }

      await prompter.note(
        `Saved OPENAI_API_KEY to ${result.path} for memory embeddings.`,
        "Memory Setup",
      );

      // Set memory configuration to use OpenAI
      nextConfig = {
        ...nextConfig,
        agents: {
          ...nextConfig.agents,
          defaults: {
            ...nextConfig.agents?.defaults,
            memorySearch: {
              ...nextConfig.agents?.defaults?.memorySearch,
              provider: "openai",
              model: "text-embedding-3-small",
            },
          },
        },
      };

      await prompter.note("Memory embeddings configured to use OpenAI.", "Memory Setup");
    }
  } else {
    // Ask about local model
    const wantLocal = await prompter.confirm({
      message: "Do you want to install a local model for memory embeddings?",
      initialValue: false,
    });

    if (wantLocal) {
      await prompter.note(
        [
          "Installing local embedding model...",
          "",
          "This will download ~300MB model (embeddinggemma-300M).",
          "The model will be cached for future use.",
        ].join("\n"),
        "Local Model Setup",
      );

      // Configure local embedding model
      nextConfig = {
        ...nextConfig,
        agents: {
          ...nextConfig.agents,
          defaults: {
            ...nextConfig.agents?.defaults,
            memorySearch: {
              ...nextConfig.agents?.defaults?.memorySearch,
              provider: "local",
              model: "embeddinggemma-300M",
              local: {
                modelPath: "hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf",
              },
            },
          },
        },
      };

      await prompter.note(
        [
          "Local embedding model configured.",
          "",
          "The model will download automatically on first use.",
          "Memory features (memory_search, memory_get) will use this local model.",
        ].join("\n"),
        "Memory Setup",
      );
    } else {
      await prompter.note(
        [
          "Memory embeddings not configured.",
          "",
          "You can add memory support later with:",
          "  openclaw config set agents.defaults.memorySearch.provider openai",
          "  export OPENAI_API_KEY=sk-...",
          "",
          "Or configure local embeddings:",
          "  openclaw config set agents.defaults.memorySearch.provider local",
        ].join("\n"),
        "Memory Setup",
      );
    }
  }

  return nextConfig;
}
