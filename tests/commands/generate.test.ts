import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prompts from "prompts";
import { generateCommand } from "../../src/commands/generate.js";
import { configurationExists, loadConfiguration, getConfigurationWithEnvironmentOverrides } from "../../src/utils/config.js";
import { checkGitInstalled, checkInGitRepo, getGitContext, commit, getLatestCommitHash, getCommitStats, hasUpstream, getAheadBehind, getRemoteUrl } from "../../src/utils/git-utils.js";
import { copyToClipboard } from "../../src/utils/system-utils.js";
import { createProvider, createProviderFromConfig } from "../../src/providers/index.js";
import { exitWithError, errorWithDebug, message } from "../../src/utils/ui-utils.js";
import { Provider, UsageMode } from "../../src/types/index.js";
import type { AIProvider } from "../../src/types/index.js";

vi.mock("prompts");
vi.mock("../../src/utils/config.js");
vi.mock("../../src/utils/git-utils.js");
vi.mock("../../src/utils/system-utils.js", () => ({
  copyToClipboard: vi.fn(),
  exit: vi.fn((code) => {
    if (code === 1) {
      throw new Error("Process would exit with code 1");
    }
  }),
}));
vi.mock("../../src/providers/index.js", () => ({
  createProvider: vi.fn(),
  createProviderFromConfig: vi.fn(),
}));
vi.mock("../../src/utils/ui-utils.js", async () => {
  const { uiUtilsMock } = await import("../__mocks__/ui-utils.mock.js");
  return uiUtilsMock;
});
vi.mock("node:fs", () => ({
  promises: {
    writeFile: vi.fn(),
  },
}));
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    stop: vi.fn(),
  })),
}));

