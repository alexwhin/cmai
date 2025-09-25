import { isRecord, hasProperty, isArray, isString, isNumber } from "./guards.js";
import { NetworkError, InvalidAPIKeyError, InvalidResponseFormatError } from "./errors.js";
import { t } from "./i18n.js";
import { getProviderDisplayName } from "./formatting.js";
import { Provider } from "../types/index.js";

interface ApiResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}

export function handleApiError(error: unknown): never {
  if (error instanceof Error) {
    throw error;
  }
  throw new NetworkError(t("errors.api.generationFailed"));
}

export function validateApiResponse(
  response: ApiResponse,
  provider: Provider,
  invalidStatusCodes: number[] = [401]
): void {
  if (!response.ok) {
    if (invalidStatusCodes.includes(response.status)) {
      throw new InvalidAPIKeyError(getProviderDisplayName(provider));
    }
    throw new NetworkError(
      t("errors.api.requestFailed", {
        message: `${response.status} ${response.statusText}`,
      })
    );
  }
}

export function validateResponseStructure(
  responseData: unknown,
  provider: Provider,
  dataFieldName: string = "data"
): void {
  if (
    !isRecord(responseData) ||
    !hasProperty(responseData, dataFieldName) ||
    !isArray(responseData[dataFieldName])
  ) {
    throw new InvalidResponseFormatError(getProviderDisplayName(provider));
  }
}

export function trimTrailingChars(text: string, chars: string[]): string {
  let result = text;
  let trimmed = true;
  while (trimmed) {
    trimmed = false;
    for (const char of chars) {
      if (result.endsWith(char)) {
        result = result.slice(0, -char.length);
        trimmed = true;
        break;
      }
    }
  }
  return result;
}

export function isEnumValue<T extends Record<string, string>>(
  value: unknown,
  enumObject: T
): value is T[keyof T] {
  return isString(value) && (Object.values(enumObject) as string[]).includes(value);
}

export function sortById<T extends { id: string }>(items: T[]): T[] {
  return sortByKey(items, "id");
}

export function sortByKey<T, K extends keyof T>(
  items: T[],
  key: K,
  options?: { reverse?: boolean }
): T[] {
  const sorted = [...items];
  const multiplier = options?.reverse ? -1 : 1;

  return sorted.sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];

    if (isString(aValue) && isString(bValue)) {
      return aValue.localeCompare(bValue) * multiplier;
    }

    if (isNumber(aValue) && isNumber(bValue)) {
      return (aValue - bValue) * multiplier;
    }

    return 0;
  });
}

export function sortByMultipleKeys<T>(items: T[], compareFn: (a: T, b: T) => number): T[] {
  return [...items].sort(compareFn);
}
