export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import path from 'path';
import os from 'os';
import {
  getSkillRootsFromRuntime,
  handleSkillMatrixGet,
  type MindosRuntimeSettings,
} from '@geminilight/mindos/server';
import { readSettings } from '@/lib/settings';
import { handleRouteErrorSimple } from '@/lib/errors';
import { getProjectRoot } from '@/lib/project-root';
import { listSkillLinkAgents } from '@/lib/mcp-agents';
import { toNextResponse } from '../../_mindos-adapter';

const PROJECT_ROOT = getProjectRoot();

export async function GET() {
  try {
    const settings = readSettings();
    const mindRoot = settings.mindRoot || process.env.MIND_ROOT || path.join(os.homedir(), 'MindOS', 'mind');
    const skillRoots = getSkillRootsFromRuntime({
      mindRoot,
      runtimeRoot: PROJECT_ROOT,
      homeDir: process.env.HOME || os.homedir(),
      settings: settings as unknown as MindosRuntimeSettings,
    });

    return toNextResponse(handleSkillMatrixGet({
      disabledSkills: settings.disabledSkills,
      skillRoots,
      listLinkAgents: listSkillLinkAgents,
    }));
  } catch (err) {
    return handleRouteErrorSimple(err);
  }
}
