import { describe, it, expect } from "vitest";
import { Provider, UsageMode } from "../../src/types/index.js";
import type {
  Config,
  GitContext,
  TokenUsage,
  AIProvider,
  CommitCandidate,
} from "../../src/types/index.js";

describe("types/index", () => {
  describe("Provider enum", () => {
    it("should have OPENAI, ANTHROPIC, OLLAMA, and GEMINI values", () => {
      expect(Provider.OPENAI).toBe("OPENAI");
      expect(Provider.ANTHROPIC).toBe("ANTHROPIC");
      expect(Provider.OLLAMA).toBe("OLLAMA");
      expect(Provider.GEMINI).toBe("GEMINI");
    });

    it("should contain all expected providers", () => {
      const providers = Object.values(Provider);
      expect(providers).toHaveLength(4);
      expect(providers).toContain("OPENAI");
      expect(providers).toContain("ANTHROPIC");
      expect(providers).toContain("OLLAMA");
      expect(providers).toContain("GEMINI");
    });
  });

  describe("UsageMode enum", () => {
    it("should have all expected usage modes", () => {
      expect(UsageMode.CLIPBOARD).toBe("CLIPBOARD");
      expect(UsageMode.COMMIT).toBe("COMMIT");
      expect(UsageMode.TERMINAL).toBe("TERMINAL");
    });

    it("should contain all expected usage modes", () => {
      const modes = Object.values(UsageMode);
      expect(modes).toHaveLength(3);
      expect(modes).toContain("TERMINAL");
      expect(modes).toContain("COMMIT");
      expect(modes).toContain("CLIPBOARD");
    });
  });

  describe("Type definitions", () => {
    it("should export Config type", () => {
      const config: Config = {
        provider: Provider.OPENAI,
        apiKey: "test-key",
        model: "gpt-4",
        maxCommitLength: 72,
        usageMode: UsageMode.CLIPBOARD,
        commitChoicesCount: 5,
        redactSensitiveData: true,
        customRules: ["test rule"],
      };

      expect(config.provider).toBe(Provider.OPENAI);
      expect(config.apiKey).toBe("test-key");
      expect(config.model).toBe("gpt-4");
    });

    it("should export GitContext type", () => {
      const context: GitContext = {
        stagedFiles: ["file1.ts", "file2.ts"],
        branch: "main",
        difference: "diff content",
        recentCommits: ["feat: add feature"],
        regenerationAttempts: 0,
      };

      expect(context.stagedFiles).toHaveLength(2);
      expect(context.branch).toBe("main");
      expect(context.difference).toBe("diff content");
    });

    it("should export TokenUsage type", () => {
      const usage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };

      expect(usage.promptTokens).toBe(100);
      expect(usage.completionTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
    });

    it("should export CommitCandidate type", () => {
      const candidate: CommitCandidate = "feat: add new feature";
      expect(candidate).toBe("feat: add new feature");
    });

    it("should enforce AIProvider interface structure", () => {
      const mockProvider: AIProvider = {
        generateCandidates: async () => ["test commit"],
        buildPrompt: () => "test prompt",
        getLastTokenUsage: () => ({ totalTokens: 100 }),
      };

      expect(mockProvider.generateCandidates).toBeDefined();
      expect(mockProvider.buildPrompt).toBeDefined();
      expect(mockProvider.getLastTokenUsage).toBeDefined();
    });
  });
});
