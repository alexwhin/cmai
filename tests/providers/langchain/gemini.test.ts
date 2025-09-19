import { describe, it, expect, vi, beforeEach } from "vitest";
import { LangChainGeminiProvider } from "../../../src/providers/langchain/gemini.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ModelNotFoundError } from "../../../src/utils/errors.js";

vi.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: vi.fn(),
}));

describe("LangChainGeminiProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createModel", () => {
    it("creates a Gemini model with correct configuration", () => {
      const mockChatGemini = { invoke: vi.fn() };
      vi.mocked(ChatGoogleGenerativeAI).mockImplementation(() => mockChatGemini as unknown as ChatGoogleGenerativeAI);

      new LangChainGeminiProvider(
        "test-api-key",
        "gemini-1.5-pro",
        72,
        5,
        [],
        "en"
      );

      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith({
        model: "gemini-1.5-pro",
        apiKey: "test-api-key",
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 10,
      });
    });

    it("throws ModelNotFoundError for unsupported model", () => {
      expect(() => new LangChainGeminiProvider(
        "test-api-key",
        "unsupported-model",
        72,
        5,
        [],
        "en"
      )).toThrow(ModelNotFoundError);
    });

    it("supports all expected Gemini models", () => {
      const mockChatGemini = { invoke: vi.fn() };
      vi.mocked(ChatGoogleGenerativeAI).mockImplementation(() => mockChatGemini as unknown as ChatGoogleGenerativeAI);

      const supportedModels = [
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-2.0-flash-exp",
        "gemini-pro",
        "gemini-pro-vision",
      ];

      supportedModels.forEach(model => {
        expect(() => new LangChainGeminiProvider(
          "test-api-key",
          model,
          72,
          5,
          [],
          "en"
        )).not.toThrow();
      });
    });
  });

  describe("inheritance", () => {
    it("inherits from LangChainBaseProvider", () => {
      const mockChatGemini = { invoke: vi.fn() };
      vi.mocked(ChatGoogleGenerativeAI).mockImplementation(() => mockChatGemini as unknown as ChatGoogleGenerativeAI);

      const provider = new LangChainGeminiProvider(
        "test-api-key",
        "gemini-1.5-pro",
        72,
        5,
        [],
        "en"
      );

      expect(provider.generateCandidates).toBeDefined();
      expect(provider.buildPrompt).toBeDefined();
      expect(provider.getLastTokenUsage).toBeDefined();
    });

    it("passes custom configuration to provider", () => {
      const mockChatGemini = { invoke: vi.fn() };
      vi.mocked(ChatGoogleGenerativeAI).mockImplementation(() => mockChatGemini as unknown as ChatGoogleGenerativeAI);

      const customRules = ["Use conventional commits", "Be concise"];
      new LangChainGeminiProvider(
        "custom-api-key",
        "gemini-1.5-flash",
        100,
        3,
        customRules,
        "es"
      );

      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith({
        model: "gemini-1.5-flash",
        apiKey: "custom-api-key",
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.8,
        topK: 10,
      });
    });
  });
});