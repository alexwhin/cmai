#!/usr/bin/env node
import { program } from "commander";
import { handleError } from "./utils/errors.js";
import { logo } from "./utils/ui-utils.js";
import { getPackageVersion } from "./utils/system-utils.js";
import { initCommand } from "./commands/init.js";
import { generateCommand } from "./commands/generate.js";
import { settingsCommand } from "./commands/settings.js";
import { t, initI18n } from "./utils/i18n.js";
import { checkForUpdates } from "./utils/updates.js";

await initI18n();
const VERSION = getPackageVersion();

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
