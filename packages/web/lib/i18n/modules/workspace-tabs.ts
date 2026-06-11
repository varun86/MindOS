// Workspace tab strip (titlebar row) + /chat route (spec-titlebar-row Phase 2)

export const workspaceTabsEn = {
  workspaceTabs: {
    newChat: 'New chat',
    closeTab: 'Close tab',
    moreTabs: (n: number) => `${n} more tab${n !== 1 ? 's' : ''}`,
    overflowMenuTitle: 'Hidden tabs',
    tabLimitReached: 'Tab limit reached (50). Close a tab to open another.',
    docTab: 'Document',
    chatTab: 'Chat session',
    sessionNotFoundTitle: 'This conversation no longer exists',
    sessionNotFoundHint: 'It may have been deleted, or evicted by the 30-session history limit.',
    closeThisTab: 'Close this tab',
    backToHome: 'Back to home',
  },
};

export const workspaceTabsZh = {
  workspaceTabs: {
    newChat: '新会话',
    closeTab: '关闭标签',
    moreTabs: (n: number) => `还有 ${n} 个标签`,
    overflowMenuTitle: '收起的标签',
    tabLimitReached: '标签数已达上限（50），请先关闭一些标签。',
    docTab: '文档',
    chatTab: '对话会话',
    sessionNotFoundTitle: '该会话已不存在',
    sessionNotFoundHint: '它可能已被删除，或因 30 个会话的历史上限被淘汰。',
    closeThisTab: '关闭此标签',
    backToHome: '回到首页',
  },
};
