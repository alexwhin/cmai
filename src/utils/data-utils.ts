import { Provider, UsageMode, GitContext } from "../types/index.js";
import { color } from "./style.js";
import { getFormattedGitAuthor, getRemoteUrl } from "./git-utils.js";
import { getProviderDisplayName } from "./formatting.js";

export type FilePathItem = { label: string; value: string };

export function formatFilePathsAsItems(files: string[]): FilePathItem[] {
  const items = files.map((file) => {
    const lastSlash = file.lastIndexOf("/");
    const directory = lastSlash === -1 ? "./" : file.substring(0, lastSlash + 1);
    const filename = lastSlash === -1 ? file : file.substring(lastSlash + 1);

    return {
      label: directory,
      value: filename,
    };
  });

  return items.sort((a, b) => {
    if (a.label !== b.label) {
      return a.label.localeCompare(b.label);
    }
    return a.value.localeCompare(b.value);
  });
}

const PROVIDER_VALUES = new Set<string>(Object.values(Provider));

export function parseProvider(value: string | undefined): Provider | undefined {
  if (!value) {
    return undefined;
  }

  if (PROVIDER_VALUES.has(value)) {
    switch (value) {
      case Provider.OPENAI:
        return Provider.OPENAI;
      case Provider.ANTHROPIC:
        return Provider.ANTHROPIC;
    }
  }

  return undefined;
}

export interface ReportData {
  commitHash?: string;
  stats?: { filesChanged: number; insertions: number; deletions: number };
  provider?: { tokensUsed?: number; model?: string; name?: string };
}

interface ReportItem {
  label: string;
  value: string;
}

export async function generateReport(
  selectedMessage: string,
  context: GitContext,
  mode: UsageMode,
  data?: ReportData
): Promise<ReportItem[]> {
  const items: ReportItem[] = [];

  items.push({ label: "Message", value: color("cyan", selectedMessage) });

  if (mode === UsageMode.COMMIT && data?.commitHash) {
    const branchName = context.branch || "unknown";
    const combinedValue = `${color("green", data.commitHash)} on ${color("magenta", branchName)}`;
    items.push({ label: "Commit", value: combinedValue });
  } else {
    items.push({
      label: "Branch",
      value: color("magenta", context.branch || "unknown"),
    });
  }

  if (mode === UsageMode.COMMIT && data?.stats && data.stats.filesChanged > 0) {
    const statParts = [];
    statParts.push(`${data.stats.filesChanged} file${data.stats.filesChanged === 1 ? "" : "s"}`);
    if (data.stats.insertions > 0) {
      statParts.push(color("green", `+${data.stats.insertions}`));
    }
    if (data.stats.deletions > 0) {
      statParts.push(color("red", `-${data.stats.deletions}`));
    }
    items.push({ label: "Changes", value: statParts.join(", ") });
  }

  if (data?.provider) {
    const providerParts = [];
    if (data.provider.tokensUsed) {
      const formattedTokens = data.provider.tokensUsed.toLocaleString();
      providerParts.push(color("red", `${formattedTokens} tokens`));
    }
    if (data.provider.model) {
      providerParts.push(color("magenta", data.provider.model));
    }
    if (data.provider.name) {
      const friendlyName = getProviderDisplayName(data.provider.name);
      providerParts.push(color("green", friendlyName));
    }
    if (providerParts.length > 0) {
      items.push({ label: "Provider", value: providerParts.join(", ") });
    }
  }

  const [gitAuthor, remoteUrl] = await Promise.all([getFormattedGitAuthor(), getRemoteUrl()]);

  items.push({ label: "Author", value: gitAuthor });

  if (remoteUrl) {
    items.push({ label: "Repository", value: remoteUrl });
  }

  items.sort((a, b) => b.label.length - a.label.length);

  return items;
}
