#!/usr/bin/env node
import { program } from "commander";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { handleError, InvalidConfigurationError } from "./utils/errors.js";
import { isJSONString } from "./utils/guards.js";
import { logo } from "./utils/ui-utils.js";
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
      handleError(errorInstance, program.opts().debug);
    }
  });

program
  .command("generate", { isDefault: true })
  .description(t("commands.generate.description"))
  .option("--dryrun", t("commands.generate.dryrun"))
  .action(async (options, command) => {
    const parentOptions = command.parent?.opts() || {};
    try {
      await generateCommand(
        {
          dryrun: options.dryrun || false,
        },
        parentOptions.debug || false
      );
    } catch (errorInstance) {
      handleError(errorInstance, parentOptions.debug || false);
    }
  });

program
  .command("settings")
  .description(t("commands.settings.description"))
  .action(async () => {
    try {
      await settingsCommand();
    } catch (errorInstance) {
      handleError(errorInstance, program.opts().debug);
    }
  });

program.parse();
