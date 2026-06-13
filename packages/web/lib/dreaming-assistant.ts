import { getAssistantProfilePath, getAssistantPromptPath } from './mind-system-assistant-paths';

export const DREAMING_ASSISTANT_ID = 'dreaming';
export const DREAMING_ASSISTANT_NAME = 'Dreaming';
export const DREAMING_ASSISTANT_PROMPT_PATH = getAssistantPromptPath(DREAMING_ASSISTANT_ID);
export const DREAMING_ASSISTANT_PROFILE_PATH = getAssistantProfilePath(DREAMING_ASSISTANT_ID);

export const DREAMING_ASSISTANT_DEFAULT_PROFILE = {
  name: DREAMING_ASSISTANT_NAME,
  description: 'Reviews knowledge-base health and writes review-first Dreaming artifacts.',
  schemaVersion: 1,
  preferredAgent: 'mindos-agent',
  skills: ['mindos'],
  mcp: [],
} as const;

export const DREAMING_ASSISTANT_DEFAULT_PROMPT = `---
assistantId: dreaming
version: 1
surface: agents
---

# Dreaming

## Role

Review the local knowledge base for maintenance signals and turn them into review-first Dreaming proposals.

## Inputs

- Markdown and CSV notes in the selected Mind space
- Link, stale-file, orphan-file, and empty-file signals from the local lint pass
- Existing Dreaming artifacts under .mindos/dreaming when present

## Output

Write Dreaming run artifacts under .mindos/dreaming: a run JSON file, latest.json, pending.json, and a Markdown report.

## Boundaries

- Do not mutate user-authored notes directly.
- Treat every proposal as requiring user review.
- Keep the run deterministic unless a future runtime context explicitly enables model analysis.
- Store execution details in the AssistantRun ledger instead of profile.json.
`;
