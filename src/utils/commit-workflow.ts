import prompts from "prompts";
import { Config, CommitCandidate, GitContext, AIProvider } from "../types/index.js";
import { createProviderFromConfig } from "../providers/index.js";
import { formatError, isRetryableError } from "./errors.js";
import { errorWithDebug, spinner, message, formatMenuOption } from "./ui-utils.js";
import { t, getPromptMessage, getPromptHint, getChoiceValue } from "./i18n.js";

enum CommitWorkflowState {
  INITIALIZING = "INITIALIZING",
  GENERATING_CANDIDATES = "GENERATING_CANDIDATES",
  SELECTING_MESSAGE = "SELECTING_MESSAGE",
  REGENERATING = "REGENERATING",
  CUSTOM_INPUT = "CUSTOM_INPUT",
  MESSAGE_SELECTED = "MESSAGE_SELECTED",
  CANCELLED = "CANCELLED",
}

interface WorkflowContext {
  configuration: Config;
  gitContext: GitContext;
  showDebug: boolean;
  candidates: CommitCandidate[];
  selectedMessage?: string;
  regenerationAttempts: number;
  provider: AIProvider | null;
  currentState: CommitWorkflowState;
}

interface WorkflowResult {
  selectedMessage?: string;
  provider: AIProvider | null;
  cancelled: boolean;
}

function createWorkflowContext(
  configuration: Config,
  gitContext: GitContext,
  showDebug: boolean
): WorkflowContext {
  return {
    configuration,
    gitContext,
    showDebug,
    candidates: [],
    selectedMessage: undefined,
    regenerationAttempts: 0,
    provider: null,
    currentState: CommitWorkflowState.INITIALIZING,
  };
}

async function generateCommitCandidates(
  configuration: Config,
  gitContext: GitContext,
  showDebug: boolean,
  spinnerStartMessage: string = getPromptMessage("GENERATING_MESSAGES"),
  spinnerSuccessMessage: string = getPromptMessage("MESSAGES_GENERATED"),
  spinnerFailMessage: string = t("errors.api.generationFailed")
): Promise<{ candidates: CommitCandidate[]; provider: AIProvider | null }> {
  let candidates: CommitCandidate[] = [];
  let provider: AIProvider | null = null;

  try {
    provider = createProviderFromConfig(configuration);
    candidates = await provider.generateCandidates(gitContext);
    spinner(spinnerSuccessMessage, "succeed");
  } catch (error) {
    spinner(spinnerFailMessage, "fail");
    errorWithDebug(formatError(error, configuration.provider, showDebug));

    if (isRetryableError(error)) {
      const { retry } = await prompts({
        type: "confirm",
        name: "retry",
        message: t("prompts.tryAgain"),
        initial: true,
      });

      if (retry) {
        spinner(spinnerStartMessage, "start", true);
        try {
          const retryProvider = createProviderFromConfig(configuration);
          candidates = await retryProvider.generateCandidates(gitContext);
          spinner(spinnerSuccessMessage, "succeed");
          provider = retryProvider;
        } catch (retryError) {
          spinner(spinnerFailMessage, "fail");
          errorWithDebug(formatError(retryError, configuration.provider, showDebug));
          candidates = [];
        }
      }
    }
  }

  return { candidates, provider };
}

async function regenerateCommitCandidates(
  configuration: Config,
  gitContext: GitContext,
  regenerationAttempts: number,
  showDebug: boolean
): Promise<{ candidates: CommitCandidate[]; shouldRetry: boolean }> {
  try {
    const provider = createProviderFromConfig(configuration);
    const contextWithRetries = { ...gitContext, regenerationAttempts };
    const candidates = await provider.generateCandidates(contextWithRetries);
    spinner(getPromptMessage("MESSAGES_REGENERATED"), "succeed");
    return { candidates, shouldRetry: false };
  } catch (error) {
    spinner(t("errors.api.regenerationFailed"), "fail");
    errorWithDebug(formatError(error, configuration.provider, showDebug));

    if (isRetryableError(error)) {
      const { retry } = await prompts({
        type: "confirm",
        name: "retry",
        message: t("prompts.tryAgain"),
        initial: true,
      });

      if (retry) {
        return { candidates: [], shouldRetry: true };
      }
    }

    return { candidates: [], shouldRetry: false };
  }
}

async function buildChoicesFromCandidates(
  candidates: CommitCandidate[]
): Promise<Array<{ title: string; value: string }>> {
  const choices = candidates.map((candidate) => ({
    title: candidate,
    value: candidate,
  }));

  choices.push(
    {
      title: formatMenuOption(t("actions.regenerate"), "regenerate"),
      value: getChoiceValue("REGENERATE"),
    },
    {
      title: formatMenuOption(t("actions.custom"), "edit"),
      value: getChoiceValue("CUSTOM"),
    }
  );

  return choices;
}

