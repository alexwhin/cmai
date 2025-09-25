import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockPlatform } from "../test-helpers.js";

const mockExecFilePromise = vi.fn();

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));
vi.mock("node:util", () => ({
  promisify: vi.fn(() => mockExecFilePromise),
}));

describe("system-utils", () => {
  let restorePlatform: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFilePromise.mockReset();
  });

  afterEach(() => {
    if (restorePlatform) {
      restorePlatform();
      restorePlatform = undefined;
    }
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
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | pbcopy'],
        { shell: false, windowsHide: true }
      );
    });

    it("copies text successfully on Windows", async () => {
      restorePlatform = mockPlatform("win32");
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      const base64Text = Buffer.from("test text").toString("base64");
      expect(mockExecFilePromise).toHaveBeenCalledWith(
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
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | xclip -selection clipboard'],
        { shell: false, windowsHide: true }
      );
    });

    it("handles command execution failure", async () => {
      restorePlatform = mockPlatform("darwin");
      mockExecFilePromise.mockRejectedValue(new Error("Command failed"));

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test")).rejects.toThrow("Failed to copy to clipboard");
    });

    it("handles special characters correctly", async () => {
      restorePlatform = mockPlatform("darwin");
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");
      const specialText = 'Text with "quotes" and $variables';

      await expect(copyToClipboard(specialText)).resolves.toBeUndefined();
    });

    it("handles multiline text", async () => {
      restorePlatform = mockPlatform("darwin");
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");
      const multilineText = "Line 1\nLine 2\nLine 3";

      await expect(copyToClipboard(multilineText)).resolves.toBeUndefined();
    });

    it("uses fallback methods on Linux when primary method fails", async () => {
      restorePlatform = mockPlatform("linux");
      mockExecFilePromise
        .mockRejectedValueOnce(new Error("xclip not found"))
        .mockResolvedValueOnce({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
    });

    it("throws error when all methods fail", async () => {
      restorePlatform = mockPlatform("linux");
      mockExecFilePromise.mockRejectedValue(new Error("All commands failed"));

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
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

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

  // Data Security (Redaction)
  describe("redactSensitiveData", () => {
    it("redacts email addresses with fingerprints", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("Contact: john@example.com");
      expect(result).toMatch(/^Contact: \[REDACTED_EMAIL:[0-9a-f]{8}\]$/);
    });

    it("redacts API keys with fingerprints", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("api_key=sk-1234567890abcdefghij");
      expect(result).toMatch(/^api_key=\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts OpenAI API keys", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("sk-1234567890abcdefghijklmnopqrstuvwxyz123456");
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts Anthropic API keys", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData(
        "sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456789012345678901234567890123456"
      );
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts AWS access keys", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("AKIAIOSFODNN7EXAMPLE");
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts Google API keys", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI");
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts GitHub tokens", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("ghp_1234567890abcdefghijklmnopqrstuvwxyz123");
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts JWT tokens", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const result = redactSensitiveData(jwt);
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts passwords in URLs", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("postgres://user:password123@localhost:5432/db");
      expect(result).toMatch(/postgres:\/\/user:\[REDACTED:[0-9a-f]{8}\]@localhost:5432\/db/);
    });

    it("redacts private keys", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const privateKey =
        "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----";
      const result = redactSensitiveData(privateKey);
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts SSH private keys", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const sshKey =
        "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABFwAAAAdzc2gtcn...\n-----END OPENSSH PRIVATE KEY-----";
      const result = redactSensitiveData(sshKey);
      expect(result).toMatch(/^\[REDACTED:[0-9a-f]{8}\]$/);
    });

    it("redacts credit card numbers", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("Credit card: 4532-1234-5678-9012");
      expect(result).toMatch(/Credit card: \[REDACTED:[0-9a-f]{8}\]/);
    });

    it("redacts social security numbers", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("SSN: 123-45-6789");
      expect(result).toMatch(/SSN: \[REDACTED:[0-9a-f]{8}\]/);
    });

    it("redacts phone numbers", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("Call me at +1-555-123-4567");
      expect(result).toMatch(/Call me at \[REDACTED:[0-9a-f]{8}\]/);
    });

    it("redacts IP addresses", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("Server at 192.168.1.1");
      expect(result).toMatch(/Server at \[REDACTED:[0-9a-f]{8}\]/);
    });

    it("redacts multiple sensitive items", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const input = "API key: sk-1234567890 and email: user@example.com";
      const result = redactSensitiveData(input);
      expect(result).toMatch(
        /API key: \[REDACTED:[0-9a-f]{8}\] and email: \[REDACTED_EMAIL:[0-9a-f]{8}\]/
      );
    });

    it("preserves non-sensitive data", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const input = "This is a normal message with no sensitive data.";
      const result = redactSensitiveData(input);
      expect(result).toBe(input);
    });

    it("handles empty strings", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      expect(redactSensitiveData("")).toBe("");
    });

    it("handles null and undefined", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      expect(redactSensitiveData(null as unknown as string)).toBe("");
      expect(redactSensitiveData(undefined as unknown as string)).toBe("");
    });

    it("redacts Base64 encoded secrets", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const base64Secret = "c2VjcmV0X2tleV8xMjM0NTY3ODkw"; // base64 encoded secret
      const result = redactSensitiveData(`token=${base64Secret}`);
      expect(result).toMatch(/token=\[REDACTED:[0-9a-f]{8}\]/);
    });

    it("redacts Docker registry credentials", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("docker login -u user -p secret123 registry.com");
      expect(result).toMatch(/docker login -u user -p \[REDACTED:[0-9a-f]{8}\] registry\.com/);
    });

    it("generates consistent fingerprints for same input", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const input = "sk-1234567890abcdefghij";
      const result1 = redactSensitiveData(input);
      const result2 = redactSensitiveData(input);
      expect(result1).toBe(result2);
    });

    it("generates different fingerprints for different inputs", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result1 = redactSensitiveData("sk-1234567890abcdefghij");
      const result2 = redactSensitiveData("sk-abcdefghij1234567890");
      expect(result1).not.toBe(result2);
    });

    it("redacts database connection strings", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const connString = "mongodb://username:password@localhost:27017/database";
      const result = redactSensitiveData(connString);
      expect(result).toMatch(
        /mongodb:\/\/username:\[REDACTED:[0-9a-f]{8}\]@localhost:27017\/database/
      );
    });

    it("redacts secrets in environment variable format", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const result = redactSensitiveData("export SECRET_KEY=super_secret_value_123");
      expect(result).toMatch(/export SECRET_KEY=\[REDACTED_SECRET:[0-9a-f]{8}\]/);
    });

    it("preserves structure while redacting content", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const json = '{"apiKey": "sk-1234567890", "email": "user@example.com"}';
      const result = redactSensitiveData(json);
      expect(result).toMatch(
        /\{"apiKey": "\[REDACTED:[0-9a-f]{8}\]", "email": "\[REDACTED_EMAIL:[0-9a-f]{8}\]"\}/
      );
    });

    it("handles malformed or partial patterns", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const input = "sk- incomplete key and partial@email";
      const result = redactSensitiveData(input);
      // Should not redact incomplete patterns
      expect(result).toBe(input);
    });

    it("tests IPv6 patterns and validation", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      
      // Test that most IPv6 addresses are preserved (not redacted)
      const ipv6 = "2001:db8:85a3:8d3:1319:8a2e:370:7334";
      const result = redactSensitiveData(ipv6);
      expect(result).toBe(ipv6); // Should be preserved as is
      
      // Test that IPv6 patterns with colon-port are preserved
      const ipv6WithColonPort = "2001:db8::1:8080";
      const resultWithPort = redactSensitiveData(ipv6WithColonPort);
      expect(resultWithPort).toBe(ipv6WithColonPort);
    });

    it("preserves local IPv6 addresses", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const localIpv6 = "fe80::1";
      const result = redactSensitiveData(localIpv6);
      expect(result).toBe(localIpv6); // Should not redact local addresses
    });

    it("preserves loopback IPv6 addresses", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const loopback = "::1";
      const result = redactSensitiveData(loopback);
      expect(result).toBe(loopback); // Should not redact loopback
    });

    it("handles IPv6 with ports correctly", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const ipv6WithPort = "2001:db8:85a3:8d3:1319:8a2e:370:7348:8080";
      const result = redactSensitiveData(ipv6WithPort);
      expect(result).toBe(ipv6WithPort); // Should not redact when has port pattern
    });

    it("handles invalid JWT tokens", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const invalidJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid";
      const result = redactSensitiveData(invalidJwt);
      expect(result).toBe(invalidJwt); // Should not redact invalid JWT
    });

    it("handles non-string inputs to redaction", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      expect(redactSensitiveData(null as unknown as string)).toBe("");
      expect(redactSensitiveData(undefined as unknown as string)).toBe("");
      expect(redactSensitiveData(123 as unknown as string)).toBe("");
    });

    it("handles empty string redaction", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      expect(redactSensitiveData("")).toBe("");
    });

    it("handles Windows apostrophe escaping", async () => {
      restorePlatform = mockPlatform("win32");
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");
      const textWithApostrophes = "It's a test's text";

      await expect(copyToClipboard(textWithApostrophes)).resolves.toBeUndefined();
      const base64Text = Buffer.from(textWithApostrophes).toString("base64");
      expect(mockExecFilePromise).toHaveBeenCalledWith(
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
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | xclip -selection clipboard'],
        { shell: false, windowsHide: true }
      );
    });

    it("handles OpenBSD platform for clipboard", async () => {
      restorePlatform = mockPlatform("openbsd");
      mockExecFilePromise.mockResolvedValue({ stdout: "", stderr: "" });

      const { copyToClipboard } = await import("../../src/utils/system-utils.js");

      await expect(copyToClipboard("test text")).resolves.toBeUndefined();
      expect(mockExecFilePromise).toHaveBeenCalledWith(
        "/bin/sh",
        ["-c", 'printf \'%s\' "test text" | xclip -selection clipboard'],
        { shell: false, windowsHide: true }
      );
    });

    it("handles aggregate errors in clipboard operations", async () => {
      restorePlatform = mockPlatform("linux");
      mockExecFilePromise.mockRejectedValue(new Error("Command failed"));

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

      // Should not actually schedule exit in VITEST environment
      expect(() => exit(0)).not.toThrow();

      // Restore
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

    it("handles low entropy strings in redaction", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const lowEntropy = "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"; // Low entropy, should not be redacted
      const result = redactSensitiveData(lowEntropy);
      expect(result).toBe(lowEntropy);
    });

    it("handles short strings in entropy check", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const shortString = "abc"; // Below minimum length for entropy check
      const result = redactSensitiveData(shortString);
      expect(result).toBe(shortString);
    });

    it("redacts UUIDs correctly", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = redactSensitiveData(uuid);
      expect(result).toMatch(/\[REDACTED_UUID:[0-9a-f]{8}\]/);
    });

    it("handles string replacement with function error gracefully", async () => {
      const { redactSensitiveData } = await import("../../src/utils/system-utils.js");
      // This tests the try-catch block in redaction where replacement might throw
      const input = "test sk-1234567890abcdefghijklmnopqrstuvwxyz123456 string";
      const result = redactSensitiveData(input);
      expect(result).toMatch(/\[REDACTED:[0-9a-f]{8}\]/);
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
