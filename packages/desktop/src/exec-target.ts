/**
 * Windows .cmd/.bat exec target resolution — shared by node-detect,
 * process-manager and main. No electron imports: process-manager tests load
 * this module graph without an electron mock.
 *
 * spawn/execFile cannot run .cmd directly (Node >=18.20 EINVAL), and
 * shell:true concatenates argv unquoted — paths like C:\Users\John Smith\...
 * split at the space. Wrapping in cmd.exe with quoted argv handles both.
 */
const IS_WIN = process.platform === 'win32';

export function quoteCmdArg(value: string): string {
  if (value.includes('"')) {
    throw new Error('Invalid Windows command argument: double quote is not allowed');
  }
  return `"${value}"`;
}

export function resolveExecTarget(command: string, args: string[]): { command: string; args: string[] } {
  if (IS_WIN && /\.(?:cmd|bat)$/i.test(command)) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', [command, ...args].map(quoteCmdArg).join(' ')],
    };
  }
  return { command, args };
}