async function promptForMessageSelection(
  choices: Array<{ title: string; value: string }>
): Promise<{
  selection: string | undefined;
  cancelled: boolean;
}> {
  const { selection } = await prompts({
    type: "select",
    name: "selection",
    message: getPromptMessage("SELECT_COMMIT_MESSAGE"),
    choices,
    hint: getPromptHint("SELECT"),
  });

  if (!selection) {
    message(t("messages.cancelled"), { type: "warning", variant: "title" });
    return { selection: undefined, cancelled: true };
  }

  return { selection, cancelled: false };
}

async function promptForCustomMessage(): Promise<string | undefined> {
  const { custom } = await prompts({
    type: "text",
    name: "custom",
    message: t("prompts.enterCustomMessage"),
    hint: t("prompts.enterCustomMessage"),
  });

  if (!custom) {
    message(t("messages.cancelled"), { type: "warning", variant: "title" });
    return undefined;
  }

  return custom.trim();
}

async function handleEmptyCandidates(): Promise<string | undefined> {
  return await promptForCustomMessage();
}

export async function runCommitWorkflow(
  configuration: Config,
  gitContext: GitContext,
  showDebug: boolean
): Promise<WorkflowResult> {
  const context = createWorkflowContext(configuration, gitContext, showDebug);

  context.currentState = CommitWorkflowState.GENERATING_CANDIDATES;
  spinner(getPromptMessage("GENERATING_MESSAGES"), "start", true);

  const generationResult = await generateCommitCandidates(
    context.configuration,
    context.gitContext,
    context.showDebug
  );

  context.candidates = generationResult.candidates;
  context.provider = generationResult.provider;

  let selectedMessage: string | undefined;

  while (!selectedMessage) {
    if (context.candidates.length === 0) {
      context.currentState = CommitWorkflowState.CUSTOM_INPUT;
      selectedMessage = await handleEmptyCandidates();
      if (!selectedMessage) {
        context.currentState = CommitWorkflowState.CANCELLED;
        return { selectedMessage: undefined, provider: context.provider, cancelled: true };
      }
      context.selectedMessage = selectedMessage;
      context.currentState = CommitWorkflowState.MESSAGE_SELECTED;
      break;
    }

    context.currentState = CommitWorkflowState.SELECTING_MESSAGE;
    const choices = await buildChoicesFromCandidates(context.candidates);
    const { selection, cancelled } = await promptForMessageSelection(choices);

    if (cancelled) {
      context.currentState = CommitWorkflowState.CANCELLED;
      return { selectedMessage: undefined, provider: context.provider, cancelled: true };
    }

    if (selection === getChoiceValue("REGENERATE")) {
      context.currentState = CommitWorkflowState.REGENERATING;
      context.regenerationAttempts++;
      spinner(getPromptMessage("REGENERATING_MESSAGES"), "start", true);

      const regenerationResult = await regenerateCommitCandidates(
        context.configuration,
        context.gitContext,
        context.regenerationAttempts,
        context.showDebug
      );

      context.candidates = regenerationResult.candidates;

      if (regenerationResult.shouldRetry) {
        spinner(getPromptMessage("REGENERATING_MESSAGES"), "start", true);
        const retryResult = await regenerateCommitCandidates(
          context.configuration,
          context.gitContext,
          context.regenerationAttempts,
          context.showDebug
        );
        context.candidates = retryResult.candidates;
        continue;
      }

      context.currentState = CommitWorkflowState.SELECTING_MESSAGE;
      continue;
    }

    if (selection === getChoiceValue("CUSTOM")) {
      context.currentState = CommitWorkflowState.CUSTOM_INPUT;
      selectedMessage = await promptForCustomMessage();
      if (!selectedMessage) {
        context.currentState = CommitWorkflowState.CANCELLED;
        return { selectedMessage: undefined, provider: context.provider, cancelled: true };
      }
      context.selectedMessage = selectedMessage;
      context.currentState = CommitWorkflowState.MESSAGE_SELECTED;
      break;
    }

    selectedMessage = selection;
    context.selectedMessage = selectedMessage;
    context.currentState = CommitWorkflowState.MESSAGE_SELECTED;
  }

  if (!selectedMessage) {
    return { selectedMessage: undefined, provider: context.provider, cancelled: true };
  }

  selectedMessage = selectedMessage.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  return {
    selectedMessage,
    provider: context.provider,
    cancelled: false,
  };
}
