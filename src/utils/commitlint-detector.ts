import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isRecord, hasProperty, isArray, isString } from "./guards.js";
import { createError } from "./errors.js";

const configCache = new Map<string, string | null>();
const CONFIG_TYPE_CACHE = new Map<string, readonly string[] | null>();
const PARSED_CONFIG_CACHE = new Map<string, CommitlintRules | null>();

export function clearCommitlintCaches(): void {
  configCache.clear();
  CONFIG_TYPE_CACHE.clear();
  PARSED_CONFIG_CACHE.clear();
}

interface CommitlintRules {
  types?: string[];
  scopeRequired?: boolean;
  subjectMinLength?: number;
  subjectMaxLength?: number;
  subjectCase?: string;
  subjectCaseMode?: "always" | "never";
  headerMaxLength?: number;
}

interface CommitlintConfig {
  extends?: string | string[];
  rules?: Record<string, unknown>;
}

const COMMITLINT_CONFIG_FILES = [
  "commitlint.config.js",
  "commitlint.config.cjs",
  "commitlint.config.mjs",
  "commitlint.config.ts",
  ".commitlintrc.js",
  ".commitlintrc.cjs",
  ".commitlintrc.json",
  ".commitlintrc.yml",
  ".commitlintrc.yaml",
  ".commitlintrc",
] as const;

const CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
] as const;

const POPULAR_CONFIGS: Record<string, readonly string[]> = {
  "@commitlint/config-conventional": CONVENTIONAL_TYPES,
  "@commitlint/config-angular": [
    "build",
    "ci",
    "docs",
    "feat",
    "fix",
    "perf",
    "refactor",
    "style",
    "test",
  ],
  "@commitlint/config-angular-type-enum": [
    "build",
    "ci",
    "docs",
    "feat",
    "fix",
    "perf",
    "refactor",
    "test",
  ],
  "@commitlint/config-lerna-scopes": [],
  "@commitlint/config-nx-scopes": [],
  "@commitlint/config-rush-scopes": [],
} as const;

