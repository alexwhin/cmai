import { vi } from "vitest";
import { GitContext } from "../src/types/index.js";

// Platform mocking utilities
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

// Mock fetch response helper
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

// Test data helpers
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

// Constants for tests
export const TRUNCATION_LIMIT = 3000;
export const DEFAULT_COMMIT_LIMIT = 10;
export const MAX_COMMIT_LENGTH_DEFAULT = 72;
export const COMMIT_CHOICES_COUNT_DEFAULT = 5;
