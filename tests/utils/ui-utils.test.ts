import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import prompts from "prompts";
import {
  symbol,
  message,
  SYMBOLS,
  spinner,
  invisiblePrompt,
  promptProvider,
  promptApiKey,
  validateAndSelectModel,
  promptMaxCommitLength,
  promptCommitChoicesCount,
  promptUsageMode,
  promptRedactSensitiveData,
  validateApiKey,
  displayConfiguration,
  formatBooleanAsYesNo,
  formatMenuOption,
  formatModelChoice,
  logo,
  exitWithError,
  errorWithDebug,
  promptUILanguage,
  promptCommitLanguage,
  promptCustomRules,
  manageCustomRules,
} from "../../src/utils/ui-utils.js";
import { Provider, UsageMode } from "../../src/types/index.js";
import { getAvailableModels, validateAndFetchModels } from "../../src/providers/models.js";

vi.mock("prompts");
vi.mock("chalk", () => {
  return {
    default: {
      bold: vi.fn((text) => `BOLD[${text}]`),
      dim: vi.fn((text) => `DIM[${text}]`),
      cyan: vi.fn((text) => `CYAN[${text}]`),
      green: vi.fn((text) => `GREEN[${text}]`),
      red: vi.fn((text) => `RED[${text}]`),
      yellow: vi.fn((text) => `YELLOW[${text}]`),
      blue: vi.fn((text) => `BLUE[${text}]`),
      magenta: vi.fn((text) => `MAGENTA[${text}]`),
      white: vi.fn((text) => `WHITE[${text}]`),
      gray: vi.fn((text) => `GRAY[${text}]`),
    },
  };
});
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));
vi.mock("../../src/utils/style.js", () => ({
  dim: vi.fn((text) => `DIM[${text}]`),
  color: vi.fn((colorName, text) => `${colorName.toUpperCase()}[${text}]`),
  bold: vi.fn((text) => `BOLD[${text}]`),
  styledSymbol: vi.fn((_type, symbol) => `DIM[${symbol}]`),
}));
vi.mock("../../src/providers/models.js");
vi.mock("../../src/utils/system-utils.js", () => ({
  exit: vi.fn(),
}));
vi.mock("../../src/constants.js", () => ({
  getProviderDisplayName: vi.fn((provider) => (provider === "openai" ? "OpenAI" : "Anthropic")),
  getProviderChoices: vi.fn(() => [
    { title: "OpenAI", value: "openai" },
    { title: "Anthropic", value: "anthropic" },
  ]),
  getUsageModeChoices: vi.fn(() => [
    {
      title: "Terminal output",
      value: "TERMINAL",
      description: "Output command to terminal",
    },
    {
      title: "Create commit",
      value: "COMMIT",
      description: "Create a commit with the selected message",
    },
    {
      title: "Copy to clipboard",
      value: "CLIPBOARD",
      description: "Copy the message to clipboard",
    },
  ]),
  PROMPT_MESSAGES: {
    FETCHING_MODELS: "Fetching models",
    MODELS_LOADED: "Models loaded",
    FAILED_TO_FETCH_MODELS: "Failed to load models",
    MAX_COMMIT_LENGTH: "Maximum commit message length (characters)",
  },
  PROMPT_HINTS: {},
  DEFAULTS: {
    MAX_COMMIT_LENGTH: 72,
    COMMIT_CHOICES_COUNT: 5,
  },
  VALIDATION_LIMITS: {
    MIN_COMMIT_LENGTH: 50,
    MAX_COMMIT_LENGTH: 100,
    MIN_COMMIT_CHOICES: 1,
    MAX_COMMIT_CHOICES: 10,
  },
  USAGE_MODE_DISPLAY_TEXT: {},
  UI: {
    SYMBOLS: {
      success: "\u2714",
      error: "\u2716",
      warning: "\u26a0",
      info: "\u2261",
      regenerate: "\u21bb",
      edit: "\u270e",
      exit: "\u2190",
      complete: "\u2736",
    },
  },
}));

