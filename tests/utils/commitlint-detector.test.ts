import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectCommitlintConfig, parseCommitlintConfig, formatCommitlintRulesForPrompt, clearCommitlintCaches } from "../../src/utils/commitlint-detector.js";
import { readFileSync, existsSync } from "node:fs";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

describe("commitlint-detector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCommitlintCaches();
  });

  describe("detectCommitlintConfig", () => {
    it("should detect commitlint.config.js", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith("commitlint.config.js");
      });

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBe("/test/project/commitlint.config.js");
    });

    it("should detect .commitlintrc.json", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith(".commitlintrc.json");
      });

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBe("/test/project/.commitlintrc.json");
    });

    it("should detect commitlint config in package.json", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith("package.json");
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        name: "test-project",
        commitlint: {
          extends: ["@commitlint/config-conventional"],
        },
      }));

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBe("/test/project/package.json");
    });

    it("should return null if no config found", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBeNull();
    });

    it("should check all config file extensions", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await detectCommitlintConfig("/test/project");
      
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/commitlint.config.js");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/commitlint.config.cjs");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/commitlint.config.mjs");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/commitlint.config.ts");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/.commitlintrc.js");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/.commitlintrc.cjs");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/.commitlintrc.json");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/.commitlintrc.yml");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/.commitlintrc.yaml");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/.commitlintrc");
      expect(vi.mocked(existsSync)).toHaveBeenCalledWith("/test/project/package.json");
    });

    it("should detect .commitlintrc.yaml", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith(".commitlintrc.yaml");
      });

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBe("/test/project/.commitlintrc.yaml");
    });

    it("should detect .commitlintrc file without extension", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        const pathStr = String(path);
        return pathStr === "/test/project/.commitlintrc";
      });

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBe("/test/project/.commitlintrc");
    });

    it("should use current working directory when no path provided", async () => {
      const originalCwd = process.cwd();
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith("commitlint.config.js");
      });

      const result = await detectCommitlintConfig();
      expect(result).toBe(`${originalCwd}/commitlint.config.js`);
    });

    it("should handle package.json without commitlint field", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith("package.json");
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        name: "test-project",
        version: "1.0.0",
      }));

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBeNull();
    });

    it("should handle invalid package.json", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).endsWith("package.json");
      });
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      const result = await detectCommitlintConfig("/test/project");
      expect(result).toBeNull();
    });
  });

  describe("parseCommitlintConfig", () => {
    it("should parse JavaScript config with type-enum", async () => {
      const configContent = `
        export default {
          extends: ["@commitlint/config-conventional"],
          rules: {
            "type-enum": [
              2,
              "always",
              [
                "feat",
                "fix",
                "docs",
                "test",
              ],
            ],
            "subject-case": [2, "never", ["upper-case"]],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: ["feat", "fix", "docs", "test"],
        subjectCase: "upper-case",
        subjectCaseMode: "never",
      });
    });

    it("should parse JSON config", async () => {
      const config = {
        extends: ["@commitlint/config-conventional"],
        rules: {
          "type-enum": [2, "always", ["feat", "fix", "chore"]],
          "header-max-length": [2, "always", 100],
          "subject-min-length": [2, "always", 5],
        },
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toEqual({
        types: ["feat", "fix", "chore"],
        headerMaxLength: 100,
        subjectMinLength: 5,
      });
    });

    it("should parse package.json with commitlint field", async () => {
      const packageJson = {
        name: "test-project",
        commitlint: {
          rules: {
            "type-enum": [2, "always", ["build", "ci", "docs"]],
            "scope-enum": [2, "always", ["api", "ui"]],
          },
        },
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packageJson));

      const result = await parseCommitlintConfig("/test/package.json");
      expect(result).toEqual({
        types: ["build", "ci", "docs"],
        scopeRequired: true,
      });
    });

    it("should use default conventional types when extends is present", async () => {
      const config = {
        extends: "@commitlint/config-conventional",
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result?.types).toEqual([
        "feat", "fix", "docs", "style", "refactor", 
        "perf", "test", "build", "ci", "chore", "revert"
      ]);
    });

    it("should return null for invalid config", async () => {
      vi.mocked(readFileSync).mockReturnValue("invalid json");

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toBeNull();
    });

    it("should parse YAML config files", async () => {
      const yamlContent = `extends: ['@commitlint/config-conventional']
rules:
  type-enum: [2, always, ['feat', 'fix', 'docs']]
  header-max-length: [2, always, 72]`;
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.yml");
      expect(result).toEqual({
        types: ["feat", "fix", "docs"],
        headerMaxLength: 72,
      });
    });

    it("should return null for empty YAML files", async () => {
      vi.mocked(readFileSync).mockReturnValue("");
      const result = await parseCommitlintConfig("/test/.commitlintrc.yml");
      expect(result).toBeNull();
    });

    it("should parse YAML with popular config extends", async () => {
      const yamlContent = "extends: \"@commitlint/config-angular\"";
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.yaml");
      expect(result).toEqual({
        types: ["build", "ci", "docs", "feat", "fix", "perf", "refactor", "style", "test"],
      });
    });

    it("should parse configuration assigned to variable and exported", async () => {
      const configContent = `
        const Configuration = {
          extends: ["@commitlint/config-conventional"],
          rules: {
            "type-enum": [
              2,
              "always",
              ["build", "chore", "docs", "feat", "fix", "perf", "refactor", "style", "test"],
            ],
            "subject-case": [2, "always", "sentence-case"],
          },
        };
        export default Configuration;
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: ["build", "chore", "docs", "feat", "fix", "perf", "refactor", "style", "test"],
      });
    });

    it("should parse rules with unquoted keys", async () => {
      const configContent = `
        export default {
          extends: ["@commitlint/config-conventional"],
          rules: {
            type-enum: [
              2,
              "always",
              ["feat", "fix", "docs"],
            ],
            subject-case: [2, "never", ["upper-case", "pascal-case"]],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: ["feat", "fix", "docs"],
      });
    });

    it("should use conventional types when only extends is specified without explicit type-enum", async () => {
      const configContent = `
        export default {
          extends: ["@commitlint/config-conventional"],
          rules: {
            "subject-case": [2, "always", "lower-case"],
            "header-max-length": [2, "always", 72],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: [
          "feat", "fix", "docs", "style", "refactor", 
          "perf", "test", "build", "ci", "chore", "revert"
        ],
        headerMaxLength: 72,
      });
    });

    it("should parse multiline type arrays", async () => {
      const configContent = `
        module.exports = {
          extends: ["@commitlint/config-conventional"],
          rules: {
            "type-enum": [
              2,
              "always",
              [
                // Features
                "feat",
                "feature",
                
                // Bug fixes
                "fix",
                "bugfix",
                
                // Documentation
                "docs",
                "documentation",
                
                // Code quality
                "style",
                "refactor",
                "perf",
                "test",
                
                // Build and CI
                "build",
                "ci",
                
                // Other
                "chore",
                "revert",
                "wip"
              ],
            ],
            "scope-enum": [2, "always", ["api", "ui", "db", "auth"]],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: [
          "feat", "feature", "fix", "bugfix", "docs", "documentation",
          "style", "refactor", "perf", "test", "build", "ci",
          "chore", "revert", "wip"
        ],
      });
    });

    it("should handle TypeScript config files", async () => {
      const configContent = `
        import type { UserConfig } from '@commitlint/types';

        const Configuration: UserConfig = {
          extends: ['@commitlint/config-conventional'],
          rules: {
            'type-enum': [
              2,
              'always',
              ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'],
            ],
            'scope-enum': [2, 'always', ['core', 'ui', 'api', 'docs']],
            'header-max-length': [2, 'always', 80],
          },
        };

        export default Configuration;
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.ts");
      expect(result).toEqual({
        types: ["feat", "fix", "docs", "style", "refactor", "test", "chore"],
        headerMaxLength: 80,
      });
    });

    it("should handle .commitlintrc.js with function export", async () => {
      const configContent = `
        module.exports = function() {
          return {
            extends: ['@commitlint/config-conventional'],
            rules: {
              'type-enum': [
                2,
                'always',
                ['feat', 'fix', 'docs'],
              ],
              'subject-case': [2, 'always', ['sentence-case']],
              'subject-min-length': [2, 'always', 10],
            },
          };
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.js");
      expect(result).toEqual({
        types: ["feat", "fix", "docs"],
        subjectCase: "sentence-case",
        subjectCaseMode: "always",
        subjectMinLength: 10,
      });
    });

    it("should handle config with async function export", async () => {
      const configContent = `
        module.exports = async function() {
          return {
            extends: ['@commitlint/config-conventional'],
            rules: {
              'type-enum': [
                2,
                'always',
                ['feat', 'fix'],
              ],
              'header-max-length': [2, 'always', 72],
            },
          };
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.js");
      expect(result).toEqual({
        types: ["feat", "fix"],
        headerMaxLength: 72,
      });
    });

    it("should handle CommonJS require syntax", async () => {
      const configContent = `
        const { rules } = require('@commitlint/config-conventional');
        
        module.exports = {
          extends: ['@commitlint/config-conventional'],
          rules: {
            ...rules,
            'type-enum': [2, 'always', ['feat', 'fix', 'chore']],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.cjs");
      expect(result).toEqual({
        types: ["feat", "fix", "chore"],
      });
    });

    it("should handle config without extends but with type-enum", async () => {
      const configContent = `
        export default {
          rules: {
            'type-enum': [
              2,
              'always',
              ['feat', 'fix', 'docs', 'test'],
            ],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: ["feat", "fix", "docs", "test"],
      });
    });

    it("should handle complex nested arrays in type-enum", async () => {
      const configContent = `
        module.exports = {
          extends: ['@commitlint/config-conventional'],
          rules: {
            'type-enum': [
              2,
              'always',
              [
                'feat',
                'fix',
                'docs',
                'test',
              ],
            ],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: ["feat", "fix", "docs", "test"],
      });
    });

    it("should handle subject-case with multiple cases", async () => {
      const config = {
        rules: {
          "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
        },
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toEqual({
        subjectCase: "start-case",
        subjectCaseMode: "never",
      });
    });

    it("should handle scope-enum with different modes", async () => {
      const config = {
        rules: {
          "type-enum": [2, "always", ["feat", "fix"]],
          "scope-enum": [2, "never", ["api", "ui"]],
        },
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toEqual({
        types: ["feat", "fix"],
        scopeRequired: false,
      });
    });

    it("should ignore rules with severity 0", async () => {
      const config = {
        rules: {
          "type-enum": [2, "always", ["feat", "fix"]],
          "header-max-length": [0, "always", 100],
          "subject-min-length": [1, "always", 5],
          "subject-max-length": [0, "always", 80],
        },
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toEqual({
        types: ["feat", "fix"],
        subjectMinLength: 5,
      });
    });

    it("should handle config with mixed quotes and spacing", async () => {
      const configContent = `
        export default {
          extends: [ '@commitlint/config-conventional' ],
          rules: {
            "type-enum":[
              2 ,
              "always" ,
              [  'feat'  ,  "fix"  ,  'docs'  ]
            ],
            'subject-case' : [ 2, "never" , [ "upper-case" ] ],
          },
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: ["feat", "fix", "docs"],
        subjectCase: "upper-case",
        subjectCaseMode: "never",
      });
    });

    it("should handle empty rules object", async () => {
      const config = {
        extends: ["@commitlint/config-conventional"],
        rules: {},
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toEqual({
        types: [
          "feat", "fix", "docs", "style", "refactor",
          "perf", "test", "build", "ci", "chore", "revert"
        ],
      });
    });

    it("should handle subject-max-length rule", async () => {
      const config = {
        rules: {
          "type-enum": [2, "always", ["feat", "fix"]],
          "subject-max-length": [2, "always", 50],
        },
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toEqual({
        types: ["feat", "fix"],
        subjectMaxLength: 50,
      });
    });

    it("should handle malformed JavaScript config gracefully", async () => {
      const configContent = `
        module.exports = {
          extends: ['@commitlint/config-conventional'],
          rules: {
            'type-enum': [2, 'always', ['feat', 'fix'
            // Missing closing brackets
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: [
          "feat", "fix", "docs", "style", "refactor",
          "perf", "test", "build", "ci", "chore", "revert"
        ],
      });
    });

    it("should handle package.json without commitlint config", async () => {
      const packageJson = {
        name: "test-package",
        version: "1.0.0",
        dependencies: {},
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packageJson));

      const result = await parseCommitlintConfig("/test/package.json");
      expect(result).toBeNull();
    });

    it("should handle package.json with invalid commitlint config", async () => {
      const packageJson = {
        name: "test-package",
        commitlint: "invalid-string",
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packageJson));

      const result = await parseCommitlintConfig("/test/package.json");
      expect(result).toBeNull();
    });

    it("should handle invalid JSON config files", async () => {
      vi.mocked(readFileSync).mockReturnValue("not-valid-json");

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toBeNull();
    });

    it("should handle YAML files that parse to non-object", async () => {
      vi.mocked(readFileSync).mockReturnValue("just-a-string");

      const result = await parseCommitlintConfig("/test/.commitlintrc.yaml");
      expect(result).toBeNull();
    });

    it("should handle empty YAML files that return null", async () => {
      vi.mocked(readFileSync).mockReturnValue("");

      const result = await parseCommitlintConfig("/test/.commitlintrc.yaml");
      expect(result).toBeNull();
    });

    it("should handle readFileContent errors in detectCommitlintConfig", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path.toString().endsWith("package.json");
      });
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await detectCommitlintConfig("/test");
      expect(result).toBeNull();
    });

    it("should handle parseJsonSafely errors in detectCommitlintConfig", async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path.toString().endsWith("package.json");
      });
      vi.mocked(readFileSync).mockReturnValue("invalid-json");

      const result = await detectCommitlintConfig("/test");
      expect(result).toBeNull();
    });

    it("should handle YAML arrays with nested brackets", async () => {
      const yamlContent = `rules:
  type-enum: [2, always, [feat, fix, docs]]`;
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.yml");
      expect(result).toEqual({
        types: ["feat", "fix", "docs"],
      });
    });

    it("should handle YAML arrays with quotes and special characters", async () => {
      const yamlContent = `rules:
  type-enum: [2, always, ['feat:special', "fix,with,commas", docs]]`;
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.yml");
      expect(result).toEqual({
        types: ["feat:special", "fix,with,commas", "docs"],
      });
    });

    it("should handle edge cases in getTypesFromExtendedConfig", async () => {
      const configContent = `
        export default {
          extends: ["config-conventional"], // partial match
          rules: {},
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({
        types: [
          "feat", "fix", "docs", "style", "refactor", 
          "perf", "test", "build", "ci", "chore", "revert"
        ],
      });
    });

    it("should handle configs with unknown extends", async () => {
      const configContent = `
        export default {
          extends: ["@unknown/config"],
          rules: {},
        };
      `;
      vi.mocked(readFileSync).mockReturnValue(configContent);

      const result = await parseCommitlintConfig("/test/commitlint.config.js");
      expect(result).toEqual({});
    });

    it("should handle readFileContent throwing errors", async () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("File not found");
      });

      const result = await parseCommitlintConfig("/test/missing-file.js");
      expect(result).toBeNull();
    });

    it("should handle parseJsonSafely throwing errors", async () => {
      vi.mocked(readFileSync).mockReturnValue("{ invalid json }");

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toBeNull();
    });

    it("should handle YAML config with empty content that returns null from parseSimpleYaml", async () => {
      vi.mocked(readFileSync).mockReturnValue("# just comments\n# no actual config");

      const result = await parseCommitlintConfig("/test/.commitlintrc.yml");
      expect(result).toBeNull();
    });

    it("should handle scope-required false case", async () => {
      const config = {
        rules: {
          "scope-enum": [2, "never"],
        },
      };
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await parseCommitlintConfig("/test/.commitlintrc.json");
      expect(result).toEqual({
        scopeRequired: false,
      });
    });

    it("should handle YAML boolean and number parsing", async () => {
      const yamlContent = "extends: false\nrules:\n  header-max-length: [2, always, 100]\n  some-bool: true\n  some-number: 42";
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.yml");
      expect(result).toEqual({
        headerMaxLength: 100,
      });
    });

    it("should handle empty YAML arrays", async () => {
      const yamlContent = "rules:\n  type-enum: [2, always, []]";
      vi.mocked(readFileSync).mockReturnValue(yamlContent);

      const result = await parseCommitlintConfig("/test/.commitlintrc.yml");
      // Empty arrays in type-enum result in no types being set
      expect(result).toEqual({});
    });
  });

  describe("formatCommitlintRulesForPrompt", () => {
    it("should format rules with all fields", () => {
      const rules = {
        types: ["feat", "fix", "docs"],
        scopeRequired: true,
        subjectCase: "lower-case",
        subjectCaseMode: "always" as const,
        headerMaxLength: 100,
        subjectMinLength: 5,
        subjectMaxLength: 50,
      };

      const result = formatCommitlintRulesForPrompt(rules);
      expect(result).toBe(
        "Allowed commit types: feat, fix, docs. Scope is required. " +
        "Subject must be lower-case. Max header length: 100 characters. " +
        "Min subject length: 5 characters. Max subject length: 50 characters"
      );
    });

    it("should format rules with never case", () => {
      const rules = {
        types: ["feat", "fix"],
        subjectCase: "upper-case",
        subjectCaseMode: "never" as const,
      };

      const result = formatCommitlintRulesForPrompt(rules);
      expect(result).toBe(
        "Allowed commit types: feat, fix. Subject must NOT be upper-case"
      );
    });

    it("should format rules with only types", () => {
      const rules = {
        types: ["feat", "fix"],
      };

      const result = formatCommitlintRulesForPrompt(rules);
      expect(result).toBe("Allowed commit types: feat, fix");
    });

    it("should handle empty rules", () => {
      const rules = {};
      const result = formatCommitlintRulesForPrompt(rules);
      expect(result).toBe("");
    });
  });
});