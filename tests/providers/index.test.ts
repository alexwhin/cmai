import { describe, it, expect, vi } from "vitest";
import { createProvider, createProviderFromConfig } from "../../src/providers/index.js";
import { Provider, UsageMode } from "../../src/types/index.js";
import { LangChainOpenAIProvider } from "../../src/providers/langchain/openai.js";
import { LangChainAnthropicProvider } from "../../src/providers/langchain/anthropic.js";

vi.mock("../../src/providers/langchain/openai.js", () => ({
  LangChainOpenAIProvider: vi.fn(),
}));

vi.mock("../../src/providers/langchain/anthropic.js", () => ({
  LangChainAnthropicProvider: vi.fn(),
}));

describe("providers/index", () => {
  describe("createProvider", () => {
    it("creates OpenAI provider with correct parameters", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainOpenAIProvider).mockReturnValue(
        mockProvider as unknown as LangChainOpenAIProvider
      );

      const result = createProvider(Provider.OPENAI, "test-api-key", "gpt-4", 80, 7);

      expect(LangChainOpenAIProvider).toHaveBeenCalledWith(
        "test-api-key",
        "gpt-4",
        80,
        7,
        undefined,
        "en"
      );
      expect(result).toBe(mockProvider);
    });

    it("creates Anthropic provider with correct parameters", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainAnthropicProvider).mockReturnValue(
        mockProvider as unknown as LangChainAnthropicProvider
      );

      const result = createProvider(Provider.ANTHROPIC, "test-api-key", "claude-3", 72, 5);

      expect(LangChainAnthropicProvider).toHaveBeenCalledWith(
        "test-api-key",
        "claude-3",
        72,
        5,
        undefined,
        "en"
      );
      expect(result).toBe(mockProvider);
    });

    it("uses default values for optional parameters", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainOpenAIProvider).mockReturnValue(
        mockProvider as unknown as LangChainOpenAIProvider
      );

      createProvider(Provider.OPENAI, "test-api-key", "gpt-4");

      expect(LangChainOpenAIProvider).toHaveBeenCalledWith(
        "test-api-key",
        "gpt-4",
        72,
        5,
        undefined,
        "en"
      );
    });

    it("throws error for unknown provider", () => {
      expect(() => createProvider("UNKNOWN" as Provider, "test-api-key", "model")).toThrow(
        "Unsupported provider: UNKNOWN"
      );
    });

    it("passes custom rules to provider constructor", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainOpenAIProvider).mockReturnValue(
        mockProvider as unknown as LangChainOpenAIProvider
      );

      const customRules = ["Use imperative mood", "Keep it concise"];

      createProvider(Provider.OPENAI, "test-api-key", "gpt-4", 72, 5, customRules);

      expect(LangChainOpenAIProvider).toHaveBeenCalledWith(
        "test-api-key",
        "gpt-4",
        72,
        5,
        customRules,
        "en"
      );
    });
  });

  describe("createProviderFromConfig", () => {
    it("creates provider from OpenAI configuration", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainOpenAIProvider).mockReturnValue(
        mockProvider as unknown as LangChainOpenAIProvider
      );

      const config = {
        provider: Provider.OPENAI,
        apiKey: "openai-key",
        model: "gpt-4-turbo",
        maxCommitLength: 80,
        commitChoicesCount: 3,
        customRules: ["Be specific"],
        usageMode: UsageMode.CLIPBOARD,
        redactSensitiveData: true,
      };

      const result = createProviderFromConfig(config);

      expect(LangChainOpenAIProvider).toHaveBeenCalledWith(
        "openai-key",
        "gpt-4-turbo",
        80,
        3,
        ["Be specific"],
        "en"
      );
      expect(result).toBe(mockProvider);
    });

    it("creates provider from Anthropic configuration", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainAnthropicProvider).mockReturnValue(
        mockProvider as unknown as LangChainAnthropicProvider
      );

      const config = {
        provider: Provider.ANTHROPIC,
        apiKey: "anthropic-key",
        model: "claude-3-sonnet",
        maxCommitLength: 72,
        commitChoicesCount: 4,
        usageMode: UsageMode.COMMIT,
      };

      const result = createProviderFromConfig(config);

      expect(LangChainAnthropicProvider).toHaveBeenCalledWith(
        "anthropic-key",
        "claude-3-sonnet",
        72,
        4,
        undefined,
        "en"
      );
      expect(result).toBe(mockProvider);
    });

    it("uses default values when config properties are undefined", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainOpenAIProvider).mockReturnValue(
        mockProvider as unknown as LangChainOpenAIProvider
      );

      const config = {
        provider: Provider.OPENAI,
        apiKey: "test-key",
        model: "gpt-3.5-turbo",
        usageMode: UsageMode.CLIPBOARD,
      };

      const result = createProviderFromConfig(config);

      expect(LangChainOpenAIProvider).toHaveBeenCalledWith(
        "test-key",
        "gpt-3.5-turbo",
        72,
        5,
        undefined,
        "en"
      );
      expect(result).toBe(mockProvider);
    });

    it("handles configuration with all optional fields", () => {
      const mockProvider = { generateCandidates: vi.fn() };
      vi.mocked(LangChainAnthropicProvider).mockReturnValue(
        mockProvider as unknown as LangChainAnthropicProvider
      );

      const config = {
        provider: Provider.ANTHROPIC,
        apiKey: "anthropic-key",
        model: "claude-3-haiku",
        maxCommitLength: 50,
        commitChoicesCount: 7,
        customRules: ["Rule 1", "Rule 2", "Rule 3"],
        usageMode: UsageMode.COMMIT,
        redactSensitiveData: false,
      };

      const result = createProviderFromConfig(config);

      expect(LangChainAnthropicProvider).toHaveBeenCalledWith(
        "anthropic-key",
        "claude-3-haiku",
        50,
        7,
        ["Rule 1", "Rule 2", "Rule 3"],
        "en"
      );
      expect(result).toBe(mockProvider);
    });
  });
});
