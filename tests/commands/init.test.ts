import { describe, it, expect, vi, beforeEach } from "vitest";
import prompts from "prompts";
import { initCommand } from "../../src/commands/init.js";
import { configurationExists, saveConfiguration } from "../../src/utils/config.js";
import { message, promptProvider, promptApiKey, validateApiKey, validateAndSelectModel, promptMaxCommitLength, promptCommitChoicesCount, promptRedactSensitiveData, promptUsageMode, promptUILanguage, promptCommitLanguage, promptCustomRules } from "../../src/utils/ui-utils.js";
import { Provider, UsageMode, Language } from "../../src/types/index.js";

vi.mock("prompts");
vi.mock("../../src/utils/config.js");
vi.mock("../../src/utils/style.js", () => ({
  color: vi.fn((colorName, text) => `${colorName.toUpperCase()}[${text}]`),
}));
vi.mock("../../src/utils/ui-utils.js", async () => {
  const { uiUtilsMock } = await import("../__mocks__/ui-utils.mock.js");
  return uiUtilsMock;
});

describe("commands/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes full initialization flow", async () => {
    vi.mocked(configurationExists).mockResolvedValue(false);

    vi.mocked(promptProvider).mockResolvedValue({
      value: Provider.OPENAI,
      cancelled: false,
    });
    vi.mocked(promptApiKey).mockResolvedValue({
      value: "test-key",
      cancelled: false,
    });
    vi.mocked(validateApiKey).mockResolvedValue(true);
    vi.mocked(validateAndSelectModel).mockResolvedValue({
      value: "gpt-4",
      cancelled: false,
    });
    vi.mocked(promptMaxCommitLength).mockResolvedValue({
      value: 72,
      cancelled: false,
    });
    vi.mocked(promptCommitChoicesCount).mockResolvedValue({
      value: 5,
      cancelled: false,
    });
    vi.mocked(promptRedactSensitiveData).mockResolvedValue({
      value: true,
      cancelled: false,
    });
    vi.mocked(promptUsageMode).mockResolvedValue({
      value: UsageMode.CLIPBOARD,
      cancelled: false,
    });
    vi.mocked(promptUILanguage).mockResolvedValue({
      value: Language.EN,
      cancelled: false,
    });
    vi.mocked(promptCommitLanguage).mockResolvedValue({
      value: Language.EN,
      cancelled: false,
    });
    vi.mocked(promptCustomRules).mockResolvedValue({
      value: [],
      cancelled: false,
    });
    vi.mocked(saveConfiguration).mockResolvedValue();

    await initCommand();

    expect(saveConfiguration).toHaveBeenCalledWith({
      provider: Provider.OPENAI,
      apiKey: "test-key",
      model: "gpt-4",
      maxCommitLength: 72,
      commitChoicesCount: 5,
      redactSensitiveData: true,
      usageMode: UsageMode.CLIPBOARD,
      uiLanguage: Language.EN,
      commitLanguage: Language.EN,
    });
    expect(message).toHaveBeenCalledWith("Configuration saved", {
      type: "success",
      variant: "title",
    });
  });

  it("prompts for overwrite when configuration exists", async () => {
    vi.mocked(configurationExists).mockResolvedValue(true);
    vi.mocked(prompts).mockResolvedValue({ overwrite: false });

    await initCommand();

    expect(prompts).toHaveBeenCalledWith({
      type: "confirm",
      name: "overwrite",
      message: "Configuration already exists. Do you want to overwrite it?",
      initial: false,
    });
    expect(message).toHaveBeenCalledWith("Keeping existing configuration.", {
      type: "warning",
      variant: "title",
    });
    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("cancels when provider selection is cancelled", async () => {
    vi.mocked(configurationExists).mockResolvedValue(false);
    vi.mocked(promptProvider).mockResolvedValue({
      value: undefined,
      cancelled: true,
    });

    await initCommand();

    expect(message).toHaveBeenCalledWith("Setup cancelled.", { type: "warning", variant: "title" });
    expect(saveConfiguration).not.toHaveBeenCalled();
  });

  it("exits when API key validation fails", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("Process exit");
    });

    vi.mocked(configurationExists).mockResolvedValue(false);
    vi.mocked(promptProvider).mockResolvedValue({
      value: Provider.OPENAI,
      cancelled: false,
    });
    vi.mocked(promptApiKey).mockResolvedValue({
      value: "invalid-key",
      cancelled: false,
    });
    vi.mocked(validateApiKey).mockResolvedValue(false);

    await expect(initCommand()).rejects.toThrow("Process would exit with code 1");

    mockExit.mockRestore();
  });

  it("handles cancellation at each step", async () => {
    const testCases = [
      {
        step: "API key",
        setup: () => {
          vi.mocked(configurationExists).mockResolvedValue(false);
          vi.mocked(promptProvider).mockResolvedValue({
            value: Provider.OPENAI,
            cancelled: false,
          });
          vi.mocked(promptApiKey).mockResolvedValue({
            value: undefined,
            cancelled: true,
          });
        },
      },
      {
        step: "Model selection",
        setup: () => {
          vi.mocked(configurationExists).mockResolvedValue(false);
          vi.mocked(promptProvider).mockResolvedValue({
            value: Provider.OPENAI,
            cancelled: false,
          });
          vi.mocked(promptApiKey).mockResolvedValue({
            value: "test-key",
            cancelled: false,
          });
          vi.mocked(validateApiKey).mockResolvedValue(true);
          vi.mocked(validateAndSelectModel).mockResolvedValue({
            value: undefined,
            cancelled: true,
          });
        },
      },
    ];

    for (const testCase of testCases) {
      vi.clearAllMocks();
      testCase.setup();

      await initCommand();

      expect(message).toHaveBeenCalledWith("Setup cancelled.", {
        type: "warning",
        variant: "title",
      });
      expect(saveConfiguration).not.toHaveBeenCalled();
    }
  });

});
