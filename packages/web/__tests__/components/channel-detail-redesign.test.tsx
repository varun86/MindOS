// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AgentsContentChannelDetail from '@/components/agents/AgentsContentChannelDetail';
import { ChannelSetupFlow } from '@/components/agents/channel-detail/ChannelSetupFlow';
import { ChannelSettings } from '@/components/agents/channel-detail/ChannelSettings';
import { ChannelTestSend } from '@/components/agents/channel-detail/ChannelTestSend';
import type { PlatformDef } from '@/lib/im/platforms';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en',
    t: {
      panels: {
        im: {
          emptyDesc: 'Connect messaging platforms to let MindOS send messages on your behalf.',
          backToChannels: 'Back to Channels',
          statusConnected: 'Connected',
          notConfigured: 'Set up',
          fetchError: 'Failed to load channel status.',
          thisIsNotChat: 'This is a delivery channel, not a chat inbox.',
          retry: 'Retry',
          howItWorks: 'How it works',
          currentMode: 'Current mode',
          notificationsOnly: 'Notifications only',
          twoWayConversation: 'Two-way conversation',
          conversationTitle: 'Talk with MindOS in Feishu',
          conversationEnable: 'Allow messages from Feishu',
          conversationWaiting: 'Waiting for setup',
          conversationReady: 'Ready for replies',
          conversationDisabled: 'Disabled',
          conversationError: 'Needs attention',
          conversationNotStarted: 'Not started',
          conversationNeedsPublicUrl: 'Public URL required',
          conversationNeedsEncryptKey: 'Encrypt Key required',
          conversationHint: 'Users can DM the bot, and group messages only trigger when the bot is mentioned.',
          conversationConfigHint: 'Turn this on after you have a reachable public URL and your Feishu Encrypt Key ready.',
          conversationWebhookUrl: 'Webhook URL',
          conversationCopyUrl: 'Copy URL',
          conversationStatus: 'Webhook status',
          conversationReachability: 'Reachability',
          conversationReachabilityHint: 'Feishu must be able to reach this URL from the public internet.',
          conversationOpenPlatform: 'Open Feishu console',
          conversationPublicBaseUrl: 'Public base URL',
          conversationEncryptKey: 'Encrypt Key',
          conversationVerificationToken: 'Verification Token',
          conversationVerificationTokenHint: 'Used for Feishu webhook challenge verification. Leave blank to keep the saved value.',
          conversationSecretPlaceholder: 'Leave blank to keep saved value',
          conversationGroupMentions: 'Only reply when mentioned in groups',
          conversationSaved: 'Conversation settings saved',
          conversationSave: 'Save conversation settings',
          conversationPrimaryTitle: 'Start Feishu chat',
          conversationPrimaryHint: '',
          conversationStart: 'Start Feishu chat',
          conversationStarted: 'Feishu chat started.',
          conversationStepApp: 'App connected',
          conversationStepStart: 'Start chat',
          conversationStepTest: 'DM / @ bot in Feishu',
          conversationFeishuChecklist: 'Feishu console: Bot · im.message.receive_v1 · Installed',
          conversationAdvancedToggle: 'Advanced deployment: public Webhook',
          conversationAdvancedHint: 'Only for public deployments.',
          conversationWebhookReady: 'Public Webhook is ready',
          conversationSaveWebhook: 'Save Webhook settings',
          conversationSetupTitle: 'Setup flow',
          conversationLongStep1: 'Choose local long connection and save settings.',
          conversationLongStep2: 'Start the local connection and keep MindOS running.',
          conversationLongStep3: 'Enable the im.message.receive_v1 event in Feishu console.',
          conversationWebhookStep1: 'Fill public Base URL and Encrypt Key.',
          conversationWebhookStep2: 'Save, then copy the Webhook URL into Feishu event subscriptions.',
          conversationWebhookStep3: 'Enable the im.message.receive_v1 event in Feishu console.',
          conversationLongControlTitle: 'Local long connection',
          conversationLongControlHint: 'Best for local development and desktop use. Feishu events arrive through WebSocket after it starts.',
          conversationLongStart: 'Start local connection',
          conversationLongStop: 'Stop Feishu chat',
          conversationLongStarted: 'Local long connection started.',
          conversationLongStopped: 'Local long connection stopped.',
          conversationLongRunning: 'Local connection is running.',
          conversationLongIdle: 'Local connection is not running.',
          feishuOAuthTitle: 'Optional user binding',
          feishuOAuthHint: '',
          feishuOAuthConnected: 'Bound as',
          feishuOAuthPending: 'Pending',
          feishuOAuthDisconnected: 'Optional',
          feishuOAuthAuthorize: 'Bind Feishu user',
          feishuOAuthOpening: 'Opening...',
          feishuOAuthSetupRequired: 'Save App ID and App Secret first.',
          feishuOAuthOpened: 'Feishu user binding opened.',
          workInMindosHint: 'Use Ask in MindOS to work with the agent.',
          useCasesTitle: 'What you can receive',
          statusSummaryTitle: 'Status summary',
          lastActivity: 'Last activity',
          lastRecipient: 'Last recipient',
          noActivityYet: 'No messages sent yet',
          noActivityHint: 'Send a sample message to verify this channel is working.',
          recentActivity: 'Recent activity',
          sendSample: 'Send sample notification',
          sampleHint: 'This sends a real outbound message through the selected channel.',
          settingsTitle: 'Settings',
          settingsHint: 'Maintain credentials and channel settings here.',
          latestSuccess: 'Latest success',
          latestFailure: 'Latest failure',
          noRecentActivity: 'No recent activity',
          notAvailable: 'Not available',
          activityTypeTest: 'Sample message',
          activityTypeAgent: 'Agent update',
          activityTypeManual: 'Manual send',
          disconnectHint: 'Remove credentials and disconnect this platform.',
          disconnect: 'Disconnect',
          confirmDisconnect: 'Confirm?',
          editCredentials: 'Update credentials',
          editCredentialsHint: 'Need to rotate tokens or fix a broken connection?',
          guideLink: 'Open setup guide',
          recipientHint: 'Use the platform-specific recipient ID.',
          recipientPlaceholder: 'Recipient ID',
          messagePlaceholder: 'Hello from MindOS',
          savedValuesHint: 'Saved values stay hidden.',
          required: 'required',
          saving: 'Saving...',
          saved: 'Saved',
          saveConfig: 'Save',
          setupGuide: 'Setup Guide',
          setupMethodsTitle: 'Connection options',
          manualSetupTitle: 'Manual setup',
          openSetupLink: 'Open',
          copySetupLink: 'Copy setup link',
          copyLink: 'Copy link',
          copied: 'Copied',
          recommended: 'Recommended',
          setupAvailable: 'Available',
          setupAfterCredentials: 'After credentials',
          setupPlanned: 'Planned',
          setupManualOnly: 'Manual',
          scanQrHint: 'Scan this locally generated QR code to continue on your phone. No credentials are embedded.',
          setupQrAlt: (name: string) => `${name} QR code`,
          transportLongTitle: 'Local long connection',
          transportWebhookTitle: 'Public Webhook',
          transportLongHint: 'Recommended for local development. No public URL needed; events arrive over WebSocket.',
          transportWebhookHint: 'Use this for deployed servers with a Base URL reachable by Feishu.',
          tabConfigure: 'Configure',
          hideSecret: 'Hide',
          showSecret: 'Show',
          sentOk: 'Sent',
          sentWithId: (id: string) => `Sent ${id}`,
          failed: 'Failed',
          botLabel: 'Bot',
        },
      },
    },
  }),
}));

