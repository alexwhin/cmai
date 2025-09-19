import { describe, it, expect } from "vitest";
import {
  getProviderChoices,
  VALIDATION,
  CHOICE_VALUES,
  SETTINGS_ACTIONS,
  API_TIMEOUT_MS,
  DEFAULTS,
  VALIDATION_LIMITS,
  FILE_SYSTEM,
  GIT,
} from "../src/constants.js";
import { Provider } from "../src/types/index.js";

describe("constants", () => {
  describe("getProviderChoices", () => {
    it("contains OpenAI, Anthropic, Ollama, and Gemini providers", () => {
      const providerChoices = getProviderChoices();
      expect(providerChoices).toHaveLength(4);
      expect(providerChoices[0]).toEqual({
        title: "OpenAI",
        value: Provider.OPENAI,
      });
      expect(providerChoices[1]).toEqual({
        title: "Anthropic",
        value: Provider.ANTHROPIC,
      });
      expect(providerChoices[2]).toEqual({
        title: "Ollama",
        value: Provider.OLLAMA,
      });
      expect(providerChoices[3]).toEqual({
        title: "Gemini",
        value: Provider.GEMINI,
      });
    });
  });

  // PROMPT_MESSAGES tests removed - now handled through translations

  describe("VALIDATION", () => {
    it("validates API key is not empty", () => {
      const validator = VALIDATION.API_KEY_REQUIRED;

      expect(validator("valid-key")).toBe(true);
      expect(validator("")).toBe("API key is required");
      expect(validator("   ")).toBe(true); // Spaces are technically valid
    });
  });

  // PROMPT_HINTS tests removed - now handled through translations

  describe("CHOICE_VALUES", () => {
    it("contains all choice values", () => {
      expect(CHOICE_VALUES.CUSTOM).toBe("custom");
      expect(CHOICE_VALUES.REGENERATE).toBe("regenerate");
      expect(CHOICE_VALUES.EXIT).toBe("exit");
      expect(CHOICE_VALUES.VIEW).toBe("view");
    });
  });

  describe("SETTINGS_ACTIONS", () => {
    it("contains all settings action keys", () => {
      const expectedActions = [
        "PROVIDER",
        "API_KEY",
        "MODEL",
        "MAX_LENGTH",
        "USAGE_MODE",
        "COMMIT_CHOICES_COUNT",
        "REDACT_SENSITIVE",
      ];

      expectedActions.forEach((key) => {
        expect(SETTINGS_ACTIONS).toHaveProperty(key);
      });
    });
  });

  // SETTINGS_ACTION_CHOICES tests removed - now built dynamically with translations

  describe("API_TIMEOUT_MS", () => {
    it("is set to 60 seconds", () => {
      expect(API_TIMEOUT_MS).toBe(60000);
    });
  });

  describe("DEFAULTS", () => {
    it("contains expected default values", () => {
      expect(DEFAULTS.MAX_COMMIT_LENGTH).toBe(72);
      expect(DEFAULTS.COMMIT_CHOICES_COUNT).toBe(5);
      expect(DEFAULTS.RECENT_COMMITS_COUNT).toBe(10);
      expect(DEFAULTS.REDACT_SENSITIVE_DATA).toBe(true);
    });
  });

  describe("VALIDATION_LIMITS", () => {
    it("contains expected validation limits", () => {
      expect(VALIDATION_LIMITS.MIN_COMMIT_LENGTH).toBe(50);
      expect(VALIDATION_LIMITS.MAX_COMMIT_LENGTH).toBe(100);
      expect(VALIDATION_LIMITS.MIN_COMMIT_CHOICES).toBe(1);
      expect(VALIDATION_LIMITS.MAX_COMMIT_CHOICES).toBe(10);
      expect(VALIDATION_LIMITS.MAX_CUSTOM_RULE_LENGTH).toBe(100);
    });
  });

  describe("FILE_SYSTEM", () => {
    it("contains file system constants", () => {
      expect(FILE_SYSTEM.CONFIG_DIRECTORY).toBe(".cmai");
      expect(FILE_SYSTEM.CONFIG_FILENAME).toBe("settings.json");
      expect(FILE_SYSTEM.SCHEMA_FILENAME).toBe("settings.schema.json");
      expect(FILE_SYSTEM.CONFIG_FILE_PERMISSIONS).toBe(0o600);
    });
  });

  describe("GIT", () => {
    it("contains git configuration constants", () => {
      expect(GIT.DIFF_TRUNCATION_LIMIT).toBe(3000);
      expect(GIT.MAX_DIFF_LENGTH).toBe(10000);
    });
  });

  // MESSAGES tests removed - now handled through translations
});
