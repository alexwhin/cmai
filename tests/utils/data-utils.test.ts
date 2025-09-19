import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatFilePathsAsItems,
  parseProvider,
  generateReport,
  ReportData,
} from "../../src/utils/data-utils.js";
import { Provider, UsageMode, GitContext } from "../../src/types/index.js";
import * as GitUtils from "../../src/utils/git-utils.js";

vi.mock("../../src/utils/git-utils.js", () => ({
  getFormattedGitAuthor: vi.fn(),
  getRemoteUrl: vi.fn(),
}));

vi.mock("../../src/utils/style.js", () => ({
  color: vi.fn((colorName, text) => `${colorName.toUpperCase()}[${text}]`),
}));

describe("data-utils", () => {
  describe("formatFilePathsAsItems", () => {
    it("returns array of label-value pairs", () => {
      const paths = ["src/utils/file.ts", "test/spec.js"];
      const result = formatFilePathsAsItems(paths);

      expect(result).toEqual([
        { label: "src/utils/", value: "file.ts" },
        { label: "test/", value: "spec.js" },
      ]);
    });

    it("handles files without directories", () => {
      const paths = ["file.ts", "spec.js"];
      const result = formatFilePathsAsItems(paths);

      expect(result).toEqual([
        { label: "./", value: "file.ts" },
        { label: "./", value: "spec.js" },
      ]);
    });

    it("handles mixed paths", () => {
      const paths = ["package.json", "src/cli.ts", ".vscode/settings.json"];
      const result = formatFilePathsAsItems(paths);

      expect(result).toEqual([
        { label: "./", value: "package.json" },
        { label: ".vscode/", value: "settings.json" },
        { label: "src/", value: "cli.ts" },
      ]);
    });

    it("sorts files alphabetically", () => {
      const paths = [
        "src/commands/generate.ts",
        ".release-it.json",
        "README.md",
        "package.json",
        ".vscode/settings.json",
        "src/utils/display.ts",
        "tests/utils/display.test.ts",
      ];
      const result = formatFilePathsAsItems(paths);

      expect(result).toEqual([
        { label: "./", value: ".release-it.json" },
        { label: "./", value: "package.json" },
        { label: "./", value: "README.md" },
        { label: ".vscode/", value: "settings.json" },
        { label: "src/commands/", value: "generate.ts" },
        { label: "src/utils/", value: "display.ts" },
        { label: "tests/utils/", value: "display.test.ts" },
      ]);
    });

    it("handles empty array", () => {
      const result = formatFilePathsAsItems([]);
      expect(result).toEqual([]);
    });

    it("handles single file", () => {
      const result = formatFilePathsAsItems(["package.json"]);
      expect(result).toEqual([{ label: "./", value: "package.json" }]);
    });

    it("sorts directories correctly", () => {
      const paths = ["z/file.ts", "a/file.ts", "b/file.ts"];
      const result = formatFilePathsAsItems(paths);

      expect(result).toEqual([
        { label: "a/", value: "file.ts" },
        { label: "b/", value: "file.ts" },
        { label: "z/", value: "file.ts" },
      ]);
    });

    it("sorts files within directories correctly", () => {
      const paths = ["src/z.ts", "src/a.ts", "src/b.ts"];
      const result = formatFilePathsAsItems(paths);

      expect(result).toEqual([
        { label: "src/", value: "a.ts" },
        { label: "src/", value: "b.ts" },
        { label: "src/", value: "z.ts" },
      ]);
    });
  });

  describe("parseProvider", () => {
    it("returns the provider when valid", () => {
      expect(parseProvider("OPENAI")).toBe(Provider.OPENAI);
      expect(parseProvider("ANTHROPIC")).toBe(Provider.ANTHROPIC);
    });

    it("returns undefined when invalid", () => {
      expect(parseProvider("invalid")).toBeUndefined();
      expect(parseProvider("openai")).toBeUndefined();
      expect(parseProvider("")).toBeUndefined();
    });

    it("returns undefined when input is undefined", () => {
      expect(parseProvider(undefined)).toBeUndefined();
    });
  });

  describe("generateReport", () => {
    const mockContext: GitContext = {
      stagedFiles: ["file1.ts", "file2.ts"],
      branch: "main",
      difference: "mock diff",
      recentCommits: ["commit1", "commit2"],
    };

    const mockReportData: ReportData = {
      commitHash: "abc123",
      stats: {
        filesChanged: 2,
        insertions: 10,
        deletions: 5,
      },
      provider: {
        tokensUsed: 1250,
        model: "gpt-4o",
        name: "OpenAI",
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.setSystemTime(new Date("2024-01-15 14:30:00"));

      vi.mocked(GitUtils.getFormattedGitAuthor).mockResolvedValue("Test User (testuser)");
      vi.mocked(GitUtils.getRemoteUrl).mockResolvedValue("https://github.com/test/repo.git");
    });

    it("includes basic stats for all modes", async () => {
      const message = "feat: add new feature";
      const result = await generateReport(message, mockContext, UsageMode.CLIPBOARD);

      expect(result).toContainEqual({ label: "Message", value: "CYAN[feat: add new feature]" });
      expect(result).toContainEqual({ label: "Branch", value: "MAGENTA[main]" });
      expect(result).toContainEqual({ label: "Author", value: "Test User (testuser)" });
      expect(result).toContainEqual({
        label: "Repository",
        value: "https://github.com/test/repo.git",
      });
    });

    it("includes provider stats when available", async () => {
      const message = "feat: add new feature";
      const result = await generateReport(
        message,
        mockContext,
        UsageMode.CLIPBOARD,
        mockReportData
      );

      expect(result).toContainEqual({
        label: "Provider",
        value: "RED[1,250 tokens], MAGENTA[gpt-4o], GREEN[OpenAI]",
      });
    });

    it("excludes provider stats when not available", async () => {
      const message = "feat: add new feature";
      const dataWithoutProvider = { ...mockReportData, provider: undefined };
      const result = await generateReport(
        message,
        mockContext,
        UsageMode.CLIPBOARD,
        dataWithoutProvider
      );

      const providerItem = result.find((item) => item.label === "Provider");
      expect(providerItem).toBeUndefined();
    });

    it("converts provider names to friendly format", async () => {
      const message = "feat: test anthropic";
      const anthropicData = {
        ...mockReportData,
        provider: {
          model: "claude-3-5-sonnet-20241022",
          name: "ANTHROPIC",
        },
      };
      const result = await generateReport(message, mockContext, UsageMode.CLIPBOARD, anthropicData);

      expect(result).toContainEqual({
        label: "Provider",
        value: "MAGENTA[claude-3-5-sonnet-20241022], GREEN[Anthropic]",
      });
    });

    it("includes token usage when available", async () => {
      const message = "feat: test with tokens";
      const dataWithTokens = {
        ...mockReportData,
        provider: {
          model: "gpt-4o",
          name: "OPENAI",
          tokensUsed: 850,
        },
      };
      const result = await generateReport(
        message,
        mockContext,
        UsageMode.CLIPBOARD,
        dataWithTokens
      );

      expect(result).toContainEqual({
        label: "Provider",
        value: "RED[850 tokens], MAGENTA[gpt-4o], GREEN[OpenAI]",
      });
    });

    it("excludes token usage when not available", async () => {
      const message = "feat: test without tokens";
      const dataWithoutTokens = {
        ...mockReportData,
        provider: {
          model: "gpt-4o",
          name: "OPENAI",
        },
      };
      const result = await generateReport(
        message,
        mockContext,
        UsageMode.CLIPBOARD,
        dataWithoutTokens
      );

      expect(result).toContainEqual({
        label: "Provider",
        value: "MAGENTA[gpt-4o], GREEN[OpenAI]",
      });
    });

    it("formats large token numbers with commas", async () => {
      const message = "feat: test large token count";
      const dataWithLargeTokens = {
        ...mockReportData,
        provider: {
          model: "gpt-4o",
          name: "OPENAI",
          tokensUsed: 125678,
        },
      };
      const result = await generateReport(
        message,
        mockContext,
        UsageMode.CLIPBOARD,
        dataWithLargeTokens
      );

      expect(result).toContainEqual({
        label: "Provider",
        value: "RED[125,678 tokens], MAGENTA[gpt-4o], GREEN[OpenAI]",
      });
    });

    it("handles unknown branch", async () => {
      const contextWithoutBranch = { ...mockContext, branch: "" };
      const result = await generateReport("feat: test", contextWithoutBranch, UsageMode.CLIPBOARD);

      expect(result).toContainEqual({ label: "Branch", value: "MAGENTA[unknown]" });
    });

    it("handles missing repository URL", async () => {
      vi.mocked(GitUtils.getRemoteUrl).mockResolvedValue(null);

      const result = await generateReport("feat: test", mockContext, UsageMode.CLIPBOARD);

      const repoItem = result.find((item) => item.label === "Repository");
      expect(repoItem).toBeUndefined();
    });

    it("sorts items by label length in descending order", async () => {
      const result = await generateReport("feat: test", mockContext, UsageMode.CLIPBOARD);

      const labels = result.map((item) => item.label);
      const sortedLabels = [...labels].sort((a, b) => b.length - a.length);

      expect(labels).toEqual(sortedLabels);
    });

    it("includes commit hash for COMMIT mode", async () => {
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.COMMIT,
        mockReportData
      );

      expect(result).toContainEqual({ label: "Commit", value: "GREEN[abc123] on MAGENTA[main]" });
    });

    it("excludes commit hash for non-COMMIT modes", async () => {
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.CLIPBOARD,
        mockReportData
      );

      const commitItem = result.find((item) => item.label === "Commit");
      expect(commitItem).toBeUndefined();
    });

    it("includes changes stats for COMMIT mode with file changes", async () => {
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.COMMIT,
        mockReportData
      );

      expect(result).toContainEqual({
        label: "Changes",
        value: "2 files, GREEN[+10], RED[-5]",
      });
    });

    it("handles single file change", async () => {
      const singleFileCommitData = {
        ...mockReportData,
        stats: { filesChanged: 1, insertions: 5, deletions: 0 },
      };
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.COMMIT,
        singleFileCommitData
      );

      expect(result).toContainEqual({
        label: "Changes",
        value: "1 file, GREEN[+5]",
      });
    });

    it("handles changes with only insertions", async () => {
      const insertionsOnlyData = {
        ...mockReportData,
        stats: { filesChanged: 2, insertions: 10, deletions: 0 },
      };
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.COMMIT,
        insertionsOnlyData
      );

      expect(result).toContainEqual({
        label: "Changes",
        value: "2 files, GREEN[+10]",
      });
    });

    it("handles changes with only deletions", async () => {
      const deletionsOnlyData = {
        ...mockReportData,
        stats: { filesChanged: 2, insertions: 0, deletions: 8 },
      };
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.COMMIT,
        deletionsOnlyData
      );

      expect(result).toContainEqual({
        label: "Changes",
        value: "2 files, RED[-8]",
      });
    });

    it("excludes changes stats when no files changed", async () => {
      const noChangesData = {
        ...mockReportData,
        stats: { filesChanged: 0, insertions: 0, deletions: 0 },
      };
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.COMMIT,
        noChangesData
      );

      const changesItem = result.find((item) => item.label === "Changes");
      expect(changesItem).toBeUndefined();
    });

    it("excludes COMMIT-specific stats for CLIPBOARD mode", async () => {
      const result = await generateReport(
        "feat: test",
        mockContext,
        UsageMode.CLIPBOARD,
        mockReportData
      );

      const commitItem = result.find((item) => item.label === "Commit");
      const changesItem = result.find((item) => item.label === "Changes");

      expect(commitItem).toBeUndefined();
      expect(changesItem).toBeUndefined();
    });

  });
});
