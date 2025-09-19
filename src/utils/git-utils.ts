import { exec } from "node:child_process";
import { promisify } from "node:util";
import { GitContext } from "../types/index.js";
import { GitNotInstalledError, NotInGitRepositoryError, GitError } from "./errors.js";
import { GIT, DEFAULTS } from "../constants.js";
import { isString } from "./guards.js";

const executeCommand = promisify(exec);

export async function checkGitInstalled(): Promise<void> {
  try {
    await executeCommand("git --version");
  } catch {
    throw new GitNotInstalledError();
  }
}

export async function checkInGitRepo(): Promise<void> {
  try {
    await executeCommand("git rev-parse --git-dir");
  } catch {
    throw new NotInGitRepositoryError();
  }
}

export async function getStagedFiles(): Promise<string[]> {
  const { stdout } = await executeCommand("git diff --cached --name-only");
  return stdout.trim().split("\n").filter(Boolean);
}

export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await executeCommand("git branch --show-current");
  return stdout.trim();
}

export async function getStagedDifference(
  maxLength: number = GIT.MAX_DIFF_LENGTH
): Promise<string> {
  const { stdout } = await executeCommand("git diff --cached");
  if (stdout.length > maxLength) {
    return stdout.substring(0, maxLength) + "\n... (truncated)";
  }
  return stdout;
}

export async function commit(message: string, allowEmpty: boolean = false): Promise<void> {
  const commandArguments = ["commit", "-m", message];
  if (allowEmpty) {
    commandArguments.push("--allow-empty");
  }

  const { stderr } = await executeCommand(
    `git ${commandArguments
      .map((argument) => (argument.includes(" ") ? `"${argument}"` : argument))
      .join(" ")}`
  );

  if (stderr && !stderr.includes("create mode") && !stderr.includes("files changed")) {
    throw new GitError(stderr);
  }
}

export async function getLatestCommitHash(): Promise<string> {
  const { stdout } = await executeCommand("git rev-parse --short HEAD");
  return stdout.trim();
}

export async function getCommitStats(): Promise<{
  filesChanged: number;
  insertions: number;
  deletions: number;
}> {
  const { stdout } = await executeCommand("git diff --stat HEAD~1 HEAD | tail -1");

  const stats = {
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
  };

  const filesChangedMatch = stdout.match(/(\d+)\s+files?\s+changed/);
  if (filesChangedMatch && filesChangedMatch[1] && isString(filesChangedMatch[1])) {
    stats.filesChanged = parseInt(filesChangedMatch[1], 10);
  }

  const insertionsMatch = stdout.match(/(\d+)\s+insertions?\(\+\)/);
  if (insertionsMatch && insertionsMatch[1] && isString(insertionsMatch[1])) {
    stats.insertions = parseInt(insertionsMatch[1], 10);
  }

  const deletionsMatch = stdout.match(/(\d+)\s+deletions?\(-\)/);
  if (deletionsMatch && deletionsMatch[1] && isString(deletionsMatch[1])) {
    stats.deletions = parseInt(deletionsMatch[1], 10);
  }

  return stats;
}

