import { vi } from "vitest";

export const uiUtilsMock = {
  logo: vi.fn(),
  symbol: vi.fn((type: string) => {
    const symbols: Record<string, string> = {
      success: "✔",
      error: "✖",
      warning: "⚠",
      info: "≡",
      regenerate: "↻",
      edit: "✎",
      exit: "←",
    };
    return symbols[type] || "?";
  }),
  exitWithError: vi.fn((msg) => {
    throw new Error(msg || "Process would exit with code 1");
  }),
  errorWithDebug: vi.fn(),
  message: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), succeed: vi.fn(), fail: vi.fn() })),
  SYMBOLS: {
    success: "✔",
    error: "✖",
    warning: "⚠",
    info: "≡",
    regenerate: "↻",
    edit: "✎",
    exit: "←",
  },

  invisiblePrompt: vi.fn(),
  promptProvider: vi.fn(),
  promptApiKey: vi.fn(),
  validateAndSelectModel: vi.fn(),
  promptMaxCommitLength: vi.fn(),
  promptCommitChoicesCount: vi.fn(),
  promptRedactSensitiveData: vi.fn(),
  promptUsageMode: vi.fn(),
  promptUILanguage: vi.fn(),
  promptCommitLanguage: vi.fn(),
  validateApiKey: vi.fn(),

  formatModelChoice: vi.fn((model) => ({
    title: model.name || model.id,
    value: model.id,
  })),
  formatBooleanAsYesNo: vi.fn((value) => (value ? "Yes" : "No")),
  formatMenuOption: vi.fn((text: string, symbolName?: string) => {
    if (symbolName) {
      const symbolMap: Record<string, string> = {
        exit: "←",
        regenerate: "↻",
        edit: "✎",
        success: "✔",
        error: "✖",
        warning: "⚠",
        info: "≡",
      };
      const sym = symbolMap[symbolName] || symbolName;
      return `DIM[${sym} ${text}]`;
    }
    return `DIM[${text}]`;
  }),
  manageCustomRules: vi.fn(),
  displayConfiguration: vi.fn(),
  promptCustomRules: vi.fn(),
};
