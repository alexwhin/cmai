import { Provider } from "../types/index.js";

export enum ProviderAuthType {
  API_KEY = "API_KEY",
  URL = "URL",
}

interface ProviderConfig {
  authType: ProviderAuthType;
  defaultUrl?: string;
  placeholder?: string;
}

export const PROVIDER_CONFIGS: Record<Provider, ProviderConfig> = {
  [Provider.OPENAI]: {
    authType: ProviderAuthType.API_KEY,
  },
  [Provider.ANTHROPIC]: {
    authType: ProviderAuthType.API_KEY,
  },
  [Provider.OLLAMA]: {
    authType: ProviderAuthType.URL,
    defaultUrl: "http://localhost:11434",
  },
  [Provider.GEMINI]: {
    authType: ProviderAuthType.API_KEY,
  },
};

export function getProviderAuthType(provider: Provider): ProviderAuthType {
  return PROVIDER_CONFIGS[provider].authType;
}

export function isUrlBasedProvider(provider: Provider): boolean {
  return getProviderAuthType(provider) === ProviderAuthType.URL;
}

export function getProviderDefaultUrl(provider: Provider): string | undefined {
  return PROVIDER_CONFIGS[provider].defaultUrl;
}