export async function getRemoteUrl(): Promise<string | null> {
  try {
    const { stdout } = await executeCommand("git remote get-url origin");
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function hasUpstream(): Promise<boolean> {
  try {
    const { stdout } = await executeCommand("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function getAheadBehind(): Promise<{
  ahead: number;
  behind: number;
}> {
  try {
    const { stdout } = await executeCommand("git rev-list --left-right --count HEAD...@{u}");
    const [ahead, behind] = stdout
      .trim()
      .split("\t")
      .map((value: string) => (isString(value) ? parseInt(value, 10) : 0));
    return { ahead: ahead || 0, behind: behind || 0 };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

async function getGitUsername(): Promise<string> {
  try {
    const { stdout } = await executeCommand("git config user.name");
    return stdout.trim();
  } catch {
    return process.env.USER || process.env.USERNAME || "unknown";
  }
}

export async function getGitUserEmail(): Promise<string | null> {
  try {
    const { stdout } = await executeCommand("git config user.email");
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getFormattedGitAuthor(): Promise<string> {
  const [name, email] = await Promise.all([getGitUsername(), getGitUserEmail()]);

  if (email) {
    const username = email.split("@")[0];
    return `${name} (${username})`;
  }

  return name;
}

function isAutomatedCommit(commit: string): boolean {
  return GIT.AUTOMATED_PATTERNS.some((pattern: RegExp) => pattern.test(commit));
}

async function getMergeCommits(count: number): Promise<string[]> {
  try {
    const { stdout } = await executeCommand(
      `git log --all --merges --pretty=format:"%s|%b" -n ${count * 3}`
    );

    if (!stdout.trim()) {
      return [];
    }

    const commits: string[] = [];
    const lines = stdout.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const [subject, body = ""] = line.split("|");

      if (!subject) {
        continue;
      }

      let commitMessage = subject.trim();

      if (GIT.MERGE_PATTERNS[0]?.test(commitMessage) && body?.trim()) {
        const bodyLines = body
          .trim()
          .split("\\n")
          .filter((line) => line.trim());
        if (bodyLines.length > 0 && bodyLines[0] && !bodyLines[0].startsWith("Co-authored-by")) {
          commitMessage = bodyLines[0].trim();
        }
      }

      if (commitMessage.match(/^(Merge|merge) (pull request|branch|remote)/i)) {
        continue;
      }

      if (isAutomatedCommit(commitMessage)) {
        continue;
      }

      commits.push(commitMessage);
      if (commits.length >= count) {
        break;
      }
    }

    return commits;
  } catch {
    return [];
  }
}

class DiversityCollector {
  static async getDiverseCommits(count: number): Promise<string[]> {
    try {
      const { stdout } = await executeCommand(
        `git log --all --pretty=format:"%s|%an|%D" --no-merges -n ${count * 4}`
      );

      if (!stdout.trim()) {
        return [];
      }

      const commits: string[] = [];
      const seenAuthors = new Set<string>();
      const seenBranches = new Set<string>();

      stdout
        .trim()
        .split("\n")
        .forEach((line: string) => {
          if (!line.trim()) {
            return;
          }

          const [subject, author = "", references = ""] = line.split("|");

          if (!subject) {
            return;
          }

          const commitMessage = subject.trim();

          if (!commitMessage || isAutomatedCommit(commitMessage)) {
            return;
          }

          const isNewAuthor = author && !seenAuthors.has(author);
          const hasNewBranch =
            references &&
            references
              .split(",")
              .some(
                (reference) => reference.includes("origin/") && !seenBranches.has(reference.trim())
              );

          if (isNewAuthor || hasNewBranch || commits.length === 0) {
            commits.push(commitMessage);

            if (author) {
              seenAuthors.add(author);
            }

            if (references) {
              references.split(",").forEach((reference) => {
                if (reference.includes("origin/")) {
                  seenBranches.add(reference.trim());
                }
              });
            }
          }

          if (commits.length >= count) {
            return;
          }
        });

      return commits;
    } catch {
      return [];
    }
  }

  static async getFallbackCommits(count: number): Promise<string[]> {
    try {
      const { stdout } = await executeCommand(
        `git log --all --pretty=format:%s --no-merges -n ${count * 3}`
      );

      if (!stdout.trim()) {
        return [];
      }

      const commits: string[] = [];

      stdout
        .trim()
        .split("\n")
        .forEach((commit: string) => {
          if (!commit.trim()) {
            return;
          }

          if (isAutomatedCommit(commit.trim())) {
            return;
          }

          commits.push(commit.trim());
        });

      return commits.slice(0, count);
    } catch {
      return [];
    }
  }
}

export async function getRecentCommits(
  count: number = DEFAULTS.RECENT_COMMITS_COUNT
): Promise<string[]> {
  try {
    const uniqueCommits = new Set<string>();

    const mergeCommits = await getMergeCommits(count);
    mergeCommits.forEach((commit) => uniqueCommits.add(commit));

    if (uniqueCommits.size < count) {
      const diverseCommits = await DiversityCollector.getDiverseCommits(count - uniqueCommits.size);
      diverseCommits.forEach((commit) => uniqueCommits.add(commit));
    }

    if (uniqueCommits.size < count) {
      const fallbackCommits = await DiversityCollector.getFallbackCommits(
        count - uniqueCommits.size
      );
      fallbackCommits.forEach((commit) => uniqueCommits.add(commit));
    }

    return Array.from(uniqueCommits).slice(0, count);
  } catch {
    return [];
  }
}

export async function getGitContext(redactSensitive: boolean = true): Promise<GitContext> {
  const { redactSensitiveData } = await import("./system-utils.js");

  const [stagedFiles, branch] = await Promise.all([getStagedFiles(), getCurrentBranch()]);

  const recentCommits = await getRecentCommits();
  const difference = await getStagedDifference();
  const finalDifference = redactSensitive ? redactSensitiveData(difference) : difference;

  return {
    stagedFiles,
    branch,
    difference: finalDifference,
    recentCommits: recentCommits.length > 0 ? recentCommits : undefined,
  };
}
