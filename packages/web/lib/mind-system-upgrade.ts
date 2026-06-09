import fs from 'fs';
import path from 'path';
import { resolveSafe } from '@/lib/core/security';
import { ensureMindSystemConfig, type MindSystemSlot } from './mind-system';

export interface MindSystemUpgradeSkippedPath {
  path: string;
  reason: 'file_conflict' | 'unsafe_path' | 'write_failed';
}

export interface MindSystemUpgradeResult {
  state: 'ready' | 'partial' | 'hidden';
  createdPaths: string[];
  existingPaths: string[];
  skippedPaths: MindSystemUpgradeSkippedPath[];
}

const README_BY_SLOT: Record<MindSystemSlot['key'], string> = {
  dao: '# 道\n\n价值、方向、长期判断。\n',
  fa: '# 法\n\n规则、边界、承诺。\n',
  shu: '# 术\n\n方法、流程、SOP、可复用套路。\n',
  qi: '# 器\n\n工具、资产、资料源、模板。\n',
};

const INSTRUCTION_BY_SLOT: Record<MindSystemSlot['key'], string> = {
  dao: `# 道 / Dao Instructions

Use this space for values, direction, and long-term judgment.

Agent rules:

- Save durable principles, worldview notes, and strategic decisions here.
- Prefer stable context over temporary status updates.
- Do not put tools, SOPs, or raw assets here unless they directly support a long-term judgment.
- When adding a note, make the underlying belief or decision explicit.
`,
  fa: `# 法 / Fa Instructions

Use this space for rules, boundaries, protocols, and commitments.

Agent rules:

- Save operating rules, constraints, standards, agreements, and policies here.
- Prefer clear do / do-not wording.
- Link to supporting examples when useful, but keep the rule itself concise.
- Do not put one-off tactics or tool inventories here.
`,
  shu: `# 术 / Shu Instructions

Use this space for methods, workflows, SOPs, and reusable tactics.

Agent rules:

- Save repeatable procedures, checklists, prompts, debugging playbooks, and execution patterns here.
- Write steps so they can be reused by a future agent or human.
- Include preconditions, failure modes, and verification checks when relevant.
- Do not put strategic principles or tool inventories here unless they are part of a workflow.
`,
  qi: `# 器 / Qi Instructions

Use this space for tools, assets, templates, references, and resource inventories.

Agent rules:

- Save concrete tools, links, templates, config notes, datasets, and reusable assets here.
- Record how to access or operate an asset, not only that it exists.
- Keep resource notes scannable with names, paths, owners, and usage constraints when known.
- Do not put general principles or full SOPs here unless the asset requires them.
`,
};

export function ensureDefaultMindSystemUpgrade(mindRoot: string): MindSystemUpgradeResult {
  const config = ensureMindSystemConfig(mindRoot);
  if (!config.enabled) {
    return {
      state: 'hidden',
      createdPaths: [],
      existingPaths: [],
      skippedPaths: [],
    };
  }

  const createdPaths: string[] = [];
  const existingPaths: string[] = [];
  const skippedPaths: MindSystemUpgradeSkippedPath[] = [];

  for (const slot of Object.values(config.slots).sort((a, b) => a.order - b.order)) {
    if (!slot.enabled) continue;
    const result = ensureSlotDirectory(mindRoot, slot);
    if (result === 'created') createdPaths.push(slot.path);
    else if (result === 'existing') existingPaths.push(slot.path);
    else skippedPaths.push({ path: slot.path, reason: result });
  }

  return {
    state: skippedPaths.length > 0 ? 'partial' : 'ready',
    createdPaths,
    existingPaths,
    skippedPaths,
  };
}

function ensureSlotDirectory(
  mindRoot: string,
  slot: MindSystemSlot,
): 'created' | 'existing' | MindSystemUpgradeSkippedPath['reason'] {
  let slotDir: string;
  try {
    slotDir = resolveSafe(mindRoot, slot.path);
  } catch {
    return 'unsafe_path';
  }

  try {
    if (fs.existsSync(slotDir)) {
      if (!fs.statSync(slotDir).isDirectory()) return 'file_conflict';
      ensureScaffoldFiles(slotDir, slot);
      return 'existing';
    }

    fs.mkdirSync(slotDir, { recursive: true });
    ensureScaffoldFiles(slotDir, slot);
    return 'created';
  } catch {
    return 'write_failed';
  }
}

function ensureScaffoldFiles(slotDir: string, slot: MindSystemSlot): void {
  const readmePath = path.join(slotDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, README_BY_SLOT[slot.key], 'utf-8');
  }

  const instructionPath = path.join(slotDir, 'INSTRUCTION.md');
  if (!fs.existsSync(instructionPath)) {
    fs.writeFileSync(instructionPath, INSTRUCTION_BY_SLOT[slot.key], 'utf-8');
  }

  const draftsPath = path.join(slotDir, 'Drafts');
  if (!fs.existsSync(draftsPath)) {
    fs.mkdirSync(draftsPath);
  }
}
