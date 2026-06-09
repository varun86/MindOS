export type SkillInstallMode = 'universal' | 'additional' | 'unsupported';

export interface SkillAgentRegistration {
  mode: SkillInstallMode;
  /** npx skills `-a` value for additional agents. */
  skillAgentName?: string;
}

/**
 * Skill-install registry keyed by MCP agent key.
 * Client-safe: do not import Node-only modules here.
 * Keep in sync with docs and bin/lib/mcp-agents.js.
 */
export const SKILL_AGENT_REGISTRY: Record<string, SkillAgentRegistration> = {
  'claude-code': { mode: 'additional', skillAgentName: 'claude-code' },
  'cursor': { mode: 'universal' },
  'windsurf': { mode: 'additional', skillAgentName: 'windsurf' },
  'cline': { mode: 'universal' },
  'trae': { mode: 'additional', skillAgentName: 'trae' },
  'gemini-cli': { mode: 'universal' },
  'openclaw': { mode: 'additional', skillAgentName: 'openclaw' },
  'codebuddy': { mode: 'additional', skillAgentName: 'codebuddy' },
  'kimi-cli': { mode: 'universal' },
  'opencode': { mode: 'universal' },
  'pi': { mode: 'additional', skillAgentName: 'pi' },
  'augment': { mode: 'additional', skillAgentName: 'augment' },
  'qwen-code': { mode: 'additional', skillAgentName: 'qwen-code' },
  'qoder': { mode: 'additional', skillAgentName: 'qoder' },
  'trae-cn': { mode: 'additional', skillAgentName: 'trae-cn' },
  'roo': { mode: 'additional', skillAgentName: 'roo' },
  'github-copilot': { mode: 'universal' },
  'codex': { mode: 'universal' },
  'kilo-code': { mode: 'universal' },
  'warp': { mode: 'universal' },
  'antigravity': { mode: 'additional', skillAgentName: 'antigravity' },
  'qclaw': { mode: 'unsupported' },
  'workbuddy': { mode: 'unsupported' },
  'lingma': { mode: 'unsupported' },
  'copaw': { mode: 'unsupported' },
  'hermes': { mode: 'unsupported' },
};
