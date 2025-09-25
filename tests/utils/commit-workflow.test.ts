import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCommitWorkflow } from "../../src/utils/commit-workflow.js";
import { createProviderFromConfig } from "../../src/providers/index.js";
import { formatError, isRetryableError } from "../../src/utils/errors.js";
import { spinner, message, errorWithDebug, formatMenuOption } from "../../src/utils/ui-utils.js";
import { Provider, UsageMode, type AIProvider } from "../../src/types/index.js";

vi.mock("prompts");
vi.mock("../../src/providers/index.js");
vi.mock("../../src/utils/errors.js");
vi.mock("../../src/utils/ui-utils.js");

const mockProvider = {
  generateCandidates: vi.fn(),
  buildPrompt: vi.fn(),
  getLastTokenUsage: vi.fn().mockReturnValue(null),
};

describe("commit-workflow", () => {
  const mockConfiguration = {
    provider: Provider.OPENAI,
    apiKey: "test-key",
    model: "gpt-4",
    usageMode: UsageMode.CLIPBOARD,
    redactSensitiveData: true,
  };

  const mockGitContext = {
    stagedFiles: ["src/test.ts"],
    branch: "main",
    difference: "test diff",
    regenerationAttempts: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createProviderFromConfig).mockReturnValue(
      mockProvider as unknown as AIProvider
    );
    vi.mocked(spinner).mockReturnValue(null);
    vi.mocked(message).mockReturnValue(undefined);
    vi.mocked(errorWithDebug).mockReturnValue(undefined);
    vi.mocked(formatError).mockReturnValue("formatted error");
    vi.mocked(isRetryableError).mockReturnValue(false);
    vi.mocked(formatMenuOption).mockImplementation(
      (label, type) => `${label} (${type})`
    );
  });

  describe("runCommitWorkflow", () => {
    it("successfully generates and selects a commit message", async () => {
      const mockCandidates = ["feat: add feature", "fix: bug fix"];
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(mockCandidates);

      const prompts = await import("prompts");
      vi.mocked(prompts.default).mockResolvedValue({ selection: "feat: add feature" });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("feat: add feature");
      expect(result.provider).toBe(mockProvider);
      expect(spinner).toHaveBeenCalledWith(
        "Generating commit messages...",
        "start",
        true
      );
      expect(spinner).toHaveBeenCalledWith(
        "Generating commit messages...",
        "succeed"
      );
    });

    it("handles empty candidates with custom message", async () => {
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue([]);

      const prompts = await import("prompts");
      vi.mocked(prompts.default).mockResolvedValue({ custom: "custom commit message" });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("custom commit message");
      expect(result.provider).toBe(mockProvider);
    });

    it("handles user cancellation during empty candidates", async () => {
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue([]);

      const prompts = await import("prompts");
      vi.mocked(prompts.default).mockResolvedValue({ custom: undefined });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(true);
      expect(result.selectedMessage).toBeUndefined();
      expect(message).toHaveBeenCalledWith("Commit cancelled", {
        type: "warning",
        variant: "title",
      });
    });

    it("handles user cancellation during message selection", async () => {
      const mockCandidates = ["feat: add feature"];
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(mockCandidates);

      const prompts = await import("prompts");
      vi.mocked(prompts.default).mockResolvedValue({ selection: undefined });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(true);
      expect(result.selectedMessage).toBeUndefined();
      expect(message).toHaveBeenCalledWith("Commit cancelled", {
        type: "warning",
        variant: "title",
      });
    });

    it("handles regeneration successfully", async () => {
      const initialCandidates = ["feat: initial"];
      const regeneratedCandidates = ["feat: regenerated"];

      vi.mocked(mockProvider.generateCandidates)
        .mockResolvedValueOnce(initialCandidates)
        .mockResolvedValueOnce(regeneratedCandidates);

      const prompts = await import("prompts");
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ selection: "REGENERATE" })
        .mockResolvedValueOnce({ selection: "feat: regenerated" });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("feat: regenerated");
      expect(mockProvider.generateCandidates).toHaveBeenCalledTimes(2);
      expect(spinner).toHaveBeenCalledWith(
        "Generating commit messages...",
        "start",
        true
      );
      expect(spinner).toHaveBeenCalledWith(
        "Generating commit messages...",
        "succeed"
      );
    });

    it("handles custom message selection", async () => {
      const mockCandidates = ["feat: add feature"];
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(mockCandidates);

      const prompts = await import("prompts");
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ selection: "CUSTOM" })
        .mockResolvedValueOnce({ custom: "custom message from selection" });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("custom message from selection");
    });

    it("handles generation errors without retry", async () => {
      const error = new Error("API error");
      vi.mocked(mockProvider.generateCandidates).mockRejectedValue(error);

      const prompts = await import("prompts");
      vi.mocked(prompts.default).mockResolvedValue({ custom: "fallback message" });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("fallback message");
      expect(spinner).toHaveBeenCalledWith(
        "Failed to generate messages from provider",
        "fail"
      );
      expect(errorWithDebug).toHaveBeenCalled();
    });

    it("handles generation errors with successful retry", async () => {
      const error = new Error("Network error");
      const mockCandidates = ["feat: add feature"];

      vi.mocked(mockProvider.generateCandidates)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockCandidates);
      vi.mocked(isRetryableError).mockReturnValue(true);

      const prompts = await import("prompts");
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ retry: true })
        .mockResolvedValueOnce({ selection: "feat: add feature" });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("feat: add feature");
      expect(mockProvider.generateCandidates).toHaveBeenCalledTimes(2);
    });

    it("handles regeneration errors with retry request", async () => {
      const mockCandidates = ["feat: initial"];
      vi.mocked(mockProvider.generateCandidates)
        .mockResolvedValueOnce(mockCandidates)
        .mockRejectedValueOnce(new Error("Regeneration error"))
        .mockResolvedValueOnce(["feat: finally works"]);
      vi.mocked(isRetryableError).mockReturnValue(true);

      const prompts = await import("prompts");
      vi.mocked(prompts.default)
        .mockResolvedValueOnce({ selection: "REGENERATE" })
        .mockResolvedValueOnce({ retry: true })
        .mockResolvedValueOnce({ selection: "feat: finally works" });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("feat: finally works");
      expect(mockProvider.generateCandidates).toHaveBeenCalledTimes(3);
    });

    it("normalizes selected messages by removing newlines and extra spaces", async () => {
      const mockCandidates = ["feat: add\n  feature\n\n  with   spaces"];
      vi.mocked(mockProvider.generateCandidates).mockResolvedValue(mockCandidates);

      const prompts = await import("prompts");
      vi.mocked(prompts.default).mockResolvedValue({
        selection: "feat: add\n  feature\n\n  with   spaces",
      });

      const result = await runCommitWorkflow(mockConfiguration, mockGitContext, false);

      expect(result.cancelled).toBe(false);
      expect(result.selectedMessage).toBe("feat: add feature with spaces");
    });
  });
});
