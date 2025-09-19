import { describe, it, expect, vi, beforeEach } from "vitest";
import prompts from "prompts";
import { settingsCommand } from "../../src/commands/settings.js";
import * as ConfigManager from "../../src/utils/config.js";
import * as ConfigFlow from "../../src/utils/ui-utils.js";
import { message } from "../../src/utils/ui-utils.js";
import { Provider, UsageMode } from "../../src/types/index.js";
import { SETTINGS_ACTIONS } from "../../src/constants.js";

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
  });

  it("runs init when no configuration exists", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(false);
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
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: "EXIT" });

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).not.toHaveBeenCalled();
  });

  it("updates provider and resets apiKey and model", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue({ ...mockConfiguration });
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "provider" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(ConfigFlow.promptProvider).mockResolvedValue({
      value: Provider.ANTHROPIC,
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
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
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue({ ...mockConfiguration });
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "provider" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(ConfigFlow.promptProvider).mockResolvedValue({
      value: Provider.OPENAI,
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).not.toHaveBeenCalled();
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
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue({ ...mockConfiguration });
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: "provider" })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(ConfigFlow.promptProvider).mockResolvedValue({
      value: Provider.OLLAMA,
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      provider: Provider.OLLAMA,
      apiKey: "http://localhost:11434",
      model: "",
    });
    expect(message).toHaveBeenCalledWith("Provider updated", { type: "success", variant: "title" });
    expect(message).toHaveBeenCalledWith("Key and model have been reset for the new provider", { type: "info" });
  });

  it("updates API key", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.API_KEY });
    vi.mocked(ConfigFlow.promptApiKey).mockResolvedValue({
      value: "new-api-key",
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      apiKey: "new-api-key",
    });
  });

  it("updates model", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.MODEL });
    vi.mocked(ConfigFlow.validateAndSelectModel).mockResolvedValue({
      value: "gpt-4-turbo",
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      model: "gpt-4-turbo",
    });
  });

  it("updates max commit length", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.MAX_LENGTH });
    vi.mocked(ConfigFlow.promptMaxCommitLength).mockResolvedValue({
      value: 80,
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      maxCommitLength: 80,
    });
  });

  it("updates commit choices count", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.COMMIT_CHOICES_COUNT });
    vi.mocked(ConfigFlow.promptCommitChoicesCount).mockResolvedValue({
      value: 7,
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      commitChoicesCount: 7,
    });
  });

  it("updates sensitive data redaction setting", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.REDACT_SENSITIVE });
    vi.mocked(ConfigFlow.promptRedactSensitiveData).mockResolvedValue({
      value: false,
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      redactSensitiveData: false,
    });
  });

  it("updates usage mode", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.USAGE_MODE });
    vi.mocked(ConfigFlow.promptUsageMode).mockResolvedValue({
      value: UsageMode.COMMIT,
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
      ...mockConfiguration,
      usageMode: UsageMode.COMMIT,
    });
  });

  it("handles cancellation during updates", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts).mockResolvedValue({ action: SETTINGS_ACTIONS.PROVIDER });
    vi.mocked(ConfigFlow.promptProvider).mockResolvedValue({
      value: undefined,
      cancelled: true,
    });

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).not.toHaveBeenCalled();
    expect(message).not.toHaveBeenCalledWith("Provider updated", {
      type: "success",
      variant: "title",
    });
  });

  it("displays choices in correct order", async () => {
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
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
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(mockConfiguration);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.CUSTOM_RULES })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(ConfigFlow.manageCustomRules).mockResolvedValue({
      value: ["rule1", "rule2"],
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    expect(ConfigManager.saveConfiguration).toHaveBeenCalledWith({
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
    vi.mocked(ConfigManager.configurationExists).mockResolvedValue(true);
    vi.mocked(ConfigManager.loadConfiguration).mockResolvedValue(configWithRules);
    vi.mocked(prompts)
      .mockResolvedValueOnce({ action: SETTINGS_ACTIONS.CUSTOM_RULES })
      .mockResolvedValueOnce({ action: "EXIT" });
    vi.mocked(ConfigFlow.manageCustomRules).mockResolvedValue({
      value: [],
      cancelled: false,
    });
    vi.mocked(ConfigManager.saveConfiguration).mockResolvedValue();

    await settingsCommand();

    const savedConfig = vi.mocked(ConfigManager.saveConfiguration).mock.calls[0]?.[0];
    expect(savedConfig).toBeDefined();
    expect(savedConfig).not.toHaveProperty("customRules");
  });
});
