import prompts from "prompts";
import { UsageMode } from "../types/index.js";
import { t, ensureI18n } from "../utils/i18n.js";
import {
  configurationExists,
  loadConfiguration,
  getConfigurationWithEnvironmentOverrides,
} from "../utils/config.js";
import { executeCommitAction } from "../utils/commit-actions.js";
import { runCommitWorkflow } from "../utils/commit-workflow.js";
import { formatFilePathsAsItems } from "../utils/data-utils.js";
import { NoStagedFilesError, ConfigurationNotFoundError } from "../utils/errors.js";
import { checkGitInstalled, checkInGitRepo, getGitContext } from "../utils/git-utils.js";
import { message } from "../utils/ui-utils.js";
import { createProviderFromConfig } from "../providers/index.js";

interface GenerateOptions {
  dryrun: boolean;
}

export async function generateCommand(
  options: GenerateOptions,
  showDebug: boolean = false
): Promise<void> {
  const configExists = await configurationExists();
  if (!configExists) {
    throw new ConfigurationNotFoundError();
  }

  let configuration = await loadConfiguration();
  configuration = getConfigurationWithEnvironmentOverrides(configuration);

  if (configuration.uiLanguage) {
    await ensureI18n(configuration.uiLanguage);
  }

  await checkGitInstalled();
  await checkInGitRepo();

  const gitContext = await getGitContext(configuration.redactSensitiveData !== false);

  const filesToAnalyse = gitContext.stagedFiles;
  if (!filesToAnalyse || filesToAnalyse.length === 0) {
    throw new NoStagedFilesError();
  }

  message(t("messages.stagedChangesToProcess"), {
    type: "success",
    items: formatFilePathsAsItems(filesToAnalyse),
    valueColor: "green",
    variant: "title",
  });

  if (options.dryrun) {
    const provider = createProviderFromConfig(configuration);

    message(provider.buildPrompt(gitContext));

    const { proceed } = await prompts({
      type: "confirm",
      name: "proceed",
      message: t("prompts.continueWithGeneration"),
      initial: true,
    });

    if (!proceed) {
      message(t("messages.cancelled"), { type: "warning", variant: "title" });
      return;
    }
  }

  const workflowResult = await runCommitWorkflow(configuration, gitContext, showDebug);

  if (workflowResult.cancelled || !workflowResult.selectedMessage) {
    return;
  }

  const usageMode =
    configuration.usageMode || configuration.completionAction || UsageMode.CLIPBOARD;

  await executeCommitAction({
    selectedMessage: workflowResult.selectedMessage,
    configuration,
    gitContext,
    usageMode,
    provider: workflowResult.provider,
  });
}
