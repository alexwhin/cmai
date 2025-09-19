import { describe, it, expect } from "vitest";
import {
  getProviderAuthType,
  isUrlBasedProvider,
  getProviderDefaultUrl,
  ProviderAuthType,
  PROVIDER_CONFIGS,
} from "../../src/providers/configuration.js";
import { Provider } from "../../src/types/index.js";

describe("configuration", () => {
  describe("PROVIDER_CONFIGS", () => {
    it("should have configuration for all providers", () => {
      const providers = Object.values(Provider);
      providers.forEach((provider) => {
        expect(PROVIDER_CONFIGS).toHaveProperty(provider);
        expect(PROVIDER_CONFIGS[provider]).toHaveProperty("authType");
      });
    });
  });

  describe("getProviderAuthType", () => {
    it("should return API_KEY for OpenAI", () => {
      expect(getProviderAuthType(Provider.OPENAI)).toBe(ProviderAuthType.API_KEY);
    });

    it("should return API_KEY for Anthropic", () => {
      expect(getProviderAuthType(Provider.ANTHROPIC)).toBe(ProviderAuthType.API_KEY);
    });

    it("should return URL for Ollama", () => {
      expect(getProviderAuthType(Provider.OLLAMA)).toBe(ProviderAuthType.URL);
    });
  });

  describe("isUrlBasedProvider", () => {
    it("should return false for API key based providers", () => {
      expect(isUrlBasedProvider(Provider.OPENAI)).toBe(false);
      expect(isUrlBasedProvider(Provider.ANTHROPIC)).toBe(false);
    });

    it("should return true for URL based providers", () => {
      expect(isUrlBasedProvider(Provider.OLLAMA)).toBe(true);
    });
  });

  describe("getProviderDefaultUrl", () => {
    it("should return undefined for API key based providers", () => {
      expect(getProviderDefaultUrl(Provider.OPENAI)).toBeUndefined();
      expect(getProviderDefaultUrl(Provider.ANTHROPIC)).toBeUndefined();
    });

    it("should return default URL for Ollama", () => {
      expect(getProviderDefaultUrl(Provider.OLLAMA)).toBe("http://localhost:11434");
    });
  });
});
