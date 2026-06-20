// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import StepReview from '@/components/setup/StepReview';
import type { SetupState } from '@/components/setup/types';
import { onboardingEn } from '@/lib/i18n/modules/onboarding-en';

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({ locale: 'en' as const }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state: SetupState = {
  mindRoot: '/Users/alice/Documents/MindOS/mind',
  template: '',
  initialSpaces: ['life', 'product'],
  initialSpaceLocale: 'en',
  activeProvider: 'skip',
  providers: [],
  webPort: 4567,
  mcpPort: 8567,
  authToken: 'test-token',
  webPassword: '',
};

describe('StepReview', () => {
  it('renders review settings without the old outer framed card', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <StepReview
          state={state}
          selectedAgents={new Set()}
          agentStatuses={{}}
          onRetryAgent={vi.fn()}
          error=""
          needsRestart={false}
          s={onboardingEn.setup}
          setupPhase="review"
          cliEnabled
          mcpEnabled={false}
        />,
      );
    });

    const summary = host.querySelector('[data-setup-review-summary]');
    expect(summary).not.toBeNull();
    expect(summary?.className).not.toContain('border');
    expect(summary?.className).not.toContain('rounded-xl');
    expect(host.querySelectorAll('[data-setup-review-row]')).toHaveLength(5);
    expect(host.textContent).toContain('Mind Spaces');
    expect(host.textContent).toContain('Mind location');
    expect(host.textContent).toContain('AI Provider');
    expect(host.textContent).toContain('Skip for now');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
