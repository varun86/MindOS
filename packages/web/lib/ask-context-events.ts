'use client';

export const ASK_ADD_CONTEXT_EVENT = 'mindos:add-ask-context';

export type AskContextNodeType = 'file' | 'directory';

export type AskAddContextDetail = {
  path?: string;
  type?: AskContextNodeType | 'folder' | 'space';
  label?: string;
};

export type AskContextRequest = {
  id: number;
  path: string;
  type: AskContextNodeType;
  label?: string;
};

export function normalizeAskContextDetail(detail: AskAddContextDetail | undefined): Omit<AskContextRequest, 'id'> | null {
  const rawPath = detail?.path?.trim().replace(/\\/g, '/');
  if (!rawPath) return null;

  const type: AskContextNodeType = detail?.type === 'directory' || detail?.type === 'folder' || detail?.type === 'space'
    ? 'directory'
    : 'file';
  const path = type === 'directory'
    ? `${rawPath.replace(/\/+$/, '')}/`
    : rawPath.replace(/\/+$/, '');
  const label = detail?.label?.trim();

  return {
    path,
    type,
    ...(label ? { label } : {}),
  };
}

export function requestAddAskContext(detail: AskAddContextDetail) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeAskContextDetail(detail);
  if (!normalized) return;
  window.dispatchEvent(new CustomEvent(ASK_ADD_CONTEXT_EVENT, { detail: normalized }));
}
