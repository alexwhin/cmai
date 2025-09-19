#!/usr/bin/env node
import { program } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { formatError, InvalidConfigurationError } from "./utils/errors.js";
import { isJSONString } from "./utils/guards.js";
import { dim } from "./utils/style.js";
import { exit } from "./utils/system-utils.js";
import { errorWithDebug, message, logo } from "./utils/ui-utils.js";
import { initCommand } from "./commands/init.js";
import { generateCommand } from "./commands/generate.js";
import { settingsCommand } from "./commands/settings.js";
import { t, initI18n } from "./utils/i18n.js";
import { checkForUpdates } from "./utils/updates.js";

await initI18n();

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(currentDirectory, "../package.json");
const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
if (!isJSONString(packageJsonContent)) {
  throw new InvalidConfigurationError([t("errors.configuration.invalidPackageJson")]);
}
const packageJson = JSON.parse(packageJsonContent);
const VERSION = packageJson.version;

logo();
checkForUpdates(VERSION);

export function handleError(errorInstance: unknown): void {
  const showDebug = program.opts().debug || false;

  if (errorInstance instanceof Error && errorInstance.message.includes("API error")) {
    let provider = "unknown";
    if (errorInstance.message.includes("OpenAI")) {
      provider = "openai";
    } else if (errorInstance.message.includes("Anthropic")) {
      provider = "anthropic";
    }

    errorWithDebug(formatError(errorInstance, provider, showDebug));
  } else {
    const errorMessage = errorInstance instanceof Error ? errorInstance.message : t("errors.unknown", { message: "Unknown error" });
    message(errorMessage, { type: "error", variant: "title" });

    if (showDebug && errorInstance instanceof Error && errorInstance.stack) {
      message(dim("\n" + t("debug.stackTrace")));
      message(dim(errorInstance.stack));
    }
  }

  exit(1);
}

program
  .name(t("commands.app.name"))
  .description(t("commands.app.description"))
  .version(VERSION)
  .option("--debug", t("commands.debug"));

program
  .command("init")
  .description(t("commands.init.description"))
  .action(async () => {
    try {
      await initCommand();
    } catch (errorInstance) {
      handleError(errorInstance);
    }
  });

program
  .command("generate", { isDefault: true })
  .description(t("commands.generate.description"))
  .option("--dryrun", t("commands.generate.dryrun"))
  .action(async (options, command) => {
    try {
      const parentOptions = command.parent?.opts() || {};
      await generateCommand(
        {
          dryrun: options.dryrun || false,
        },
        parentOptions.debug || false
      );
    } catch (errorInstance) {
      handleError(errorInstance);
    }
  });

program
  .command("settings")
  .description(t("commands.settings.description"))
  .action(async () => {
    try {
      await settingsCommand();
    } catch (errorInstance) {
      handleError(errorInstance);
    }
  });

program.parse();
