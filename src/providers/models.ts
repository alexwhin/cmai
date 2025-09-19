import { Provider } from "../types/index.js";
import { isRecord, hasProperty, isArray, isString } from "../utils/guards.js";
import {
  UnknownProviderError,
  InvalidAPIKeyError,
  NetworkError,
  InvalidResponseFormatError,
  NoSuitableModelsError,
} from "../utils/errors.js";
import { t } from "../utils/i18n.js";
import { getProviderDefaultUrl } from "./configuration.js";

interface ModelInfo {
  id: string;
  name: string;
}

interface CachedModels {
  models: ModelInfo[];
  timestamp: number;
}

const MODEL_CACHE_TTL = 5 * 60 * 1000;
const modelCache = new Map<string, CachedModels>();
const pendingRequests = new Map<string, Promise<ModelInfo[]>>();

function getCacheKey(provider: Provider, apiKey: string): string {
  const keyPrefix = apiKey.substring(0, 8);
  return `${provider}-${keyPrefix}`;
}

export async function getAvailableModels(provider: Provider, apiKey: string): Promise<ModelInfo[]> {
  const cacheKey = getCacheKey(provider, apiKey);

  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MODEL_CACHE_TTL) {
    return cached.models;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      let models: ModelInfo[];
      switch (provider) {
        case Provider.OPENAI:
          models = await fetchOpenAIModels(apiKey);
          break;
        case Provider.ANTHROPIC:
          models = await fetchAnthropicModels(apiKey);
          break;
        case Provider.OLLAMA:
          models = await fetchOllamaModels(apiKey);
          break;
        default:
          throw new UnknownProviderError(provider);
      }

      modelCache.set(cacheKey, {
        models,
        timestamp: Date.now(),
      });

      return models;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, request);
  return request;
}

export function clearModelCache(provider?: Provider, apiKey?: string): void {
  if (provider && apiKey) {
    const cacheKey = getCacheKey(provider, apiKey);
    modelCache.delete(cacheKey);
  } else {
    modelCache.clear();
  }
}

export async function validateAndFetchModels(
  provider: Provider,
  apiKey: string
): Promise<{ isValid: boolean; models?: ModelInfo[]; error?: Error }> {
  try {
    const models = await getAvailableModels(provider, apiKey);
    return { isValid: true, models };
  } catch (error) {
    if (error instanceof InvalidAPIKeyError) {
      return { isValid: false, error: error as Error };
    }
    return { isValid: false, error: error as Error };
  }
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new InvalidAPIKeyError("OpenAI");
      }
      throw new NetworkError(
        t("errors.api.requestFailed", { message: `${response.status} ${response.statusText}` })
      );
    }

    const responseData: unknown = await response.json();
    if (
      !isRecord(responseData) ||
      !hasProperty(responseData, "data") ||
      !isArray(responseData.data)
    ) {
      throw new InvalidResponseFormatError("OpenAI");
    }

    const gptModels: ModelInfo[] = [];

    for (const item of responseData.data) {
      if (isRecord(item) && hasProperty(item, "id") && isString(item.id)) {
        const modelId = item.id;
        if (
          modelId.includes("gpt") &&
          !modelId.includes("instruct") &&
          !modelId.includes("0301") &&
          !modelId.includes("0314") &&
          !modelId.includes("vision")
        ) {
          gptModels.push({
            id: modelId,
            name: modelId,
          });
        }
      }
    }

    gptModels.sort((a, b) => a.id.localeCompare(b.id));

    if (gptModels.length === 0) {
      throw new NoSuitableModelsError("OpenAI");
    }

    return gptModels;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new NetworkError(t("errors.api.generationFailed"));
  }
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new InvalidAPIKeyError("Anthropic");
      }
      throw new NetworkError(
        t("errors.api.requestFailed", { message: `${response.status} ${response.statusText}` })
      );
    }

    const responseData: unknown = await response.json();
    if (
      !isRecord(responseData) ||
      !hasProperty(responseData, "data") ||
      !isArray(responseData.data)
    ) {
      throw new InvalidResponseFormatError("Anthropic");
    }

    const claudeModels: ModelInfo[] = [];

    for (const item of responseData.data) {
      if (isRecord(item) && hasProperty(item, "id") && isString(item.id)) {
        const modelId = item.id;
        if (modelId.includes("claude") && !modelId.includes("instant")) {
          claudeModels.push({
            id: modelId,
            name: hasProperty(item, "display_name") && isString(item.display_name) ? item.display_name : modelId,
          });
        }
      }
    }

    claudeModels.sort((a, b) => a.id.localeCompare(b.id));

    if (claudeModels.length === 0) {
      throw new NoSuitableModelsError("Anthropic");
    }

    return claudeModels;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new NetworkError(t("errors.api.generationFailed"));
  }
}

async function fetchOllamaModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const baseUrl = apiKey || getProviderDefaultUrl(Provider.OLLAMA) || "http://localhost:11434";
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new NetworkError(
        t("errors.api.requestFailed", { message: `${response.status} ${response.statusText}` })
      );
    }

    const responseData: unknown = await response.json();
    if (
      !isRecord(responseData) ||
      !hasProperty(responseData, "models") ||
      !isArray(responseData.models)
    ) {
      throw new InvalidResponseFormatError("Ollama");
    }

    const ollamaModels: ModelInfo[] = [];

    for (const item of responseData.models) {
      if (isRecord(item) && hasProperty(item, "name") && isString(item.name)) {
        const modelName = item.name;

        ollamaModels.push({
          id: modelName,
          name: modelName,
        });
      }
    }

    ollamaModels.sort((a, b) => a.id.localeCompare(b.id));

    if (ollamaModels.length === 0) {
      throw new NoSuitableModelsError("Ollama");
    }

    return ollamaModels;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new NetworkError(t("errors.api.generationFailed"));
  }
}
