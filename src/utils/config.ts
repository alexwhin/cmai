import { promises as fs } from "node:fs";
import { join } from "node:path";
import Ajv, { ValidateFunction } from "ajv";

import { Config, UsageMode } from "../types/index.js";
import { parseProvider } from "./data-utils.js";
import { ConfigurationNotFoundError, InvalidConfigurationError } from "./errors.js";
import { message } from "./ui-utils.js";
import { t } from "./i18n.js";
import { FILE_SYSTEM, DEFAULTS } from "../constants.js";
import { isJSONString, isValidConfig, isString, isNumber } from "./guards.js";

const { CONFIG_DIRECTORY, CONFIG_FILENAME, SCHEMA_FILENAME, SCHEMA_URL } = FILE_SYSTEM;
const CONFIG_FILE_PATH = join(CONFIG_DIRECTORY, CONFIG_FILENAME);
const SCHEMA_FILE_PATH = SCHEMA_FILENAME;


let cachedConfiguration: Config | null = null;
let schemaValidator: ValidateFunction | null = null;
const jsonValidator = new Ajv({ allErrors: true });

async function loadConfigurationSchema(): Promise<void> {
  if (schemaValidator) {
    return;
  }

  try {
    const schemaData = await fs.readFile(SCHEMA_FILE_PATH, "utf-8");
    if (!isJSONString(schemaData)) {
      throw new InvalidConfigurationError(["Invalid schema JSON format"]);
    }
    const schema = JSON.parse(schemaData);
    schemaValidator = jsonValidator.compile(schema);
  } catch {
    message(t("errors.configuration.loadSchemaFailed"), { type: "warning", variant: "title" });
    schemaValidator = null;
  }
}

export async function ensureConfigurationDirectory(): Promise<void> {
  try {
    await fs.access(FILE_SYSTEM.CONFIG_DIRECTORY);
  } catch {
    await fs.mkdir(FILE_SYSTEM.CONFIG_DIRECTORY, { recursive: true });
  }
}

export async function loadConfiguration(): Promise<Config> {
  if (cachedConfiguration) {
    return cachedConfiguration;
  }

  try {
    const configurationData = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    if (!isJSONString(configurationData)) {
      throw new InvalidConfigurationError(["Configuration file contains invalid JSON"]);
    }
    const parsedConfiguration = JSON.parse(configurationData);

    const configurationWithoutSchema = Object.keys(parsedConfiguration)
      .filter((key) => key !== "$schema")
      .reduce((obj, key) => ({ ...obj, [key]: parsedConfiguration[key] }), {});

    if (!isValidConfig(configurationWithoutSchema)) {
      throw new InvalidConfigurationError([t("errors.configuration.invalidStructure")]);
    }

    const configuration: Config = { ...configurationWithoutSchema };

    migrateDeprecatedFields(configuration);

    cachedConfiguration = configuration;
    return cachedConfiguration;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      throw new ConfigurationNotFoundError();
    }
    if (error instanceof InvalidConfigurationError) {
      throw error;
    }
    throw new InvalidConfigurationError([error instanceof Error ? error.message : String(error)]);
  }
}

function migrateDeprecatedFields(configuration: Config): void {
  if (!configuration.usageMode && configuration.completionAction) {
    configuration.usageMode = configuration.completionAction;
    delete configuration.completionAction;
  }
}

export async function saveConfiguration(configuration: Config): Promise<void> {
  await ensureConfigurationDirectory();
  await validateConfigurationSchema(configuration);

  const configurationWithSchema = {
    $schema: SCHEMA_URL,
    ...configuration,
  };

  await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(configurationWithSchema, null, 2), {
    mode: FILE_SYSTEM.CONFIG_FILE_PERMISSIONS,
  });

  cachedConfiguration = configuration;
}

async function validateConfigurationSchema(configuration: Config): Promise<void> {
  await loadConfigurationSchema();

  if (schemaValidator && !schemaValidator(configuration)) {
    const errorMessages = jsonValidator.errorsText(schemaValidator.errors);
    throw new InvalidConfigurationError([errorMessages]);
  }
}

export async function configurationExists(): Promise<boolean> {
  try {
    await fs.access(CONFIG_FILE_PATH);
    return true;
  } catch {
    return false;
  }
}

export function getConfigurationWithEnvironmentOverrides(configuration: Config): Config {
  const environmentProvider = parseProvider(process.env.CMAI_PROVIDER);
  const environmentMaxCommitLength = parseMaxCommitLength(process.env.CMAI_MAX_COMMIT_LENGTH);
  const environmentUsageMode = parseUsageMode(
    process.env.CMAI_USAGE_MODE || process.env.CMAI_COMPLETION_ACTION
  );

  return {
    ...configuration,
    provider: environmentProvider || configuration.provider,
    apiKey: process.env.CMAI_API_KEY || configuration.apiKey,
    model: process.env.CMAI_MODEL || configuration.model,
    maxCommitLength:
      environmentMaxCommitLength || configuration.maxCommitLength || DEFAULTS.MAX_COMMIT_LENGTH,
    usageMode:
      environmentUsageMode ||
      configuration.usageMode ||
      configuration.completionAction ||
      UsageMode.CLIPBOARD,
  };
}

function parseMaxCommitLength(value: string | undefined): number | undefined {
  if (!isString(value)) {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  return isNumber(parsed) ? parsed : undefined;
}

function parseUsageMode(value: string | undefined): UsageMode | undefined {
  if (!isString(value)) {
    return undefined;
  }

  const normalizedValue = value.toUpperCase();

  switch (normalizedValue) {
    case UsageMode.TERMINAL:
      return UsageMode.TERMINAL;
    case UsageMode.COMMIT:
      return UsageMode.COMMIT;
    case UsageMode.CLIPBOARD:
      return UsageMode.CLIPBOARD;
    default:
      return undefined;
  }
}
