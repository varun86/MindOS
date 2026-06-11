import type { CaptureIntent, CaptureIntentOption, InboxFile, InboxUnderstandingLabels } from './InboxViewTypes';
import { countWords, getFileExt } from './InboxViewFormat';

export function getIntentOptions(labels: InboxUnderstandingLabels): CaptureIntentOption[] {
  return [
    {
      id: 'source',
      title: labels.intentSourceTitle,
      desc: labels.intentSourceDesc,
      action: labels.intentSourceAction,
      density: labels.typeRawNote,
    },
    {
      id: 'note',
      title: labels.intentNoteTitle,
      desc: labels.intentNoteDesc,
      action: labels.intentNoteAction,
      density: labels.typeDocument,
    },
    {
      id: 'judgment',
      title: labels.intentJudgmentTitle,
      desc: labels.intentJudgmentDesc,
      action: labels.intentJudgmentAction,
      density: labels.typeDecision,
    },
    {
      id: 'reflect',
      title: labels.intentReflectTitle,
      desc: labels.intentReflectDesc,
      action: labels.intentReflectAction,
      density: labels.targetDecisions,
    },
  ];
}

export function inferSuggestedIntent(
  text: string,
  urls: string[],
  files: File[],
): CaptureIntent {
  const lower = text.toLowerCase();
  const wordCount = countWords(text);
  const fileNames = files.map(file => file.name.toLowerCase()).join(' ');

  if (/decision|rule|preference|principle|judgment|sop|should|must|判断|决策|规则|偏好|原则|方法|以后|不要|必须/.test(lower)) {
    return 'judgment';
  }
  if (/reflect|reflection|why|pattern|blind spot|growth|lesson|复盘|反思|成长|盲区|模式|我发现/.test(lower)) {
    return 'reflect';
  }
  if (urls.length > 0 || wordCount > 80 || /\.(pdf|docx?|md|html?)\b/.test(fileNames)) {
    return 'note';
  }
  return 'source';
}

export function inferInboxFileIntent(file: InboxFile): CaptureIntent {
  const lower = file.name.toLowerCase();
  const ext = getFileExt(file.name);
  if (/decision|adr|rule|preference|judgment|判断|决策|规则|偏好/.test(lower)) {
    return 'judgment';
  }
  if (/reflect|reflection|lesson|复盘|反思|成长/.test(lower)) {
    return 'reflect';
  }
  if (looksLikeCapturedArticle(lower) || ['md', 'markdown', 'html', 'htm', 'pdf', 'doc', 'docx', 'docm'].includes(ext)) {
    return 'note';
  }
  return 'source';
}

export function buildUnderstanding(file: InboxFile, labels: InboxUnderstandingLabels, intent: CaptureIntent): {
  type: string;
  target: string;
  reason: string;
  signals: string[];
  density: string;
} {
  const ext = getFileExt(file.name);
  const lower = file.name.toLowerCase();
  const intentOption = getIntentOptions(labels).find(option => option.id === intent);
  const density = intentOption?.density ?? labels.typeRawNote;
  const signals = [
    ext ? `.${ext}` : 'no extension',
    file.isAging ? 'aged 7+ days' : 'fresh capture',
    intentOption?.title ?? labels.intentSourceTitle,
  ];

  if (file.source || looksLikeCapturedArticle(lower)) {
    return {
      type: labels.typeArticle,
      target: labels.targetResearch,
      reason: labels.reasonArticle,
      signals: [...signals, file.source?.platformLabel ?? file.source?.siteName ?? 'external source'],
      density,
    };
  }
  if (/meeting|interview|访谈|会议|notes?/.test(lower)) {
    return {
      type: labels.typeMeeting,
      target: labels.targetMeetings,
      reason: labels.reasonMeeting,
      signals: [...signals, 'discussion record'],
      density,
    };
  }
  if (/decision|adr|rule|preference|判断|决策|规则|偏好/.test(lower)) {
    return {
      type: labels.typeDecision,
      target: labels.targetDecisions,
      reason: labels.reasonDecision,
      signals: [...signals, 'judgment candidate'],
      density,
    };
  }
  if (ext === 'csv' || ext === 'json' || ext === 'yaml' || ext === 'yml') {
    return {
      type: labels.typeData,
      target: labels.targetData,
      reason: labels.reasonData,
      signals: [...signals, 'structured'],
      density,
    };
  }
  if (ext === 'pdf' || ext === 'docx' || ext === 'doc' || ext === 'docm') {
    return {
      type: labels.typeDocument,
      target: labels.targetResearch,
      reason: labels.reasonDocument,
      signals: [...signals, 'long-form'],
      density,
    };
  }
  return {
    type: labels.typeRawNote,
    target: labels.targetInboxReview,
    reason: labels.reasonRawNote,
    signals,
    density,
  };
}

export function looksLikeCapturedArticle(lowerName: string): boolean {
  return /article|url|web|clip|wechat|公众号|mp.weixin|小红书|link|reference|ref/.test(lowerName);
}

export type InboxUnderstanding = ReturnType<typeof buildUnderstanding>;
