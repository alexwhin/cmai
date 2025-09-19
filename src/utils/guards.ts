import { Provider, UsageMode, Config, CommitCandidate } from "../types/index.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function hasProperty<K extends string>(
  object: Record<string, unknown>,
  key: K
): object is Record<K, unknown> {
  return key in object;
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isValidEmail(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  const emailRegex = /^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)+$/;
  return emailRegex.test(value) && !value.includes("..");
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isValidProvider(value: unknown): value is Provider {
  return isString(value) && (Object.values(Provider) as string[]).includes(value);
}

export function isValidUsageMode(value: unknown): value is UsageMode {
  return isString(value) && (Object.values(UsageMode) as string[]).includes(value);
}

export function isValidConfig(value: unknown): value is Config {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasProperty(value, "provider") &&
    isValidProvider(value.provider) &&
    (!hasProperty(value, "apiKey") || isString(value.apiKey)) &&
    hasProperty(value, "model") &&
    isString(value.model) &&
    (!hasProperty(value, "maxCommitLength") || isPositiveNumber(value.maxCommitLength)) &&
    (!hasProperty(value, "commitChoicesCount") || isPositiveNumber(value.commitChoicesCount)) &&
    (!hasProperty(value, "usageMode") || isValidUsageMode(value.usageMode)) &&
    (!hasProperty(value, "redactSensitiveData") ||
      isBoolean(value.redactSensitiveData)) &&
    (!hasProperty(value, "customRules") ||
      (isArray(value.customRules) && value.customRules.every(isString)))
  );
}

export function isCommitCandidate(value: unknown): value is CommitCandidate {
  return isNonEmptyString(value);
}

export function isJSONString(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isStringArray(value: unknown): value is string[] {
  return isArray(value) && value.every(isString);
}
