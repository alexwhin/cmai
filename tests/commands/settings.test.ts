import { describe, it, expect, vi, beforeEach } from "vitest";
import prompts from "prompts";
import { settingsCommand } from "../../src/commands/settings.js";
import { saveConfiguration, loadConfiguration, configurationExists } from "../../src/utils/config.js";
import {
  promptProvider,
  promptApiKey,
  validateAndSelectModel,
  promptMaxCommitLength,
  promptCommitChoicesCount,
  promptRedactSensitiveData,
  promptUsageMode,
  manageCustomRules,
  promptUILanguage,
  promptCommitLanguage,
  message,
} from "../../src/utils/ui-utils.js";
import { Provider, UsageMode, Language } from "../../src/types/index.js";
import { SETTINGS_ACTIONS } from "../../src/constants.js";
import { changeLanguage, ensureI18n } from "../../src/utils/i18n.js";

vi.mock("prompts");
vi.mock("../../src/utils/config.js");
vi.mock("../../src/commands/init.js", () => ({
  initCommand: vi.fn(),
}));
vi.mock("../../src/utils/ui-utils.js", async () => {
  const { uiUtilsMock } = await import("../__mocks__/ui-utils.mock.js");
  return uiUtilsMock;
});
vi.mock("../../src/utils/style.js", () => ({
  dim: vi.fn((text) => `DIM[${text}]`),
  color: vi.fn((colorName, text) => `${colorName.toUpperCase()}[${text}]`),
}));
vi.mock("../../src/utils/git-utils.js", () => ({
  installHook: vi.fn(),
  uninstallHook: vi.fn(),
  isHookInstalled: vi.fn(),
}));
vi.mock("../../src/providers/configuration.js", () => ({
  isUrlBasedProvider: vi.fn((provider) => provider === "OLLAMA"),
  getProviderDefaultUrl: vi.fn((provider) => provider === "OLLAMA" ? "http://localhost:11434" : undefined),
}));
vi.mock("../../src/utils/js", () => ({
  t: vi.fn((key) => key),
  changeLanguage: vi.fn(),
  ensureI18n: vi.fn(),
  getPromptMessage: vi.fn((key) => {
    const messages: Record<string, string> = {
      "SELECT_PROVIDER": "Select your provider",
      "ENTER_API_KEY": "Enter your API key",
      "SELECT_MODEL": "Select model",
      "MAX_COMMIT_LENGTH": "Max commit length",
    };
    return messages[key] || key;
  }),
  getPromptHint: vi.fn((key) => {
    const hints: Record<string, string> = {
      "SELECT": "Use arrow keys to navigate",
    };
    return hints[key] || key;
  }),
  getChoiceValue: vi.fn((key) => {
    const values: Record<string, string> = {
      "EXIT": "EXIT",
    };
    return values[key] || key;
  }),
  getUsageModeDisplayText: vi.fn((mode) => mode),
  getProviderDisplayName: vi.fn((provider) => provider),
  getLanguageDisplayName: vi.fn((language) => language),
}));

