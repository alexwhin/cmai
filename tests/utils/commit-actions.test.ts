import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeCommitAction } from "../../src/utils/commit-actions.js";
import { Provider, UsageMode, type AIProvider } from "../../src/types/index.js";
import { copyToClipboard, exit } from "../../src/utils/system-utils.js";
import { commit, getLatestCommitHash, getCommitStats } from "../../src/utils/git-utils.js";
import { generateReport } from "../../src/utils/data-utils.js";
import { message, spinner } from "../../src/utils/ui-utils.js";

vi.mock("../../src/utils/system-utils.js");
vi.mock("../../src/utils/git-utils.js");
vi.mock("../../src/utils/data-utils.js");
vi.mock("../../src/utils/ui-utils.js");

describe("commit-actions", () => {
  const mockProvider = {
    getLastTokenUsage: vi.fn().mockReturnValue({ totalTokens: 100 }),
  };

  const baseContext = {
    selectedMessage: "feat: test message",
    configuration: {
      provider: Provider.OPENAI,
      apiKey: "test-key",
      model: "gpt-4",
    },
    gitContext: {
      stagedFiles: ["src/test.ts"],
      branch: "main",
      difference: "test diff",
    },
    provider: mockProvider as unknown as AIProvider,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(message).mockReturnValue(undefined);
    vi.mocked(spinner).mockReturnValue(null);
    vi.mocked(exit).mockReturnValue(undefined);
    vi.mocked(generateReport).mockResolvedValue([
      { label: "Message", value: "feat: test message" },
    ]);
  });

  describe("executeCommitAction", () => {
    describe("clipboard mode", () => {
      it("successfully copies to clipboard", async () => {
        vi.mocked(copyToClipboard).mockResolvedValue();

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.CLIPBOARD,
        });

        expect(copyToClipboard).toHaveBeenCalledWith("feat: test message");
        expect(message).toHaveBeenCalledWith("", { items: expect.any(Array) });
        expect(message).toHaveBeenCalledWith("Message copied to clipboard", {
          type: "success",
          variant: "title",
        });
        expect(exit).toHaveBeenCalledWith();
      });

      it("handles clipboard failure", async () => {
        vi.mocked(copyToClipboard).mockRejectedValue(new Error("Clipboard error"));

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.CLIPBOARD,
        });

        expect(message).toHaveBeenCalledWith("", { items: expect.any(Array) });
        expect(message).toHaveBeenCalledWith("Failed to copy to clipboard", {
          type: "warning",
          variant: "title",
        });
        expect(message).toHaveBeenCalledWith(
          "You can manually copy the message above",
          { type: "info", variant: "title" }
        );
        expect(exit).toHaveBeenCalledWith();
      });
    });

    describe("commit mode", () => {
      it("successfully creates commit", async () => {
        vi.mocked(commit).mockResolvedValue();
        vi.mocked(getLatestCommitHash).mockResolvedValue("abc123");
        vi.mocked(getCommitStats).mockResolvedValue({
          filesChanged: 1,
          insertions: 10,
          deletions: 2,
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.COMMIT,
        });

        expect(commit).toHaveBeenCalledWith("feat: test message");
        expect(getLatestCommitHash).toHaveBeenCalled();
        expect(getCommitStats).toHaveBeenCalled();
        expect(spinner).toHaveBeenCalledWith("Creating commit...", "start");
        expect(spinner).toHaveBeenCalledWith(
          "Commit created successfully!",
          "succeed"
        );
        expect(message).toHaveBeenCalledWith("", { items: expect.any(Array) });
        expect(message).toHaveBeenCalledWith(
          "Commit created successfully (ready for push)",
          { type: "success", variant: "title" }
        );
        expect(exit).toHaveBeenCalledWith();
      });

      it("handles commit failure", async () => {
        const error = new Error("Commit failed");
        vi.mocked(commit).mockRejectedValue(error);

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.COMMIT,
        });

        expect(spinner).toHaveBeenCalledWith("Creating commit...", "start");
        expect(spinner).toHaveBeenCalledWith("Failed to create commit", "fail");
        expect(message).toHaveBeenCalledWith("Commit failed", {
          type: "error",
          variant: "title",
        });
        expect(exit).toHaveBeenCalledWith(1);
      });

      it("handles unknown commit error", async () => {
        vi.mocked(commit).mockRejectedValue("string error");

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.COMMIT,
        });

        expect(message).toHaveBeenCalledWith(
          "An unexpected error occurred: string error",
          { type: "error", variant: "title" }
        );
        expect(exit).toHaveBeenCalledWith(1);
      });
    });

    describe("terminal output mode", () => {
      let mockReadline: {
        createInterface: ReturnType<typeof vi.fn>;
      };
      let mockRl: {
        question: ReturnType<typeof vi.fn>;
        close: ReturnType<typeof vi.fn>;
        write: ReturnType<typeof vi.fn>;
      };
      let mockSpawn: ReturnType<typeof vi.fn>;
      let mockExecSync: ReturnType<typeof vi.fn>;
      let mockProcess: {
        on: ReturnType<typeof vi.fn>;
      };

      beforeEach(() => {
        mockRl = {
          question: vi.fn(),
          write: vi.fn(),
          close: vi.fn(),
        };
        mockReadline = {
          createInterface: vi.fn().mockReturnValue(mockRl),
        };
        mockProcess = {
          on: vi.fn(),
        };
        mockSpawn = vi.fn(() => mockProcess);
        mockExecSync = vi.fn();

        vi.doMock("node:readline", () => mockReadline);
        vi.doMock("node:child_process", () => ({
          spawn: mockSpawn,
          execSync: mockExecSync,
        }));
      });

      afterEach(() => {
        vi.doUnmock("node:readline");
        vi.doUnmock("node:child_process");
      });

      it("displays commit message and prompts user with git command", async () => {
        vi.mocked(generateReport).mockResolvedValue([
          { label: "Message", value: "feat: test message" },
        ]);

        const gitCommand = "git commit -m \"feat: test message\"";
        mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
          callback("");
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.TERMINAL,
        });

        expect(message).toHaveBeenCalledWith("", { items: expect.any(Array) });
        expect(message).toHaveBeenCalledWith("Edit command or press enter to execute", {
          type: "success",
          variant: "title",
        });
        expect(mockRl.write).toHaveBeenCalledWith(gitCommand);
        expect(mockRl.question).toHaveBeenCalled();
        expect(mockRl.close).toHaveBeenCalled();
        expect(exit).toHaveBeenCalledWith();
      });

      it("streams git commit output in real-time using spawn", async () => {
        vi.mocked(generateReport).mockResolvedValue([
          { label: "Message", value: "feat: test message" },
        ]);

        mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
          callback("git commit -m \"fix: modified message\"");
        });

        mockProcess.on.mockImplementation((event: string, handler: (code: number) => void) => {
          if (event === "close") {
            setTimeout(() => handler(0), 0);
          }
          return mockProcess;
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.TERMINAL,
        });

        expect(mockSpawn).toHaveBeenCalledWith("git", ["commit", "-m", "fix: modified message"], {
          stdio: "inherit",
        });
        expect(mockProcess.on).toHaveBeenCalledWith("close", expect.any(Function));
        expect(mockProcess.on).toHaveBeenCalledWith("error", expect.any(Function));
        expect(message).toHaveBeenCalledWith("Command executed successfully", {
          type: "success",
          variant: "title",
        });
        expect(exit).toHaveBeenCalledWith();
      });

      it("handles empty input", async () => {
        vi.mocked(generateReport).mockResolvedValue([
          { label: "Message", value: "feat: test message" },
        ]);

        mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
          callback("");
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.TERMINAL,
        });

        expect(mockSpawn).not.toHaveBeenCalled();
        expect(mockExecSync).not.toHaveBeenCalled();
        expect(exit).toHaveBeenCalledWith();
      });

      it("handles non-git commands", async () => {
        vi.mocked(generateReport).mockResolvedValue([
          { label: "Message", value: "feat: test message" },
        ]);
        
        mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
          callback("echo 'custom command'");
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.TERMINAL,
        });

        expect(message).toHaveBeenCalledWith("Not a git commit command - executing as shell command", {
          type: "warning",
          variant: "title",
        });
        expect(mockExecSync).toHaveBeenCalledWith("echo 'custom command'", { stdio: "inherit" });
        expect(exit).toHaveBeenCalledWith();
      });

      it("handles git commit errors with spawn", async () => {
        vi.mocked(generateReport).mockResolvedValue([
          { label: "Message", value: "feat: test message" },
        ]);

        mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
          callback("git commit -m \"test message\"");
        });

        mockProcess.on.mockImplementation((event: string, handler: (codeOrError: number | Error) => void) => {
          if (event === "close") {
            setTimeout(() => handler(1), 0);
          }
          return mockProcess;
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.TERMINAL,
        });

        expect(message).toHaveBeenCalledWith("Failed to create commit", {
          type: "error",
          variant: "title",
        });
        expect(exit).toHaveBeenCalledWith(1);
      });

      it("handles spawn process errors", async () => {
        vi.mocked(generateReport).mockResolvedValue([
          { label: "Message", value: "feat: test message" },
        ]);

        mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
          callback("git commit -m \"test message\"");
        });

        mockProcess.on.mockImplementation((event: string, handler: (codeOrError: Error) => void) => {
          if (event === "error") {
            setTimeout(() => handler(new Error("Process spawn failed")), 0);
          }
          return mockProcess;
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.TERMINAL,
        });

        expect(message).toHaveBeenCalledWith("Process spawn failed", {
          type: "error",
          variant: "title",
        });
        expect(exit).toHaveBeenCalledWith(1);
      });

      it("handles special characters in commit message", async () => {
        const messageWithSpecialChars = "feat: test $var `cmd` 'quotes' \\backslash";
        vi.mocked(generateReport).mockResolvedValue([
          { label: "Message", value: messageWithSpecialChars },
        ]);
        
        mockRl.question.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
          callback("");
        });

        await executeCommitAction({
          ...baseContext,
          selectedMessage: messageWithSpecialChars,
          usageMode: UsageMode.TERMINAL,
        });

        const expectedEscaped = "git commit -m \"feat: test $var `cmd` 'quotes' \\backslash\"";
        expect(mockRl.write).toHaveBeenCalledWith(expectedEscaped);
      });
    });

    describe("default mode", () => {
      it("handles unknown usage mode as clipboard", async () => {
        vi.mocked(copyToClipboard).mockResolvedValue();
        
        await executeCommitAction({
          ...baseContext,
          usageMode: "unknown" as unknown as UsageMode,
        });

        expect(message).toHaveBeenCalledWith(
          "Message copied to clipboard",
          { type: "success", variant: "title" }
        );
        expect(exit).toHaveBeenCalledWith();
      });
    });

    describe("report generation", () => {
      it("includes token usage in reports when available", async () => {
        vi.mocked(copyToClipboard).mockResolvedValue();
        const mockTokenUsage = { totalTokens: 150 };
        const providerWithUsage = {
          getLastTokenUsage: vi.fn().mockReturnValue(mockTokenUsage),
        };

        await executeCommitAction({
          ...baseContext,
          provider: providerWithUsage as unknown as AIProvider,
          usageMode: UsageMode.CLIPBOARD,
        });

        expect(generateReport).toHaveBeenCalledWith(
          "feat: test message",
          baseContext.gitContext,
          UsageMode.CLIPBOARD,
          expect.objectContaining({
            provider: expect.objectContaining({
              tokensUsed: 150,
            }),
          })
        );
      });

      it("handles null token usage", async () => {
        vi.mocked(copyToClipboard).mockResolvedValue();
        const providerWithoutUsage = {
          getLastTokenUsage: vi.fn().mockReturnValue(null),
        };

        await executeCommitAction({
          ...baseContext,
          provider: providerWithoutUsage as unknown as AIProvider,
          usageMode: UsageMode.CLIPBOARD,
        });

        expect(generateReport).toHaveBeenCalledWith(
          "feat: test message",
          baseContext.gitContext,
          UsageMode.CLIPBOARD,
          expect.objectContaining({
            provider: expect.objectContaining({
              tokensUsed: undefined,
            }),
          })
        );
      });

      it("handles commit mode with additional data", async () => {
        vi.mocked(commit).mockResolvedValue();
        vi.mocked(getLatestCommitHash).mockResolvedValue("commit123");
        vi.mocked(getCommitStats).mockResolvedValue({
          filesChanged: 3,
          insertions: 25,
          deletions: 8,
        });

        await executeCommitAction({
          ...baseContext,
          usageMode: UsageMode.COMMIT,
        });

        expect(generateReport).toHaveBeenCalledWith(
          "feat: test message",
          baseContext.gitContext,
          UsageMode.COMMIT,
          expect.objectContaining({
            commitHash: "commit123",
            stats: {
              filesChanged: 3,
              insertions: 25,
              deletions: 8,
            },
            provider: expect.objectContaining({
              model: "gpt-4",
              name: Provider.OPENAI,
              tokensUsed: 100,
            }),
          })
        );
      });
    });
  });
});
