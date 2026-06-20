/**
 * mindos ask — deprecated compatibility alias for `mindos agent`.
 */

import { dim, yellow } from '../lib/colors.js';
import { isJsonMode } from '../lib/command.js';
import * as agentCommand from './agent.js';

export const meta = {
  name: 'ask',
  group: 'AI',
  summary: 'Deprecated alias for mindos agent',
  usage: 'mindos agent [-p "<task>"]',
  flags: agentCommand.meta.flags,
  examples: agentCommand.meta.examples,
};

function printDeprecation(flags = {}) {
  if (isJsonMode(flags)) return;
  console.error(`${yellow('Deprecated:')} ${dim('mindos ask has been replaced by mindos agent.')}`);
}

export async function run(args, flags) {
  printDeprecation(flags);
  return agentCommand.run(args, flags);
}

export function printHelp() {
  printDeprecation();
  agentCommand.printHelp();
}
