import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setupGitMocks, resetAllMocks } from "../test-helpers.js";

vi.mock("../../src/utils/system-utils.js", () => ({
  redactSensitiveData: vi.fn((text) => `[REDACTED] ${text}`),
}));

vi.mock("../../src/utils/ui-utils.js", () => ({
  log: vi.fn(),
  info: vi.fn((message) => message),
  message: vi.fn(),
}));

describe("git-utils", () => {
  let gitMocks: ReturnType<typeof setupGitMocks>;
  
  beforeEach(() => {
    gitMocks = setupGitMocks();
    vi.clearAllMocks();
    resetAllMocks(gitMocks.mockExecuteCommand, gitMocks.mockExecFilePromise);
    vi.resetModules();
  });
  
  afterEach(() => {
    gitMocks.cleanup();
  });

  // Core Git Commands
  describe("checkGitInstalled", () => {
    it("succeeds when git is installed", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "git version 2.39.1", stderr: "" });

      const { checkGitInstalled } = await import("../../src/utils/git-utils.js");
      await expect(checkGitInstalled()).resolves.toBeUndefined();
    });

    it("throws error when git is not installed", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("command not found"));

      const { checkGitInstalled } = await import("../../src/utils/git-utils.js");
      await expect(checkGitInstalled()).rejects.toThrow("Command not found: git");
    });
  });

  describe("checkInGitRepo", () => {
    it("succeeds when in a git repository", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: ".git", stderr: "" });

      const { checkInGitRepo } = await import("../../src/utils/git-utils.js");
      await expect(checkInGitRepo()).resolves.toBeUndefined();
    });

    it("throws error when not in a git repository", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("not a git repository"));

      const { checkInGitRepo } = await import("../../src/utils/git-utils.js");
      await expect(checkInGitRepo()).rejects.toThrow("Not a git repository");
    });
  });

  describe("getStagedFiles", () => {
    it("returns list of staged files", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: "file1.ts\nfile2.js\nfile3.md\n",
        stderr: "",
      });

      const { getStagedFiles } = await import("../../src/utils/git-utils.js");
      const files = await getStagedFiles();

      expect(files).toEqual(["file1.ts", "file2.js", "file3.md"]);
    });

    it("returns empty array when no files staged", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "", stderr: "" });

      const { getStagedFiles } = await import("../../src/utils/git-utils.js");
      const files = await getStagedFiles();

      expect(files).toEqual([]);
    });

    it("handles files with special characters", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: 'file with spaces.txt\n"file-with-quotes".js\nfile\\with\\backslash.ts',
        stderr: "",
      });

      const { getStagedFiles } = await import("../../src/utils/git-utils.js");
      const files = await getStagedFiles();

      expect(files).toEqual([
        "file with spaces.txt",
        '"file-with-quotes".js',
        "file\\with\\backslash.ts",
      ]);
    });

    it("handles git command failure", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("Not a git repository"));

      const { getStagedFiles } = await import("../../src/utils/git-utils.js");
      await expect(getStagedFiles()).rejects.toThrow();
    });
  });

  describe("getCurrentBranch", () => {
    it("returns the current branch name", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "main\n", stderr: "" });

      const { getCurrentBranch } = await import("../../src/utils/git-utils.js");
      const branch = await getCurrentBranch();

      expect(branch).toBe("main");
    });
  });

  describe("getStagedDifference", () => {
    it("returns staged differences", async () => {
      const difference = "diff --git a/file.js b/file.js\n+console.log('test');";
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: difference, stderr: "" });

      const { getStagedDifference } = await import("../../src/utils/git-utils.js");
      const result = await getStagedDifference();

      expect(result).toBe(difference);
    });

    it("truncates long differences", async () => {
      const longDifference = "x".repeat(15000);
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: longDifference, stderr: "" });

      const { getStagedDifference } = await import("../../src/utils/git-utils.js");
      const result = await getStagedDifference();

      expect(result).toBe("x".repeat(10000) + "\n... (truncated)");
    });

    it("truncates very long diffs", async () => {
      const longDiff = "a".repeat(100001);
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: longDiff, stderr: "" });

      const { getStagedDifference } = await import("../../src/utils/git-utils.js");
      const diff = await getStagedDifference(100000);

      expect(diff).toEqual("a".repeat(100000) + "\n... (truncated)");
    });

    it("handles custom max length parameter", async () => {
      const diff = "a".repeat(150);
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: diff, stderr: "" });

      const { getStagedDifference } = await import("../../src/utils/git-utils.js");
      const result = await getStagedDifference(100);

      expect(result).toEqual("a".repeat(100) + "\n... (truncated)");
    });

    it("does not truncate when under limit", async () => {
      const shortDiff = "diff content";
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: shortDiff, stderr: "" });

      const { getStagedDifference } = await import("../../src/utils/git-utils.js");
      const diff = await getStagedDifference();

      expect(diff).toEqual(shortDiff);
    });
  });

  describe("commit", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("commits with message", async () => {
      vi.doMock("node:child_process", () => ({
        exec: vi.fn(),
        execFile: vi.fn((cmd, args, opts, callback) => {
          if (typeof opts === "function") {
            callback = opts;
          }
          callback(null, "", "2 files changed, 10 insertions(+)");
        }),
      }));
      vi.doMock("node:util", () => ({
        promisify: vi.fn(() => gitMocks.mockExecFilePromise),
      }));
      
      gitMocks.mockExecFilePromise.mockResolvedValue({
        stdout: "",
        stderr: "2 files changed, 10 insertions(+)",
      });

      const { commit } = await import("../../src/utils/git-utils.js");
      await expect(commit("test: add tests")).resolves.toBeUndefined();

      expect(gitMocks.mockExecFilePromise).toHaveBeenCalledWith("git", ["commit", "-m", "test: add tests"], {
        shell: false,
        windowsHide: true,
      });
      
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    });

    it("commits with allow-empty flag", async () => {
      vi.doMock("node:child_process", () => ({
        exec: vi.fn(),
        execFile: vi.fn(),
      }));
      vi.doMock("node:util", () => ({
        promisify: vi.fn(() => gitMocks.mockExecFilePromise),
      }));
      
      gitMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { commit } = await import("../../src/utils/git-utils.js");
      await expect(commit("chore: empty commit", true)).resolves.toBeUndefined();

      expect(gitMocks.mockExecFilePromise).toHaveBeenCalledWith("git", ["commit", "-m", "chore: empty commit", "--allow-empty"], {
        shell: false,
        windowsHide: true,
      });
      
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    });

    it("throws on real errors", async () => {
      vi.doMock("node:child_process", () => ({
        exec: vi.fn(),
        execFile: vi.fn(),
      }));
      vi.doMock("node:util", () => ({
        promisify: vi.fn(() => gitMocks.mockExecFilePromise),
      }));
      
      const error = new Error("Command failed");
      (error as unknown as { stderr: string }).stderr = "fatal: error occurred";
      gitMocks.mockExecFilePromise.mockRejectedValue(error);

      const { commit } = await import("../../src/utils/git-utils.js");
      await expect(commit("test")).rejects.toThrow("fatal: error occurred");
      
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    });

    it("handles commit with quotes in message", async () => {
      vi.doMock("node:child_process", () => ({
        exec: vi.fn(),
        execFile: vi.fn(),
      }));
      vi.doMock("node:util", () => ({
        promisify: vi.fn(() => gitMocks.mockExecFilePromise),
      }));
      
      gitMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { commit } = await import("../../src/utils/git-utils.js");
      await commit('feat: add "quoted" feature');

      expect(gitMocks.mockExecFilePromise).toHaveBeenCalledWith("git", ["commit", "-m", 'feat: add "quoted" feature'], {
        shell: false,
        windowsHide: true,
      });
      
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    });

    it("ignores acceptable stderr messages", async () => {
      vi.doMock("node:child_process", () => ({
        exec: vi.fn(),
        execFile: vi.fn(),
      }));
      vi.doMock("node:util", () => ({
        promisify: vi.fn(() => gitMocks.mockExecFilePromise),
      }));
      
      gitMocks.mockExecFilePromise.mockResolvedValue({
        stdout: "",
        stderr: "create mode 100644 new-file.txt",
      });

      const { commit } = await import("../../src/utils/git-utils.js");
      await expect(commit("feat: add new file")).resolves.not.toThrow();
      
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    });

    it("throws on real git errors", async () => {
      vi.doMock("node:child_process", () => ({
        exec: vi.fn(),
        execFile: vi.fn(),
      }));
      vi.doMock("node:util", () => ({
        promisify: vi.fn(() => gitMocks.mockExecFilePromise),
      }));
      
      gitMocks.mockExecFilePromise.mockRejectedValue({
        message: "Command failed",
        stderr: "error: spec 'nonexistent' did not match any file(s)"
      });

      const { commit } = await import("../../src/utils/git-utils.js");
      await expect(commit("test")).rejects.toThrow();
      
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    });
  });

  describe("getLatestCommitHash", () => {
    it("returns short commit hash", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "abc1234\n", stderr: "" });

      const { getLatestCommitHash } = await import("../../src/utils/git-utils.js");
      const hash = await getLatestCommitHash();

      expect(hash).toBe("abc1234");
    });
  });

  describe("getCommitStats", () => {
    it("parses commit stats correctly", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: " 3 files changed, 25 insertions(+), 10 deletions(-)\n",
        stderr: "",
      });

      const { getCommitStats } = await import("../../src/utils/git-utils.js");
      const stats = await getCommitStats();

      expect(stats).toEqual({
        filesChanged: 3,
        insertions: 25,
        deletions: 10,
      });
    });

    it("handles singular forms", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: " 1 file changed, 1 insertion(+), 1 deletion(-)\n",
        stderr: "",
      });

      const { getCommitStats } = await import("../../src/utils/git-utils.js");
      const stats = await getCommitStats();

      expect(stats).toEqual({
        filesChanged: 1,
        insertions: 1,
        deletions: 1,
      });
    });

    it("returns zeros for missing stats", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "", stderr: "" });

      const { getCommitStats } = await import("../../src/utils/git-utils.js");
      const stats = await getCommitStats();

      expect(stats).toEqual({
        filesChanged: 0,
        insertions: 0,
        deletions: 0,
      });
    });

    it("handles partial stats output", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: "3 files changed",
        stderr: "",
      });

      const { getCommitStats } = await import("../../src/utils/git-utils.js");
      const stats = await getCommitStats();

      expect(stats).toEqual({
        filesChanged: 3,
        insertions: 0,
        deletions: 0,
      });
    });
  });

  describe("getRemoteUrl", () => {
    it("returns remote URL", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: "https://github.com/user/repo.git\n",
        stderr: "",
      });

      const { getRemoteUrl } = await import("../../src/utils/git-utils.js");
      const url = await getRemoteUrl();

      expect(url).toBe("https://github.com/user/repo.git");
    });

    it("returns null on error", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("no remote"));

      const { getRemoteUrl } = await import("../../src/utils/git-utils.js");
      const url = await getRemoteUrl();

      expect(url).toBeNull();
    });
  });

  describe("hasUpstream", () => {
    it("returns true when upstream exists", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "origin/main\n", stderr: "" });

      const { hasUpstream } = await import("../../src/utils/git-utils.js");
      const result = await hasUpstream();

      expect(result).toBe(true);
    });

    it("returns false when no upstream", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("no upstream"));

      const { hasUpstream } = await import("../../src/utils/git-utils.js");
      const result = await hasUpstream();

      expect(result).toBe(false);
    });
  });

  describe("getAheadBehind", () => {
    it("returns ahead/behind counts", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "3\t2\n", stderr: "" });

      const { getAheadBehind } = await import("../../src/utils/git-utils.js");
      const result = await getAheadBehind();

      expect(result).toEqual({ ahead: 3, behind: 2 });
    });

    it("returns zeros on error", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("no upstream"));

      const { getAheadBehind } = await import("../../src/utils/git-utils.js");
      const result = await getAheadBehind();

      expect(result).toEqual({ ahead: 0, behind: 0 });
    });

    it("handles malformed output", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "invalid", stderr: "" });

      const { getAheadBehind } = await import("../../src/utils/git-utils.js");
      const result = await getAheadBehind();

      expect(result).toEqual({ ahead: 0, behind: 0 });
    });

    it("handles missing values in output", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "5\t", stderr: "" });

      const { getAheadBehind } = await import("../../src/utils/git-utils.js");
      const result = await getAheadBehind();

      expect(result).toEqual({ ahead: 5, behind: 0 });
    });
  });

  describe("getGitUserEmail", () => {
    it("returns user email from git config", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({ stdout: "alex@example.com\n", stderr: "" });

      const { getGitUserEmail } = await import("../../src/utils/git-utils.js");
      const result = await getGitUserEmail();

      expect(result).toBe("alex@example.com");
      expect(gitMocks.mockExecuteCommand).toHaveBeenCalledWith("git config user.email");
    });

    it("returns null when git config user.email is not set", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("no email"));

      const { getGitUserEmail } = await import("../../src/utils/git-utils.js");
      const result = await getGitUserEmail();

      expect(result).toBeNull();
    });
  });

  describe("getFormattedGitAuthor", () => {
    it("returns formatted author with username from email", async () => {
      gitMocks.mockExecuteCommand
        .mockResolvedValueOnce({ stdout: "Alex Whinfield\n", stderr: "" }) // getGitUsername
        .mockResolvedValueOnce({ stdout: "alex@example.com\n", stderr: "" }); // getGitUserEmail

      const { getFormattedGitAuthor } = await import("../../src/utils/git-utils.js");
      const result = await getFormattedGitAuthor();

      expect(result).toBe("Alex Whinfield (alex)");
    });

    it("returns just the name when email is not available", async () => {
      gitMocks.mockExecuteCommand
        .mockResolvedValueOnce({ stdout: "Alex Whinfield\n", stderr: "" }) // getGitUsername
        .mockRejectedValueOnce(new Error("no email")); // getGitUserEmail

      const { getFormattedGitAuthor } = await import("../../src/utils/git-utils.js");
      const result = await getFormattedGitAuthor();

      expect(result).toBe("Alex Whinfield");
    });

    it("handles missing git config with environment variables", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("no config"));
      const originalUser = process.env.USER;
      process.env.USER = "test-user";

      const { getFormattedGitAuthor } = await import("../../src/utils/git-utils.js");
      const author = await getFormattedGitAuthor();

      expect(author).toBe("test-user");
      process.env.USER = originalUser;
    });

    it("handles USERNAME env variable fallback", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("no config"));
      const originalUser = process.env.USER;
      const originalUsername = process.env.USERNAME;
      delete process.env.USER;
      process.env.USERNAME = "win-user";

      const { getFormattedGitAuthor } = await import("../../src/utils/git-utils.js");
      const author = await getFormattedGitAuthor();

      expect(author).toBe("win-user");
      process.env.USER = originalUser;
      process.env.USERNAME = originalUsername;
    });

    it("handles no environment variables", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("no config"));
      const originalUser = process.env.USER;
      const originalUsername = process.env.USERNAME;
      delete process.env.USER;
      delete process.env.USERNAME;

      const { getFormattedGitAuthor } = await import("../../src/utils/git-utils.js");
      const author = await getFormattedGitAuthor();

      expect(author).toBe("unknown");
      process.env.USER = originalUser;
      process.env.USERNAME = originalUsername;
    });

    it("formats author with email correctly", async () => {
      gitMocks.mockExecuteCommand
        .mockResolvedValueOnce({ stdout: "John Doe", stderr: "" })
        .mockResolvedValueOnce({ stdout: "john.doe@example.com", stderr: "" });

      const { getFormattedGitAuthor } = await import("../../src/utils/git-utils.js");
      const author = await getFormattedGitAuthor();

      expect(author).toBe("John Doe (john.doe)");
    });
  });

  describe("getRecentCommits", () => {
    it("returns commits from pull request merges when available", async () => {
      gitMocks.mockExecuteCommand
        .mockResolvedValueOnce({
          stdout:
            "feat: add awesome feature (#123)|\nfix: resolve critical bug (#124)|\nMerge pull request #125 from feature|feat: implement new API\n",
          stderr: "",
        })
        .mockResolvedValueOnce({ stdout: "", stderr: "" })
        .mockResolvedValueOnce({ stdout: "", stderr: "" });

      const { getRecentCommits } = await import("../../src/utils/git-utils.js");
      const commits = await getRecentCommits(3);

      expect(commits).toEqual([
        "feat: add awesome feature (#123)",
        "fix: resolve critical bug (#124)",
        "feat: implement new API",
      ]);
    });

    it("returns empty array on error", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("git command failed"));

      const { getRecentCommits } = await import("../../src/utils/git-utils.js");
      const commits = await getRecentCommits();

      expect(commits).toEqual([]);
    });

    it("handles empty repository", async () => {
      gitMocks.mockExecuteCommand.mockRejectedValue(new Error("does not have any commits"));

      const { getRecentCommits } = await import("../../src/utils/git-utils.js");
      const commits = await getRecentCommits();

      expect(commits).toEqual([]);
    });

    it("filters out automated commits", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: "Auto-merge pull request #123\nfeat: real feature\n[bot] Update dependencies",
        stderr: "",
      });

      const { getRecentCommits } = await import("../../src/utils/git-utils.js");
      const commits = await getRecentCommits(3);

      expect(commits).toEqual(["feat: real feature"]);
    });

    it("handles merge commit body extraction", async () => {
      gitMocks.mockExecuteCommand.mockResolvedValue({
        stdout: "Merge pull request #123 from feature|feat: add new feature",
        stderr: "",
      });

      const { getRecentCommits } = await import("../../src/utils/git-utils.js");
      const commits = await getRecentCommits(1);

      expect(commits).toEqual(["feat: add new feature"]);
    });
  });

  describe("getGitContext", () => {
    it("returns full git context", async () => {
      gitMocks.mockExecuteCommand
        .mockResolvedValueOnce({ stdout: "file1.ts\nfile2.js\n", stderr: "" }) // getStagedFiles
        .mockResolvedValueOnce({ stdout: "main\n", stderr: "" }) // getCurrentBranch
        .mockResolvedValueOnce({ stdout: "feat: add (#123)|\n", stderr: "" }) // getRecentCommits - strategy 1
        .mockResolvedValueOnce({ stdout: "fix: bug|Alice|\n", stderr: "" }) // getRecentCommits - strategy 2
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // getRecentCommits - strategy 3
        .mockResolvedValueOnce({ stdout: "diff content", stderr: "" }); // getStagedDifference

      const { getGitContext } = await import("../../src/utils/git-utils.js");
      const context = await getGitContext();

      expect(context).toEqual({
        stagedFiles: ["file1.ts", "file2.js"],
        branch: "main",
        difference: "[REDACTED] diff content",
        recentCommits: ["feat: add (#123)", "fix: bug"],
      });
    });

    it("handles context with redaction disabled", async () => {
      gitMocks.mockExecuteCommand
        .mockResolvedValueOnce({ stdout: "file1.ts\nfile2.js", stderr: "" }) // getStagedFiles
        .mockResolvedValueOnce({ stdout: "main", stderr: "" }) // getCurrentBranch
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // getRecentCommits - getMergeCommits
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // getRecentCommits - getDiverseCommits
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // getRecentCommits - getFallbackCommits
        .mockResolvedValueOnce({ stdout: "sensitive diff content", stderr: "" }); // getStagedDifference

      const { getGitContext } = await import("../../src/utils/git-utils.js");
      const context = await getGitContext(false);

      expect(context.difference).toBe("sensitive diff content");
      expect(context.difference).not.toContain("[REDACTED]");
    });

    it("handles empty recent commits gracefully", async () => {
      gitMocks.mockExecuteCommand
        .mockResolvedValueOnce({ stdout: "file1.ts", stderr: "" }) // getStagedFiles
        .mockResolvedValueOnce({ stdout: "main", stderr: "" }) // getCurrentBranch
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // getRecentCommits - getMergeCommits
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // getRecentCommits - getDiverseCommits
        .mockResolvedValueOnce({ stdout: "", stderr: "" }) // getRecentCommits - getFallbackCommits
        .mockResolvedValueOnce({ stdout: "diff", stderr: "" }); // getStagedDifference

      const { getGitContext } = await import("../../src/utils/git-utils.js");
      const context = await getGitContext();

      expect(context.recentCommits).toBeUndefined();
    });
  });
});