describe("commands/generate", () => {
  const mockConfiguration = {
    provider: Provider.OPENAI,
    apiKey: "test-key",
    model: "gpt-4",
    maxCommitLength: 72,
    commitChoicesCount: 5,
    usageMode: UsageMode.CLIPBOARD,
    redactSensitiveData: true,
  };

  const mockContext = {
    stagedFiles: ["src/index.ts", "src/utils.ts"],
    branch: "main",
    difference: "diff content",
    regenerationAttempts: 0,
  };

  const mockProvider = {
    generateCandidates: vi.fn(),
    buildPrompt: vi.fn(),
    getLastTokenUsage: vi.fn().mockReturnValue(null),
  };

  const originalExit = process.exit;
  const mockExit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = mockExit as never;

    vi.mocked(exitWithError).mockImplementation(() => {
      throw new Error("Exit with error");
    });

    vi.mocked(createProvider).mockReturnValue(mockProvider as unknown as AIProvider);
    vi.mocked(createProviderFromConfig).mockReturnValue(mockProvider as unknown as AIProvider);
  });

  const setupBasicMocks = (config = mockConfiguration, context = mockContext) => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(config);
    vi.mocked(getConfigurationWithEnvironmentOverrides).mockReturnValue(config);
    vi.mocked(checkGitInstalled).mockResolvedValue();
    vi.mocked(checkInGitRepo).mockResolvedValue();
    vi.mocked(getGitContext).mockResolvedValue(context);
  };

  afterEach(() => {
    process.exit = originalExit;
  });

  describe("configuration check", () => {
    it("exits when no configuration exists", async () => {
      vi.mocked(configurationExists).mockResolvedValue(false);

      await expect(generateCommand({ dryrun: false })).rejects.toThrow(
        "Configuration not found. Please run 'cmai init' to set up your configuration"
      );
    });
  });

  describe("git checks", () => {
    it("performs git checks", async () => {
      setupBasicMocks();
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(["feat: add new feature"]);
      vi.mocked(prompts).mockResolvedValue({ selection: "feat: add new feature" });

      await generateCommand({ dryrun: false });

      expect(checkGitInstalled).toHaveBeenCalled();
      expect(checkInGitRepo).toHaveBeenCalled();
    });
  });

  describe("staged files check", () => {
    it("exits when no files staged without allowEmpty", async () => {
      setupBasicMocks(mockConfiguration, {
        ...mockContext,
        stagedFiles: [],
      });

      await expect(generateCommand({ dryrun: false })).rejects.toThrow(
        "No staged files found. Stage some changes before running."
      );
    });
  });

  describe("dry run mode", () => {
    it("shows prompt preview in dry run mode", async () => {
      vi.mocked(configurationExists).mockResolvedValue(true);
      vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
      vi.mocked(getConfigurationWithEnvironmentOverrides).mockReturnValue(
        mockConfiguration
      );
      vi.mocked(checkGitInstalled).mockResolvedValue();
      vi.mocked(checkInGitRepo).mockResolvedValue();
      vi.mocked(getGitContext).mockResolvedValue(mockContext);
      vi.mocked(mockProvider.buildPrompt).mockReturnValue("Test prompt");
      vi.mocked(prompts).mockResolvedValueOnce({ proceed: false });

      await generateCommand({ dryrun: true });

      expect(mockProvider.buildPrompt).toHaveBeenCalledWith(mockContext);
      expect(message).toHaveBeenCalledWith("Test prompt");
      expect(message).toHaveBeenCalledWith("Commit cancelled", {
        type: "warning",
        variant: "title",
      });
    });
  });

  describe("commit message generation", () => {
    it("generates and displays commit messages", async () => {
      vi.mocked(configurationExists).mockResolvedValue(true);
      vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
      vi.mocked(getConfigurationWithEnvironmentOverrides).mockReturnValue(
        mockConfiguration
      );
      vi.mocked(checkGitInstalled).mockResolvedValue();
      vi.mocked(checkInGitRepo).mockResolvedValue();
      vi.mocked(getGitContext).mockResolvedValue(mockContext);
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue([
        "feat: add new feature",
        "feat: implement feature",
        "feat: create feature",
      ]);
      vi.mocked(prompts).mockResolvedValue({ selection: "feat: add new feature" });

      await generateCommand({ dryrun: false });

      expect(mockProvider.generateCandidates).toHaveBeenCalledWith(mockContext);
    });

    it("handles regeneration", async () => {
      vi.mocked(configurationExists).mockResolvedValue(true);
      vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
      vi.mocked(getConfigurationWithEnvironmentOverrides).mockReturnValue(
        mockConfiguration
      );
      vi.mocked(checkGitInstalled).mockResolvedValue();
      vi.mocked(checkInGitRepo).mockResolvedValue();
      vi.mocked(getGitContext).mockResolvedValue(mockContext);
      vi.mocked(mockProvider.generateCandidates)
        .mockResolvedValueOnce(["feat: first"])
        .mockResolvedValueOnce(["feat: second"]);
      vi.mocked(prompts)
        .mockResolvedValueOnce({ selection: "REGENERATE" })
        .mockResolvedValueOnce({ selection: "feat: second" });

      await generateCommand({ dryrun: false });

      expect(mockProvider.generateCandidates).toHaveBeenCalledTimes(2);
      expect(mockProvider.generateCandidates).toHaveBeenLastCalledWith({
        ...mockContext,
        regenerationAttempts: 1,
      });
    });
  });

  describe("usage modes", () => {
    it("copies to clipboard in clipboard mode", async () => {
      setupBasicMocks();
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(["feat: add feature"]);
      vi.mocked(prompts).mockResolvedValue({ selection: "feat: add feature" });
      vi.mocked(copyToClipboard).mockResolvedValue();

      await generateCommand({ dryrun: false });

      expect(copyToClipboard).toHaveBeenCalledWith("feat: add feature");
      expect(message).toHaveBeenCalledWith(
        "",
        expect.objectContaining({
          items: expect.anything(),
        })
      );
      expect(message).toHaveBeenCalledWith(
        "Message copied to clipboard",
        expect.objectContaining({
          type: "success",
        })
      );
    });

    it("creates commit in commit mode", async () => {
      const commitConfig = {
        ...mockConfiguration,
        usageMode: UsageMode.COMMIT,
      };
      setupBasicMocks(commitConfig);
      vi.mocked(commit).mockResolvedValue();
      vi.mocked(getLatestCommitHash).mockResolvedValue("abc123");
      vi.mocked(getCommitStats).mockResolvedValue({
        filesChanged: 2,
        insertions: 10,
        deletions: 5,
      });
      vi.mocked(hasUpstream).mockResolvedValue(true);
      vi.mocked(getAheadBehind).mockResolvedValue({ ahead: 1, behind: 0 });
      vi.mocked(getRemoteUrl).mockResolvedValue("https://github.com/user/repo.git");
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(["feat: add feature"]);
      vi.mocked(prompts).mockResolvedValue({ selection: "feat: add feature" });

      await generateCommand({ dryrun: false });

      expect(commit).toHaveBeenCalledWith("feat: add feature");
      expect(message).toHaveBeenCalledWith(
        "",
        expect.objectContaining({
          items: expect.any(Array),
        })
      );
      expect(message).toHaveBeenCalledWith(
        "Commit created successfully (ready for push)",
        expect.objectContaining({
          type: "success",
        })
      );
    });


    it("handles clipboard failure with appropriate messages", async () => {
      vi.mocked(configurationExists).mockResolvedValue(true);
      vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
      vi.mocked(getConfigurationWithEnvironmentOverrides).mockReturnValue(
        mockConfiguration
      );
      vi.mocked(checkGitInstalled).mockResolvedValue();
      vi.mocked(checkInGitRepo).mockResolvedValue();
      vi.mocked(getGitContext).mockResolvedValue(mockContext);
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(["feat: add feature"]);
      vi.mocked(prompts).mockResolvedValue({ selection: "feat: add feature" });
      vi.mocked(copyToClipboard).mockRejectedValue(new Error("Clipboard error"));

      await generateCommand({ dryrun: false });

      expect(message).toHaveBeenCalledWith(
        "",
        expect.objectContaining({
          items: expect.any(Array),
        })
      );
      expect(message).toHaveBeenCalledWith(
        "Failed to copy to clipboard",
        expect.objectContaining({
          type: "warning",
          variant: "title",
        })
      );
      expect(message).toHaveBeenCalledWith("You can manually copy the message above", {
        type: "info",
        variant: "title",
      });
    });

    it("handles commit failure with error message", async () => {
      vi.mocked(configurationExists).mockResolvedValue(true);
      vi.mocked(loadConfiguration).mockResolvedValue({
        ...mockConfiguration,
        usageMode: UsageMode.COMMIT,
      });
      vi.mocked(getConfigurationWithEnvironmentOverrides).mockReturnValue({
        ...mockConfiguration,
        usageMode: UsageMode.COMMIT,
      });
      vi.mocked(checkGitInstalled).mockResolvedValue();
      vi.mocked(checkInGitRepo).mockResolvedValue();
      vi.mocked(getGitContext).mockResolvedValue(mockContext);
      vi.mocked(commit).mockRejectedValue(new Error("Git commit failed"));
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(["feat: add feature"]);
      vi.mocked(prompts).mockResolvedValue({ selection: "feat: add feature" });

      await expect(generateCommand({ dryrun: false })).rejects.toThrow(
        "Process would exit with code 1"
      );
      expect(message).toHaveBeenCalledWith("Git commit failed", {
        type: "error",
        variant: "title",
      });
    });
  });

  describe("error handling", () => {
    it("handles provider errors gracefully", async () => {
      vi.mocked(configurationExists).mockResolvedValue(true);
      vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
      vi.mocked(getConfigurationWithEnvironmentOverrides).mockReturnValue(
        mockConfiguration
      );
      vi.mocked(checkGitInstalled).mockResolvedValue();
      vi.mocked(checkInGitRepo).mockResolvedValue();
      vi.mocked(getGitContext).mockResolvedValue(mockContext);
      vi.mocked(mockProvider.generateCandidates).mockRejectedValue(new Error("API error"));

      await generateCommand({ dryrun: false });

      expect(errorWithDebug).toHaveBeenCalled();
    });
  });
});