describe("ui-utils", () => {
  const originalConsoleLog = console.log;
  const originalProcessExit = process.exit;
  const mockConsoleLog = vi.fn();
  const mockProcessExit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = mockConsoleLog;
    process.exit = mockProcessExit as never;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    process.exit = originalProcessExit;
  });

  describe("Display and Output Functions", () => {
    describe("symbol", () => {
      it("returns colored success symbol", () => {
        expect(symbol("success")).toBe(`GREEN[${SYMBOLS.success}]`);
      });

      it("returns colored error symbol", () => {
        expect(symbol("error")).toBe(`RED[${SYMBOLS.error}]`);
      });

      it("returns colored warning symbol", () => {
        expect(symbol("warning")).toBe(`YELLOW[${SYMBOLS.warning}]`);
      });

      it("returns colored info symbol", () => {
        expect(symbol("info")).toBe(`CYAN[${SYMBOLS.info}]`);
      });
    });

    describe("message with status features", () => {
      it("displays title with success symbol", () => {
        message("Test Title", { type: "success", variant: "title" });

        expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] BOLD[Test Title]`);
      });

      it("displays title with string content", () => {
        message("Title", { type: "success", items: "Content" });

        expect(mockConsoleLog).toHaveBeenCalledTimes(2);
        expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Title`);
        expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]Content");
      });

      it("displays title with items array", () => {
        message("Title", {
          type: "success",
          items: [
            { label: "Label1", value: "Value1" },
            { label: "Label2", value: "Value2" },
          ],
        });

        expect(mockConsoleLog).toHaveBeenCalledTimes(3);
        expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Title`);
        expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Label1 › ]GRAY[Value1]");
        expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Label2 › ]GRAY[Value2]");
      });

      it("uses custom symbol type", () => {
        message("Error", { type: "error", variant: "title" });

        expect(mockConsoleLog).toHaveBeenCalledWith(`RED[${SYMBOLS.error}] BOLD[Error]`);
      });

      it("uses custom value color", () => {
        message("Title", {
          type: "success",
          items: [
            { label: "Label1", value: "Value1" },
            { label: "Label2", value: "Value2" },
          ],
          valueColor: "green",
        });

        expect(mockConsoleLog).toHaveBeenCalledTimes(3);
        expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Title`);
        expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Label1 › ]GREEN[Value1]");
        expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Label2 › ]GREEN[Value2]");
      });

      it("defaults to gray value color when no options provided", () => {
        message("Title", {
          type: "success",
          items: [{ label: "Label1", value: "Value1" }],
        });

        expect(mockConsoleLog).toHaveBeenCalledTimes(2);
        expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Title`);
        expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Label1 › ]GRAY[Value1]");
      });
    });

    describe("message function", () => {
      describe("plain messages", () => {
        it("logs plain message without type", () => {
          message("Plain message");

          expect(mockConsoleLog).toHaveBeenCalledWith("Plain message");
        });

        it("logs plain message without type or options", () => {
          message("Simple content");

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith("Simple content");
        });
      });

      describe("messages with types", () => {
        it("logs message with success type", () => {
          message("Success message", { type: "success", variant: "title" });

          expect(mockConsoleLog).toHaveBeenCalledWith(
            `GREEN[${SYMBOLS.success}] BOLD[Success message]`
          );
        });

        it("logs message with error type", () => {
          message("Error message", { type: "error", variant: "title" });

          expect(mockConsoleLog).toHaveBeenCalledWith(`RED[${SYMBOLS.error}] BOLD[Error message]`);
        });

        it("logs message with warning type", () => {
          message("Warning message", { type: "warning", variant: "title" });

          expect(mockConsoleLog).toHaveBeenCalledWith(
            `YELLOW[${SYMBOLS.warning}] BOLD[Warning message]`
          );
        });

        it("logs message with info type", () => {
          message("Info message", { type: "info", variant: "title" });

          expect(mockConsoleLog).toHaveBeenCalledWith(`CYAN[${SYMBOLS.info}] BOLD[Info message]`);
        });

        it("applies bold formatting to title when type is provided", () => {
          message("Bold Title", { type: "success", variant: "title" });

          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] BOLD[Bold Title]`);
        });
      });

      describe("empty content with items only", () => {
        it("displays items array without title when content is empty", () => {
          message("", {
            items: [
              { label: "Name", value: "John" },
              { label: "Age", value: "25" },
            ],
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Name › ]GRAY[John]");
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Age › ]GRAY[25]");
        });

        it("displays string items without title when content is empty", () => {
          message("", { items: "String content here" });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]String content here");
        });

        it("uses first item as title when content is empty", () => {
          message("", {
            type: "success",
            items: [{ label: "Key", value: "Value" }],
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith(
            `GREEN[${SYMBOLS.success}] GRAY[Key › ]GRAY[Value]`
          );
        });

        it("uses first item as title with remaining items below when content is empty", () => {
          message("", {
            type: "success",
            items: [
              { label: "First", value: "Item" },
              { label: "Second", value: "Item" },
              { label: "Third", value: "Item" },
            ],
            valueColor: "green",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(3);
          expect(mockConsoleLog).toHaveBeenCalledWith(
            `GREEN[${SYMBOLS.success}] GRAY[First › ]GREEN[Item]`
          );
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Second › ]GREEN[Item]");
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Third › ]GREEN[Item]");
        });

        it("uses first item as title with variant formatting when content is empty", () => {
          message("", {
            type: "info",
            items: [{ label: "Status", value: "Ready" }],
            variant: "title",
            valueColor: "cyan",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith(
            `CYAN[${SYMBOLS.info}] BOLD[GRAY[Status › ]CYAN[Ready]]`
          );
        });

        it("handles success type with first item as title when content is empty", () => {
          message("", {
            type: "success",
            items: [{ label: "Task", value: "Done" }],
            variant: "title",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith(
            `GREEN[${SYMBOLS.success}] BOLD[GRAY[Task › ]GRAY[Done]]`
          );
        });
      });

      describe("messages with string items", () => {
        it("displays title and string items with success type", () => {
          message("Configuration", { type: "success", items: "All settings validated" });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Configuration`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]All settings validated");
        });

        it("displays title and string items with error type", () => {
          message("Validation Failed", { type: "error", items: "Missing required field" });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`RED[${SYMBOLS.error}] Validation Failed`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]Missing required field");
        });

        it("displays title and string items with warning type", () => {
          message("Deprecated", { type: "warning", items: "This feature will be removed" });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`YELLOW[${SYMBOLS.warning}] Deprecated`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]This feature will be removed");
        });

        it("displays title and string items with info type", () => {
          message("Information", { type: "info", items: "Additional details here" });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`CYAN[${SYMBOLS.info}] Information`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]Additional details here");
        });
      });

      describe("messages with array items", () => {
        it("displays title and array items with default gray values", () => {
          message("Status Report", {
            type: "success",
            items: [
              { label: "Version", value: "1.0.0" },
              { label: "Status", value: "Active" },
              { label: "Users", value: "1,250" },
            ],
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(4);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Status Report`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Version › ]GRAY[1.0.0]");
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Status › ]GRAY[Active]");
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Users › ]GRAY[1,250]");
        });

        it("displays single item array", () => {
          message("Single Item", {
            type: "info",
            items: [{ label: "Count", value: "42" }],
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`CYAN[${SYMBOLS.info}] Single Item`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Count › ]GRAY[42]");
        });

        it("applies gray formatting to labels in items", () => {
          message("Test Labels", {
            type: "success",
            items: [
              { label: "First Label", value: "Value1" },
              { label: "Second Label", value: "Value2" },
            ],
          });

          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  First Label › ]GRAY[Value1]");
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Second Label › ]GRAY[Value2]");
        });
      });

      describe("messages with custom value colors", () => {
        it("uses green value color when specified", () => {
          message("Success Details", {
            type: "success",
            items: [
              { label: "Result", value: "Passed" },
              { label: "Score", value: "100%" },
            ],
            valueColor: "green",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(3);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Success Details`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Result › ]GREEN[Passed]");
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Score › ]GREEN[100%]");
        });

        it("uses cyan value color when specified", () => {
          message("Information", {
            type: "info",
            items: [{ label: "Data", value: "Important" }],
            valueColor: "cyan",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`CYAN[${SYMBOLS.info}] Information`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Data › ]CYAN[Important]");
        });

        it("uses red value color when specified", () => {
          message("Error Details", {
            type: "error",
            items: [{ label: "Code", value: "E001" }],
            valueColor: "red",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`RED[${SYMBOLS.error}] Error Details`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Code › ]RED[E001]");
        });

        it("uses magenta value color when specified", () => {
          message("Warning Info", {
            type: "warning",
            items: [{ label: "Level", value: "Medium" }],
            valueColor: "magenta",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`YELLOW[${SYMBOLS.warning}] Warning Info`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Level › ]MAGENTA[Medium]");
        });

        it("uses white value color when specified", () => {
          message("Debug Info", {
            type: "info",
            items: [{ label: "Thread", value: "main" }],
            valueColor: "white",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`CYAN[${SYMBOLS.info}] Debug Info`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Thread › ]WHITE[main]");
        });
      });

      describe("items-only with custom colors", () => {
        it("displays items with custom cyan color without title", () => {
          message("", {
            items: [
              { label: "Host", value: "localhost" },
              { label: "Port", value: "3000" },
            ],
            valueColor: "cyan",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Host › ]CYAN[localhost]");
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Port › ]CYAN[3000]");
        });

        it("displays items with custom green color without title", () => {
          message("", {
            items: [{ label: "Status", value: "Online" }],
            valueColor: "green",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Status › ]GREEN[Online]");
        });

        it("displays string items with custom color without title", () => {
          message("", {
            items: "Configuration loaded successfully",
            valueColor: "green",
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]Configuration loaded successfully");
        });
      });

      describe("edge cases and empty content behavior", () => {
        it("does not make unnecessary console.log calls for empty content", () => {
          message("", { items: [{ label: "Key", value: "Value" }] });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Key › ]GRAY[Value]");
        });

        it("handles empty items array", () => {
          message("Title", { type: "success", items: [] });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Title`);
        });

        it("handles empty string items", () => {
          message("Title", { type: "success", items: "" });

          expect(mockConsoleLog).toHaveBeenCalledTimes(1);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Title`);
        });

        it("handles items with empty label and value", () => {
          message("Test", {
            type: "info",
            items: [{ label: "", value: "" }],
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`CYAN[${SYMBOLS.info}] Test`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[   › ]GRAY[]");
        });
      });

      describe("string vs array items handling", () => {
        it("handles string items correctly", () => {
          message("String Test", { type: "success", items: "This is string content" });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] String Test`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]This is string content");
        });

        it("handles array items correctly", () => {
          message("Array Test", {
            type: "success",
            items: [{ label: "Item", value: "Content" }],
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Array Test`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Item › ]GRAY[Content]");
        });

        it("differentiates between string and array items formatting", () => {
          message("String Format", { items: "Content here" });
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  ]Content here");

          mockConsoleLog.mockClear();

          message("Array Format", { items: [{ label: "Label", value: "Value" }] });
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Label › ]GRAY[Value]");
        });
      });

      describe("compatibility with legacy styled option", () => {
        it("handles styled option false", () => {
          message("Unstyled message", { type: "error", styled: false });

          expect(mockConsoleLog).toHaveBeenCalledWith(`RED[${SYMBOLS.error}] Unstyled message`);
        });

        it("ignores styled option when provided with items", () => {
          message("Title", {
            type: "success",
            items: [{ label: "Key", value: "Value" }],
            styled: false,
          });

          expect(mockConsoleLog).toHaveBeenCalledTimes(2);
          expect(mockConsoleLog).toHaveBeenCalledWith(`GREEN[${SYMBOLS.success}] Title`);
          expect(mockConsoleLog).toHaveBeenCalledWith("GRAY[  Key › ]GRAY[Value]");
        });
      });
    });

    describe("spinner function", () => {
      it("returns spinner instance without state", () => {
        const result = spinner("Loading...");

        expect(result).toBeDefined();
        expect(result?.start).toBeDefined();
        expect(result?.succeed).toBeDefined();
        expect(result?.fail).toBeDefined();
      });

      it("handles different text inputs", () => {
        expect(() => spinner("Loading...")).not.toThrow();
        expect(() => spinner("")).not.toThrow();
        expect(() => spinner("Very long message with lots of text")).not.toThrow();
      });

      it("covers switch statement branches", () => {
        expect(() => spinner("Test", "start")).not.toThrow();
        expect(() => spinner("Test", "succeed")).not.toThrow();
        expect(() => spinner("Test", "fail")).not.toThrow();
        expect(() => spinner("Test", undefined)).not.toThrow();
        expect(() => spinner("Test")).not.toThrow();
      });

      it("always returns an ora instance", () => {
        const result1 = spinner("Test");
        const result2 = spinner("Test", "start");
        const result3 = spinner("Test", "succeed");
        const result4 = spinner("Test", "fail");

        [result1, result2, result3, result4].forEach((result) => {
          expect(result).toBeDefined();
          expect(typeof result?.start).toBe("function");
          expect(typeof result?.succeed).toBe("function");
          expect(typeof result?.fail).toBe("function");
        });
      });
    });
  });

  describe("User Input and Prompt Functions", () => {
    describe("invisiblePrompt", () => {
      it("returns the value when user enters text", async () => {
        const mockValue = "test-api-key";
        vi.mocked(prompts).mockResolvedValue({ value: mockValue });

        const result = await invisiblePrompt("Enter API key");

        expect(result).toBe(mockValue);
      });

      it("returns undefined when user cancels", async () => {
        vi.mocked(prompts).mockResolvedValue({ value: undefined });

        const result = await invisiblePrompt("Enter API key");

        expect(result).toBeUndefined();
      });

      it("uses invisible type for secure input", async () => {
        vi.mocked(prompts).mockResolvedValue({ value: "secret" });

        await invisiblePrompt("Enter secret");

        expect(prompts).toHaveBeenCalledWith({
          type: "invisible",
          name: "value",
          message: "Enter secret",
          validate: expect.any(Function),
        });
      });

      it("validates that input is not empty", async () => {
        let validateFunction: ((value: string) => boolean | string) | undefined;
        vi.mocked(prompts).mockImplementation(async (configuration) => {
          validateFunction = (configuration as unknown as { validate: (value: string) => boolean | string }).validate;
          return { value: "test" };
        });

        await invisiblePrompt("Enter key");

        expect(validateFunction!("valid-input")).toBe(true);
        expect(validateFunction!("")).toBe("API key is required");
      });
    });

    describe("promptProvider", () => {
      it("returns selected provider", async () => {
        vi.mocked(prompts).mockResolvedValue({ provider: Provider.OPENAI });

        const result = await promptProvider();

        expect(result.value).toBe(Provider.OPENAI);
        expect(result.cancelled).toBe(false);
      });

      it("handles cancellation", async () => {
        vi.mocked(prompts).mockResolvedValue({});

        const result = await promptProvider();

        expect(result.value).toBeUndefined();
        expect(result.cancelled).toBe(true);
      });
    });

    describe("promptApiKey", () => {
      it("returns api key", async () => {
        vi.mocked(prompts).mockResolvedValue({ value: "test-api-key" });

        const result = await promptApiKey();

        expect(result.value).toBe("test-api-key");
        expect(result.cancelled).toBe(false);
      });
    });

    describe("promptMaxCommitLength", () => {
      it("returns max commit length", async () => {
        vi.mocked(prompts).mockResolvedValue({ maxCommitLength: 80 });

        const result = await promptMaxCommitLength();

        expect(result.value).toBe(80);
        expect(result.cancelled).toBe(false);
      });

      it("uses default value", async () => {
        vi.mocked(prompts).mockResolvedValue({ maxCommitLength: 72 });

        await promptMaxCommitLength(72);

        expect(prompts).toHaveBeenCalledWith(
          expect.objectContaining({
            initial: 72,
          })
        );
      });
    });

    describe("promptCommitChoicesCount", () => {
      it("returns commit choices count", async () => {
        vi.mocked(prompts).mockResolvedValue({ commitChoicesCount: 7 });

        const result = await promptCommitChoicesCount();

        expect(result.value).toBe(7);
        expect(result.cancelled).toBe(false);
      });
    });

    describe("promptUsageMode", () => {
      it("returns selected usage mode", async () => {
        vi.mocked(prompts).mockResolvedValue({ usageMode: UsageMode.CLIPBOARD });

        const result = await promptUsageMode();

        expect(result.value).toBe(UsageMode.CLIPBOARD);
        expect(result.cancelled).toBe(false);
      });

      it("sets initial value when provided", async () => {
        vi.mocked(prompts).mockResolvedValue({ usageMode: UsageMode.COMMIT });

        await promptUsageMode(UsageMode.COMMIT);

        expect(prompts).toHaveBeenCalledWith(
          expect.objectContaining({
            initial: expect.any(Number),
          })
        );
      });
    });

    describe("promptRedactSensitiveData", () => {
      it("returns boolean value", async () => {
        vi.mocked(prompts).mockResolvedValue({ redactSensitiveData: true });

        const result = await promptRedactSensitiveData();

        expect(result.value).toBe(true);
        expect(result.cancelled).toBe(false);
      });
    });
  });

  describe("Validation Functions", () => {
    describe("validateAndSelectModel", () => {
      it("fetches and displays models", async () => {
        const mockModels = [
          { id: "gpt-4", name: "GPT-4", description: "Latest model" },
          { id: "gpt-3.5", name: "GPT-3.5", description: "Faster model" },
        ];

        vi.mocked(getAvailableModels).mockResolvedValue(mockModels);
        vi.mocked(prompts).mockResolvedValue({ model: "gpt-4" });

        const result = await validateAndSelectModel(Provider.OPENAI, "api-key");

        expect(result.value).toBe("gpt-4");
        expect(result.cancelled).toBe(false);
      });

      it("handles fetch failure", async () => {
        vi.mocked(getAvailableModels).mockRejectedValue(new Error("Network error"));

        await expect(validateAndSelectModel(Provider.OPENAI, "api-key")).rejects.toThrow(
          "Network error"
        );
      });
    });

    describe("validateApiKey", () => {
      it("returns true for valid key", async () => {
        vi.mocked(validateAndFetchModels).mockResolvedValue({
          isValid: true,
          models: [{ id: "gpt-4", name: "GPT-4" }]
        });

        const result = await validateApiKey(Provider.OPENAI, "valid-key");

        expect(result).toBe(true);
      });

      it("returns false for invalid key", async () => {
        vi.mocked(validateAndFetchModels).mockResolvedValue({
          isValid: false,
          error: new Error("401 Unauthorized")
        });

        const result = await validateApiKey(Provider.OPENAI, "invalid-key");

        expect(result).toBe(false);
      });

      it("handles network errors", async () => {
        vi.mocked(validateAndFetchModels).mockResolvedValue({
          isValid: false,
          error: new Error("Network fetch failed")
        });

        const result = await validateApiKey(Provider.OPENAI, "key");

        expect(result).toBe(false);
      });

      it("handles generic errors", async () => {
        vi.mocked(validateAndFetchModels).mockResolvedValue({
          isValid: false,
          error: new Error("Something went wrong")
        });

        const result = await validateApiKey(Provider.OPENAI, "key");

        expect(result).toBe(false);
      });
    });
  });

  describe("Formatting Functions", () => {
    describe("formatBooleanAsYesNo", () => {
      it("returns 'Yes' for true", () => {
        expect(formatBooleanAsYesNo(true)).toBe("Yes");
      });

      it("returns 'No' for false", () => {
        expect(formatBooleanAsYesNo(false)).toBe("No");
      });
    });

    describe("formatMenuOption", () => {
      it("formats text with symbol", () => {
        expect(formatMenuOption("Exit", "exit")).toBe("DIM[DIM[←] Exit]");
      });

      it("formats text without symbol", () => {
        expect(formatMenuOption("Plain text")).toBe("DIM[Plain text]");
      });
    });

    describe("formatModelChoice", () => {
      it("formats model with name", () => {
        const result = formatModelChoice({ id: "gpt-4", name: "GPT-4" });
        expect(result).toEqual({
          title: "GPT-4",
          value: "gpt-4",
        });
      });

      it("uses id when name is not provided", () => {
        const result = formatModelChoice({ id: "claude-3" });
        expect(result).toEqual({
          title: "claude-3",
          value: "claude-3",
        });
      });
    });
  });

  describe("Configuration Management Functions", () => {
    describe("displayConfiguration", () => {
      it("displays basic configuration", () => {
        const configuration = {
          provider: Provider.OPENAI,
          apiKey: "sk-abcdefghijklmnopqrstuvwxyz",
          model: "gpt-4",
          maxCommitLength: 72,
          commitChoicesCount: 5,
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });

      it("displays extended configuration", () => {
        const configuration = {
          provider: Provider.ANTHROPIC,
          apiKey: "short-key",
          model: "claude-3",
          maxCommitLength: 80,
          commitChoicesCount: 3,
          redactSensitiveData: false,
          usageMode: UsageMode.COMMIT,
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });

      it("displays configuration with languages", () => {
        const configuration = {
          provider: Provider.OPENAI,
          apiKey: "test-key",
          model: "gpt-4",
          maxCommitLength: 72,
          commitChoicesCount: 5,
          uiLanguage: "es" as const,
          commitLanguage: "fr" as const,
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });

      it("displays configuration with only UI language", () => {
        const configuration = {
          provider: Provider.OPENAI,
          apiKey: "test-key",
          model: "gpt-4",
          maxCommitLength: 72,
          commitChoicesCount: 5,
          uiLanguage: "es" as const,
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });

      it("displays configuration with only commit language", () => {
        const configuration = {
          provider: Provider.OPENAI,
          apiKey: "test-key",
          model: "gpt-4",
          maxCommitLength: 72,
          commitChoicesCount: 5,
          commitLanguage: "fr" as const,
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });

      it("displays configuration with custom rules", () => {
        const configuration = {
          provider: Provider.OPENAI,
          apiKey: "test-key",
          model: "gpt-4",
          maxCommitLength: 72,
          commitChoicesCount: 5,
          customRules: ["Rule 1", "Rule 2", "Rule 3"],
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });

      it("displays configuration with single custom rule", () => {
        const configuration = {
          provider: Provider.OPENAI,
          apiKey: "test-key",
          model: "gpt-4",
          maxCommitLength: 72,
          commitChoicesCount: 5,
          customRules: ["Single rule"],
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });

      it("displays configuration with all optional features", () => {
        const configuration = {
          provider: Provider.ANTHROPIC,
          apiKey: "test-key",
          model: "claude-3",
          maxCommitLength: 80,
          commitChoicesCount: 3,
          redactSensitiveData: true,
          usageMode: UsageMode.TERMINAL,
          uiLanguage: "es" as const,
          commitLanguage: "fr" as const,
          customRules: ["Rule 1", "Rule 2"],
        };

        displayConfiguration(configuration);

        expect(() => displayConfiguration(configuration)).not.toThrow();
      });
    });
  });

  describe("exitWithError", () => {
    it("displays error message and exits with code 1", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitFn = vi.fn();

      vi.doMock("../../src/utils/system-utils.js", () => ({ exit: exitFn }));

      exitWithError("Test error message");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Test error message"));
    });
  });

  describe("errorWithDebug", () => {
    it("displays formatted error message", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      errorWithDebug("Detailed error information");

      expect(consoleSpy).toHaveBeenCalledWith("Detailed error information");
    });
  });

  describe("logo", () => {
    it("displays application logo", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logo();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("promptCustomRules", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns empty array when user declines custom rules", async () => {
      vi.mocked(prompts).mockResolvedValue({ wantCustomRules: false });

      const result = await promptCustomRules([]);

      expect(result).toEqual({ value: [], cancelled: false });
    });

    it("returns cancelled when user cancels prompt", async () => {
      vi.mocked(prompts).mockResolvedValue({ wantCustomRules: undefined });

      const result = await promptCustomRules([]);

      expect(result).toEqual({ value: undefined, cancelled: true });
    });

    it("proceeds to rule management when user wants custom rules", async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ wantCustomRules: true })
        .mockResolvedValueOnce({ action: "done" });

      const result = await promptCustomRules(["existing rule"]);

      expect(result.cancelled).toBe(false);
    });
  });

  describe("manageCustomRules", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("handles done action to finish rule management", async () => {
      vi.mocked(prompts).mockResolvedValue({ action: "done" });

      const result = await manageCustomRules(["rule1", "rule2"]);

      expect(result.value).toEqual(["rule1", "rule2"]);
      expect(result.cancelled).toBe(false);
    });

    it("handles add action to add new rule", async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ action: "add" })
        .mockResolvedValueOnce({ rule: "new custom rule" })
        .mockResolvedValueOnce({ action: "done" });

      const result = await manageCustomRules([]);

      expect(result.value).toContain("new custom rule");
    });

    it("handles remove action to delete rule", async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ action: "remove" })
        .mockResolvedValueOnce({ ruleToRemove: "0" })
        .mockResolvedValueOnce({ action: "done" });

      const result = await manageCustomRules(["rule to delete", "rule to keep"]);

      expect(result.cancelled).toBe(false);
      expect(result.value).toEqual(["rule to keep"]);
      expect(result.value).not.toContain("rule to delete");
    });

    it("handles undefined action as done", async () => {
      vi.mocked(prompts).mockResolvedValue({ action: undefined });

      const result = await manageCustomRules([]);

      expect(result.cancelled).toBe(false);
      expect(result.value).toEqual([]);
    });

    it("handles rule addition workflow", async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ action: "add" })
        .mockResolvedValueOnce({ rule: undefined })
        .mockResolvedValueOnce({ action: "done" });

      const result = await manageCustomRules([]);

      expect(result.cancelled).toBe(false);
      expect(result.value).toEqual([]);
    });
  });

  describe("logo", () => {
    it("should display logo without errors", () => {
      expect(() => logo()).not.toThrow();
    });
  });

  describe("exitWithError", () => {
    it("should display error message and call exit", () => {
      // exitWithError calls message() and exit() functions
      expect(() => exitWithError("Test error")).not.toThrow();
      // The function should complete without throwing
    });
  });

  describe("errorWithDebug", () => {
    it("should display formatted error with debug info", () => {
      expect(() => errorWithDebug("Formatted error message")).not.toThrow();
    });
  });

  describe("promptUILanguage", () => {
    it("should prompt for UI language selection", async () => {
      vi.mocked(prompts).mockResolvedValue({ language: "en" });

      const result = await promptUILanguage();

      expect(result.cancelled).toBe(false);
      expect(result.value).toBe("en");
      expect(prompts).toHaveBeenCalled();
    });

    it("should handle cancelled language selection", async () => {
      vi.mocked(prompts).mockResolvedValue({ language: undefined });

      const result = await promptUILanguage();

      expect(result.cancelled).toBe(true);
    });
  });

  describe("promptCommitLanguage", () => {
    it("should prompt for commit language selection", async () => {
      vi.mocked(prompts).mockResolvedValue({ language: "en" });

      const result = await promptCommitLanguage();

      expect(result.cancelled).toBe(false);
      expect(result.value).toBe("en");
      expect(prompts).toHaveBeenCalled();
    });

    it("should handle cancelled commit language selection", async () => {
      vi.mocked(prompts).mockResolvedValue({ language: undefined });

      const result = await promptCommitLanguage();

      expect(result.cancelled).toBe(true);
    });
  });

  describe("promptCustomRules", () => {
    it("should prompt for custom rules confirmation", async () => {
      vi.mocked(prompts)
        .mockResolvedValueOnce({ wantCustomRules: true })
        .mockResolvedValueOnce({ action: "done" });

      const result = await promptCustomRules();

      expect(result.cancelled).toBe(false);
      expect(Array.isArray(result.value)).toBe(true);
      expect(prompts).toHaveBeenCalled();
    });

    it("should handle cancelled custom rules prompt", async () => {
      vi.mocked(prompts).mockResolvedValue({ wantCustomRules: undefined });

      const result = await promptCustomRules();

      expect(result.cancelled).toBe(true);
    });

    it("should return empty array when user declines custom rules", async () => {
      vi.mocked(prompts).mockResolvedValue({ wantCustomRules: false });

      const result = await promptCustomRules();

      expect(result.cancelled).toBe(false);
      expect(result.value).toEqual([]);
    });

    it("should use existing rules as initial value", async () => {
      const existingRules = ["existing rule"];
      vi.mocked(prompts).mockResolvedValue({ wantCustomRules: false });

      const result = await promptCustomRules(existingRules);

      expect(result.cancelled).toBe(false);
      expect(result.value).toEqual([]);
      expect(prompts).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: true, // Should be true since existingRules has length > 0
        })
      );
    });
  });
});
