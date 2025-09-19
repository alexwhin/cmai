import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { LangChainAnthropicProvider } from "../../../src/providers/langchain/anthropic.js";

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: vi.fn(),
}));

describe("providers/langchain/anthropic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createModel", () => {
    it("creates ChatAnthropic instance with correct configuration", () => {
      const mockChatAnthropic = { invoke: vi.fn() };
      vi.mocked(ChatAnthropic).mockReturnValue(mockChatAnthropic as unknown as ChatAnthropic);

      const provider = new LangChainAnthropicProvider("test-api-key", "claude-3-opus", 80, 7);
      const model = provider.createModel();

      expect(ChatAnthropic).toHaveBeenCalledWith({
        modelName: "claude-3-opus",
        anthropicApiKey: "test-api-key",
        temperature: 0.7,
        maxTokens: 2000,
      });
      expect(model).toBe(mockChatAnthropic);
    });

    it("throws error when model name is not provided", () => {
      // Creating provider with empty model name should throw because createModel is called in constructor
      expect(() => new LangChainAnthropicProvider("test-api-key", "", 72, 5)).toThrow(
        "Model name is required"
      );
    });

    it("creates model with different model names", () => {
      const mockChatAnthropic = { invoke: vi.fn() };
      vi.mocked(ChatAnthropic).mockReturnValue(mockChatAnthropic as unknown as ChatAnthropic);

      const provider = new LangChainAnthropicProvider("test-api-key", "claude-3-haiku", 72, 5);
      provider.createModel();

      expect(ChatAnthropic).toHaveBeenCalledWith({
        modelName: "claude-3-haiku",
        anthropicApiKey: "test-api-key",
        temperature: 0.7,
        maxTokens: 2000,
      });
    });
  });

  describe("inheritance", () => {
    it("inherits from LangChainBaseProvider", () => {
      const provider = new LangChainAnthropicProvider("test-api-key", "claude-3");

      expect(provider.generateCandidates).toBeDefined();
      expect(provider.buildPrompt).toBeDefined();
    });

    it("uses constructor parameters correctly", () => {
      const mockChatAnthropic = { invoke: vi.fn() };
      vi.mocked(ChatAnthropic).mockReturnValue(mockChatAnthropic as unknown as ChatAnthropic);

      // Test with custom parameters
      new LangChainAnthropicProvider("key1", "model1", 100, 10);
      // Constructor already calls createModel

      // Test with default parameters
      new LangChainAnthropicProvider("key2", "model2");
      // Constructor already calls createModel

      expect(vi.mocked(ChatAnthropic)).toHaveBeenCalledTimes(2);
      const mockCalls = vi.mocked(ChatAnthropic).mock.calls;
      expect(mockCalls[0]?.[0]?.anthropicApiKey).toBe("key1");
      expect(mockCalls[0]?.[0]?.modelName).toBe("model1");
      expect(mockCalls[1]?.[0]?.anthropicApiKey).toBe("key2");
      expect(mockCalls[1]?.[0]?.modelName).toBe("model2");
    });
  });
});
