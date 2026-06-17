import {
  normalizeMindosSelectedSkills,
  type MindosSelectedSkill,
} from '../selected-skills.js';

export function renderMindosPiSelectedSkillPrompt(
  prompt: string,
  selectedSkills: Array<MindosSelectedSkill | string | null | undefined> | undefined,
): string {
  const skills = normalizeMindosSelectedSkills(selectedSkills);
  if (skills.length === 0) return prompt;

  const skillInstructions = skills.map((skill) => {
    const loadSkillCall = `load_skill(${JSON.stringify(skill.name)})`;
    return [
      `### ${skill.name}`,
      `The user selected the skill ${JSON.stringify(skill.name)} for this turn.`,
      `Immediately call \`${loadSkillCall}\` to load the skill's full content before acting.`,
      'Follow the loaded skill instructions for this request. Do not ask which skill the user meant; they already selected it.',
    ].join('\n\n');
  });

  return [
    prompt.trim(),
    '---',
    '## MindOS Pi Selected Skills',
    ...skillInstructions,
  ].filter(Boolean).join('\n\n');
}
