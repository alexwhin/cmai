import { Provider, Config, AIProvider } from "../types/index.js";
import { LangChainOpenAIProvider } from "./langchain/openai.js";
import { LangChainAnthropicProvider } from "./langchain/anthropic.js";
import { LangChainOllamaProvider } from "./langchain/ollama.js";
import { LangChainGeminiProvider } from "./langchain/gemini.js";
import { UnknownProviderError } from "../utils/errors.js";
import { DEFAULTS } from "../constants.js";

type ProviderConstructor = new (
  apiKey: string,
  model: string,
  maxCommitLength: number,
  commitChoicesCount: number,
  customRules: string[] | undefined,
  commitLanguage: string
) => AIProvider;

const PROVIDER_MAP: Record<Provider, ProviderConstructor> = {
  [Provider.OPENAI]: LangChainOpenAIProvider,
  [Provider.ANTHROPIC]: LangChainAnthropicProvider,
  [Provider.OLLAMA]: LangChainOllamaProvider,
  [Provider.GEMINI]: LangChainGeminiProvider,
};

export function createProvider(
  provider: Provider,
  apiKey: string,
  model: string,
  maxCommitLength: number = DEFAULTS.MAX_COMMIT_LENGTH,
  commitChoicesCount: number = DEFAULTS.COMMIT_CHOICES_COUNT,
  customRules?: string[],
  commitLanguage: string = DEFAULTS.COMMIT_LANGUAGE
): AIProvider {
  const ProviderClass = PROVIDER_MAP[provider];

  if (!ProviderClass) {
    throw new UnknownProviderError(provider);
  }

  return new ProviderClass(
    apiKey,
    model,
    maxCommitLength,
    commitChoicesCount,
    customRules,
    commitLanguage
  );
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
