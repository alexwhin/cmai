import { Provider, Config, AIProvider } from "../types/index.js";
import { LangChainOpenAIProvider } from "./langchain/openai.js";
import { LangChainAnthropicProvider } from "./langchain/anthropic.js";
import { LangChainOllamaProvider } from "./langchain/ollama.js";
import { UnknownProviderError } from "../utils/errors.js";
import { DEFAULTS } from "../constants.js";

export function createProvider(
  provider: Provider,
  apiKey: string,
  model: string,
  maxCommitLength: number = DEFAULTS.MAX_COMMIT_LENGTH,
  commitChoicesCount: number = DEFAULTS.COMMIT_CHOICES_COUNT,
  customRules?: string[],
  commitLanguage: string = DEFAULTS.COMMIT_LANGUAGE
): AIProvider {
  switch (provider) {
    case Provider.OPENAI:
      return new LangChainOpenAIProvider(
        apiKey,
        model,
        maxCommitLength,
        commitChoicesCount,
        customRules,
        commitLanguage
      );

    case Provider.ANTHROPIC:
      return new LangChainAnthropicProvider(
        apiKey,
        model,
        maxCommitLength,
        commitChoicesCount,
        customRules,
        commitLanguage
      );

    case Provider.OLLAMA:
      return new LangChainOllamaProvider(
        apiKey,
        model,
        maxCommitLength,
        commitChoicesCount,
        customRules,
        commitLanguage
      );

    default:
      throw new UnknownProviderError(provider);
  }
}

export function createProviderFromConfig(configuration: Config): AIProvider {
  return createProvider(
    configuration.provider,
    configuration.apiKey || "",
    configuration.model,
    configuration.maxCommitLength || DEFAULTS.MAX_COMMIT_LENGTH,
    configuration.commitChoicesCount || DEFAULTS.COMMIT_CHOICES_COUNT,
    configuration.customRules,
    configuration.commitLanguage || DEFAULTS.COMMIT_LANGUAGE
  );
}
