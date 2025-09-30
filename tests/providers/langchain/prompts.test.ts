import { describe, it, expect } from "vitest";
import {
  getCommitGenerationPrompt,
  formatRecentCommitsSection,
  formatRegenerationNote,
  formatCustomRulesSection,
  formatLanguageRule,
  formatCommitlintRulesSection,
} from "../../../src/providers/langchain/prompts.js";

describe("providers/langchain/prompts", () => {
  describe("formatRecentCommitsSection", () => {
    it("returns empty string when no commits provided", () => {
      expect(formatRecentCommitsSection()).toBe("");
      expect(formatRecentCommitsSection([])).toBe("");
    });

    it("formats recent commits correctly", () => {
      const commits = [
        "feat: add new feature",
        "fix: resolve bug in parser",
        "docs: update README",
      ];

      const result = formatRecentCommitsSection(commits);

      expect(result).toBe(
        "Recent commit messages for styling, tone and formatting reference:\n" +
          "- feat: add new feature\n" +
          "- fix: resolve bug in parser\n" +
          "- docs: update README"
      );
    });

    it("limits to 10 commits maximum", () => {
      const commits = Array.from({ length: 15 }, (_, i) => `commit ${i + 1}`);

      const result = formatRecentCommitsSection(commits);
      const lines = result.split("\n");

      expect(lines).toHaveLength(11); // header + 10 commits
      expect(lines[10]).toBe("- commit 10");
      expect(lines).not.toContain("- commit 11");
    });
  });

  describe("formatRegenerationNote", () => {
    it("returns empty string when no regeneration attempts", () => {
      expect(formatRegenerationNote()).toBe("");
      expect(formatRegenerationNote(0)).toBe("");
    });

    it("returns specific message for single regeneration attempt", () => {
      const result = formatRegenerationNote(1);

      expect(result).toBe(
        "\nNOTE: The user rejected the previous batch of suggestions. Please provide more diverse or creative alternatives.\n"
      );
    });

    it("returns numbered message for multiple regeneration attempts", () => {
      const result = formatRegenerationNote(3);

      expect(result).toBe(
        "\nNOTE: The user has rejected 3 previous batches of suggestions. Please provide significantly different alternatives with varied approaches, styles, and focus areas.\n"
      );
    });
  });

  describe("formatCustomRulesSection", () => {
    it("returns empty string when no custom rules provided", () => {
      expect(formatCustomRulesSection()).toBe("");
      expect(formatCustomRulesSection([])).toBe("");
    });

    it("formats custom rules correctly", () => {
      const customRules = [
        "All messages must be lowercase",
        "Don't append story IDs",
        "Use conventional commit format",
      ];

      const result = formatCustomRulesSection(customRules);

      expect(result).toBe(
        "Custom commit message rules (must be followed strictly):\n" +
          "- All messages must be lowercase\n" +
          "- Don't append story IDs\n" +
          "- Use conventional commit format\n"
      );
    });

    it("handles single custom rule", () => {
      const customRules = ["All commit messages must be lowercase"];

      const result = formatCustomRulesSection(customRules);

      expect(result).toBe(
        "Custom commit message rules (must be followed strictly):\n" +
          "- All commit messages must be lowercase\n"
      );
    });
  });

  describe("formatLanguageRule", () => {
    it("returns empty string for English", () => {
      expect(formatLanguageRule("en")).toBe("");
    });

    it("returns formatted rule for non-English languages", () => {
      const result = formatLanguageRule("es");
      expect(result).toContain("Español");
      expect(result).toContain("Important: Generate all commit messages in");
      expect(result).toContain("The commit type (feat, fix, etc.) should remain in English");
    });

    it("returns formatted rule for French", () => {
      const result = formatLanguageRule("fr");
      expect(result).toContain("Français");
    });
  });

  describe("formatCommitlintRulesSection", () => {
    it("returns empty string when no rules provided", () => {
      expect(formatCommitlintRulesSection(undefined)).toBe("");
      expect(formatCommitlintRulesSection("")).toBe("");
    });

    it("formats commitlint rules section with rules", () => {
      const rules = "type-enum: [feat, fix, chore]";
      const result = formatCommitlintRulesSection(rules);
      expect(result).toContain("Commitlint Rules");
      expect(result).toContain(rules);
      expect(result).toContain("must be followed strictly");
    });
  });

  describe("getCommitGenerationPrompt", () => {
    it("contains all required placeholders", () => {
      const prompt = getCommitGenerationPrompt();
      const template = prompt.template;
      const templateString = typeof template === "string" ? template : String(template);

      expect(templateString).toContain("{commitChoicesCount}");
      expect(templateString).toContain("{recentCommitsSection}");
      expect(templateString).toContain("{regenerationNote}");
      expect(templateString).toContain("{customRulesSection}");
      expect(templateString).toContain("{maxCommitLength}");
      expect(templateString).toContain("{branch}");
      expect(templateString).toContain("{files}");
      expect(templateString).toContain("{difference}");
      expect(templateString).toContain("{languageRule}");
    });

    it("formats prompt correctly with all parameters", async () => {
      const prompt = getCommitGenerationPrompt();
      const formatted = await prompt.format({
        commitChoicesCount: 5,
        recentCommitsSection:
          "Recent commit messages for styling, tone and formatting reference:\n- feat: add feature",
        regenerationNote: "",
        customRulesSection: "",
        commitlintRulesSection: "",
        maxCommitLength: 72,
        branch: "main",
        files: "src/index.ts, src/utils.ts",
        difference: "diff content here",
        languageRule: "",
      });

      expect(formatted).toContain("Generate exactly 5 commit messages");
      expect(formatted).toContain(
        "Recent commit messages for styling, tone and formatting reference:\n- feat: add feature"
      );
      expect(formatted).toContain("Maximum 72 characters");
      expect(formatted).toContain("Branch: main");
      expect(formatted).toContain("Files: src/index.ts, src/utils.ts");
      expect(formatted).toContain("diff content here");
    });

    it("includes JSON structure example", () => {
      const prompt = getCommitGenerationPrompt();
      const template = prompt.template;
      const templateString = typeof template === "string" ? template : String(template);

      expect(templateString).toContain('"commits": [');
      expect(templateString).toContain('"feat: add user authentication to login page"');
      expect(templateString).toContain("Return ONLY valid JSON");
    });

    it("includes all important rules", () => {
      const prompt = getCommitGenerationPrompt();
      const template = prompt.template;
      const templateString = typeof template === "string" ? template : String(template);

      expect(templateString).toContain("Use imperative mood");
      expect(templateString).toContain("No period at the end");
      expect(templateString).toContain("Follow the project's existing commit style");
      expect(templateString).toContain(
        "Each commit message must describe ALL the changes in the difference"
      );
    });
  });
});
