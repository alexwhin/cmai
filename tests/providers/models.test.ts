import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAvailableModels, clearModelCache, validateAndFetchModels } from "../../src/providers/models.js";
import { Provider } from "../../src/types/index.js";
import { createMockFetchResponse, mockFetchSuccess, mockFetch401, mockFetch500, TEST_MODELS, expectAuthenticationError, expectNoSuitableModelsError } from "../test-helpers.js";

globalThis.fetch = vi.fn();

describe("providers/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearModelCache(); // Clear cache before each test
  });

  describe("getAvailableModels", () => {
    describe("OpenAI", () => {
      const openAIEndpoint = "https://api.openai.com/v1/models";
      const testApiKey = "test-key";

      it("fetches and formats OpenAI models successfully", async () => {
        mockFetchSuccess({
          data: [
            TEST_MODELS.openai.gpt4o,
            TEST_MODELS.openai.gpt4turbo,
            TEST_MODELS.openai.gpt35turbo,
            { id: "gpt-4-vision-preview", created: 1234567890 },
            { id: "gpt-3.5-turbo-instruct", created: 1234567890 },
          ],
        });

        const models = await getAvailableModels(Provider.OPENAI, testApiKey);

        expect(globalThis.fetch).toHaveBeenCalledWith(openAIEndpoint, {
          headers: {
            Authorization: `Bearer ${testApiKey}`,
          },
        });

        expect(models).toHaveLength(3);
        expect(models[0]).toEqual({ id: "gpt-3.5-turbo", name: "gpt-3.5-turbo" });
        expect(models[1]).toEqual({ id: "gpt-4-turbo", name: "gpt-4-turbo" });
        expect(models[2]).toEqual({ id: "gpt-4o", name: "gpt-4o" });
      });

      it("handles 401 unauthorized error for OpenAI", async () => {
        mockFetch401();

        await expectAuthenticationError(getAvailableModels(Provider.OPENAI, "invalid-key"));
      });

      it("handles other HTTP errors for OpenAI", async () => {
        mockFetch500();

        await expect(getAvailableModels(Provider.OPENAI, testApiKey)).rejects.toThrow(
          "API request failed: 500 Internal Server Error"
        );
      });

      it("handles invalid response format for OpenAI", async () => {
        mockFetchSuccess({ invalid: "response" });

        await expect(getAvailableModels(Provider.OPENAI, testApiKey)).rejects.toThrow(
          "Invalid response format"
        );
      });

      it("handles empty model list for OpenAI", async () => {
        mockFetchSuccess({ data: [] });

        await expectNoSuitableModelsError(getAvailableModels(Provider.OPENAI, testApiKey), "OpenAI");
      });

      it("filters out deprecated and special models", async () => {
        const mockResponse = createMockFetchResponse({
          data: [
            { id: "gpt-4", created: 1234567890 },
            { id: "gpt-4-0301", created: 1234567890 },
            { id: "gpt-4-0314", created: 1234567890 },
            { id: "gpt-4-vision", created: 1234567890 },
            { id: "gpt-3.5-turbo-instruct", created: 1234567890 },
          ],
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        const models = await getAvailableModels(Provider.OPENAI, testApiKey);

        expect(models).toHaveLength(1);
        expect(models[0].id).toBe("gpt-4");
      });
    });

    describe("Anthropic", () => {
      const anthropicEndpoint = "https://api.anthropic.com/v1/models";
      const testApiKey = "test-key";

      it("fetches and formats Anthropic models successfully", async () => {
        const mockResponse = createMockFetchResponse({
          data: [
            { id: "claude-3-5-sonnet-20241022", display_name: "Claude 3.5 Sonnet" },
            { id: "claude-3-opus-20240229", display_name: "Claude 3 Opus" },
            { id: "claude-3-haiku-20240307", display_name: "Claude 3 Haiku" },
            { id: "claude-instant-1.2", display_name: "Claude Instant" },
          ],
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        const models = await getAvailableModels(Provider.ANTHROPIC, testApiKey);

        expect(globalThis.fetch).toHaveBeenCalledWith(anthropicEndpoint, {
          headers: {
            "x-api-key": testApiKey,
            "anthropic-version": "2023-06-01",
          },
        });

        expect(models).toHaveLength(3);
        expect(models[0]).toEqual({ id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" });
        expect(models[1]).toEqual({ id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" });
        expect(models[2]).toEqual({ id: "claude-3-opus-20240229", name: "Claude 3 Opus" });
      });

      it("handles 401 unauthorized error for Anthropic", async () => {
        const mockResponse = createMockFetchResponse(
          {},
          {
            ok: false,
            status: 401,
            statusText: "Unauthorized",
          }
        );
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        await expect(getAvailableModels(Provider.ANTHROPIC, "invalid-key")).rejects.toThrow(
          "Authentication failed. Please check your API key."
        );
      });

      it("uses default display name when not provided", async () => {
        const mockResponse = createMockFetchResponse({
          data: [{ id: "claude-3-5-sonnet-20241022" }, { id: "claude-3-haiku-20240307" }],
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        const models = await getAvailableModels(Provider.ANTHROPIC, testApiKey);

        expect(models[0].name).toBe("claude-3-5-sonnet-20241022");
        expect(models[1].name).toBe("claude-3-haiku-20240307");
      });

      it("filters out instant models", async () => {
        const mockResponse = createMockFetchResponse({
          data: [
            { id: "claude-3-opus-20240229" },
            { id: "claude-instant-1.2" },
            { id: "claude-instant-1.1" },
          ],
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        const models = await getAvailableModels(Provider.ANTHROPIC, testApiKey);

        expect(models).toHaveLength(1);
        expect(models[0].id).toBe("claude-3-opus-20240229");
      });

      it("handles network errors", async () => {
        vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network error"));

        await expect(getAvailableModels(Provider.ANTHROPIC, testApiKey)).rejects.toThrow(
          "Network error"
        );
      });
    });

    describe("Ollama", () => {
      const ollamaEndpoint = "http://localhost:11434/api/tags";
      const customEndpoint = "http://custom:11434/api/tags";
      
      it("fetches Ollama models from default URL when apiKey is empty", async () => {
        const mockResponse = createMockFetchResponse({
          models: [
            { name: "llama2", size: "3.8GB", digest: "abc123" },
            { name: "codellama", size: "4.0GB", digest: "def456" },
            { name: "mistral", size: "4.1GB", digest: "ghi789" },
          ],
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        const models = await getAvailableModels(Provider.OLLAMA, "");

        expect(globalThis.fetch).toHaveBeenCalledWith(ollamaEndpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        expect(models).toHaveLength(3);
        expect(models[0]).toEqual({ id: "codellama", name: "codellama" });
        expect(models[1]).toEqual({ id: "llama2", name: "llama2" });
        expect(models[2]).toEqual({ id: "mistral", name: "mistral" });
      });

      it("fetches Ollama models from custom URL when apiKey contains URL", async () => {
        const mockResponse = createMockFetchResponse({
          models: [
            { name: "llama2", size: "3.8GB", digest: "abc123" },
          ],
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        const models = await getAvailableModels(Provider.OLLAMA, "http://custom:11434");

        expect(globalThis.fetch).toHaveBeenCalledWith(customEndpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        expect(models).toHaveLength(1);
        expect(models[0]).toEqual({ id: "llama2", name: "llama2" });
      });

      it("throws NoSuitableModelsError when no models are available", async () => {
        const mockResponse = createMockFetchResponse({
          models: [],
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        await expect(getAvailableModels(Provider.OLLAMA, "")).rejects.toThrow(
          "No suitable models found"
        );
      });

      it("handles invalid response format", async () => {
        const mockResponse = createMockFetchResponse({
          error: "Invalid response",
        });
        vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

        await expect(getAvailableModels(Provider.OLLAMA, "")).rejects.toThrow(
          "Invalid response format"
        );
      });

      it("handles network errors", async () => {
        vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Connection refused"));

        await expect(getAvailableModels(Provider.OLLAMA, "")).rejects.toThrow(
          "Connection refused"
        );
      });
    });
  });

  describe("caching", () => {
    it("caches model responses to avoid duplicate API calls", async () => {
      const mockResponse = createMockFetchResponse({
        data: [
          { id: "gpt-4o", created: 1234567890 },
          { id: "gpt-4-turbo", created: 1234567890 },
        ],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      // First call - should hit API
      const models1 = await getAvailableModels(Provider.OPENAI, "test-key");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const models2 = await getAvailableModels(Provider.OPENAI, "test-key");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Results should be the same
      expect(models1).toEqual(models2);
    });

    it("does not use cache for different API keys", async () => {
      const mockResponse = createMockFetchResponse({
        data: [{ id: "gpt-4o", created: 1234567890 }],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      await getAvailableModels(Provider.OPENAI, "key1");
      await getAvailableModels(Provider.OPENAI, "key2");

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("handles concurrent requests efficiently", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      
      vi.mocked(globalThis.fetch).mockReturnValue(promise as any);

      // Make two concurrent requests
      const request1 = getAvailableModels(Provider.OPENAI, "test-key");
      const request2 = getAvailableModels(Provider.OPENAI, "test-key");

      // Should only make one fetch call
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Resolve the fetch
      resolvePromise!(createMockFetchResponse({
        data: [{ id: "gpt-4o", created: 1234567890 }],
      }));

      const [result1, result2] = await Promise.all([request1, request2]);
      expect(result1).toEqual(result2);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("validateAndFetchModels", () => {
    it("returns isValid true and models on success", async () => {
      const mockResponse = createMockFetchResponse({
        data: [{ id: "gpt-4o", created: 1234567890 }],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      const result = await validateAndFetchModels(Provider.OPENAI, "valid-key");
      
      expect(result.isValid).toBe(true);
      expect(result.models).toEqual([{ id: "gpt-4o", name: "gpt-4o" }]);
      expect(result.error).toBeUndefined();
    });

    it("returns isValid false on 401 error", async () => {
      const mockResponse = createMockFetchResponse(
        {},
        {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        }
      );
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      const result = await validateAndFetchModels(Provider.OPENAI, "invalid-key");
      
      expect(result.isValid).toBe(false);
      expect(result.models).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Authentication failed");
    });

    it("returns isValid false on network error", async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network error"));

      const result = await validateAndFetchModels(Provider.OPENAI, "test-key");
      
      expect(result.isValid).toBe(false);
      expect(result.models).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain("Network error");
    });
  });

  describe("Gemini", () => {
    const testApiKey = "test-key";
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${testApiKey}`;

    it("fetches and formats Gemini models successfully", async () => {
      const mockResponse = createMockFetchResponse({
        models: [
          { 
            name: "models/gemini-1.5-pro", 
            displayName: "Gemini 1.5 Pro",
            supportedGenerationMethods: ["generateContent"]
          },
          { 
            name: "models/gemini-1.5-flash", 
            displayName: "Gemini 1.5 Flash",
            supportedGenerationMethods: ["generateContent"]
          },
          { 
            name: "models/gemini-pro", 
            displayName: "Gemini Pro",
            supportedGenerationMethods: ["generateContent"]
          },
          { 
            name: "models/gemini-1.5-flash-8b", 
            displayName: "Gemini 1.5 Flash 8B",
            supportedGenerationMethods: ["generateContent"]
          },
        ],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      const models = await getAvailableModels(Provider.GEMINI, testApiKey);

      expect(globalThis.fetch).toHaveBeenCalledWith(geminiEndpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(models).toHaveLength(4);
      expect(models[0]).toEqual({ id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" });
      expect(models[1]).toEqual({ id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash 8B" });
      expect(models[2]).toEqual({ id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" });
      expect(models[3]).toEqual({ id: "gemini-pro", name: "Gemini Pro" });
    });

    it("handles 401 unauthorized error for Gemini", async () => {
      const mockResponse = createMockFetchResponse(
        {},
        {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
        }
      );
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      await expect(getAvailableModels(Provider.GEMINI, "invalid-key")).rejects.toThrow(
        "Authentication failed"
      );
    });

    it("handles 403 forbidden error for Gemini", async () => {
      const mockResponse = createMockFetchResponse(
        {},
        {
          ok: false,
          status: 403,
          statusText: "Forbidden",
        }
      );
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      await expect(getAvailableModels(Provider.GEMINI, "invalid-key")).rejects.toThrow(
        "Authentication failed"
      );
    });

    it("throws NoSuitableModelsError when no Gemini models are available", async () => {
      const mockResponse = createMockFetchResponse({
        models: [],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      await expect(getAvailableModels(Provider.GEMINI, testApiKey)).rejects.toThrow(
        "No suitable models"
      );
    });

    it("includes all models sorted by ID", async () => {
      const mockResponse = createMockFetchResponse({
        models: [
          { 
            name: "models/gemini-pro", 
            displayName: "Gemini Pro",
            supportedGenerationMethods: ["generateContent"]
          },
          { 
            name: "models/gemini-1.5-flash", 
            displayName: "Gemini 1.5 Flash",
            supportedGenerationMethods: ["generateContent"]
          },
          { 
            name: "models/gemini-1.5-pro", 
            displayName: "Gemini 1.5 Pro",
            supportedGenerationMethods: ["generateContent"]
          },
          { 
            name: "models/gemini-other", 
            displayName: "Other Model",
            supportedGenerationMethods: ["generateContent"]
          },
        ],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      const models = await getAvailableModels(Provider.GEMINI, testApiKey);

      // Should include all models sorted alphabetically by ID
      expect(models).toHaveLength(4);
      expect(models[0].id).toBe("gemini-1.5-flash");
      expect(models[1].id).toBe("gemini-1.5-pro");
      expect(models[2].id).toBe("gemini-other");
      expect(models[3].id).toBe("gemini-pro");
    });
  });

  describe("Anthropic no suitable models", () => {
    it("throws NoSuitableModelsError when no Anthropic models are available", async () => {
      const mockResponse = createMockFetchResponse({
        data: [],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      await expect(getAvailableModels(Provider.ANTHROPIC, "test-key")).rejects.toThrow(
        "No suitable models"
      );
    });
  });

  describe("Ollama no suitable models", () => {
    it("throws NoSuitableModelsError when no Ollama models are available", async () => {
      const mockResponse = createMockFetchResponse({
        models: [],
      });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as any);

      await expect(getAvailableModels(Provider.OLLAMA, "http://localhost:11434")).rejects.toThrow(
        "No suitable models"
      );
    });
  });
});
