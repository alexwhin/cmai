import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPlatform, setupSystemUtilsMocks, resetAllMocks } from "../test-helpers.js";

describe("system-utils", () => {
  let restorePlatform: (() => void) | undefined;
  let systemMocks: ReturnType<typeof setupSystemUtilsMocks>;
  
  beforeEach(() => {
    systemMocks = setupSystemUtilsMocks();
    resetAllMocks(systemMocks.mockExecFilePromise, systemMocks.mockExecCommand, systemMocks.mockExecSync);
  });

  afterEach(() => {
    if (restorePlatform) {
      restorePlatform();
      restorePlatform = undefined;
    }
    systemMocks.cleanup();
    vi.resetModules();
  });

  // Clipboard Operations
  describe("copyToClipboard", () => {
    it("throws ClipboardError for non-string input", async () => {
      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      // @ts-expect-error Testing runtime validation
      await expect(copyToClipboard(123)).rejects.toThrow("Text must be a string");
      // @ts-expect-error Testing runtime validation
      await expect(copyToClipboard(null)).rejects.toThrow("Text must be a string");
      // @ts-expect-error Testing runtime validation
      await expect(copyToClipboard(undefined)).rejects.toThrow("Text must be a string");
    });

    it("throws error for empty string", async () => {
      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("")).rejects.toThrow("Cannot copy empty text");
      await expect(copyToClipboard("   ")).rejects.toThrow("Cannot copy empty text");
    });

    it("copies text successfully on macOS", async () => {
      restorePlatform = mockPlatform("darwin");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(systemMocks.mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | pbcopy'],
        { shell: false, windowsHide: true }
      );
    });

    it("copies text successfully on Windows", async () => {
      restorePlatform = mockPlatform("win32");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      const base64Text = Buffer.from("test text").toString("base64");
      expect(systemMocks.mockExecFilePromise).toHaveBeenCalledWith(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64Text}')) | Set-Clipboard`
        ],
        { shell: false, windowsHide: true }
      );
    });

    it("copies text successfully on Linux with xclip", async () => {
      restorePlatform = mockPlatform("linux");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(systemMocks.mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | xclip -selection clipboard'],
        { shell: false, windowsHide: true }
      );
    });

    it("handles command execution failure", async () => {
      restorePlatform = mockPlatform("darwin");
      systemMocks.mockExecFilePromise.mockRejectedValue(new Error("Command failed"));

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test")).rejects.toThrow("Failed to copy to clipboard");
    });

    it("handles special characters correctly", async () => {
      restorePlatform = mockPlatform("darwin");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");
      const specialText = 'Text with "quotes" and $variables';

      await expect(copyToClipboard(specialText)).resolves.toBeUndefined();
    });

    it("handles multiline text", async () => {
      restorePlatform = mockPlatform("darwin");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");
      const multilineText = "Line 1\nLine 2\nLine 3";

      await expect(copyToClipboard(multilineText)).resolves.toBeUndefined();
    });

    it("uses fallback methods on Linux when primary method fails", async () => {
      restorePlatform = mockPlatform("linux");
      systemMocks.mockExecFilePromise
        .mockRejectedValueOnce(new Error("xclip not found"))
        .mockResolvedValueOnce({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
    });

    it("throws error when all methods fail", async () => {
      restorePlatform = mockPlatform("linux");
      systemMocks.mockExecFilePromise.mockRejectedValue(new Error("All commands failed"));

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test")).rejects.toThrow();
    });

    it("throws error for unsupported platform", async () => {
      restorePlatform = mockPlatform("aix");

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test")).rejects.toThrow("Unsupported platform: aix");
    });

    it("handles very long text", async () => {
      restorePlatform = mockPlatform("darwin");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");
      const longText = "x".repeat(10000);

      await expect(copyToClipboard(longText)).resolves.toBeUndefined();
    });
  });

  // Process Management
  describe("exit", () => {
    let originalNodeEnv: string | undefined;
    let originalExit: typeof process.exit;
    const mockExit = vi.fn(() => {
      throw new Error("process.exit called");
    });

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
      originalExit = process.exit;
      process.exit = mockExit as never;
    });

    afterEach(async () => {
      process.env.NODE_ENV = originalNodeEnv;
      process.exit = originalExit;
      mockExit.mockClear();

      const { resetExitSchedule } = await import("../../src/utils/system-utils.js");
      resetExitSchedule();
    });

    it("throws SystemError in test environment for non-zero exit codes", async () => {
      process.env.NODE_ENV = "test";

      const { exit } = await import("../../src/utils/system-utils.js");

      expect(() => exit(1)).toThrow("Process would exit with code 1");
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("does not throw in test environment for zero exit code", async () => {
      process.env.NODE_ENV = "test";

      const { exit } = await import("../../src/utils/system-utils.js");

      expect(() => exit(0)).not.toThrow();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it("prevents duplicate exit scheduling", async () => {
      process.env.NODE_ENV = "production";

      const { exit, isExitScheduled } = await import("../../src/utils/system-utils.js");

      exit(0);
      expect(isExitScheduled()).toBe(true);

      // Second call should be ignored
      exit(1);
      // Should still be scheduled for exit code 0
    });

    it("allows exit scheduling after reset", async () => {
      process.env.NODE_ENV = "production";

      const { exit, isExitScheduled, resetExitSchedule } = await import(
        "../../src/utils/system-utils.js"
      );

      exit(0);
      expect(isExitScheduled()).toBe(true);

      resetExitSchedule();
      expect(isExitScheduled()).toBe(false);

      // Should be able to schedule again
      exit(1);
      expect(isExitScheduled()).toBe(true);
    });

    it("uses default exit code of 0", async () => {
      process.env.NODE_ENV = "test";

      const { exit } = await import("../../src/utils/system-utils.js");

      expect(() => exit()).not.toThrow();
    });

    it("handles graceful shutdown in production", async () => {
      process.env.NODE_ENV = "production";

      const { exit } = await import("../../src/utils/system-utils.js");

      expect(() => exit(0)).not.toThrow();
      // In production, this would schedule a graceful shutdown
    });

    it("reports exit scheduling status correctly", async () => {
      const { isExitScheduled, resetExitSchedule } = await import(
        "../../src/utils/system-utils.js"
      );

      expect(isExitScheduled()).toBe(false);
      resetExitSchedule();
      expect(isExitScheduled()).toBe(false);
    });
  });

  describe("redactSensitiveData", () => {
    it("redacts sensitive data with fingerprinted tokens", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("Contact: john@example.com");
      expect(result).toContain("[REDACTED:");
      expect(result).toMatch(/\[REDACTED:[0-9a-f]{8}\]/);
      expect(result).not.toContain("john@example.com");
    });

    it("generates consistent fingerprints for same input", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const input = "sk-1234567890abcdefghij";
      const result1 = redactSensitiveData(input);
      const result2 = redactSensitiveData(input);
      expect(result1).toBe(result2);
    });

    it("preserves non-sensitive data", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const input = "This is a normal message with no sensitive data.";
      const result = redactSensitiveData(input);
      expect(result).toBe(input);
    });

    it("handles empty and invalid inputs", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      expect(redactSensitiveData("")).toBe("");
      expect(redactSensitiveData(null as unknown as string)).toBe("");
      expect(redactSensitiveData(undefined as unknown as string)).toBe("");
      expect(redactSensitiveData(123 as unknown as string)).toBe("");
    });

    it("handles Windows apostrophe escaping", async () => {
      restorePlatform = mockPlatform("win32");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");
      const textWithApostrophes = "It's a test's text";

      await expect(copyToClipboard(textWithApostrophes)).resolves.toBeUndefined();
      const base64Text = Buffer.from(textWithApostrophes).toString("base64");
      expect(systemMocks.mockExecFilePromise).toHaveBeenCalledWith(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${base64Text}')) | Set-Clipboard`
        ],
        { shell: false, windowsHide: true }
      );
    });

    it("handles FreeBSD platform for clipboard", async () => {
      restorePlatform = mockPlatform("freebsd");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(systemMocks.mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | xclip -selection clipboard'],
        { shell: false, windowsHide: true }
      );
    });

    it("handles OpenBSD platform for clipboard", async () => {
      restorePlatform = mockPlatform("openbsd");
      systemMocks.mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(systemMocks.mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | xclip -selection clipboard'],
        { shell: false, windowsHide: true }
      );
    });

    it("handles aggregate errors in clipboard operations", async () => {
      restorePlatform = mockPlatform("linux");
      systemMocks.mockExecFilePromise.mockRejectedValue(new Error("Command failed"));

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test")).rejects.toThrow(/Failed to copy/);
    });

    it("skips VITEST environment in scheduleProcessExit", async () => {
      const originalVitest = globalThis.process?.env?.VITEST;
      if (globalThis.process?.env) {
        globalThis.process.env.VITEST = "true";
      }

      process.env.NODE_ENV = "production";

      const { exit } = await import("../../src/utils/system-utils.js");

      expect(() => exit(0)).not.toThrow();

      if (originalVitest !== undefined) {
        if (globalThis.process?.env) {
          globalThis.process.env.VITEST = originalVitest;
        }
      } else {
        if (globalThis.process?.env) {
          delete globalThis.process.env.VITEST;
        }
      }
    });
  });

  describe("getPackageVersion", () => {
    const mockReadFileSync = vi.fn();
    
    beforeEach(() => {
      vi.doMock("node:fs", () => ({
        readFileSync: mockReadFileSync,
      }));
    });

    afterEach(() => {
      vi.doUnmock("node:fs");
    });

    it("returns version from valid package.json", async () => {
      const validPackageJson = JSON.stringify({ version: "1.2.3", name: "test-package" });
      mockReadFileSync.mockReturnValue(validPackageJson);
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("1.2.3");
      expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining("package.json"), "utf-8");
    });

    it("returns fallback version for invalid JSON", async () => {
      mockReadFileSync.mockReturnValue("{ invalid json");
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("0.2.1");
    });

    it("returns fallback version for missing version field", async () => {
      const packageJsonWithoutVersion = JSON.stringify({ name: "test-package" });
      mockReadFileSync.mockReturnValue(packageJsonWithoutVersion);
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("0.2.1");
    });

    it("returns fallback version for non-string version", async () => {
      const packageJsonWithInvalidVersion = JSON.stringify({ version: 123 });
      mockReadFileSync.mockReturnValue(packageJsonWithInvalidVersion);
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("0.2.1");
    });

    it("returns correct version when package.json is in current working directory", async () => {
      const cwdPackageJson = JSON.stringify({ name: "cmai", version: "1.0.0" });
      const cwd = process.cwd();
      mockReadFileSync.mockImplementation((path: string) => {
        if (path === `${cwd}/package.json`) {
          return cwdPackageJson;
        }
        throw new Error("File not found");
      });
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("1.0.0");
    });

    it("returns fallback version when cwd package.json is invalid JSON", async () => {
      const cwd = process.cwd();
      mockReadFileSync.mockImplementation((path: string) => {
        if (path === `${cwd}/package.json`) {
          return "{ invalid json";
        }
        throw new Error("File not found");
      });
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("0.2.1");
    });

    it("returns fallback version when readFileSync fails", async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("0.2.1");
    });

    it("returns fallback version for non-object package.json", async () => {
      const nonObjectPackageJson = JSON.stringify("not an object");
      mockReadFileSync.mockReturnValue(nonObjectPackageJson);
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("0.2.1");
    });

    it("returns fallback version for array package.json", async () => {
      const arrayPackageJson = JSON.stringify(["not", "an", "object"]);
      mockReadFileSync.mockReturnValue(arrayPackageJson);
      
      const { getPackageVersion } = await import("../../src/utils/system-utils.js");
      const version = getPackageVersion();
      
      expect(version).toBe("0.2.1");
    });
  });
});
