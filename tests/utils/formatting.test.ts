import { describe, it, expect, vi } from "vitest";
import {
  getProviderDisplayName,
  getUsageModeChoices,
  getLanguageDisplayName,
  getLanguageChoices,
} from "../../src/utils/formatting.js";
import { Provider, UsageMode, Language } from "../../src/types/index.js";

vi.mock("../../src/utils/i18n.js", () => ({
  t: vi.fn((key: string) => {
    const translations: Record<string, string> = {
      "providers.openai": "OpenAI",
      "providers.anthropic": "Anthropic",
      "providers.ollama": "Ollama",
      "providers.gemini": "Gemini",
      "usageModes.interactive.name": "Create commit",
      "usageModes.interactive.description": "Generate message and create commit interactively",
      "usageModes.automatic.name": "Copy to clipboard",
      "usageModes.automatic.description": "Generate and copy message to clipboard",
      "usageModes.terminal.name": "Terminal output",
      "usageModes.terminal.description": "Output commit command to terminal for editing",
      "languages.english": "English",
      "languages.spanish": "Español",
      "languages.french": "Français",
      "languages.german": "Deutsch",
      "languages.italian": "Italiano",
      "languages.portuguese": "Português",
      "languages.dutch": "Dutch",
      "languages.russian": "Русский",
      "languages.japanese": "日本語",
      "languages.chinese": "中文",
      "languages.korean": "한국어",
      "languages.arabic": "العربية",
      "languages.hindi": "हिन्दी",
      "languages.turkish": "Türkçe",
      "languages.polish": "Polski",
      "languages.swedish": "Svenska",
      "languages.danish": "Dansk",
      "languages.norwegian": "Norsk",
      "languages.finnish": "Suomi",
      "languages.czech": "Čeština",
      "languages.hebrew": "עברית",
      "languages.thai": "ไทย",
      "languages.vietnamese": "Tiếng Việt",
      "languages.indonesian": "Bahasa Indonesia",
      "languages.ukrainian": "Українська",
    };
    return translations[key] || key;
  }),
}));

describe("getProviderDisplayName", () => {
  it("converts OPENAI to friendly name", () => {
    expect(getProviderDisplayName(Provider.OPENAI)).toBe("OpenAI");
    expect(getProviderDisplayName("OPENAI")).toBe("OpenAI");
    expect(getProviderDisplayName("openai")).toBe("OpenAI");
  });

  it("converts ANTHROPIC to friendly name", () => {
    expect(getProviderDisplayName(Provider.ANTHROPIC)).toBe("Anthropic");
    expect(getProviderDisplayName("ANTHROPIC")).toBe("Anthropic");
    expect(getProviderDisplayName("anthropic")).toBe("Anthropic");
  });

  it("returns original string for unsupported providers", () => {
    expect(getProviderDisplayName("unsupported")).toBe("unsupported");
  });

  it("handles empty string", () => {
    expect(getProviderDisplayName("")).toBe("");
  });
});

describe("getUsageModeChoices", () => {
  it("contains all usage modes with descriptions", () => {
    const usageModeChoices = getUsageModeChoices();
    expect(usageModeChoices).toHaveLength(3);

    expect(usageModeChoices[0]).toEqual({
      title: "Terminal output",
      value: UsageMode.TERMINAL,
      description: "Output commit command to terminal for editing",
    });

    expect(usageModeChoices[1]).toEqual({
      title: "Create commit",
      value: UsageMode.COMMIT,
      description: "Generate message and create commit interactively",
    });

    expect(usageModeChoices[2]).toEqual({
      title: "Copy to clipboard",
      value: UsageMode.CLIPBOARD,
      description: "Generate and copy message to clipboard",
    });
  });
});

describe("getLanguageDisplayName", () => {
  it("returns localized name for English", () => {
    expect(getLanguageDisplayName(Language.EN)).toBe("English");
  });

  it("returns native names for other languages", () => {
    expect(getLanguageDisplayName(Language.ES)).toBe("Español");
    expect(getLanguageDisplayName(Language.FR)).toBe("Français");
    expect(getLanguageDisplayName(Language.DE)).toBe("Deutsch");
    expect(getLanguageDisplayName(Language.IT)).toBe("Italiano");
    expect(getLanguageDisplayName(Language.PT)).toBe("Português");
    expect(getLanguageDisplayName(Language.NL)).toBe("Dutch");
    expect(getLanguageDisplayName(Language.RU)).toBe("Русский");
    expect(getLanguageDisplayName(Language.JA)).toBe("日本語");
    expect(getLanguageDisplayName(Language.ZH)).toBe("中文");
    expect(getLanguageDisplayName(Language.KO)).toBe("한국어");
    expect(getLanguageDisplayName(Language.AR)).toBe("العربية");
    expect(getLanguageDisplayName(Language.HI)).toBe("हिन्दी");
    expect(getLanguageDisplayName(Language.TR)).toBe("Türkçe");
    expect(getLanguageDisplayName(Language.PL)).toBe("Polski");
    expect(getLanguageDisplayName(Language.SV)).toBe("Svenska");
    expect(getLanguageDisplayName(Language.DA)).toBe("Dansk");
    expect(getLanguageDisplayName(Language.NO)).toBe("Norsk");
    expect(getLanguageDisplayName(Language.FI)).toBe("Suomi");
    expect(getLanguageDisplayName(Language.CS)).toBe("Čeština");
    expect(getLanguageDisplayName(Language.HE)).toBe("עברית");
    expect(getLanguageDisplayName(Language.TH)).toBe("ไทย");
    expect(getLanguageDisplayName(Language.VI)).toBe("Tiếng Việt");
    expect(getLanguageDisplayName(Language.ID)).toBe("Bahasa Indonesia");
    expect(getLanguageDisplayName(Language.UK)).toBe("Українська");
  });

  it("returns the language code for unknown languages", () => {
    expect(getLanguageDisplayName("unknown" as Language)).toBe("unknown");
  });
});

describe("getLanguageChoices", () => {
  it("returns English as the first option", () => {
    const choices = getLanguageChoices();
    expect(choices[0]).toEqual({
      title: "English",
      value: Language.EN,
    });
  });

  it("returns all language options", () => {
    const choices = getLanguageChoices();
    const languageCount = Object.keys(Language).length;
    expect(choices).toHaveLength(languageCount);
  });

  it("sorts other languages alphabetically by display name", () => {
    const choices = getLanguageChoices();
    const otherLanguages = choices.slice(1);
    
    const sortedNames = otherLanguages.map(choice => choice.title);
    const expectedSorted = [...sortedNames].sort((a, b) => a.localeCompare(b));
    
    expect(sortedNames).toEqual(expectedSorted);
  });

  it("includes proper title and value for each language", () => {
    const choices = getLanguageChoices();
    
    choices.forEach(choice => {
      expect(choice).toHaveProperty("title");
      expect(choice).toHaveProperty("value");
      expect(choice.title).toBeTruthy();
      expect(Object.values(Language)).toContain(choice.value);
    });
  });
});