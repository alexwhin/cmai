import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { LangChainOpenAIProvider } from "../../../src/providers/langchain/openai.js";

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn(),
}));

describe("providers/langchain/openai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createModel", () => {
    it("creates ChatOpenAI instance with correct configuration", () => {
      const mockChatOpenAI = { invoke: vi.fn() };
      vi.mocked(ChatOpenAI).mockImplementation(() => mockChatOpenAI as unknown as ChatOpenAI);

      const provider = new LangChainOpenAIProvider("test-api-key", "gpt-4", 80, 7);
      const model = provider.createModel();

      expect(ChatOpenAI).toHaveBeenCalledWith({
        model: "gpt-4",
        apiKey: "test-api-key",
        temperature: 0.7,
        maxTokens: 2000,
      });
      expect(model).toBe(mockChatOpenAI);
    });

    it("throws error when model name is not provided", () => {
      // Creating provider with empty model name should throw because createModel is called in constructor
      expect(() => new LangChainOpenAIProvider("test-api-key", "", 72, 5)).toThrow(
        "Model name is required"
      );
    });

    it("creates model with different model names", () => {
      const mockChatOpenAI = { invoke: vi.fn() };
      vi.mocked(ChatOpenAI).mockImplementation(() => mockChatOpenAI as unknown as ChatOpenAI);

      const provider = new LangChainOpenAIProvider("test-api-key", "gpt-3.5-turbo", 72, 5);
      provider.createModel();

      expect(ChatOpenAI).toHaveBeenCalledWith({
        model: "gpt-3.5-turbo",
        apiKey: "test-api-key",
        temperature: 0.7,
        maxTokens: 2000,
      });
    });
  });

  describe("inheritance", () => {
    it("inherits from LangChainBaseProvider", () => {
      const provider = new LangChainOpenAIProvider("test-api-key", "gpt-4");

      expect(provider.generateCandidates).toBeDefined();
      expect(provider.buildPrompt).toBeDefined();
    });

    it("uses constructor parameters correctly", () => {
      const mockChatOpenAI = { invoke: vi.fn() };
      vi.mocked(ChatOpenAI).mockImplementation(() => mockChatOpenAI as unknown as ChatOpenAI);

      // Test with custom parameters
      new LangChainOpenAIProvider("key1", "model1", 100, 10);
      // Constructor already calls createModel

      // Test with default parameters
      new LangChainOpenAIProvider("key2", "model2");
      // Constructor already calls createModel

      expect(vi.mocked(ChatOpenAI)).toHaveBeenCalledTimes(2);
      const mockCalls = vi.mocked(ChatOpenAI).mock.calls;
      expect(mockCalls[0]?.[0]?.apiKey).toBe("key1");
      expect(mockCalls[0]?.[0]?.model).toBe("model1");
      expect(mockCalls[1]?.[0]?.apiKey).toBe("key2");
      expect(mockCalls[1]?.[0]?.model).toBe("model2");
    });
  });
});
