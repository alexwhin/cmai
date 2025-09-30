import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { LangChainBaseProvider } from "../../../src/providers/langchain/base.js";
import { GitContext } from "../../../src/types/index.js";
import {
  setupGitContext,
  TRUNCATION_LIMIT,
  MAX_COMMIT_LENGTH_DEFAULT,
  COMMIT_CHOICES_COUNT_DEFAULT,
} from "../../test-helpers.js";

// Mock the display module
vi.mock("../../../src/utils/ui-utils.js", () => ({
  message: vi.fn(),
}));

import { message } from "../../../src/utils/ui-utils.js";

// Create a concrete implementation for testing
class TestProvider extends LangChainBaseProvider {
  createModel(): BaseLanguageModel {
    return {
      invoke: vi.fn(),
      generatePrompt: vi.fn(),
      predict: vi.fn(),
      predictMessages: vi.fn(),
      call: vi.fn(),
    } as unknown as BaseLanguageModel;
  }
}

describe("providers/langchain/base", () => {
  let provider: TestProvider;
  let mockContext: GitContext;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new TestProvider(
      "test-key",
      "test-model",
      MAX_COMMIT_LENGTH_DEFAULT,
      COMMIT_CHOICES_COUNT_DEFAULT
    );
    mockContext = setupGitContext();
  });

  describe("constructor", () => {
    it("initializes with provided parameters", () => {
      const customProvider = new TestProvider("custom-key", "custom-model", 80, 7);

      expect(customProvider).toBeDefined();
      expect(customProvider.createModel()).toBeDefined();
    });

    it("uses default values for optional parameters", () => {
      const defaultProvider = new TestProvider("key", "model");

      expect(defaultProvider).toBeDefined();
    });
  });

  describe("generateCandidates", () => {
    it("generates candidates from JSON response", async () => {
      const mockResponse = {
        content: JSON.stringify({
          commits: [
            "feat: add new functionality",
            "feat: implement feature X and Y",
            "feat: enhance system with new features",
            "feat: introduce multiple improvements",
            "feat: update codebase with new capabilities",
          ],
        }),
      };
      vi.spyOn(provider["model"], "invoke").mockResolvedValue(mockResponse);

      const candidates = await provider.generateCandidates(mockContext);

      expect(candidates).toHaveLength(5);
      expect(candidates[0]).toBe("feat: add new functionality");
      expect(candidates[4]).toBe("feat: update codebase with new capabilities");
    });

    it("handles string response directly", async () => {
      const jsonResponse = JSON.stringify({
        commits: ["fix: resolve issue", "fix: patch bug"],
      });
      vi.spyOn(provider["model"], "invoke").mockResolvedValue(jsonResponse);

      const candidates = await provider.generateCandidates(mockContext);

      expect(candidates).toHaveLength(2);
      expect(candidates[0]).toBe("fix: resolve issue");
    });

    it("handles array content response", async () => {
      const mockResponse = {
        content: [{ text: JSON.stringify({ commits: ["test: add tests"] }) }],
      };
      vi.spyOn(provider["model"], "invoke").mockResolvedValue(mockResponse);

      const candidates = await provider.generateCandidates(mockContext);

      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toBe("test: add tests");
    });

    it("truncates difference to 3000 characters", async () => {
      const longDifference = "x".repeat(5000);
      const contextWithLongDifference = { ...mockContext, difference: longDifference };

      const invokeMethod = vi
        .spyOn(provider["model"], "invoke")
        .mockResolvedValue(JSON.stringify({ commits: ["feat: change"] }));

      await provider.generateCandidates(contextWithLongDifference);

      const calledPrompt = invokeMethod.mock.calls[0][0] as string;
      expect(calledPrompt).toContain("x".repeat(TRUNCATION_LIMIT));
      expect(calledPrompt).not.toContain("x".repeat(TRUNCATION_LIMIT + 1));
    });

    it("falls back to text parsing when JSON parsing fails", async () => {
      const textResponse = `Here are commit messages:
feat: add new feature
fix: resolve critical bug
feat: implement requested changes`;

      vi.spyOn(provider["model"], "invoke").mockResolvedValue(textResponse);
      const candidates = await provider.generateCandidates(mockContext);

      expect(candidates).toHaveLength(3);
      expect(candidates).toContain("feat: implement requested changes");
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });
    });

    it("removes trailing periods from commits", async () => {
      const mockResponse = JSON.stringify({
        commits: ["feat: add feature.", "fix: resolve bug", "docs: update readme."],
      });
      vi.spyOn(provider["model"], "invoke").mockResolvedValue(mockResponse);

      const candidates = await provider.generateCandidates(mockContext);

      expect(candidates[0]).toBe("feat: add feature");
      expect(candidates[1]).toBe("fix: resolve bug");
      expect(candidates[2]).toBe("docs: update readme");
    });

    it("removes quotes from parsed text lines", async () => {
      const textResponse = `"feat: add feature"
'fix: resolve bug'
docs: update documentation`;

      vi.spyOn(provider["model"], "invoke").mockResolvedValue(textResponse);

      const candidates = await provider.generateCandidates(mockContext);

      expect(candidates[0]).toBe("feat: add feature");
      expect(candidates[1]).toBe("fix: resolve bug");
      expect(candidates[2]).toBe("docs: update documentation");
    });

    it("limits candidates to commitChoicesCount", async () => {
      const customProvider = new TestProvider("key", "model", 72, 3);
      const mockResponse = JSON.stringify({
        commits: ["commit 1", "commit 2", "commit 3", "commit 4", "commit 5"],
      });
      vi.spyOn(customProvider["model"], "invoke").mockResolvedValue(mockResponse);

      const candidates = await customProvider.generateCandidates(mockContext);

      expect(candidates).toHaveLength(3);
    });

    it("throws error when a provider fails", async () => {
      vi.spyOn(provider["model"], "invoke").mockRejectedValue(new Error("API error"));

      await expect(provider.generateCandidates(mockContext)).rejects.toThrow(
        "An unexpected error occurred: API error"
      );
    });

    it("throws error when response has no valid commits", async () => {
      vi.spyOn(provider["model"], "invoke").mockResolvedValue("Invalid response");

      await expect(provider.generateCandidates(mockContext)).rejects.toThrow(
        "Failed to parse commit messages"
      );
    });
  });

  describe("buildPrompt", () => {
    it("builds prompt with all context values", () => {
      const prompt = provider.buildPrompt(mockContext);

      expect(prompt).toContain("Branch: main");
      expect(prompt).toContain("Files: src/index.ts, src/utils.ts");
      expect(prompt).toContain("diff content here");
      expect(prompt).toContain(
        "Recent commit messages for styling, tone and formatting reference:"
      );
      expect(prompt).toContain("- feat: add feature");
      expect(prompt).toContain("- fix: resolve bug");
      expect(prompt).toContain("Generate exactly 5 commit messages");
      expect(prompt).toContain("Maximum 72 characters");
    });

    it("includes regeneration note when attempts > 0", () => {
      const contextWithRegeneration = setupGitContext({ regenerationAttempts: 2 });
      const prompt = provider.buildPrompt(contextWithRegeneration);

      expect(prompt).toContain("The user has rejected 2 previous batches");
    });

    it("handles empty recent commits", () => {
      const contextWithoutCommits = setupGitContext({ recentCommits: [] });
      const prompt = provider.buildPrompt(contextWithoutCommits);

      expect(prompt).not.toContain(
        "Recent commit messages for styling, tone and formatting reference:"
      );
    });

    it("truncates difference in prompt", () => {
      const longDifference = "x".repeat(5000);
      const contextWithLongDifference = setupGitContext({ difference: longDifference });
      const prompt = provider.buildPrompt(contextWithLongDifference);

      expect(prompt).toContain("x".repeat(TRUNCATION_LIMIT));
      expect(prompt).not.toContain("x".repeat(TRUNCATION_LIMIT + 1));
    });
  });

  describe("parseTextResponse", () => {
    it("successfully parses well-formatted JSON", () => {
      const jsonText = JSON.stringify({
        commits: ["feat: add", "fix: repair", "docs: update"],
      });

      const result = provider["parseTextResponse"](jsonText);

      expect(result).toEqual(["feat: add", "fix: repair", "docs: update"]);
    });

    it("handles JSON wrapped in code blocks", () => {
      const wrappedJson = '```json\n{"commits": ["feat: test"]}\n```';

      const result = provider["parseTextResponse"](wrappedJson);

      expect(result).toEqual(["feat: test"]);
    });

    it("filters out empty strings from commits array", () => {
      const jsonWithEmpty = JSON.stringify({
        commits: ["feat: add", "", "  ", "fix: repair"],
      });

      const result = provider["parseTextResponse"](jsonWithEmpty);

      expect(result).toEqual(["feat: add", "fix: repair"]);
    });

    it("throws error for invalid JSON object", () => {
      const invalidJson = JSON.stringify([]);

      expect(() => provider["parseTextResponse"](invalidJson)).toThrow(
        "Failed to parse commit messages"
      );

      vi.restoreAllMocks();
    });

    it("returns JSON string when it looks like a commit message", () => {
      // This test documents current behavior: JSON that contains ':' is parsed as a commit
      const noCommits = JSON.stringify({ otherField: "value" });

      const result = provider["parseTextResponse"](noCommits);

      // The text parser sees the ':' in the JSON and thinks it's a commit message
      expect(result).toEqual(['{"otherField":"value"}']);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("filters out JSON-like lines from text parsing", () => {
      // This test documents that JSON structure is filtered out during text parsing
      const jsonLikeText = `{"commits":["feat: add feature","fix: bug fix"]}
feat: add new feature
fix: resolve critical bug`;

      const result = provider["parseTextResponse"](jsonLikeText);

      // The parser filters out the JSON line and only returns valid commit messages
      expect(result).toEqual(["feat: add new feature", "fix: resolve critical bug"]);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("filters out numbered list items from text parsing", () => {
      const numberedText = `1. first item
2. second item
feat: actual commit message
3. third item`;

      const result = provider["parseTextResponse"](numberedText);

      // Should filter out lines starting with numbers (lines 195-196)
      expect(result).toEqual(["feat: actual commit message"]);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("filters out explanatory text containing 'commit messages'", () => {
      const textWithExplanation = `Here are the commit messages:
feat: add new feature
These commit messages follow conventional format
fix: resolve issue`;

      const result = provider["parseTextResponse"](textWithExplanation);

      expect(result).toEqual(["feat: add new feature", "fix: resolve issue"]);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("filters out standalone JSON bracket characters", () => {
      const textWithBrackets = `[
feat: add new feature
]
{
fix: resolve issue
}`;

      const result = provider["parseTextResponse"](textWithBrackets);

      expect(result).toEqual(["feat: add new feature", "fix: resolve issue"]);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("removes trailing periods from commit messages", () => {
      const textWithPeriods = `"feat: add new feature."
"fix: resolve issue."
"docs: update readme."`;

      const result = provider["parseTextResponse"](textWithPeriods);

      // Should remove trailing periods (lines 218-219)
      expect(result).toEqual([
        "feat: add new feature",
        "fix: resolve issue",
        "docs: update readme",
      ]);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("handles commit messages with quoted strings and periods", () => {
      const quotedText = `'feat: add feature.'
"fix: resolve bug."
chore: update dependencies`;

      const result = provider["parseTextResponse"](quotedText);

      // Should remove quotes and trailing periods
      expect(result).toEqual([
        "feat: add feature",
        "fix: resolve bug",
        "chore: update dependencies",
      ]);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("filters complex text with mixed numbered items and commits", () => {
      const complexText = `Here are the commits:
1. This is a numbered item
2. Another numbered item
feat: add authentication
fix: resolve memory leak
3. More numbered content
docs: improve documentation
The commits are describing the changes`;

      const result = provider["parseTextResponse"](complexText);

      // Should filter out numbered items and descriptive text
      expect(result).toEqual([
        "feat: add authentication",
        "fix: resolve memory leak",
        "docs: improve documentation",
      ]);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });

    it("filters out commits exceeding maxCommitLength", () => {
      const provider = new TestProvider("test-key", "test-model", 50, 5);
      
      const jsonWithLongCommits = JSON.stringify({
        commits: [
          "feat: add new feature with a very long description that exceeds the maximum allowed",
          "fix: bug",
          "docs: update documentation with extensive details about the new features",
          "chore: cleanup"
        ]
      });

      const result = provider["parseTextResponse"](jsonWithLongCommits);

      expect(result).toEqual(["fix: bug", "chore: cleanup"]);
      expect(result.every(commit => commit.length <= 50)).toBe(true);
    });

    it("filters out commits exceeding maxCommitLength in text fallback", () => {
      const provider = new TestProvider("test-key", "test-model", 50, 5);
      
      const textWithLongCommits = `feat: add authentication system with multiple providers and security features
fix: memory leak
docs: comprehensive documentation update covering all new features and changes
chore: deps update`;

      const result = provider["parseTextResponse"](textWithLongCommits);

      expect(result).toEqual(["fix: memory leak", "chore: deps update"]);
      expect(result.every(commit => commit.length <= 50)).toBe(true);
      expect(message).toHaveBeenCalledWith(expect.stringContaining("JSON parsing failed"), {
        type: "warning",
        variant: "title",
      });

      vi.restoreAllMocks();
    });
  });

  describe("token tracking", () => {
    it("extracts token usage from OpenAI response metadata", async () => {
      const responseWithTokens = {
        content: '{"commits": ["feat: add new feature"]}',
        response_metadata: {
          tokenUsage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        },
      };

      vi.spyOn(provider["model"], "invoke").mockResolvedValue(responseWithTokens);

      const result = await provider.generateCandidates(mockContext);
      const tokenUsage = provider.getLastTokenUsage();

      expect(result).toEqual(["feat: add new feature"]);
      expect(tokenUsage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it("extracts token usage from Anthropic response metadata", async () => {
      const responseWithTokens = {
        content: '{"commits": ["feat: add new feature"]}',
        response_metadata: {
          usage: {
            input_tokens: 120,
            output_tokens: 80,
          },
        },
      };

      vi.spyOn(provider["model"], "invoke").mockResolvedValue(responseWithTokens);

      const result = await provider.generateCandidates(mockContext);
      const tokenUsage = provider.getLastTokenUsage();

      expect(result).toEqual(["feat: add new feature"]);
      expect(tokenUsage).toEqual({
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
      });
    });

    it("returns null token usage when no metadata available", async () => {
      const responseWithoutTokens = {
        content: '{"commits": ["feat: add new feature"]}',
      };

      vi.spyOn(provider["model"], "invoke").mockResolvedValue(responseWithoutTokens);

      await provider.generateCandidates(mockContext);
      const tokenUsage = provider.getLastTokenUsage();

      expect(tokenUsage).toBeNull();
    });

    it("returns null token usage initially", () => {
      const tokenUsage = provider.getLastTokenUsage();
      expect(tokenUsage).toBeNull();
    });
  });
});
