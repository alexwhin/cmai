import { Config, UsageMode, GitContext, AIProvider } from "../types/index.js";
import { GitError } from "./errors.js";
import { copyToClipboard, exit } from "./system-utils.js";
import { commit, getLatestCommitHash, getCommitStats } from "./git-utils.js";
import { generateReport, ReportData } from "./data-utils.js";
import { message, spinner } from "./ui-utils.js";
import { t } from "./i18n.js";

interface CommitActionContext {
  selectedMessage: string;
  configuration: Config;
  gitContext: GitContext;
  usageMode: UsageMode;
  provider: AIProvider | null;
}

function createReportData(
  configuration: Config,
  provider: AIProvider | null,
  additionalData?: Partial<ReportData>
): ReportData {
  const tokenUsage = provider?.getLastTokenUsage();
  return {
    ...additionalData,
    provider: {
      model: configuration.model,
      name: configuration.provider,
      tokensUsed: tokenUsage?.totalTokens,
    },
  };
}

async function displayReportAndMessage(
  selectedMessage: string,
  gitContext: GitContext,
  usageMode: UsageMode,
  reportData: ReportData,
  successMessage: string,
  messageType: "success" | "info" = "success"
): Promise<void> {
  const items = await generateReport(selectedMessage, gitContext, usageMode, reportData);
  message("", { items });
  message(successMessage, { type: messageType, variant: "title" });
}

async function executeClipboardAction(context: CommitActionContext): Promise<void> {
  const { selectedMessage, configuration, gitContext, usageMode, provider } = context;

  try {
    await copyToClipboard(selectedMessage);
    const reportData = createReportData(configuration, provider);
    await displayReportAndMessage(
      selectedMessage,
      gitContext,
      usageMode,
      reportData,
      t("messages.messageCopied")
    );
    exit();
  } catch {
    const reportData = createReportData(configuration, provider);
    const items = await generateReport(selectedMessage, gitContext, usageMode, reportData);
    message("", { items });
    message(t("errors.system.clipboardFailed"), { type: "warning", variant: "title" });
    message(t("messages.manualCopyMessage"), { type: "info", variant: "title" });
    exit();
  }
}

async function executeGitCommitAction(context: CommitActionContext): Promise<void> {
  const { selectedMessage, configuration, gitContext, usageMode, provider } = context;

  spinner(t("messages.creatingCommit"), "start");
  try {
    await commit(selectedMessage);

    const [commitHash, stats] = await Promise.all([getLatestCommitHash(), getCommitStats()]);

    const reportData = createReportData(configuration, provider, {
      commitHash,
      stats,
    });

    const items = await generateReport(selectedMessage, gitContext, usageMode, reportData);

    spinner(t("messages.commitCreated"), "succeed");
    message("", { items });
    message(t("messages.commitReadyForPush"), {
      type: "success",
      variant: "title",
    });
    exit();
  } catch (error) {
    spinner(t("errors.system.commitCreateFailed"), "fail");
    message(
      error instanceof Error ? error.message : t("errors.unknown", { message: String(error) }),
      {
        type: "error",
        variant: "title",
      }
    );
    exit(1);
  }
}

async function executeTerminalAction(context: CommitActionContext): Promise<void> {
  const { selectedMessage, configuration, gitContext, usageMode, provider } = context;

  const reportData = createReportData(configuration, provider);
  const items = await generateReport(selectedMessage, gitContext, usageMode, reportData);

  message("", { items });
  message(t("messages.terminalCommitReady"), { type: "success", variant: "title" });

  const commitCommand = `git commit -m "${selectedMessage.replace(/"/g, '\\"')}"`;

  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question("  ", (input) => {
      resolve(input);
    });

    rl.write(commitCommand);
  });

  rl.close();

  if (answer.trim()) {
    try {
      const gitCommitRegex = /^git\s+commit\s+(?:-m\s+)?['"](.+)['"]$/;
      const match = answer.trim().match(gitCommitRegex);

      if (match && match.length > 1 && match[1]) {
        const { spawn } = await import("node:child_process");
        const commitMessage = match[1];

        await new Promise<void>((resolve, reject) => {
          const gitProcess = spawn("git", ["commit", "-m", commitMessage], {
            stdio: "inherit" as const,
          });

          gitProcess.on("close", (code: number | null) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new GitError(t("errors.system.commitCreateFailed")));
            }
          });

          gitProcess.on("error", (error: Error) => {
            reject(error);
          });
        });

        message(t("messages.commitExecuted"), { type: "success", variant: "title" });
      } else {
        message(t("errors.system.invalidCommand"), { type: "warning", variant: "title" });

        const { execSync } = await import("node:child_process");
        execSync(answer, { stdio: "inherit" });
      }
    } catch (error) {
      message(
        error instanceof Error ? error.message : t("errors.unknown", { message: String(error) }),
        { type: "error", variant: "title" }
      );
      exit(1);
    }
  }

  exit();
}

export async function executeCommitAction(context: CommitActionContext): Promise<void> {
  const { usageMode } = context;

  switch (usageMode) {
    case UsageMode.TERMINAL:
      return executeTerminalAction(context);

    case UsageMode.COMMIT:
      return executeGitCommitAction(context);

    case UsageMode.CLIPBOARD:
      return executeClipboardAction(context);

    default:
      return executeClipboardAction(context);
  }
}