describe("commands/settings", () => {
  const mockConfiguration = {
    provider: Provider.OPENAI,
    apiKey: "test-key",
    model: "gpt-4",
    maxCommitLength: 72,
    commitChoicesCount: 5,
    usageMode: UsageMode.CLIPBOARD,
    redactSensitiveData: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.mocked(saveConfiguration).mockClear();
    // Ensure loadConfiguration always returns a clean mockConfiguration unless overridden
    vi.mocked(loadConfiguration).mockResolvedValue({ ...mockConfiguration });
  });

  it("runs init when no configuration exists", async () => {
    vi.mocked(configurationExists).mockResolvedValue(false);
    const { initCommand } = await import("../../src/commands/init.js");
    vi.mocked(initCommand).mockResolvedValue();

    await settingsCommand();

    expect(message).toHaveBeenCalledWith("No configuration found. Starting setup...", {
      type: "warning",
      variant: "title",
    });
    expect(initCommand).toHaveBeenCalled();
  });

  it("exits when EXIT is selected", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: "EXIT" });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("updates provider and resets apiKey and model", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue({ ...mockConfiguration });
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "provider" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptProvider).mockResolvedValue({
      value: Provider.ANTHROPIC,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      provider: Provider.ANTHROPIC,
      model: "",
      maxCommitLength: 72,
      commitChoicesCount: 5,
      usageMode: UsageMode.CLIPBOARD,
      redactSensitiveData: true,
    });
    expect(message).toHaveBeenCalledWith("Provider updated", { type: "success", variant: "title" });
    expect(message).toHaveBeenCalledWith("Key and model have been reset for the new provider", {
      type: "info",
    });
  });

  it("does not reset when provider is unchanged", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue({ ...mockConfiguration });
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "provider" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptProvider).mockResolvedValue({
      value: Provider.OPENAI,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
    expect(message).not.toHaveBeenCalledWith("Provider updated", {
      type: "success",
      variant: "title",
    });
    expect(message).not.toHaveBeenCalledWith(
      "API key and model have been reset for the new provider",
      { type: "info" }
    );
  });

  it("sets default URL when switching to Ollama", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue({ ...mockConfiguration });
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "provider" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptProvider).mockResolvedValue({
      value: Provider.OLLAMA,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      provider: Provider.OLLAMA,
      apiKey: "http://localhost:11434",
      model: "",
    });
    expect(message).toHaveBeenCalledWith("Provider updated", { type: "success", variant: "title" });
    expect(message).toHaveBeenCalledWith("Key and model have been reset for the new provider", { type: "info" });
  });

  it("updates API key", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.API_KEY });
    vi.mocked(promptApiKey).mockResolvedValue({
      value: "new-api-key",
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      apiKey: "new-api-key",
    });
  });

  it("updates model", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.MODEL });
    vi.mocked(validateAndSelectModel).mockResolvedValue({
      value: "gpt-4-turbo",
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      model: "gpt-4-turbo",
    });
  });

  it("updates max commit length", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.MAX_LENGTH });
    vi.mocked(promptMaxCommitLength).mockResolvedValue({
      value: 80,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      maxCommitLength: 80,
    });
  });

  it("updates commit choices count", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.COMMIT_CHOICES_COUNT });
    vi.mocked(promptCommitChoicesCount).mockResolvedValue({
      value: 7,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      commitChoicesCount: 7,
    });
  });

  it("updates sensitive data redaction setting", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.REDACT_SENSITIVE });
    vi.mocked(promptRedactSensitiveData).mockResolvedValue({
      value: false,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      redactSensitiveData: false,
    });
  });

  it("updates usage mode", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.USAGE_MODE });
    vi.mocked(promptUsageMode).mockResolvedValue({
      value: UsageMode.COMMIT,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      usageMode: UsageMode.COMMIT,
    });
  });

  it("handles cancellation during updates", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.PROVIDER });
    vi.mocked(promptProvider).mockResolvedValue({
      value: undefined,
      cancelled: true,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
    expect(message).not.toHaveBeenCalledWith("Provider updated", {
      type: "success",
      variant: "title",
    });
  });

  it("displays choices in correct order", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: "EXIT" });

    await settingsCommand();

    expect(prompts).toHaveBeenCalledTimes(1);
    const [promptCall] = vi.mocked(prompts).mock.calls;
    const promptObject = promptCall[0] as { choices: Array<{ title: string; value: string }> };
    expect(promptObject).toMatchObject({
      type: "select",
      name: "action",
      message: "Select a setting to modify",
      hint: "Use arrow keys to navigate",
    });

    const choices = promptObject.choices;
    expect(choices).toHaveLength(11);
    expect(choices[0].title).toContain("Select your provider");
    expect(choices[choices.length - 1].title).toEqual("DIM[← Exit]");
  });

  it("updates custom rules", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.CUSTOM_RULES })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(manageCustomRules).mockResolvedValue({
      value: ["rule1", "rule2"],
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      customRules: ["rule1", "rule2"],
    });
    expect(message).toHaveBeenCalledWith("Custom rules updated", {
      type: "success",
      variant: "title",
    });
  });

  it("removes custom rules when empty array is returned", async () => {
    const configWithRules = { ...mockConfiguration, customRules: ["old rule"] };
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(configWithRules);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.CUSTOM_RULES })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(manageCustomRules).mockResolvedValue({
      value: [],
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    const savedConfig = vi.mocked(saveConfiguration).mock.calls[0]?.[0];
    expect(savedConfig).toBeDefined();
    expect(savedConfig).not.toHaveProperty("customRules");
  });

  it("updates UI language", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.UI_LANGUAGE })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptUILanguage).mockResolvedValue({
      value: Language.ES,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      uiLanguage: Language.ES,
    });
    expect(changeLanguage).toHaveBeenCalledWith(Language.ES);
    expect(message).toHaveBeenCalledWith("Interface language updated to Español", {
      type: "success",
      variant: "title",
    });
  });

  it("does not update UI language when cancelled", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.UI_LANGUAGE })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptUILanguage).mockResolvedValue({
      value: undefined,
      cancelled: true,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it("does not update UI language when value is unchanged", async () => {
    const configWithUILang = { ...mockConfiguration, uiLanguage: Language.EN };
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(configWithUILang);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.UI_LANGUAGE })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptUILanguage).mockResolvedValue({
      value: Language.EN,
      cancelled: false,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it("updates commit language", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.COMMIT_LANGUAGE })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptCommitLanguage).mockResolvedValue({
      value: Language.FR,
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      commitLanguage: Language.FR,
    });
    expect(message).toHaveBeenCalledWith("Commit message language updated to Français", {
      type: "success",
      variant: "title",
    });
  });

  it("does not update commit language when cancelled", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.COMMIT_LANGUAGE })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptCommitLanguage).mockResolvedValue({
      value: undefined,
      cancelled: true,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("does not update commit language when value is unchanged", async () => {
    const configWithCommitLang = { ...mockConfiguration, commitLanguage: Language.EN };
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(configWithCommitLang);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.COMMIT_LANGUAGE })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptCommitLanguage).mockResolvedValue({
      value: Language.EN,
      cancelled: false,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("handles max iterations limit", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: "provider" });
    vi.mocked(promptProvider).mockResolvedValue({
      value: Provider.OPENAI,
      cancelled: false,
    });

    await settingsCommand();

    expect(prompts).toHaveBeenCalledTimes(100);
    expect(message).toHaveBeenCalledWith("Settings loop exceeded maximum iterations", {
      type: "warning",
      variant: "title",
    });
  });

  it("displays URL for URL-based providers instead of masked key", async () => {
    const ollamaConfig = {
      ...mockConfiguration,
      provider: Provider.OLLAMA,
      apiKey: "http://localhost:11434",
    };
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(ollamaConfig);
    vi.mocked(prompts).mockResolvedValue({ action: "EXIT" });

    await settingsCommand();

    const [promptCall] = vi.mocked(prompts).mock.calls;
    const promptObject = promptCall[0] as { choices: Array<{ title: string; value: string }> };
    const apiKeyChoice = promptObject.choices.find(c => c.value === "apiKey");
    
    expect(apiKeyChoice).toBeDefined();
    expect(apiKeyChoice?.title).toContain("http://localhost:11434");
    expect(apiKeyChoice?.title).not.toContain("***");
  });

  it("loads UI language on startup if configured", async () => {
    const configWithUILang = { ...mockConfiguration, uiLanguage: Language.ES };
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(configWithUILang);
    vi.mocked(prompts).mockResolvedValue({ action: "EXIT" });

    await settingsCommand();

    expect(ensureI18n).toHaveBeenCalledWith(Language.ES);
  });


  it("updates API key with URL message for URL-based providers", async () => {
    const ollamaConfig = {
      ...mockConfiguration,
      provider: Provider.OLLAMA,
      apiKey: "http://localhost:11434",
    };
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(loadConfiguration).mockResolvedValue(ollamaConfig);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "apiKey" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptApiKey).mockResolvedValue({
      value: "http://localhost:8080",
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      ...ollamaConfig,
      apiKey: "http://localhost:8080",
    });
    expect(message).toHaveBeenCalledWith("Server URL updated", {
      type: "success",
      variant: "title",
    });
  });

  it("does not update max length when value is unchanged", async () => {
    const cleanConfig = {
      provider: Provider.OPENAI,
      apiKey: "test-key",
      model: "gpt-4",
      maxCommitLength: 72,
      commitChoicesCount: 5,
      usageMode: UsageMode.CLIPBOARD,
      redactSensitiveData: true,
    };
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(saveConfiguration).mockResolvedValue();
    vi.mocked(loadConfiguration).mockImplementation(async () => ({ ...cleanConfig }));
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "maxLength" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptMaxCommitLength).mockResolvedValue({
      value: 72,
      cancelled: false,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("does not update commit choices count when value is unchanged", async () => {
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "commitChoicesCount" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptCommitChoicesCount).mockResolvedValue({
      value: 5,
      cancelled: false,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("does not update usage mode when value is unchanged", async () => {
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "usageMode" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptUsageMode).mockResolvedValue({
      value: UsageMode.CLIPBOARD,
      cancelled: false,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("does not update redact sensitive data when value is unchanged", async () => {
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "redactSensitive" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(promptRedactSensitiveData).mockResolvedValue({
      value: true,
      cancelled: false,
    });

    await settingsCommand();

    expect(saveConfiguration).not.toHaveBeenCalled();
  });
});
