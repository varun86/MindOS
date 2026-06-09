/**
 * mindos auth — Local authentication maintenance commands.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { CONFIG_PATH } from '../lib/constants.js';
import { bold, cyan, dim, green, red } from '../lib/colors.js';
import { EXIT, printCommandHelp } from '../lib/command.js';
import { ensureWebSessionSecret } from '../lib/auth-session-secret.js';
import { stripBom } from '../lib/jsonc.js';

export const meta = {
  name: 'auth',
  group: 'Config',
  summary: 'Manage local Web UI authentication',
  usage: 'mindos auth <subcommand>',
  examples: [
    'mindos auth reset-web-password',
  ],
};

function readConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(red('No config found. Run `mindos onboard` first.'));
    process.exit(EXIT.ERROR);
  }
  try {
    return JSON.parse(stripBom(readFileSync(CONFIG_PATH, 'utf-8')));
  } catch {
    console.error(red('Failed to parse config file.'));
    process.exit(EXIT.ERROR);
  }
}

function createPrompt() {
  const lineBuffer = [];
  let lineResolve = null;
  let pending = '';

  const onLine = (line) => {
    if (lineResolve) {
      const resolve = lineResolve;
      lineResolve = null;
      resolve(line);
    } else {
      lineBuffer.push(line);
    }
  };

  const onData = (chunk) => {
    pending += String(chunk);
    let match = pending.match(/\r?\n/);
    while (match?.index !== undefined) {
      const line = pending.slice(0, match.index);
      pending = pending.slice(match.index + match[0].length);
      onLine(line);
      match = pending.match(/\r?\n/);
    }
  };
  const onEnd = () => {
    if (pending) {
      onLine(pending);
      pending = '';
    }
    if (lineResolve) {
      const resolve = lineResolve;
      lineResolve = null;
      resolve('');
    }
  };

  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  process.stdin.on('data', onData);
  process.stdin.on('end', onEnd);

  function prompt(question) {
    process.stdout.write(`${question} `);
    if (lineBuffer.length > 0) return Promise.resolve(lineBuffer.shift());
    return new Promise((resolve) => { lineResolve = resolve; });
  }

  async function askPassword(question) {
    const stdout = process.stdout;
    const origWrite = stdout.write.bind(stdout);
    if (process.stdin.isTTY) {
      stdout.write = (chunk, ...args) => {
        if (typeof chunk === 'string' && chunk.includes(question)) return origWrite(chunk, ...args);
        return true;
      };
    }
    const answer = await prompt(question);
    if (process.stdin.isTTY) {
      stdout.write = origWrite;
      console.log();
    }
    return answer;
  }

  function close() {
    process.stdin.off('data', onData);
    process.stdin.off('end', onEnd);
    process.stdin.pause();
  }

  return { askPassword, close };
}

async function resetWebPassword() {
  const config = readConfig();
  const prompt = createPrompt();

  console.log(`\n${bold('MindOS Web UI password reset')}\n`);
  console.log(dim('  This resets the local Web UI access password on this machine.'));
  console.log(dim('  It does not delete, encrypt, decrypt, or modify your Markdown files.\n'));

  const password = await prompt.askPassword('New Web UI password:');
  const confirm = await prompt.askPassword('Confirm Web UI password:');
  prompt.close();

  if (!password.trim()) {
    console.error(red('Password cannot be empty.'));
    process.exit(EXIT.ERROR);
  }
  if (password !== confirm) {
    console.error(red('Passwords do not match.'));
    process.exit(EXIT.ERROR);
  }

  const legacySessionSecret = typeof config.webPassword === 'string' ? config.webPassword : undefined;
  ensureWebSessionSecret(config, legacySessionSecret);
  config.webPassword = password;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  console.log(`\n${green('Done.')} Web UI password updated.`);
  console.log(dim('  Existing browser sessions are kept.'));
  console.log(dim('  Restart MindOS if the running server has not picked up the new config.\n'));
}

export async function run(args) {
  const sub = args[0];
  if (sub === 'reset-web-password') {
    await resetWebPassword();
    return;
  }

  printCommandHelp({ meta });
  console.log(`${bold('Subcommands:')}`);
  console.log(`  ${cyan('mindos auth reset-web-password')}  ${dim('Reset the local Web UI password')}`);
  console.log();
}
