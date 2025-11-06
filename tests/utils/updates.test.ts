import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import * as https from "node:https";
import { IncomingMessage } from "node:http";
import { checkForUpdates } from "../../src/utils/updates.js";
import { ensureConfigurationDirectory } from "../../src/utils/config.js";
import { message } from "../../src/utils/ui-utils.js";
import { FILE_SYSTEM } from "../../src/constants.js";
import { join } from "node:path";

vi.mock("node:fs");
vi.mock("node:https");
vi.mock("../../src/utils/config.js");
vi.mock("../../src/utils/ui-utils.js");
vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string, params?: Record<string, string>) => {
    if (key === "updates.available" && params) {
      return `Update available: v${params.currentVersion} → v${params.latestVersion} run ${params.command}`;
    }
    return key;
  }),
}));

const CACHE_FILE_PATH = join(FILE_SYSTEM.CONFIG_DIRECTORY, "updates.json");

interface MockResponse {
  statusCode: number;
  on: ReturnType<typeof vi.fn>;
}

interface MockRequest {
  on: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

describe("utils/updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ensureConfigurationDirectory).mockResolvedValue();
    vi.mocked(message).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkForUpdates", () => {
    it("should perform initial check when no cache exists", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const mockResponse: MockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === "data") {
            handler('{"version": "1.0.1"}');
          } else if (event === "end") {
            handler();
          }
        }),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      vi.mocked(fs.writeFile).mockResolvedValue();

      await checkForUpdates("1.0.0");

      expect(https.get).toHaveBeenCalledWith(
        "https://registry.npmjs.org/cmai/latest",
        expect.any(Function)
      );

      expect(fs.writeFile).toHaveBeenCalledWith(
        CACHE_FILE_PATH,
        expect.stringContaining('"latestVersion": "1.0.1"')
      );

      expect(message).toHaveBeenCalledWith(
        "Update available: v1.0.0 → v1.0.1 run npm install -g cmai@latest",
        { type: "error", variant: "title" }
      );
    });

    it("should not show notification when current version is up to date", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const mockResponse: MockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === "data") {
            handler('{"version": "1.0.0"}');
          } else if (event === "end") {
            handler();
          }
        }),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      vi.mocked(fs.writeFile).mockResolvedValue();

      await checkForUpdates("1.0.0");

      expect(message).not.toHaveBeenCalled();
    });

    it("should use cached data when check interval has not passed", async () => {
      const cache = {
        lastChecked: Date.now() - 1000 * 60 * 60, // 1 hour ago
        latestVersion: "1.0.1",
        notified: true,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(cache));

      await checkForUpdates("1.0.0");

      expect(https.get).not.toHaveBeenCalled();
      expect(message).not.toHaveBeenCalled();
    });

    it("should check again when cache interval has passed", async () => {
      const cache = {
        lastChecked: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        latestVersion: "1.0.0",
        notified: false,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(cache));

      const mockResponse: MockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === "data") {
            handler('{"version": "1.0.1"}');
          } else if (event === "end") {
            handler();
          }
        }),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      vi.mocked(fs.writeFile).mockResolvedValue();

      await checkForUpdates("1.0.0");

      expect(https.get).toHaveBeenCalled();
      expect(message).toHaveBeenCalled();
    });

    it("should handle network errors gracefully", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const mockRequest: MockRequest = {
        on: vi.fn((event, handler) => {
          if (event === "error") {
            handler(new Error("Network error"));
          }
        }),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation(() => {
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      await expect(checkForUpdates("1.0.0")).resolves.not.toThrow();
      expect(message).not.toHaveBeenCalled();
    });

    it("should handle invalid JSON responses gracefully", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const mockResponse: MockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === "data") {
            handler("invalid json");
          } else if (event === "end") {
            handler();
          }
        }),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      await expect(checkForUpdates("1.0.0")).resolves.not.toThrow();
      expect(message).not.toHaveBeenCalled();
    });

    it("should handle non-200 status codes gracefully", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const mockResponse: MockResponse = {
        statusCode: 404,
        on: vi.fn(),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      await expect(checkForUpdates("1.0.0")).resolves.not.toThrow();
      expect(message).not.toHaveBeenCalled();
    });

    it("should handle timeout gracefully", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      let timeoutCallback: (() => void) | null = null;

      vi.spyOn(globalThis, "setTimeout").mockImplementation((callback: unknown) => {
        if (typeof callback === "function") {
          timeoutCallback = callback as () => void;
        }
        return {} as unknown as ReturnType<typeof setTimeout>;
      });

      vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => {});

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation(() => {
        if (timeoutCallback) {
          timeoutCallback();
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      await expect(checkForUpdates("1.0.0")).resolves.not.toThrow();
      expect(message).not.toHaveBeenCalled();
    });

    it("should compare versions correctly", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const testCases = [
        { current: "1.0.0", latest: "1.0.1", shouldNotify: true },
        { current: "1.0.0", latest: "1.0.0", shouldNotify: false },
        { current: "1.0.1", latest: "1.0.0", shouldNotify: false },
        { current: "1.0.0", latest: "2.0.0", shouldNotify: true },
        { current: "1.2.3", latest: "1.2.4", shouldNotify: true },
        { current: "1.2.3", latest: "1.3.0", shouldNotify: true },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const mockResponse: MockResponse = {
          statusCode: 200,
          on: vi.fn((event, handler) => {
            if (event === "data") {
              handler(JSON.stringify({ version: testCase.latest }));
            } else if (event === "end") {
              handler();
            }
          }),
        };

        const mockRequest: MockRequest = {
          on: vi.fn(),
          end: vi.fn(),
        };

        vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
          const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
          if (callback) {
            callback(mockResponse as unknown as IncomingMessage);
          }
          return mockRequest as unknown as ReturnType<typeof https.get>;
        });

        vi.mocked(fs.writeFile).mockResolvedValue();

        await checkForUpdates(testCase.current);

        if (testCase.shouldNotify) {
          expect(message).toHaveBeenCalled();
        } else {
          expect(message).not.toHaveBeenCalled();
        }
      }
    });

    it("should show notification for cached update that hasn't been notified", async () => {
      const cache = {
        lastChecked: Date.now() - 1000 * 60 * 60,
        latestVersion: "1.0.1",
        notified: false,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(cache));
      vi.mocked(fs.writeFile).mockResolvedValue();

      await checkForUpdates("1.0.0");

      expect(https.get).not.toHaveBeenCalled();
      expect(message).toHaveBeenCalled();

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeCall?.[1]).toContain('"notified": true');
    });

    it("should detect npm package manager by default", async () => {
      delete process.env.npm_config_user_agent;

      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
      const mockResponse: MockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === "data") {
            handler('{"version": "1.0.1"}');
          } else if (event === "end") {
            handler();
          }
        }),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      vi.mocked(fs.writeFile).mockResolvedValue();

      await checkForUpdates("1.0.0");

      const messageCalls = vi.mocked(message).mock.calls;
      const updateMessage = messageCalls.find(
        (call) => typeof call[0] === "string" && call[0].includes("npm install -g cmai@latest")
      );
      expect(updateMessage).toBeDefined();
      expect(updateMessage?.[1]).toEqual({ type: "error", variant: "title" });
    });

    it("should detect yarn package manager", async () => {
      process.env.npm_config_user_agent = "yarn/1.22.0 npm/? node/v14.0.0";

      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
      const mockResponse: MockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === "data") {
            handler('{"version": "1.0.1"}');
          } else if (event === "end") {
            handler();
          }
        }),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      vi.mocked(fs.writeFile).mockResolvedValue();

      await checkForUpdates("1.0.0");

      const messageCalls = vi.mocked(message).mock.calls;
      const updateMessage = messageCalls.find(
        (call) => typeof call[0] === "string" && call[0].includes("yarn global add cmai@latest")
      );
      expect(updateMessage).toBeDefined();
      expect(updateMessage?.[1]).toEqual({ type: "error", variant: "title" });
    });

    it("should detect pnpm package manager", async () => {
      process.env.npm_config_user_agent = "pnpm/6.0.0 npm/? node/v14.0.0";

      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
      const mockResponse: MockResponse = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === "data") {
            handler('{"version": "1.0.1"}');
          } else if (event === "end") {
            handler();
          }
        }),
      };

      const mockRequest: MockRequest = {
        on: vi.fn(),
        end: vi.fn(),
      };

      vi.mocked(https.get).mockImplementation((...args: unknown[]) => {
        const callback = args.find((arg) => typeof arg === "function") as ((res: IncomingMessage) => void) | undefined;
        if (callback) {
          callback(mockResponse as unknown as IncomingMessage);
        }
        return mockRequest as unknown as ReturnType<typeof https.get>;
      });

      vi.mocked(fs.writeFile).mockResolvedValue();

      await checkForUpdates("1.0.0");

      const messageCalls = vi.mocked(message).mock.calls;
      const updateMessage = messageCalls.find(
        (call) => typeof call[0] === "string" && call[0].includes("pnpm add -g cmai@latest")
      );
      expect(updateMessage).toBeDefined();
      expect(updateMessage?.[1]).toEqual({ type: "error", variant: "title" });
    });
  });
});