function parseJsonSafely(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw createError(
      `Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function parseSimpleYaml(yamlContent: string): unknown {
  const lines = yamlContent
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .filter((line) => line.includes(":"));

  const result: Record<string, unknown> = {};
  let currentSection: Record<string, unknown> | null = null;

  for (const line of lines) {
    const leadingSpaces = line.length - line.trimStart().length;
    const [key, ...valueParts] = line.trim().split(":");
    const value = valueParts.join(":").trim();

    if (!key) {
      continue;
    }

    if (leadingSpaces === 0) {
      if (value) {
        result[key] = parseSimpleYamlValue(value);
      } else {
        currentSection = {};
        result[key] = currentSection;
      }
    } else if (currentSection && value) {
      currentSection[key] = parseSimpleYamlValue(value);
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function parseSimpleYamlValue(value: string): unknown {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseYamlArray(trimmed);
  }

  return trimmed.replace(/^['"]|['"]$/g, "");
}

function parseYamlArray(arrayString: string): unknown[] {
  const content = arrayString.slice(1, -1).trim();
  if (!content) {
    return [];
  }

  if (content.startsWith("[") && content.endsWith("]")) {
    return parseYamlArray(content);
  }

  const items = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  let depth = 0;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (!inQuotes && (char === "'" || char === '"')) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = "";
    } else if (!inQuotes && char === "[") {
      depth++;
    } else if (!inQuotes && char === "]") {
      depth--;
    } else if (!inQuotes && char === "," && depth === 0) {
      if (current.trim()) {
        items.push(parseSimpleYamlValue(current.trim()));
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    items.push(parseSimpleYamlValue(current.trim()));
  }

  return items;
}

function getTypesFromExtendedConfig(configName: string): readonly string[] | null {
  if (CONFIG_TYPE_CACHE.has(configName)) {
    return CONFIG_TYPE_CACHE.get(configName) || null;
  }

  const exactMatch = POPULAR_CONFIGS[configName];
  if (exactMatch && exactMatch.length > 0) {
    CONFIG_TYPE_CACHE.set(configName, exactMatch);
    return exactMatch;
  }

  for (const [popularConfigName, types] of Object.entries(POPULAR_CONFIGS)) {
    const configSuffix = popularConfigName.split("/").pop();
    if (configSuffix && configName.includes(configSuffix) && types.length > 0) {
      CONFIG_TYPE_CACHE.set(configName, types);
      return types;
    }
  }

  CONFIG_TYPE_CACHE.set(configName, null);
  return null;
}

function readFileContent(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    throw createError(
      `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function detectCommitlintConfig(
  projectPath: string = process.cwd()
): Promise<string | null> {
  if (configCache.has(projectPath)) {
    return configCache.get(projectPath) || null;
  }

  for (const configFile of COMMITLINT_CONFIG_FILES) {
    const configPath = join(projectPath, configFile);
    if (existsSync(configPath)) {
      configCache.set(projectPath, configPath);
      return configPath;
    }
  }

  const packageJsonPath = join(projectPath, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const content = readFileContent(packageJsonPath);
      const packageJson = parseJsonSafely(content);

      if (isRecord(packageJson) && hasProperty(packageJson, "commitlint")) {
        configCache.set(projectPath, packageJsonPath);
        return packageJsonPath;
      }
    } catch {
      configCache.set(projectPath, null);
      return null;
    }
  }

  configCache.set(projectPath, null);
  return null;
}

function parsePackageJsonConfig(content: string): CommitlintConfig | null {
  const packageJson = parseJsonSafely(content);

  if (
    isRecord(packageJson) &&
    hasProperty(packageJson, "commitlint") &&
    isRecord(packageJson.commitlint)
  ) {
    return packageJson.commitlint as CommitlintConfig;
  }

  return null;
}

function parseJsonConfig(content: string): CommitlintConfig | null {
  const config = parseJsonSafely(content);

  if (isRecord(config)) {
    return config as CommitlintConfig;
  }

  return null;
}

function parseYamlConfig(content: string): CommitlintConfig | null {
  const config = parseSimpleYaml(content);

  if (isRecord(config)) {
    return config as CommitlintConfig;
  }

  return null;
}

function parseJsConfigContent(content: string): CommitlintRules {
  const rules: CommitlintRules = {};

  const rulesMatch = content.match(/rules\s*:\s*\{([\s\S]*?)\}(?=\s*(?:,|\}|$))/m);
  if (rulesMatch?.[1]) {
    const rulesContent = rulesMatch[1];
    parseJsTypeEnum(rulesContent, rules);
    parseJsSubjectCase(rulesContent, rules);
    parseJsLengthRules(rulesContent, rules);
  }

  if (!rules.types) {
    const extendsMatch = content.match(/extends\s*:\s*\[?\s*["']([^"']+)["']/);
    if (extendsMatch?.[1]) {
      const extendedTypes = getTypesFromExtendedConfig(extendsMatch[1]);
      if (extendedTypes) {
        rules.types = [...extendedTypes];
      }
    }
  }

  return rules;
}

function parseJsTypeEnum(rulesContent: string, rules: CommitlintRules): void {
  const typeEnumMatch = rulesContent.match(
    /["']?type-enum["']?\s*:\s*\[\s*\d+\s*,\s*["']\w+["']\s*,\s*\[([^\]]+)\]/
  );
  if (!typeEnumMatch?.[1]) {
    return;
  }

  const types = typeEnumMatch[1]
    .match(/["']([^"']+)["']/g)
    ?.map((match) => match.slice(1, -1))
    .filter(Boolean);

  if (types?.length) {
    rules.types = types;
  }
}

function parseJsSubjectCase(rulesContent: string, rules: CommitlintRules): void {
  const match = rulesContent.match(
    /["']?subject-case["']?\s*:\s*\[\s*\d+\s*,\s*["'](always|never)["']\s*,\s*\[\s*["']([^"'[\]]+)["']\s*]/
  );
  if (match) {
    rules.subjectCaseMode = match[1] as "always" | "never";
    rules.subjectCase = match[2];
  }
}

function parseJsLengthRules(rulesContent: string, rules: CommitlintRules): void {
  const lengthPatterns = {
    headerMaxLength: /["']?header-max-length["']?\s*:\s*\[\s*\d+\s*,\s*["'][^"']+["']\s*,\s*(\d+)/,
    subjectMinLength:
      /["']?subject-min-length["']?\s*:\s*\[\s*\d+\s*,\s*["'][^"']+["']\s*,\s*(\d+)/,
    subjectMaxLength:
      /["']?subject-max-length["']?\s*:\s*\[\s*\d+\s*,\s*["'][^"']+["']\s*,\s*(\d+)/,
  } as const;

  for (const [key, pattern] of Object.entries(lengthPatterns)) {
    const match = rulesContent.match(pattern);
    if (match?.[1]) {
      rules[key as keyof typeof lengthPatterns] = parseInt(match[1], 10);
    }
  }
}

function extractRulesFromConfig(config: CommitlintConfig): CommitlintRules {
  const rules: CommitlintRules = {};

  if (config.rules && isRecord(config.rules)) {
    extractTypeEnum(config.rules, rules);
    extractScopeRules(config.rules, rules);
    extractSubjectRules(config.rules, rules);
    extractLengthRules(config.rules, rules);
  }

  if (!rules.types && config.extends) {
    const extendsConfig = isArray(config.extends) ? config.extends[0] : config.extends;
    if (isString(extendsConfig)) {
      const extendedTypes = getTypesFromExtendedConfig(extendsConfig);
      if (extendedTypes) {
        rules.types = [...extendedTypes];
      }
    }
  }

  return rules;
}

function extractTypeEnum(rulesObj: Record<string, unknown>, rules: CommitlintRules): void {
  const typeEnum = rulesObj["type-enum"];
  if (!isArray(typeEnum) || typeEnum.length < 3 || typeEnum[0] === 0 || !isArray(typeEnum[2])) {
    return;
  }

  const types = typeEnum[2].filter((t): t is string => isString(t));
  if (types.length > 0) {
    rules.types = types;
  }
}

function extractScopeRules(rulesObj: Record<string, unknown>, rules: CommitlintRules): void {
  const scopeEnum = rulesObj["scope-enum"];
  if (isArray(scopeEnum) && scopeEnum.length >= 2 && scopeEnum[0] !== 0) {
    rules.scopeRequired = scopeEnum[0] === 2 && scopeEnum[1] === "always";
  }
}

function extractSubjectRules(rulesObj: Record<string, unknown>, rules: CommitlintRules): void {
  const subjectCase = rulesObj["subject-case"];
  if (!isArray(subjectCase) || subjectCase.length < 3 || subjectCase[0] === 0) {
    return;
  }

  if (isString(subjectCase[1]) && isArray(subjectCase[2]) && subjectCase[2].length > 0) {
    rules.subjectCaseMode = subjectCase[1] as "always" | "never";
    rules.subjectCase = String(subjectCase[2][0]);
  }
}

function extractLengthRules(rulesObj: Record<string, unknown>, rules: CommitlintRules): void {
  const lengthMappings = {
    "header-max-length": "headerMaxLength" as const,
    "subject-min-length": "subjectMinLength" as const,
    "subject-max-length": "subjectMaxLength" as const,
  };

  for (const [key, target] of Object.entries(lengthMappings)) {
    const rule = rulesObj[key];
    if (isArray(rule) && rule.length >= 3 && rule[0] !== 0 && typeof rule[2] === "number") {
      rules[target] = rule[2];
    }
  }
}

export async function parseCommitlintConfig(configPath: string): Promise<CommitlintRules | null> {
  if (PARSED_CONFIG_CACHE.has(configPath)) {
    return PARSED_CONFIG_CACHE.get(configPath) || null;
  }

  try {
    const content = readFileContent(configPath);
    let config: CommitlintConfig | null = null;

    if (configPath.endsWith("package.json")) {
      config = parsePackageJsonConfig(content);
    } else if (configPath.endsWith(".json") || configPath.endsWith(".commitlintrc")) {
      config = parseJsonConfig(content);
    } else if (configPath.endsWith(".yml") || configPath.endsWith(".yaml")) {
      config = parseYamlConfig(content);
    } else {
      const result = parseJsConfigContent(content);
      PARSED_CONFIG_CACHE.set(configPath, result);
      return result;
    }

    if (!config) {
      PARSED_CONFIG_CACHE.set(configPath, null);
      return null;
    }

    const result = extractRulesFromConfig(config);
    PARSED_CONFIG_CACHE.set(configPath, result);
    return result;
  } catch {
    PARSED_CONFIG_CACHE.set(configPath, null);
    return null;
  }
}

export function formatCommitlintRulesForPrompt(rules: CommitlintRules): string {
  const parts: string[] = [];

  if (rules.types?.length) {
    parts.push(`Allowed commit types: ${rules.types.join(", ")}`);
  }

  if (rules.scopeRequired) {
    parts.push("Scope is required");
  }

  if (rules.subjectCase && rules.subjectCaseMode) {
    const caseRule =
      rules.subjectCaseMode === "never"
        ? `Subject must NOT be ${rules.subjectCase}`
        : `Subject must be ${rules.subjectCase}`;
    parts.push(caseRule);
  }

  const lengthRules = [
    { value: rules.headerMaxLength, label: "Max header length" },
    { value: rules.subjectMinLength, label: "Min subject length" },
    { value: rules.subjectMaxLength, label: "Max subject length" },
  ];

  for (const { value, label } of lengthRules) {
    if (value) {
      parts.push(`${label}: ${value} characters`);
    }
  }

  return parts.join(". ");
}
