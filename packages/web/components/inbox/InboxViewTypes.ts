import type { InboxFileSourceInfo } from '@/lib/inbox-client';

export interface InboxFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  isAging: boolean;
  source?: InboxFileSourceInfo;
}

export type CaptureIntent = 'source' | 'note' | 'judgment' | 'reflect';

export type InboxViewMode = 'capture' | 'queue' | 'shelved' | 'history';

export type LastSavedSummary = { saved: number; failed: number };

export type CaptureSaveOutcome = {
  savedAny: boolean;
  savedCount: number;
  failedCount: number;
  textSaveFailed: boolean;
  latestFiles: InboxFile[] | null;
};

export interface CaptureIntentOption {
  id: CaptureIntent;
  title: string;
  desc: string;
  action: string;
  density: string;
}

export type InboxUnderstandingLabels = {
  intentSourceTitle: string;
  intentSourceDesc: string;
  intentSourceAction: string;
  intentNoteTitle: string;
  intentNoteDesc: string;
  intentNoteAction: string;
  intentJudgmentTitle: string;
  intentJudgmentDesc: string;
  intentJudgmentAction: string;
  intentReflectTitle: string;
  intentReflectDesc: string;
  intentReflectAction: string;
  typeArticle: string;
  typeMeeting: string;
  typeDecision: string;
  typeData: string;
  typeDocument: string;
  typeRawNote: string;
  targetResearch: string;
  targetMeetings: string;
  targetDecisions: string;
  targetData: string;
  targetInboxReview: string;
  reasonArticle: string;
  reasonMeeting: string;
  reasonDecision: string;
  reasonData: string;
  reasonDocument: string;
  reasonRawNote: string;
};

export interface RelativeTimeStrings {
  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
}
