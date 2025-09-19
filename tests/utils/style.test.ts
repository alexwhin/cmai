import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bold,
  dim,
  color,
  styledSymbol,
  type Color,
  type SymbolType,
} from "../../src/utils/style.js";

vi.mock("chalk", () => ({
  default: {
    green: vi.fn((text) => `chalk-green[${text}]`),
    red: vi.fn((text) => `chalk-red[${text}]`),
    yellow: vi.fn((text) => `chalk-yellow[${text}]`),
    cyan: vi.fn((text) => `chalk-cyan[${text}]`),
    magenta: vi.fn((text) => `chalk-magenta[${text}]`),
    white: vi.fn((text) => `chalk-white[${text}]`),
    gray: vi.fn((text) => `chalk-gray[${text}]`),
    blue: vi.fn((text) => `chalk-blue[${text}]`),
    bold: vi.fn((text) => `chalk-bold[${text}]`),
    dim: vi.fn((text) => `chalk-dim[${text}]`),
  },
}));

describe("style utilities", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("color function", () => {
    it("returns test-friendly strings in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(color("green", "success")).toBe("GREEN[success]");
      expect(color("red", "error")).toBe("RED[error]");
      expect(color("cyan", "info")).toBe("CYAN[info]");
      expect(color("magenta", "highlight")).toBe("MAGENTA[highlight]");
      expect(color("white", "text")).toBe("WHITE[text]");
      expect(color("gray", "dimmed")).toBe("GRAY[dimmed]");
    });

    it("returns chalk-styled strings in production environment", () => {
      process.env.NODE_ENV = "production";

      const result = color("green", "success");
      expect(result).toBe("chalk-green[success]");
    });

    it("handles all color variants", () => {
      process.env.NODE_ENV = "test";

      const colors: Color[] = ["green", "red", "cyan", "magenta", "white", "gray"];

      colors.forEach((colorName) => {
        const result = color(colorName, "test");
        expect(result).toBe(`${colorName.toUpperCase()}[test]`);
      });
    });

    it("uses white as default for unknown colors in test", () => {
      process.env.NODE_ENV = "test";

      const result = color("unknown" as Color, "test");
      expect(result).toBe("WHITE[test]");
    });

    it("preserves text content exactly", () => {
      process.env.NODE_ENV = "test";

      expect(color("green", "")).toBe("GREEN[]");
      expect(color("green", "special chars !@#$%^&*()")).toBe("GREEN[special chars !@#$%^&*()]");
      expect(color("green", "multiline\ntext")).toBe("GREEN[multiline\ntext]");
    });
  });

  describe("bold function", () => {
    it("returns test-friendly string in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(bold("important")).toBe("BOLD[important]");
      expect(bold("")).toBe("BOLD[]");
      expect(bold("multiple words")).toBe("BOLD[multiple words]");
    });

    it("returns chalk-styled string in production environment", () => {
      process.env.NODE_ENV = "production";

      const result = bold("important");
      expect(result).toBe("chalk-bold[important]");
    });

    it("handles special characters and whitespace", () => {
      process.env.NODE_ENV = "test";

      expect(bold("  spaced  ")).toBe("BOLD[  spaced  ]");
      expect(bold("symbols: !@#$%")).toBe("BOLD[symbols: !@#$%]");
      expect(bold("line1\nline2")).toBe("BOLD[line1\nline2]");
    });
  });

  describe("dim function", () => {
    it("returns test-friendly string in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(dim("subtle")).toBe("DIM[subtle]");
      expect(dim("")).toBe("DIM[]");
      expect(dim("faded text")).toBe("DIM[faded text]");
    });

    it("returns chalk-styled string in production environment", () => {
      process.env.NODE_ENV = "production";

      const result = dim("subtle");
      expect(result).toBe("chalk-dim[subtle]");
    });

    it("preserves content formatting", () => {
      process.env.NODE_ENV = "test";

      expect(dim("  leading/trailing  ")).toBe("DIM[  leading/trailing  ]");
      expect(dim("tabs\tand\nnewlines")).toBe("DIM[tabs\tand\nnewlines]");
    });
  });

  describe("styledSymbol function", () => {
    it("applies green color to success symbols in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(styledSymbol("success", "✔")).toBe("GREEN[✔]");
    });

    it("applies red color to error symbols in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(styledSymbol("error", "✖")).toBe("RED[✖]");
    });

    it("applies yellow color to warning symbols in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(styledSymbol("warning", "⚠")).toBe("YELLOW[⚠]");
    });

    it("applies cyan color to info symbols in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(styledSymbol("info", "≡")).toBe("CYAN[≡]");
    });

    it("applies dim styling to action symbols in test environment", () => {
      process.env.NODE_ENV = "test";

      expect(styledSymbol("regenerate", "↻")).toBe("DIM[↻]");
      expect(styledSymbol("edit", "✎")).toBe("DIM[✎]");
      expect(styledSymbol("exit", "←")).toBe("DIM[←]");
    });

    it("handles unknown symbol types by applying dim styling", () => {
      process.env.NODE_ENV = "test";

      expect(styledSymbol("unknown" as SymbolType, "?")).toBe("DIM[?]");
    });

    it("returns chalk-styled symbols in production environment", () => {
      process.env.NODE_ENV = "production";

      const result = styledSymbol("success", "✔");
      expect(result).toBe("chalk-green[✔]");
    });

    it("handles all symbol types correctly", () => {
      process.env.NODE_ENV = "test";

      const symbolTests: Array<{ type: SymbolType; char: string; expected: string }> = [
        { type: "success", char: "✔", expected: "GREEN[✔]" },
        { type: "error", char: "✖", expected: "RED[✖]" },
        { type: "warning", char: "⚠", expected: "YELLOW[⚠]" },
        { type: "info", char: "≡", expected: "CYAN[≡]" },
        { type: "regenerate", char: "↻", expected: "DIM[↻]" },
        { type: "edit", char: "✎", expected: "DIM[✎]" },
        { type: "exit", char: "←", expected: "DIM[←]" },
      ];

      symbolTests.forEach(({ type, char, expected }) => {
        expect(styledSymbol(type, char)).toBe(expected);
      });
    });

    it("preserves symbol characters exactly", () => {
      process.env.NODE_ENV = "test";

      expect(styledSymbol("success", "")).toBe("GREEN[]");
      expect(styledSymbol("success", "multiple chars")).toBe("GREEN[multiple chars]");
      expect(styledSymbol("error", "🚫")).toBe("RED[🚫]");
    });
  });

  describe("environment detection", () => {
    it("uses test formatting when NODE_ENV is test", () => {
      process.env.NODE_ENV = "test";

      expect(color("green", "test")).toBe("GREEN[test]");
      expect(bold("test")).toBe("BOLD[test]");
      expect(dim("test")).toBe("DIM[test]");
      expect(styledSymbol("success", "✔")).toBe("GREEN[✔]");
    });

    it("uses chalk formatting when NODE_ENV is not test", () => {
      process.env.NODE_ENV = "production";

      expect(color("green", "prod")).toBe("chalk-green[prod]");
      expect(bold("prod")).toBe("chalk-bold[prod]");
      expect(dim("prod")).toBe("chalk-dim[prod]");
      expect(styledSymbol("success", "✔")).toBe("chalk-green[✔]");
    });

    it("uses chalk formatting when NODE_ENV is undefined", () => {
      delete process.env.NODE_ENV;

      expect(color("green", "undef")).toBe("chalk-green[undef]");
      expect(bold("undef")).toBe("chalk-bold[undef]");
      expect(dim("undef")).toBe("chalk-dim[undef]");
      expect(styledSymbol("success", "✔")).toBe("chalk-green[✔]");
    });

    it("uses chalk formatting for development environment", () => {
      process.env.NODE_ENV = "development";

      expect(color("red", "dev")).toBe("chalk-red[dev]");
      expect(bold("dev")).toBe("chalk-bold[dev]");
      expect(dim("dev")).toBe("chalk-dim[dev]");
      expect(styledSymbol("error", "✖")).toBe("chalk-red[✖]");
    });
  });

  describe("integration scenarios", () => {
    it("can combine multiple styling functions", () => {
      process.env.NODE_ENV = "test";

      const greenText = color("green", "success");
      const boldGreenText = bold(greenText);

      expect(greenText).toBe("GREEN[success]");
      expect(boldGreenText).toBe("BOLD[GREEN[success]]");
    });

    it("handles empty strings consistently", () => {
      process.env.NODE_ENV = "test";

      expect(color("red", "")).toBe("RED[]");
      expect(bold("")).toBe("BOLD[]");
      expect(dim("")).toBe("DIM[]");
      expect(styledSymbol("success", "")).toBe("GREEN[]");
    });

    it("handles complex unicode characters", () => {
      process.env.NODE_ENV = "test";

      const emoji = "🎉";
      const result = color("green", emoji);
      expect(result).toBe(`GREEN[${emoji}]`);

      const symbol = styledSymbol("success", emoji);
      expect(symbol).toBe(`GREEN[${emoji}]`);
    });
  });

  describe("chalk integration in production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("calls correct chalk methods for colors", async () => {
      const chalk = await import("chalk");

      color("green", "test");
      color("red", "test");

      expect(chalk.default.green).toHaveBeenCalledWith("test");
      expect(chalk.default.red).toHaveBeenCalledWith("test");
    });

    it("calls chalk bold method", async () => {
      const chalk = await import("chalk");

      bold("test");

      expect(chalk.default.bold).toHaveBeenCalledWith("test");
    });

    it("calls chalk dim method", async () => {
      const chalk = await import("chalk");

      dim("test");

      expect(chalk.default.dim).toHaveBeenCalledWith("test");
    });

    it("calls correct chalk methods for styled symbols", async () => {
      const chalk = await import("chalk");

      styledSymbol("success", "✔");
      styledSymbol("error", "✖");
      styledSymbol("regenerate", "↻");

      expect(chalk.default.green).toHaveBeenCalledWith("✔");
      expect(chalk.default.red).toHaveBeenCalledWith("✖");
      expect(chalk.default.dim).toHaveBeenCalledWith("↻");
    });
  });

  describe("type safety", () => {
    it("accepts only valid Color types", () => {
      process.env.NODE_ENV = "test";

      const validColors: Color[] = ["green", "red", "cyan", "magenta", "white", "gray"];

      validColors.forEach((colorName) => {
        expect(() => color(colorName, "test")).not.toThrow();
      });
    });

    it("accepts only valid SymbolType types", () => {
      process.env.NODE_ENV = "test";

      const validSymbols: SymbolType[] = [
        "success",
        "error",
        "warning",
        "info",
        "regenerate",
        "edit",
        "exit",
      ];

      validSymbols.forEach((symbolType) => {
        expect(() => styledSymbol(symbolType, "⚡")).not.toThrow();
      });
    });
  });
});
