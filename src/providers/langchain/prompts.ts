import { PromptTemplate } from "@langchain/core/prompts";
import { getLanguageDisplayName } from "../../utils/formatting.js";
import { Language } from "../../types/index.js";

export function getCommitGenerationPrompt(): PromptTemplate {
  const template = `Generate exactly {commitChoicesCount} commit messages for the following changes.

{recentCommitsSection}
{regenerationNote}
{customRulesSection}

Commit Message Rules:
- Generate exactly {commitChoicesCount} commit messages.
- Maximum {maxCommitLength} characters per message
- Each message must be on a separate line
- Each commit message MUST be {maxCommitLength} characters or less. This is a HARD LIMIT.
- Each option should describe ALL the changes in the provided difference (there should be {commitChoicesCount} messages total)
- Each commit message must describe ALL the changes in the difference
- Provide variations in wording, perspective, or emphasis between options
- Follow the project's existing commit style from recent commits
- Use imperative mood
- No period at the end
- Keep messages concise but descriptive
- Combine multiple related changes into cohesive messages
- Use conventional commit format when appropriate (feat:, fix:, docs:, style:, refactor:, test:, chore:, etc.)
{languageRule}

Temperature and Tone Matching:
- Match the formality level of recent commits
- Maintain the technical depth and detail level seen in recent commits  
- Preserve any naming conventions or terminology patterns
- Mirror the specificity level (whether commits are more general or detailed)

Context:
Branch: {branch}
Files: {files}

Difference to summarize:
{difference}

Return ONLY valid JSON. Example format:
{{
  "commits": [
    "feat: add user authentication to login page", 
    "add login authentication with email and password support"
  ]
}}

IMPORTANT: Return ONLY the JSON object, no other text or formatting.`;

  return PromptTemplate.fromTemplate(template);
}

export const formatRecentCommitsSection = (recentCommits?: string[]): string => {
  if (!recentCommits || recentCommits.length === 0) {
    return "";
  }

  return `Recent commit messages for styling, tone and formatting reference:
${recentCommits
  .slice(0, 10)
  .map((commit: string) => `- ${commit}`)
  .join("\n")}`;
};

export const formatRegenerationNote = (regenerationAttempts?: number): string => {
  if (!regenerationAttempts || regenerationAttempts === 0) {
    return "";
  }

  if (regenerationAttempts === 1) {
    return "\nNOTE: The user rejected the previous batch of suggestions. Please provide more diverse or creative alternatives.\n";
  }

  return `\nNOTE: The user has rejected ${regenerationAttempts} previous batches of suggestions. Please provide significantly different alternatives with varied approaches, styles, and focus areas.\n`;
};

export const formatCustomRulesSection = (customRules?: string[]): string => {
  if (!customRules || customRules.length === 0) {
    return "";
  }

  return `Custom commit message rules (must be followed strictly):
${customRules.map((rule: string) => `- ${rule}`).join("\n")}
`;
};

export const formatLanguageRule = (commitLanguage: string): string => {
  if (commitLanguage === "en") {
    return "";
  }

  const languageName = getLanguageDisplayName(commitLanguage as Language);
  return `\n- Important: Generate all commit messages in ${languageName}. The commit type (feat, fix, etc.) should remain in English, but the description should be in ${languageName}.`;
};
