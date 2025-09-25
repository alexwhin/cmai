import { vi, expect } from "vitest";
import { GitContext } from "../src/types/index.js";
export function mockPlatform(platform: string) {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
  return () => {
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  };
}

export function createMockFetchResponse(
  data: unknown,
  options: {
    ok?: boolean;
    status?: number;
    statusText?: string;
  } = {}
): unknown {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? "OK",
    json: vi.fn().mockResolvedValue(data),
  };
}

export function setupGitContext(overrides?: Partial<GitContext>): GitContext {
  return {
    stagedFiles: ["src/index.ts", "src/utils.ts"],
    branch: "main",
    difference: "diff content here",
    recentCommits: ["feat: add feature", "fix: resolve bug"],
    regenerationAttempts: 0,
    ...overrides,
  };
}

export const TRUNCATION_LIMIT = 3000;
export const DEFAULT_COMMIT_LIMIT = 10;
export const MAX_COMMIT_LENGTH_DEFAULT = 72;
export const COMMIT_CHOICES_COUNT_DEFAULT = 5;

export function setupSystemUtilsMocks() {
  const mockExecFilePromise = vi.fn();
  const mockExecCommand = vi.fn();
  const mockExecSync = vi.fn();
  
  vi.doMock("node:child_process", () => ({
    exec: vi.fn((cmd: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
      mockExecCommand(cmd, callback);
    }),
    execFile: vi.fn(),
    execSync: mockExecSync,
  }));
  
  vi.doMock("node:util", () => ({
    promisify: vi.fn(() => mockExecFilePromise),
  }));
  
  return {
    mockExecFilePromise,
    mockExecCommand,
    mockExecSync,
    cleanup: () => {
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    },
  };
}

export function mockFetchSuccess(data: unknown) {
  const mockResponse = createMockFetchResponse(data);
  vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as globalThis.Response);
  return mockResponse;
}

export function mockFetchError(status: number, statusText: string, data: unknown = {}) {
  const mockResponse = createMockFetchResponse(data, { ok: false, status, statusText });
  vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse as unknown as globalThis.Response);
  return mockResponse;
}

export function mockFetch401() {
  return mockFetchError(401, "Unauthorized");
}

export function mockFetch404() {
  return mockFetchError(404, "Not Found");
}

export function mockFetch500() {
  return mockFetchError(500, "Internal Server Error");
}

export function setupGitMocks() {
  const mockExecuteCommand = vi.fn();
  const mockExecFilePromise = vi.fn();
  
  vi.doMock("node:child_process", () => ({
    exec: vi.fn(),
    execFile: vi.fn(),
  }));
  
  vi.doMock("node:util", () => ({
    promisify: vi.fn(() => mockExecuteCommand),
  }));
  
  return {
    mockExecuteCommand,
    mockExecFilePromise,
    mockGitCommand: (stdout: string, stderr = "") => ({ stdout, stderr }),
    cleanup: () => {
      vi.doUnmock("node:child_process");
      vi.doUnmock("node:util");
    },
  };
}

export const TEST_MODELS = {
  openai: {
    gpt4o: { id: "gpt-4o", created: 1234567890 },
    gpt4turbo: { id: "gpt-4-turbo", created: 1234567890 },
    gpt35turbo: { id: "gpt-3.5-turbo", created: 1234567890 },
  },
  anthropic: {
    claude35Sonnet: { id: "claude-3-5-sonnet-20241022", display_name: "Claude 3.5 Sonnet" },
    claude3Opus: { id: "claude-3-opus-20240229", display_name: "Claude 3 Opus" },
    claude3Haiku: { id: "claude-3-haiku-20240307", display_name: "Claude 3 Haiku" },
  },
  ollama: {
    llama2: { name: "llama2", size: "3.8GB", digest: "abc123" },
    codellama: { name: "codellama", size: "4.0GB", digest: "def456" },
  },
  gemini: {
    gemini15Pro: { name: "models/gemini-1.5-pro", displayName: "Gemini 1.5 Pro" },
    gemini15Flash: { name: "models/gemini-1.5-flash", displayName: "Gemini 1.5 Flash" },
  },
};

export function withEnvVar<T>(key: string, value: string | undefined, fn: () => T): T {
  const original = process.env[key];
  process.env[key] = value;
  try {
    return fn();
  } finally {
    if (original !== undefined) {
      process.env[key] = original;
    } else {
      delete process.env[key];
    }
  }
}

export function resetAllMocks(...mocks: Array<ReturnType<typeof vi.fn>>) {
  vi.clearAllMocks();
  mocks.forEach(mock => mock.mockReset());
}

export function expectNoSuitableModelsError(promise: Promise<unknown>, provider?: string) {
  const message = provider ? `No suitable models found for ${provider}` : "No suitable models found";
  return expect(promise).rejects.toThrow(message);
}

export function expectAuthenticationError(promise: Promise<unknown>) {
  return expect(promise).rejects.toThrow("Authentication failed");
}

export function expectNetworkError(promise: Promise<unknown>) {
  return expect(promise).rejects.toThrow("Network error");
}

export function expectTimeoutError(promise: Promise<unknown>) {
  return expect(promise).rejects.toThrow("Request timed out");
}
