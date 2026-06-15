import { describe, expect, it } from 'vitest';

import { buildPrePushCommands } from '../../scripts/pre-push-plan.mjs';

function commandKeys(files: string[]): string[] {
  return buildPrePushCommands(files).map((command) => command.key);
}

describe('pre-push command planning', () => {
  it('runs only changed root vitest files instead of the full quick suite', () => {
    expect(commandKeys(['tests/unit/e2e-visual-debug.test.ts'])).toEqual(['root:test-files']);
  });

  it('checks e2e test loading without running browser screenshots by default', () => {
    expect(commandKeys(['tests/e2e/channel-friendly-setup.spec.ts'])).toEqual(['root:e2e-list']);
  });

  it('does not typecheck the web app for web test-only changes', () => {
    expect(commandKeys(['packages/web/__tests__/panels/search-panel-drag-drop.test.tsx'])).toEqual(['web:test-files']);
  });

  it('keeps related tests and typecheck for web source changes', () => {
    expect(commandKeys(['packages/web/components/panels/SearchPanel.tsx'])).toEqual(['web:related', 'web:typecheck']);
  });

  it('keeps the broad quick suite for root scripts and still checks script syntax', () => {
    expect(commandKeys(['scripts/pre-push-checks.mjs'])).toEqual([
      'root:quick',
      'node-check:scripts/pre-push-checks.mjs',
    ]);
  });
});