import { clearChannelCache } from '@/components/agents/channel-detail/cache';

const im = {
  settingsTitle: 'Settings',
  settingsHint: 'Maintain credentials and channel settings here.',
  editCredentials: 'Update credentials',
  savedValuesHint: 'Saved values stay hidden.',
  hideSecret: 'Hide',
  showSecret: 'Show',
  saving: 'Saving...',
  saved: 'Saved',
  saveConfig: 'Save',
  disconnect: 'Disconnect',
  disconnectHint: 'Remove credentials and disconnect this platform.',
  confirmDisconnect: 'Confirm?',
  networkError: 'Network error',
  sendSample: 'Send sample notification',
  expandToSee: 'Click to expand',
  sampleHint: 'This sends a real outbound message through the selected channel.',
  recipientPlaceholder: 'Recipient ID',
  messagePlaceholder: 'Hello from MindOS',
  sentOk: 'Sent',
  sentWithId: (id: string) => `Sent ${id}`,
  failed: 'Failed',
  setupMethodsTitle: 'Connection options',
  manualSetupTitle: 'Manual setup',
  openSetupLink: 'Open',
  copySetupLink: 'Copy setup link',
  copyLink: 'Copy link',
  copied: 'Copied',
  recommended: 'Recommended',
  setupAvailable: 'Available',
  setupAfterCredentials: 'After credentials',
  setupPlanned: 'Planned',
  setupManualOnly: 'Manual',
  scanQrHint: 'Scan this locally generated QR code to continue on your phone. No credentials are embedded.',
  setupQrAlt: (name: string) => `${name} QR code`,
  conversationTitle: 'Talk with MindOS in Feishu',
  conversationEnable: 'Allow messages from Feishu',
  conversationHint: 'Users can DM the bot, and group messages only trigger when the bot is mentioned.',
  conversationStatus: 'Webhook status',
  conversationWaiting: 'Waiting for setup',
  conversationReady: 'Ready for replies',
  conversationDisabled: 'Disabled',
  conversationError: 'Needs attention',
  conversationNotStarted: 'Not started',
  conversationPublicBaseUrl: 'Public base URL',
  conversationEncryptKey: 'Encrypt Key',
  conversationVerificationToken: 'Verification Token',
  conversationSecretPlaceholder: 'Leave blank to keep saved value',
  conversationWebhookUrl: 'Webhook URL',
  conversationCopyUrl: 'Copy URL',
  conversationGroupMentions: 'Only reply when mentioned in groups',
  conversationSaved: 'Conversation settings saved',
  conversationSave: 'Save conversation settings',
  conversationOpenPlatform: 'Open Feishu console',
  conversationPrimaryTitle: 'Start Feishu chat',
  conversationPrimaryHint: '',
  conversationStart: 'Start Feishu chat',
  conversationStarted: 'Feishu chat started.',
  conversationStepApp: 'App connected',
  conversationStepStart: 'Start chat',
  conversationStepTest: 'DM / @ bot in Feishu',
  conversationFeishuChecklist: 'Feishu console: Bot · im.message.receive_v1 · Installed',
  conversationAdvancedToggle: 'Advanced deployment: public Webhook',
  conversationAdvancedHint: 'Only for public deployments.',
  conversationWebhookReady: 'Public Webhook is ready',
  conversationSaveWebhook: 'Save Webhook settings',
  conversationSetupTitle: 'Setup flow',
  conversationLongStep1: 'Choose local long connection and save settings.',
  conversationLongStep2: 'Start the local connection and keep MindOS running.',
  conversationLongStep3: 'Enable the im.message.receive_v1 event in Feishu console.',
  conversationWebhookStep1: 'Fill public Base URL and Encrypt Key.',
  conversationWebhookStep2: 'Save, then copy the Webhook URL into Feishu event subscriptions.',
  conversationWebhookStep3: 'Enable the im.message.receive_v1 event in Feishu console.',
  conversationLongControlTitle: 'Local long connection',
  conversationLongControlHint: 'Best for local development and desktop use. Feishu events arrive through WebSocket after it starts.',
  conversationLongStart: 'Start local connection',
  conversationLongStop: 'Stop Feishu chat',
  conversationLongStarted: 'Local long connection started.',
  conversationLongStopped: 'Local long connection stopped.',
  conversationLongRunning: 'Local connection is running.',
  conversationLongIdle: 'Local connection is not running.',
  transportLongTitle: 'Local long connection',
  transportWebhookTitle: 'Public Webhook',
  transportLongHint: 'Recommended for local development. No public URL needed; events arrive over WebSocket.',
  transportWebhookHint: 'Use this for deployed servers with a Base URL reachable by Feishu.',
};

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(input, 'value')?.set;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('AgentsContentChannelDetail redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearChannelCache();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders a connected Feishu channel with status bar, conversation, and activity', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            platforms: [{ platform: 'feishu', connected: true, botName: 'MindOS Bot', capabilities: ['text', 'markdown'], webhook: { state: 'ready', webhookUrl: 'https://mindos.example.com/api/im/webhook/feishu', publicBaseUrl: 'https://mindos.example.com', transport: 'webhook' } }],
          }),
        });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            activities: [{
              id: 'a1', platform: 'feishu', type: 'test', status: 'success',
              recipient: 'ou_123456', messageSummary: 'Hello from MindOS',
              timestamp: '2026-04-10T10:00:00.000Z',
            }],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="feishu" />); });
    await act(async () => { await Promise.resolve(); });

    // Header
    expect(host.textContent).toContain('Feishu');
    expect(host.textContent).toContain('Connected');
    expect(host.textContent).toContain('MindOS Bot');

    // Status bar
    expect(host.textContent).toContain('Two-way conversation');

    // Feishu chat is the primary path. Webhook details stay under advanced deployment.
    expect(host.textContent).toContain('Talk with MindOS in Feishu');
    expect(host.textContent).toContain('Start Feishu chat');
    expect(host.textContent).toContain('App connected');
    expect(host.textContent).toContain('DM / @ bot in Feishu');
    expect(host.textContent).toContain('Feishu console: Bot · im.message.receive_v1 · Installed');
    expect(host.textContent).toContain('Advanced deployment: public Webhook');
    expect(host.textContent).not.toContain('Public base URL');
    expect(host.textContent).not.toContain('The Feishu app is connected. Next');

    // Activity
    expect(host.textContent).toContain('Recent activity');
    expect(host.textContent).toContain('Hello from MindOS');

    // Test send + Settings (collapsed)
    expect(host.textContent).toContain('Send sample notification');
    expect(host.textContent).toContain('Settings');

    await act(async () => { root.unmount(); });
  });

  it('renders Feishu user binding as optional after app credentials are connected', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            platforms: [{
              platform: 'feishu',
              connected: true,
              botName: 'MindOS Bot',
              capabilities: ['text', 'markdown'],
              oauth: { state: 'disconnected' },
              webhook: { state: 'disabled', transport: 'long_connection' },
            }],
          }),
        });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ activities: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="feishu" />); });
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain('Optional user binding');
    expect(host.textContent).toContain('Optional');
    expect(host.textContent).toContain('Bind Feishu user');
    expect(host.textContent).not.toContain('App ID and App Secret already connect the Feishu bot.');
    expect(host.textContent).not.toContain('Not authorized yet');

    await act(async () => { root.unmount(); });
  });

  it('shows optional Feishu user binding when credentials exist but verification is disconnected', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            platforms: [{
              platform: 'feishu',
              connected: false,
              capabilities: ['text', 'markdown'],
              oauth: { state: 'disconnected' },
              webhook: { state: 'disabled', transport: 'webhook' },
            }],
          }),
        });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ activities: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="feishu" />); });
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain('Manual setup');
    expect(host.textContent).toContain('Optional user binding');
    expect(host.textContent).toContain('Bind Feishu user');

    await act(async () => { root.unmount(); });
  });

  it('shows Feishu user binding pending without implying app verification failed', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            platforms: [{
              platform: 'feishu',
              connected: true,
              botName: 'MindOS Bot',
              capabilities: ['text', 'markdown'],
              oauth: { state: 'pending', expiresAt: '2026-04-10T10:10:00.000Z' },
              webhook: { state: 'disabled', transport: 'webhook' },
            }],
          }),
        });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ activities: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="feishu" />); });
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain('Connected');
    expect(host.textContent).toContain('Optional user binding');
    expect(host.textContent).toContain('Pending');
    expect(host.textContent).not.toContain('Not authorized yet');

    await act(async () => { root.unmount(); });
  });

  it('renders long connection guidance without webhook URL fields', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            platforms: [{
              platform: 'feishu', connected: true, botName: 'MindOS Bot',
              capabilities: ['text', 'markdown'],
              webhook: { state: 'pending', lastError: 'Start the Feishu long connection client.', transport: 'long_connection' },
            }],
          }),
        });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ activities: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="feishu" />); });
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain('Talk with MindOS in Feishu');
    expect(host.textContent).toContain('Not started');
    expect(host.textContent).toContain('Start Feishu chat');
    expect(host.textContent).toContain('im.message.receive_v1');
    expect(host.textContent).not.toContain('Start the Feishu long connection client.');

    await act(async () => { root.unmount(); });
  });

  it('starts Feishu long connection from the conversation setup panel', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            platforms: [{
              platform: 'feishu', connected: true, botName: 'MindOS Bot',
              capabilities: ['text', 'markdown'],
              webhook: { state: 'pending', lastError: 'Start the Feishu long connection client.', transport: 'long_connection' },
            }],
          }),
        });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ activities: [] }) });
      }
      if (url.includes('/api/im/config')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (url.includes('/api/im/feishu/long-connection')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, running: true, startedAt: '2026-04-10T10:00:00.000Z' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="feishu" />); });
    await act(async () => { await Promise.resolve(); });

    const startButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Start Feishu chat')) as HTMLButtonElement;
    expect(startButton).toBeTruthy();

    await act(async () => {
      startButton.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/im/config', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({
        platform: 'feishu',
        conversation: {
          enabled: true,
          transport: 'long_connection',
          allow_group_mentions: true,
        },
      }),
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/im/feishu/long-connection', { method: 'POST' });
    expect(host.textContent).toContain('Feishu chat started.');

    await act(async () => { root.unmount(); });
  });

  it('renders an unconfigured channel as setup flow with guide and form', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({ ok: true, json: async () => ({ platforms: [] }) });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ activities: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="telegram" />); });
    await act(async () => { await Promise.resolve(); });

    // Setup flow: has connection options, manual form, no activity/settings
    expect(host.textContent).toContain('Connection options');
    expect(host.textContent).toContain('Create bot with BotFather');
    expect(host.textContent).toContain('Manual setup');
    expect(host.textContent).toContain('Bot Token');
    expect(host.textContent).toContain('Save');
    expect(host.textContent).not.toContain('Recent activity');
    expect(host.textContent).not.toContain('Settings');

    await act(async () => { root.unmount(); });
  });

  it('renders a connected non-Feishu channel without conversation section', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('/api/im/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            platforms: [{ platform: 'telegram', connected: true, botName: '@testbot', capabilities: ['text'] }],
          }),
        });
      }
      if (url.includes('/api/im/activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ activities: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => { root.render(<AgentsContentChannelDetail platformId="telegram" />); });
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain('Telegram');
    expect(host.textContent).toContain('Connected');
    expect(host.textContent).toContain('@testbot');
    expect(host.textContent).toContain('Recent activity');
    expect(host.textContent).not.toContain('Conversation');

    await act(async () => { root.unmount(); });
  });

  it('updates only changed credential fields in connected settings', async () => {
    const platform: PlatformDef = {
      id: 'feishu',
      name: 'Feishu',
      icon: '🐦',
      fields: [
        { key: 'app_id', label: 'App ID', placeholder: 'CLI_xxx' },
        { key: 'app_secret', label: 'App Secret', placeholder: 'secret' },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onSaved = vi.fn();

    await act(async () => {
      root.render(
        <ChannelSettings
          platform={platform}
          im={im}
          onSaved={onSaved}
          onDisconnected={vi.fn()}
        />,
      );
    });

    const inputs = host.querySelectorAll('input');
    const saveButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Save')) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    await act(async () => {
      setInputValue(inputs[1] as HTMLInputElement, '  new-secret  ');
    });

    expect(saveButton.disabled).toBe(false);
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/im/config', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ platform: 'feishu', credentials: { app_secret: 'new-secret' } }),
    }));
    expect(onSaved).toHaveBeenCalled();

    await act(async () => { root.unmount(); });
  });

  it('does not require optional channel fields before saving setup credentials', async () => {
    const platform: PlatformDef = {
      id: 'dingtalk',
      name: 'DingTalk',
      icon: '🔔',
      purpose: 'Push MindOS notifications into DingTalk groups.',
      fields: [
        { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
        { key: 'webhook_secret', label: 'Signing Secret (optional)', placeholder: 'SECxxx', optional: true },
      ],
    };

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ChannelSetupFlow
          platform={platform}
          im={im}
          locale="en"
          onSaved={vi.fn()}
        />,
      );
    });

    const saveButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Save')) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    const inputs = host.querySelectorAll('input');
    await act(async () => {
      setInputValue(inputs[0] as HTMLInputElement, 'https://oapi.dingtalk.com/robot/send?access_token=abc');
    });

    expect(saveButton.disabled).toBe(false);

    await act(async () => { root.unmount(); });
  });

  it('keeps sample send disabled until recipient and message are both present', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ChannelTestSend
          platformId="telegram"
          im={im}
          onSent={vi.fn()}
        />,
      );
    });

    const inputs = host.querySelectorAll('input');
    const recipientInput = inputs[0] as HTMLInputElement;
    const messageInput = inputs[1] as HTMLInputElement;
    const sendButton = host.querySelector('button[type="button"][disabled]') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);

    await act(async () => {
      setInputValue(recipientInput, '123456789');
    });
    const activeSendButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('Send sample notification')) as HTMLButtonElement;
    expect(activeSendButton.disabled).toBe(false);

    await act(async () => {
      setInputValue(messageInput, '');
    });
    expect(activeSendButton.disabled).toBe(true);

    await act(async () => { root.unmount(); });
  });
});
