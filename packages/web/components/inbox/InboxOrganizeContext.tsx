'use client';

import { createContext, useContext } from 'react';
import type { InboxOrganizeController } from '@/hooks/useInboxOrganizeController';

const fallbackController: InboxOrganizeController = {
  isOrganizing: false,
  requestInboxOrganize: async (files, options) => {
    window.dispatchEvent(
      new CustomEvent('mindos:inbox-organize', { detail: { files, ...options } }),
    );
    return { started: true };
  },
  requestConversationOrganize: (detail) => {
    window.dispatchEvent(new CustomEvent('mindos:session-organize', { detail }));
  },
};

const InboxOrganizeContext = createContext<InboxOrganizeController>(fallbackController);

export function InboxOrganizeProvider({
  value,
  children,
}: {
  value: InboxOrganizeController;
  children: React.ReactNode;
}) {
  return (
    <InboxOrganizeContext.Provider value={value}>
      {children}
    </InboxOrganizeContext.Provider>
  );
}

export function useInboxOrganize(): InboxOrganizeController {
  return useContext(InboxOrganizeContext);
}
