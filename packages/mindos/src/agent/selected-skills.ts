export type MindosSelectedSkillSource = 'user-selected' | 'implicit';

export type MindosSelectedSkill = {
  name: string;
  source?: MindosSelectedSkillSource;
};

export function normalizeMindosSelectedSkills(
  skills: Array<MindosSelectedSkill | string | null | undefined> | undefined,
  legacySkillName?: string,
): MindosSelectedSkill[] {
  const result: MindosSelectedSkill[] = [];
  const seen = new Set<string>();
  const add = (value: MindosSelectedSkill | string | null | undefined, fallbackSource: MindosSelectedSkillSource) => {
    const name = typeof value === 'string'
      ? value.trim()
      : (value?.name ?? '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const source = typeof value === 'string'
      ? fallbackSource
      : (value?.source ?? fallbackSource);
    result.push({
      name,
      source,
    });
  };

  for (const skill of skills ?? []) add(skill, 'user-selected');
  add(legacySkillName, 'user-selected');
  return result;
}

export function mindosSelectedSkillNames(skills: Array<MindosSelectedSkill | string | null | undefined> | undefined): string[] {
  return normalizeMindosSelectedSkills(skills).map((skill) => skill.name);
}
