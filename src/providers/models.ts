import { Provider } from "../types/index.js";
import { isRecord, hasProperty, isArray, isString } from "../utils/guards.js";
import {
  UnknownProviderError,
  NoSuitableModelsError,
  InvalidAPIKeyError,
} from "../utils/errors.js";
import { getProviderDefaultUrl } from "./configuration.js";
import { getProviderDisplayName } from "../utils/formatting.js";
import {
  handleApiError,
  validateApiResponse,
  validateResponseStructure,
  sortById,
} from "../utils/api-helpers.js";

interface ModelInfo {
  id: string;
  name: string;
}

interface CachedModels {
  models: ModelInfo[];
  timestamp: number;
}

interface ModelFilterOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  allowList?: string[];
}

const MODEL_CACHE_TTL = 5 * 60 * 1000;
const modelCache = new Map<string, CachedModels>();
const pendingRequests = new Map<string, Promise<ModelInfo[]>>();

function getCacheKey(provider: Provider, apiKey: string): string {
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    const char = apiKey.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `${provider}-${Math.abs(hash).toString(16)}`;
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
        case Provider.GEMINI:
          models = await fetchGeminiModels(apiKey);
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
      return { isValid: false, error };
    }
    return { isValid: false, error: error as Error };
  }
}

function filterModels(models: ModelInfo[], options: ModelFilterOptions): ModelInfo[] {
  return models.filter((model) => {
    const modelId = model.id.toLowerCase();

    if (options.allowList && options.allowList.length > 0) {
      return options.allowList.includes(model.id);
    }

    if (options.includePatterns) {
      const hasInclude = options.includePatterns.some((pattern) =>
        modelId.includes(pattern.toLowerCase())
      );
      if (!hasInclude) {
        return false;
      }
    }

    if (options.excludePatterns) {
      const hasExclude = options.excludePatterns.some((pattern) =>
        modelId.includes(pattern.toLowerCase())
      );
      if (hasExclude) {
        return false;
      }
    }

    return true;
  });
}

function parseModelsFromResponse(
  data: unknown[],
  idField: string = "id",
  nameField?: string
): ModelInfo[] {
  const models: ModelInfo[] = [];

  for (const item of data) {
    if (isRecord(item) && hasProperty(item, idField) && isString(item[idField])) {
      const id = item[idField];
      let name = id;

      if (nameField && hasProperty(item, nameField) && isString(item[nameField])) {
        name = item[nameField];
      }

      models.push({ id, name });
    }
  }

  return models;
}

function parseGeminiModels(data: unknown[]): ModelInfo[] {
  const models: ModelInfo[] = [];

  for (const item of data) {
    if (
      isRecord(item) &&
      hasProperty(item, "name") &&
      isString(item.name) &&
      hasProperty(item, "supportedGenerationMethods") &&
      isArray(item.supportedGenerationMethods) &&
      item.supportedGenerationMethods.includes("generateContent")
    ) {
      const modelName = item.name.replace("models/", "");
      const displayName =
        hasProperty(item, "displayName") && isString(item.displayName)
          ? item.displayName
          : modelName;

      models.push({
        id: modelName,
        name: displayName,
      });
    }
  }

  return models;
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    validateApiResponse(response, Provider.OPENAI);

    const responseData: unknown = await response.json();
    validateResponseStructure(responseData, Provider.OPENAI);

    const data = responseData as { data: unknown[] };
    const allModels = parseModelsFromResponse(data.data);
    const gptModels = filterModels(allModels, {
      includePatterns: ["gpt"],
      excludePatterns: ["instruct", "0301", "0314", "vision"],
    });

    if (gptModels.length === 0) {
      throw new NoSuitableModelsError(getProviderDisplayName(Provider.OPENAI));
    }

    return sortById(gptModels);
  } catch (error) {
    return handleApiError(error);
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

    validateApiResponse(response, Provider.ANTHROPIC);

    const responseData: unknown = await response.json();
    validateResponseStructure(responseData, Provider.ANTHROPIC);

    const data = responseData as { data: unknown[] };
    const allModels = parseModelsFromResponse(data.data, "id", "display_name");
    const claudeModels = filterModels(allModels, {
      includePatterns: ["claude"],
      excludePatterns: ["instant"],
    });

    if (claudeModels.length === 0) {
      throw new NoSuitableModelsError(getProviderDisplayName(Provider.ANTHROPIC));
    }

    return sortById(claudeModels);
  } catch (error) {
    return handleApiError(error);
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

    validateApiResponse(response, Provider.OLLAMA, []);

    const responseData: unknown = await response.json();
    validateResponseStructure(responseData, Provider.OLLAMA, "models");

    const data = responseData as { models: unknown[] };
    const ollamaModels = parseModelsFromResponse(data.models, "name");

    if (ollamaModels.length === 0) {
      throw new NoSuitableModelsError(getProviderDisplayName(Provider.OLLAMA));
    }

    return sortById(ollamaModels);
  } catch (error) {
    return handleApiError(error);
  }
}

async function fetchGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    validateApiResponse(response, Provider.GEMINI, [401, 403]);

    const responseData: unknown = await response.json();
    validateResponseStructure(responseData, Provider.GEMINI, "models");

    const data = responseData as { models: unknown[] };
    const allModels = parseGeminiModels(data.models);

    const geminiModels = filterModels(allModels, {
      excludePatterns: ["-instant-"],
    });

    if (geminiModels.length === 0) {
      throw new NoSuitableModelsError(getProviderDisplayName(Provider.GEMINI));
    }

    return sortById(geminiModels);
  } catch (error) {
    return handleApiError(error);
  }
}
