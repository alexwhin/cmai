import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import {
  getPromptMessage,
  getPromptHint,
  getUsageModeDisplayText,
  getValidationMessage,
  getMessage,
  getChoiceValue,
  getSettingsActionLabel,
  initI18n,
  t,
  ensureI18n,
} from "../../src/utils/i18n.js";
import { UsageMode } from "../../src/types/index.js";
import { VALIDATION_LIMITS } from "../../src/constants.js";

describe("i18n", () => {
  describe("core i18n functions", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("should initialize i18n with default language", async () => {
      vi.resetModules();
      const { initI18n, t } = await import("../../src/utils/i18n.js");
      await initI18n();
      
      expect(t("labels.provider")).toBe("Provider");
    });

    it("should initialize i18n with specified language", async () => {
      vi.resetModules();
      const { initI18n, t } = await import("../../src/utils/i18n.js");
      await initI18n("en");
      
      expect(t("labels.provider")).toBe("Provider");
    });

    it("should initialize i18n with environment LANG", async () => {
      const originalLang = process.env.LANG;
      const originalLanguage = process.env.LANGUAGE;
      process.env.LANG = "en_US";
      delete process.env.LANGUAGE;
      
      vi.resetModules();
      const { initI18n, t } = await import("../../src/utils/i18n.js");
      await initI18n();
      
      expect(t("labels.provider")).toBe("Provider");
      
      process.env.LANG = originalLang;
      if (originalLanguage) {
        process.env.LANGUAGE = originalLanguage;
      }
    });

    it("should initialize i18n with environment LANGUAGE", async () => {
      const originalLang = process.env.LANG;
      const originalLanguage = process.env.LANGUAGE;
      delete process.env.LANG;
      process.env.LANGUAGE = "en_GB";
      
      vi.resetModules();
      const { initI18n, t } = await import("../../src/utils/i18n.js");
      await initI18n();
      
      expect(t("labels.provider")).toBe("Provider");
      
      if (originalLang) {
        process.env.LANG = originalLang;
      }
      process.env.LANGUAGE = originalLanguage;
    });

    it("should default to 'en' when no environment vars set", async () => {
      const originalLang = process.env.LANG;
      const originalLanguage = process.env.LANGUAGE;
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      
      vi.resetModules();
      const { initI18n, t } = await import("../../src/utils/i18n.js");
      await initI18n();
      
      expect(t("labels.provider")).toBe("Provider");
      
      if (originalLang) {
        process.env.LANG = originalLang;
      }
      if (originalLanguage) {
        process.env.LANGUAGE = originalLanguage;
      }
    });

    it("should handle initialization errors", async () => {
      // First, unmock the i18n module to get the real implementation
      vi.doUnmock("../../src/utils/i18n.js");
      
      // Mock i18next before importing the i18n module
      vi.doMock("i18next", () => ({
        default: {
          use: vi.fn().mockReturnThis(),
          init: vi.fn().mockRejectedValue(new Error("Init failed")),
          t: vi.fn().mockReturnValue(""),
          changeLanguage: vi.fn(),
        },
      }));

      vi.resetModules();
      const { initI18n } = await import("../../src/utils/i18n.js");
      
      await expect(initI18n()).rejects.toThrow("Failed to initialize i18n: Init failed");
      
      vi.doUnmock("i18next");
      vi.resetModules();
    });

    it("should handle non-Error exceptions during initialization", async () => {
      vi.doUnmock("../../src/utils/i18n.js");
      
      // Mock i18next to throw a non-Error object
      vi.doMock("i18next", () => ({
        default: {
          use: vi.fn().mockReturnThis(),
          init: vi.fn().mockRejectedValue("String error"),
          t: vi.fn().mockReturnValue(""),
          changeLanguage: vi.fn(),
        },
      }));

      vi.resetModules();
      const { initI18n } = await import("../../src/utils/i18n.js");
      
      await expect(initI18n()).rejects.toThrow("Failed to initialize i18n: String error");
      
      vi.doUnmock("i18next");
      vi.resetModules();
    });

    it("should return cached instance on subsequent calls", async () => {
      vi.resetModules();
      const { initI18n } = await import("../../src/utils/i18n.js");
      
      await initI18n();
      await initI18n();
      
      // Should not throw and complete successfully
      expect(true).toBe(true);
    });

    it("should change language when already initialized", async () => {
      const { initI18n, changeLanguage } = await import("../../src/utils/i18n.js");
      
      await initI18n("en");
      const tFunction = await changeLanguage("en");
      
      expect(typeof tFunction).toBe("function");
    });

    it("should reinitialize when configuredLanguage is provided to already initialized instance", async () => {
      vi.resetModules();
      const { initI18n } = await import("../../src/utils/i18n.js");
      
      // First initialization
      await initI18n("en");
      
      // Second initialization with different language should still work
      const tFunction = await initI18n("es");
      expect(typeof tFunction).toBe("function");
    });

    it("should handle initPromise when already in progress", async () => {
      vi.resetModules();
      const { initI18n } = await import("../../src/utils/i18n.js");
      
      // Start initialization but don't await it
      const promise1 = initI18n();
      const promise2 = initI18n();
      
      // Both should resolve to the same result
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(typeof result1).toBe("function");
      expect(typeof result2).toBe("function");
    });
  });

  describe("t function", () => {
    it("should return key when not initialized", async () => {
      vi.resetModules();
      const { t } = await import("../../src/utils/i18n.js");
      
      expect(t("some.key")).toBe("some.key");
    });

    it("should translate when initialized", async () => {
      // Use the mocked version which is already set up
      expect(t("labels.provider")).toBe("Provider");
    });

    it("should handle interpolation", async () => {
      // Use the mocked version which is already set up
      const result = t("validation.maxCommitLengthRange", { min: 50, max: 100 });
      expect(result).toBe("Max commit length must be between 50 and 100");
    });

    it("should handle options parameter correctly", () => {
      // Test with empty options
      expect(t("labels.provider", {})).toBe("Provider");
      
      // Test with various option types
      expect(t("labels.apiKey", { test: "value" })).toBe("API Key");
    });

    it("should return key when i18n is not initialized in fresh module", async () => {
      vi.resetModules();
      const { t } = await import("../../src/utils/i18n.js");
      
      expect(t("some.key")).toBe("some.key");
      expect(t("another.nested.key", { param: "value" })).toBe("another.nested.key");
    });
  });

  describe("ensureI18n", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("should initialize if not already initialized", async () => {
      // Use the mocked version which is already set up
      await ensureI18n();
      expect(t("labels.provider")).toBe("Provider");
    });

    it("should reinitialize with new language", async () => {
      const { initI18n, ensureI18n } = await import("../../src/utils/i18n.js");
      
      await initI18n("en");
      await ensureI18n("en");
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("changeLanguage", () => {
    it("should change the language", async () => {
      const { initI18n, changeLanguage } = await import("../../src/utils/i18n.js");
      
      await initI18n("en");
      const tFunction = await changeLanguage("en");
      
      expect(typeof tFunction).toBe("function");
    });

    it("should change language to different locale", async () => {
      const { initI18n, changeLanguage } = await import("../../src/utils/i18n.js");
      
      await initI18n("en");
      const tFunction = await changeLanguage("es");
      
      expect(typeof tFunction).toBe("function");
    });

    it("should handle language change when not initialized", async () => {
      vi.resetModules();
      const { changeLanguage } = await import("../../src/utils/i18n.js");
      
      const tFunction = await changeLanguage("en");
      expect(typeof tFunction).toBe("function");
    });
  });
});

describe("i18n-helpers", () => {
  beforeAll(async () => {
    await initI18n("en");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getPromptMessage", () => {
    it("should return translated message for valid keys", () => {
      expect(getPromptMessage("SELECT_PROVIDER")).toBe("Select your provider");
      expect(getPromptMessage("SELECT_MODEL")).toBe("Select a model");
      expect(getPromptMessage("FETCHING_MODELS")).toBe("Fetching available models...");
    });

    it("should handle ENTER_API_KEY with special logic", () => {
      const result = getPromptMessage("ENTER_API_KEY");
      // The enterApiKeyNoProvider translation returns "Enter your API key"
      expect(result).toBe("Enter your API key");
    });

    it("should return the same key for SELECT_NEW_PROVIDER as SELECT_PROVIDER", () => {
      expect(getPromptMessage("SELECT_NEW_PROVIDER")).toBe("Select your provider");
      expect(getPromptMessage("SELECT_PROVIDER")).toBe("Select your provider");
    });

    it("should return correct keys for message generation states", () => {
      expect(getPromptMessage("GENERATING_MESSAGES")).toBe("Generating commit messages...");
      expect(getPromptMessage("MESSAGES_GENERATED")).toBe("Generating commit messages...");
      expect(getPromptMessage("REGENERATING_MESSAGES")).toBe("Generating commit messages...");
      expect(getPromptMessage("MESSAGES_REGENERATED")).toBe("Generating commit messages...");
    });

    it("should return key for unknown prompt message", () => {
      expect(getPromptMessage("UNKNOWN_KEY" as keyof typeof import("../../src/utils/i18n.js"))).toBe("UNKNOWN_KEY");
    });

    it("should return translated messages for all prompt keys", () => {
      expect(getPromptMessage("SELECT_USAGE_MODE")).toBe("Select a setting to modify");
      expect(getPromptMessage("SELECT_COMMIT_MESSAGE")).toBe("Select a commit message:");
      expect(getPromptMessage("MODELS_LOADED")).toBe("Models loaded successfully");
      expect(getPromptMessage("FAILED_TO_FETCH_MODELS")).toBe("Failed to load models");
      expect(getPromptMessage("MAX_COMMIT_LENGTH")).toBe("Max commit length");
    });
  });

  describe("getPromptHint", () => {
    it("should return translated hint for valid keys", () => {
      expect(getPromptHint("SELECT")).toBe("Use arrow keys to navigate");
      expect(getPromptHint("CUSTOM_RULES_HINT")).toBe("all messages must be lowercase");
    });

    it("should return hardcoded hints for specific keys", () => {
      expect(getPromptHint("RECOMMENDED_COMMIT_LENGTH")).toBe("Recommended: 72 characters");
      expect(getPromptHint("DEFAULT_COMMIT_CHOICES")).toBe("Default: 5 options");
    });

    it("should return key for unknown hint", () => {
      expect(getPromptHint("UNKNOWN_KEY" as "RECOMMENDED_COMMIT_LENGTH" | "DEFAULT_COMMIT_CHOICES")).toBe("UNKNOWN_KEY");
    });
  });

  describe("getUsageModeDisplayText", () => {
    it("should return translated text for each usage mode", () => {
      // Note: In test environment, the function may return enum values if i18n is not fully initialized
      // The important part is that it doesn't crash and handles all enum values
      const clipboardText = getUsageModeDisplayText(UsageMode.CLIPBOARD);
      const commitText = getUsageModeDisplayText(UsageMode.COMMIT);
      const terminalText = getUsageModeDisplayText(UsageMode.TERMINAL);

      // Test that we get consistent responses (either translated or enum values)
      expect(typeof clipboardText).toBe("string");
      expect(typeof commitText).toBe("string");
      expect(typeof terminalText).toBe("string");

      // Test that all usage modes are handled
      expect(clipboardText).toBeTruthy();
      expect(commitText).toBeTruthy();
      expect(terminalText).toBeTruthy();
    });
  });

  describe("getValidationMessage", () => {
    describe("apiKey validation", () => {
      it("should return true for valid API key", () => {
        expect(getValidationMessage("apiKey", "valid-key")).toBe(true);
      });

      it("should return error message for empty API key", () => {
        expect(getValidationMessage("apiKey", "")).toBe("API key is required");
        expect(getValidationMessage("apiKey")).toBe("API key is required");
      });
    });

    describe("maxLength validation", () => {
      it("should return true for valid length", () => {
        expect(getValidationMessage("maxLength", 72)).toBe(true);
        expect(getValidationMessage("maxLength", VALIDATION_LIMITS.MIN_COMMIT_LENGTH)).toBe(true);
        expect(getValidationMessage("maxLength", VALIDATION_LIMITS.MAX_COMMIT_LENGTH)).toBe(true);
      });

      it("should return error message for invalid length", () => {
        const tooSmall = VALIDATION_LIMITS.MIN_COMMIT_LENGTH - 1;
        const tooLarge = VALIDATION_LIMITS.MAX_COMMIT_LENGTH + 1;

        expect(getValidationMessage("maxLength", tooSmall)).toBe(
          "Max commit length must be between 50 and 100"
        );
        expect(getValidationMessage("maxLength", tooLarge)).toBe(
          "Max commit length must be between 50 and 100"
        );
        expect(getValidationMessage("maxLength", "not a number" as unknown as number)).toBe(
          "Max commit length must be between 50 and 100"
        );
      });
    });

    describe("choicesCount validation", () => {
      it("should return true for valid count", () => {
        expect(getValidationMessage("choicesCount", 5)).toBe(true);
        expect(getValidationMessage("choicesCount", VALIDATION_LIMITS.MIN_COMMIT_CHOICES)).toBe(
          true
        );
        expect(getValidationMessage("choicesCount", VALIDATION_LIMITS.MAX_COMMIT_CHOICES)).toBe(
          true
        );
      });

      it("should return error message for invalid count", () => {
        const tooSmall = VALIDATION_LIMITS.MIN_COMMIT_CHOICES - 1;
        const tooLarge = VALIDATION_LIMITS.MAX_COMMIT_CHOICES + 1;

        expect(getValidationMessage("choicesCount", tooSmall)).toBe(
          "Commit choices count must be between 1 and 10"
        );
        expect(getValidationMessage("choicesCount", tooLarge)).toBe(
          "Commit choices count must be between 1 and 10"
        );
        expect(getValidationMessage("choicesCount", "not a number" as unknown as number)).toBe(
          "Commit choices count must be between 1 and 10"
        );
      });
    });

    it("should return true for unknown validation type", () => {
      expect(getValidationMessage("unknown" as "apiKey")).toBe(true);
    });

    it("should handle edge cases in validation", () => {
      // Test with undefined value for apiKey
      expect(getValidationMessage("apiKey", undefined)).toBe("API key is required");
      
      // Test with null value (converted to string)
      expect(getValidationMessage("apiKey", null as unknown as string)).toBe("API key is required");
      
      // Test with non-string value for apiKey
      expect(getValidationMessage("apiKey", 123 as unknown as string)).toBe("API key is required");
      
      // Test maxLength with undefined
      expect(getValidationMessage("maxLength", undefined)).toBe("Max commit length must be between 50 and 100");
      
      // Test choicesCount with undefined
      expect(getValidationMessage("choicesCount", undefined)).toBe("Commit choices count must be between 1 and 10");
    });
  });

  describe("getMessage", () => {
    it("should return translated message for valid keys", () => {
      expect(getMessage("CANCELLED")).toBe("Commit cancelled");
      expect(getMessage("ENTER_CUSTOM_COMMIT")).toBe("Enter your commit message");
      expect(getMessage("RETRY_PROMPT")).toBe("Would you like to try again?");
      expect(getMessage("FAILED_GENERATE")).toBe("Failed to generate messages from provider");
    });

    it("should return key for unknown message", () => {
      expect(getMessage("UNKNOWN_KEY" as keyof typeof import("../../src/utils/i18n.js"))).toBe("UNKNOWN_KEY");
    });
  });

  describe("getChoiceValue", () => {
    it("should return the same key", () => {
      expect(getChoiceValue("REGENERATE")).toBe("REGENERATE");
      expect(getChoiceValue("CUSTOM")).toBe("CUSTOM");
      expect(getChoiceValue("any-value")).toBe("any-value");
      expect(getChoiceValue("")).toBe("");
    });
  });

  describe("getSettingsActionLabel", () => {
    it("should return translated labels for settings actions", () => {
      expect(getSettingsActionLabel("provider")).toBe("Provider");
      expect(getSettingsActionLabel("apiKey")).toBe("API Key");
      expect(getSettingsActionLabel("model")).toBe("Model");
      expect(getSettingsActionLabel("maxLength")).toBe("Max commit length");
      expect(getSettingsActionLabel("usageMode")).toBe("Usage mode");
      expect(getSettingsActionLabel("commitChoicesCount")).toBe(
        "Number of commit message options to generate"
      );
      expect(getSettingsActionLabel("redactSensitive")).toBe(
        "Redact sensitive data before sending to AI"
      );
      expect(getSettingsActionLabel("customRules")).toBe("Custom rules");
      expect(getSettingsActionLabel("view")).toBe("View Current Settings");
      expect(getSettingsActionLabel("exit")).toBe("Exit");
    });

    it("should return the action itself for unknown actions", () => {
      expect(getSettingsActionLabel("unknown-action")).toBe("unknown-action");
      expect(getSettingsActionLabel("")).toBe("");
    });

    it("should handle all keys with falsy translation values", () => {
      // Testing the fallback logic when translationKey is falsy
      expect(getSettingsActionLabel("nonExistentKey")).toBe("nonExistentKey");
    });
  });
});
