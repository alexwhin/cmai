import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs, Stats } from "node:fs";
import {
  ensureConfigurationDirectory,
  saveConfiguration,
  configurationExists,
  getConfigurationWithEnvironmentOverrides,
  checkConfigFilePermissions,
  ensureConfigFilePermissions,
} from "../../src/utils/config.js";
import { Config, Provider, UsageMode } from "../../src/types/index.js";
import { message } from "../../src/utils/ui-utils.js";

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
    chmod: vi.fn(),
  },
}));

vi.mock("../../src/utils/ui-utils.js", () => ({
  message: vi.fn(),
}));

describe("config", () => {
  const mockConfiguration: Config = {
    provider: Provider.OPENAI,
    apiKey: "test-api-key",
    model: "gpt-4",
    maxCommitLength: 72,
    usageMode: UsageMode.CLIPBOARD,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {};
  });

  afterEach(() => {
    process.env = {};
  });

  describe("ensureConfigurationDirectory", () => {
    it("creates directory when it doesn't exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await ensureConfigurationDirectory();

      expect(fs.mkdir).toHaveBeenCalledWith(".cmai", { recursive: true });
    });

    it("does nothing when directory exists", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await ensureConfigurationDirectory();

      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe("configurationExists", () => {
    it("returns true when config file exists", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await configurationExists();

      expect(result).toBe(true);
    });

    it("returns false when config file doesn't exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      const result = await configurationExists();

      expect(result).toBe(false);
    });
  });

  describe("loadConfiguration", () => {
    it("loads configuration from file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfiguration));

      const { loadConfiguration } = await import("../../src/utils/config.js");
      const result = await loadConfiguration();

      expect(result).toEqual(mockConfiguration);
    });

    it("throws helpful error when file doesn't exist", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

      const { loadConfiguration } = await import("../../src/utils/config.js");
      await expect(loadConfiguration()).rejects.toThrow(
        "Configuration not found. Please run 'cmai init' to set up your configuration"
      );
    });

    it("throws error for invalid JSON", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("invalid json content");

      const { loadConfiguration } = await import("../../src/utils/config.js");
      await expect(loadConfiguration()).rejects.toThrow("Configuration file contains invalid JSON");
    });

    it("throws error for invalid config structure", async () => {
      const invalidConfig = { invalidField: "test" };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidConfig));

      const { loadConfiguration } = await import("../../src/utils/config.js");
      await expect(loadConfiguration()).rejects.toThrow("Configuration file has invalid structure");
    });

    it("filters out $schema field from configuration", async () => {
      const configWithSchema = {
        $schema: "https://example.com/schema.json",
        ...mockConfiguration,
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(configWithSchema));

      const { loadConfiguration } = await import("../../src/utils/config.js");
      const result = await loadConfiguration();

      expect(result).toEqual(mockConfiguration);
      expect((result as unknown as Record<string, unknown>).$schema).toBeUndefined();
    });

    it("migrates deprecated completionAction field", async () => {
      const configWithDeprecatedField = {
        ...mockConfiguration,
        completionAction: UsageMode.COMMIT,
        usageMode: undefined,
      };
      delete configWithDeprecatedField.usageMode;
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(configWithDeprecatedField));

      const { loadConfiguration } = await import("../../src/utils/config.js");
      const result = await loadConfiguration();

      expect(result.usageMode).toBe(UsageMode.COMMIT);
      expect(result.completionAction).toBeUndefined();
    });

    it("returns cached configuration on subsequent calls", async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfiguration));

      const { loadConfiguration } = await import("../../src/utils/config.js");

      const result1 = await loadConfiguration();
      const result2 = await loadConfiguration();

      expect(result1).toBe(result2);
      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });

    it("re-throws non-ENOENT errors", async () => {
      const customError = new Error("Permission denied");
      vi.mocked(fs.readFile).mockRejectedValue(customError);

      const { loadConfiguration } = await import("../../src/utils/config.js");
      await expect(loadConfiguration()).rejects.toThrow("Permission denied");
    });
  });

  describe("saveConfiguration", () => {
    it("saves configuration to file", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue("{}");

      await saveConfiguration(mockConfiguration);

      const expectedConfig = {
        $schema: "https://raw.githubusercontent.com/alexwhin/cmai/main/settings.schema.json",
        ...mockConfiguration,
      };

      expect(fs.writeFile).toHaveBeenCalledWith(
        ".cmai/settings.json",
        JSON.stringify(expectedConfig, null, 2),
        { mode: 0o600 }
      );
    });

    it("handles schema validation success", async () => {
      const validSchema = {
        type: "object",
        properties: {
          provider: { type: "string" },
          apiKey: { type: "string" },
          model: { type: "string" },
          maxCommitLength: { type: "number" },
          usageMode: { type: "string" },
        },
      };

      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validSchema))
        .mockResolvedValue("{}");

      await expect(saveConfiguration(mockConfiguration)).resolves.not.toThrow();
    });

    it("handles missing schema file gracefully", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.readFile)
        .mockRejectedValueOnce(new Error("Schema file not found"))
        .mockResolvedValue("{}");

      await expect(saveConfiguration(mockConfiguration)).resolves.not.toThrow();
    });

    it("handles invalid schema file gracefully", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValueOnce("invalid json schema").mockResolvedValue("{}");

      // Should not throw - invalid schema is handled gracefully
      await expect(saveConfiguration(mockConfiguration)).resolves.not.toThrow();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("updates cached configuration after successful save", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      vi.mocked(fs.readFile).mockResolvedValue("{}");

      // Save should update the cached configuration
      await saveConfiguration(mockConfiguration);

      // Verify the configuration was saved
      expect(fs.writeFile).toHaveBeenCalledWith(
        ".cmai/settings.json",
        expect.stringContaining('"provider"'),
        { mode: 0o600 }
      );
    });
  });

  describe("getConfigurationWithEnvironmentOverrides", () => {
    it("returns configuration unchanged when no environment variables set", () => {
      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result).toEqual(mockConfiguration);
    });

    it("overrides values from environment variables", () => {
      process.env.CMAI_API_KEY = "env-api-key";
      process.env.CMAI_MODEL = "gpt-3.5-turbo";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.apiKey).toBe("env-api-key");
      expect(result.model).toBe("gpt-3.5-turbo");
    });

    it("overrides usage mode from environment", () => {
      process.env.CMAI_USAGE_MODE = "COMMIT";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.usageMode).toBe(UsageMode.COMMIT);
    });

    it("handles all usage mode values from environment", () => {
      process.env.CMAI_USAGE_MODE = "CLIPBOARD";
      let result = getConfigurationWithEnvironmentOverrides(mockConfiguration);
      expect(result.usageMode).toBe(UsageMode.CLIPBOARD);

      process.env.CMAI_USAGE_MODE = "COMMIT";
      result = getConfigurationWithEnvironmentOverrides(mockConfiguration);
      expect(result.usageMode).toBe(UsageMode.COMMIT);

      process.env.CMAI_USAGE_MODE = "TERMINAL";
      result = getConfigurationWithEnvironmentOverrides(mockConfiguration);
      expect(result.usageMode).toBe(UsageMode.TERMINAL);
    });

    it("handles legacy CMAI_COMPLETION_ACTION environment variable", () => {
      process.env.CMAI_COMPLETION_ACTION = "COMMIT";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.usageMode).toBe(UsageMode.COMMIT);
    });

    it("overrides provider from environment", () => {
      process.env.CMAI_PROVIDER = "ANTHROPIC";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.provider).toBe(Provider.ANTHROPIC);
    });

    it("overrides max commit length from environment", () => {
      process.env.CMAI_MAX_COMMIT_LENGTH = "50";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.maxCommitLength).toBe(50);
    });

    it("ignores invalid max commit length from environment", () => {
      process.env.CMAI_MAX_COMMIT_LENGTH = "not-a-number";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.maxCommitLength).toBe(mockConfiguration.maxCommitLength);
    });

    it("ignores invalid usage mode from environment", () => {
      process.env.CMAI_USAGE_MODE = "INVALID_MODE";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.usageMode).toBe(mockConfiguration.usageMode);
    });

    it("ignores invalid provider from environment", () => {
      process.env.CMAI_PROVIDER = "invalid-provider";

      const result = getConfigurationWithEnvironmentOverrides(mockConfiguration);

      expect(result.provider).toBe(mockConfiguration.provider);
    });

    it("falls back to default values when config values are missing", () => {
      const incompleteConfig = { provider: Provider.OPENAI, apiKey: "test-key" } as Config;
      process.env.CMAI_MAX_COMMIT_LENGTH = "80";

      const result = getConfigurationWithEnvironmentOverrides(incompleteConfig);

      expect(result.maxCommitLength).toBe(80);
      expect(result.usageMode).toBe(UsageMode.CLIPBOARD);
    });

    it("handles legacy completionAction in config", () => {
      const configWithLegacy = {
        ...mockConfiguration,
        completionAction: UsageMode.COMMIT,
        usageMode: undefined,
      } as Config;

      const result = getConfigurationWithEnvironmentOverrides(configWithLegacy);

      expect(result.usageMode).toBe(UsageMode.COMMIT);
    });
  });

  describe("checkConfigFilePermissions", () => {
    it("does nothing if config file does not exist", async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

      await checkConfigFilePermissions();

      expect(fs.stat).not.toHaveBeenCalled();
      expect(fs.chmod).not.toHaveBeenCalled();
    });

    it("does nothing if permissions are already correct (600)", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        mode: 0o100600,
      } as unknown as Stats);

      await checkConfigFilePermissions();

      expect(fs.chmod).not.toHaveBeenCalled();
      expect(message).not.toHaveBeenCalled();
    });

    it("warns and fixes insecure permissions (644)", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        mode: 0o100644,
      } as unknown as Stats);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await checkConfigFilePermissions();

      expect(message).toHaveBeenCalledWith(
        expect.stringContaining("insecure permissions"),
        expect.objectContaining({ type: "warning" })
      );
      expect(message).toHaveBeenCalledWith(
        expect.stringContaining("fixing permissions"),
        expect.objectContaining({ type: "info" })
      );
      expect(fs.chmod).toHaveBeenCalledWith(".cmai/settings.json", 0o600);
      expect(message).toHaveBeenCalledWith(
        expect.stringContaining("updated successfully"),
        expect.objectContaining({ type: "success" })
      );
    });

    it("warns and fixes world-readable permissions (666)", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        mode: 0o100666,
      } as unknown as Stats);
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await checkConfigFilePermissions();

      expect(message).toHaveBeenCalledWith(
        expect.stringContaining("insecure permissions"),
        expect.objectContaining({ type: "warning" })
      );
      expect(fs.chmod).toHaveBeenCalledWith(".cmai/settings.json", 0o600);
    });

    it("handles chmod errors gracefully", async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.stat).mockResolvedValue({
        mode: 0o100644,
      } as unknown as Stats);
      vi.mocked(fs.chmod).mockRejectedValue(new Error("Permission denied"));

      await expect(checkConfigFilePermissions()).rejects.toThrow("Permission denied");
    });
  });

  describe("ensureConfigFilePermissions", () => {
    it("sets file permissions to 600", async () => {
      vi.mocked(fs.chmod).mockResolvedValue(undefined);

      await ensureConfigFilePermissions(".cmai/settings.json");

      expect(fs.chmod).toHaveBeenCalledWith(".cmai/settings.json", 0o600);
    });

    it("warns but does not throw on permission errors", async () => {
      vi.mocked(fs.chmod).mockRejectedValue(new Error("Operation not permitted"));

      await ensureConfigFilePermissions(".cmai/settings.json");

      expect(message).toHaveBeenCalledWith(
        expect.stringContaining("Could not set secure permissions"),
        expect.objectContaining({ type: "warning" })
      );
    });
  });
});
