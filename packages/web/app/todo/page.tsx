import { readSetupPending } from '@/lib/setup-state';
import { getFileContent, saveFileContent } from '@/lib/fs';
import TodoClient from './TodoClient';
import ClientRedirect from '@/components/ClientRedirect';

export const dynamic = 'force-dynamic';

export default async function TodoPage() {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;

  let content = '';
  let exists = true;
  try {
    content = getFileContent('TODO.md');
  } catch {
    exists = false;
  }

  async function saveAction(newContent: string) {
    'use server';
    saveFileContent('TODO.md', newContent);
  }

  return <TodoClient content={content} exists={exists} saveAction={saveAction} />;
}
