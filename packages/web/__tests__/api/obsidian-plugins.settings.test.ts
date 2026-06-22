import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  installObsidianPluginApiHarness,
  writePlugin,
  importLifecycleRoute,
  importSettingsRoute,
  postRequest,
  settingsPostRequest,
} from './obsidian-plugin-api-test-utils';

let mindRoot: string;

describe('/api/obsidian-plugins settings', () => {
  installObsidianPluginApiHarness((root) => {
    mindRoot = root;
  });

  it('returns settings from enabled Obsidian-style setting tabs', async () => {
    writePlugin(
      'settings-plugin',
      `
        const { Plugin, PluginSettingTab, Setting } = require('obsidian');
        class SettingsTab extends PluginSettingTab {
          constructor(app, plugin) {
            super(app, plugin);
            this.plugin = plugin;
          }
          display() {
            const { containerEl } = this;
            containerEl.empty();
            new Setting(containerEl)
              .setName('API Key')
              .addText((text) => text.setPlaceholder('token').setValue('abc'));
            new Setting(containerEl)
              .setName('Enabled')
              .addToggle((toggle) => toggle.setValue(true));
          }
        }
        module.exports = class SettingsPlugin extends Plugin {
          onload() {
            this.addSettingTab(new SettingsTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'settings-plugin' }));

    const { GET } = await importSettingsRoute();
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.loadResult).toEqual({ loaded: ['settings-plugin'], failed: [], skipped: [] });
    expect(json.plugins[0]).toMatchObject({
      id: 'settings-plugin',
      settingTabs: [
        {
          items: [
            { name: 'API Key', kind: 'text', value: 'abc', placeholder: 'token', canChange: false },
            { name: 'Enabled', kind: 'toggle', value: true, canChange: false },
          ],
        },
      ],
    });
  });

  it('updates plugin settings by replaying Setting onChange callbacks', async () => {
    writePlugin(
      'settings-action-plugin',
      `
        const { Plugin, PluginSettingTab, Setting } = require('obsidian');
        class SettingsTab extends PluginSettingTab {
          constructor(app, plugin) {
            super(app, plugin);
            this.plugin = plugin;
          }
          display() {
            const { containerEl } = this;
            containerEl.empty();
            new Setting(containerEl)
              .setName('Capture path')
              .addText((text) => text
                .setValue(this.plugin.settings.path)
                .onChange(async (value) => {
                  this.plugin.settings.path = value;
                  await this.plugin.saveSettings();
                }));
            new Setting(containerEl)
              .setName('Enabled')
              .addToggle((toggle) => toggle
                .setValue(this.plugin.settings.enabled)
                .onChange(async (value) => {
                  this.plugin.settings.enabled = value;
                  await this.plugin.saveSettings();
                }));
          }
        }
        module.exports = class SettingsActionPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ path: 'Inbox.md', enabled: true }, await this.loadData() || {});
            this.addSettingTab(new SettingsTab(this.app, this));
          }
          async saveSettings() {
            await this.saveData(this.settings);
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'settings-action-plugin' }));

    const settingsRoute = await importSettingsRoute();
    const res = await settingsRoute.POST(settingsPostRequest({
      action: 'set-value',
      pluginId: 'settings-action-plugin',
      tabIndex: 0,
      itemIndex: 0,
      value: 'Daily.md',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.plugins[0].settingTabs[0].items[0]).toMatchObject({
      name: 'Capture path',
      kind: 'text',
      value: 'Daily.md',
      canChange: true,
    });
    expect(JSON.parse(fs.readFileSync(path.join(mindRoot, '.plugins', 'settings-action-plugin', 'data.json'), 'utf-8'))).toEqual({
      path: 'Daily.md',
      enabled: true,
    });
  });

  it('catalogs declarative getSettingDefinitions tabs with editable controls and confirmable actions', async () => {
    writePlugin(
      'declarative-settings-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                type: 'group',
                heading: 'Capture',
                items: [
                  {
                    name: 'Enabled',
                    desc: 'Turn capture on',
                    control: { type: 'toggle', key: 'enabled', defaultValue: false },
                  },
                  {
                    name: 'Mode',
                    control: {
                      type: 'dropdown',
                      key: 'mode',
                      defaultValue: 'inbox',
                      options: { inbox: 'Inbox', daily: 'Daily' },
                    },
                  },
                  {
                    name: 'Reset',
                    action: () => { throw new Error('should not run'); },
                  },
                ],
              },
            ];
          }
        }
        module.exports = class DeclarativeSettingsPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ enabled: true, mode: 'daily' }, await this.loadData() || {});
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-settings-plugin' }));

    const { GET } = await importSettingsRoute();
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.plugins[0]).toMatchObject({
      id: 'declarative-settings-plugin',
      settingTabs: [{ items: [] }],
      declarativeSettingTabs: [
        {
          items: [
            expect.objectContaining({
              kind: 'group',
              type: 'group',
              heading: 'Capture',
              childCount: 3,
              children: [
                expect.objectContaining({
                  kind: 'control',
                  name: 'Enabled',
                  value: true,
                  control: expect.objectContaining({ type: 'toggle', key: 'enabled', defaultValue: false }),
                  capabilities: expect.objectContaining({ canChange: true }),
                }),
                expect.objectContaining({
                  kind: 'control',
                  name: 'Mode',
                  value: 'daily',
                  control: expect.objectContaining({
                    type: 'dropdown',
                    key: 'mode',
                    options: [
                      { value: 'inbox', label: 'Inbox' },
                      { value: 'daily', label: 'Daily' },
                    ],
                  }),
                }),
                expect.objectContaining({
                  kind: 'action',
                  name: 'Reset',
                  capabilities: expect.objectContaining({ canRunAction: true }),
                  warnings: ['Action callbacks require explicit confirmation before execution.'],
                }),
              ],
            }),
          ],
        },
      ],
    });
  });

  it('runs declarative setting actions only after explicit confirmation', async () => {
    writePlugin(
      'declarative-action-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                name: 'Reset count',
                action: async () => {
                  this.plugin.settings.resetCount += 1;
                  await this.plugin.saveData(this.plugin.settings);
                },
              },
            ];
          }
        }
        module.exports = class DeclarativeActionPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ resetCount: 0 }, await this.loadData() || {});
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-action-plugin' }));

    const settingsRoute = await importSettingsRoute();
    let res = await settingsRoute.POST(settingsPostRequest({
      action: 'click-button',
      source: 'declarative',
      pluginId: 'declarative-action-plugin',
      tabIndex: 0,
      path: [0],
    }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Declarative actions require explicit confirmation.' });
    expect(fs.existsSync(path.join(mindRoot, '.plugins', 'declarative-action-plugin', 'data.json'))).toBe(false);

    res = await settingsRoute.POST(settingsPostRequest({
      action: 'click-button',
      source: 'declarative',
      pluginId: 'declarative-action-plugin',
      tabIndex: 0,
      path: [0],
      confirmAction: true,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.plugins[0].declarativeSettingTabs[0].items[0]).toMatchObject({
      name: 'Reset count',
      capabilities: expect.objectContaining({ canRunAction: true }),
    });
    expect(JSON.parse(fs.readFileSync(path.join(mindRoot, '.plugins', 'declarative-action-plugin', 'data.json'), 'utf-8'))).toEqual({
      resetCount: 1,
    });
  });

  it('runs declarative list mutations only after explicit confirmation', async () => {
    writePlugin(
      'declarative-list-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                type: 'list',
                heading: 'Choices',
                items: this.plugin.settings.items.map((name) => ({ name })),
                addItem: {
                  name: 'Add choice',
                  action: async () => {
                    this.plugin.settings.items.push('New');
                    await this.plugin.saveData(this.plugin.settings);
                  },
                },
                onDelete: async (index) => {
                  this.plugin.settings.items.splice(index, 1);
                  await this.plugin.saveData(this.plugin.settings);
                },
                onReorder: async (oldIndex, newIndex) => {
                  const [item] = this.plugin.settings.items.splice(oldIndex, 1);
                  this.plugin.settings.items.splice(newIndex, 0, item);
                  await this.plugin.saveData(this.plugin.settings);
                },
              },
            ];
          }
        }
        module.exports = class DeclarativeListPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ items: ['A', 'B'] }, await this.loadData() || {});
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-list-plugin' }));

    const settingsRoute = await importSettingsRoute();
    let res = await settingsRoute.POST(settingsPostRequest({
      action: 'list-add',
      source: 'declarative',
      pluginId: 'declarative-list-plugin',
      tabIndex: 0,
      path: [0],
    }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Declarative list mutations require explicit confirmation.' });
    expect(fs.existsSync(path.join(mindRoot, '.plugins', 'declarative-list-plugin', 'data.json'))).toBe(false);

    res = await settingsRoute.POST(settingsPostRequest({
      action: 'list-add',
      source: 'declarative',
      pluginId: 'declarative-list-plugin',
      tabIndex: 0,
      path: [0],
      confirmAction: true,
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).plugins[0].declarativeSettingTabs[0].items[0]).toMatchObject({
      kind: 'list',
      childCount: 3,
      capabilities: expect.objectContaining({ hasListMutation: true }),
      warnings: ['List mutations require explicit confirmation and roll back plugin data on callback failure.'],
    });
    expect(JSON.parse(fs.readFileSync(path.join(mindRoot, '.plugins', 'declarative-list-plugin', 'data.json'), 'utf-8'))).toEqual({
      items: ['A', 'B', 'New'],
    });

    res = await settingsRoute.POST(settingsPostRequest({
      action: 'list-reorder',
      source: 'declarative',
      pluginId: 'declarative-list-plugin',
      tabIndex: 0,
      path: [0],
      listItemIndex: 0,
      newIndex: 2,
      confirmAction: true,
    }));
    expect(res.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(path.join(mindRoot, '.plugins', 'declarative-list-plugin', 'data.json'), 'utf-8'))).toEqual({
      items: ['B', 'New', 'A'],
    });

    res = await settingsRoute.POST(settingsPostRequest({
      action: 'list-delete',
      source: 'declarative',
      pluginId: 'declarative-list-plugin',
      tabIndex: 0,
      path: [0],
      listItemIndex: 1,
      confirmAction: true,
    }));
    expect(res.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(path.join(mindRoot, '.plugins', 'declarative-list-plugin', 'data.json'), 'utf-8'))).toEqual({
      items: ['B', 'A'],
    });
  });

  it('rolls back plugin data when a declarative list mutation fails', async () => {
    writePlugin(
      'declarative-list-rollback-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                type: 'list',
                heading: 'Choices',
                items: this.plugin.settings.items.map((name) => ({ name })),
                onDelete: async (index) => {
                  this.plugin.settings.items.splice(index, 1);
                  await this.plugin.saveData(this.plugin.settings);
                  throw new Error('delete failed');
                },
              },
            ];
          }
        }
        module.exports = class DeclarativeListRollbackPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ items: ['A', 'B'] }, await this.loadData() || {});
            await this.saveData(this.settings);
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-list-rollback-plugin' }));

    const settingsRoute = await importSettingsRoute();
    const res = await settingsRoute.POST(settingsPostRequest({
      action: 'list-delete',
      source: 'declarative',
      pluginId: 'declarative-list-rollback-plugin',
      tabIndex: 0,
      path: [0],
      listItemIndex: 0,
      confirmAction: true,
    }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: 'Declarative list mutation failed; plugin data was rolled back: delete failed',
    });
    expect(JSON.parse(fs.readFileSync(path.join(mindRoot, '.plugins', 'declarative-list-rollback-plugin', 'data.json'), 'utf-8'))).toEqual({
      items: ['A', 'B'],
    });
  });

  it('previews declarative render and page callbacks only after explicit confirmation', async () => {
    writePlugin(
      'declarative-preview-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                name: 'Rendered help',
                render: (el) => {
                  el.createEl('p', { text: 'Rendered snapshot' });
                  this.plugin.settings.previewCount += 1;
                  this.plugin.saveData(this.plugin.settings);
                  return () => { this.plugin.settings.cleaned = true; };
                },
              },
              {
                type: 'page',
                name: 'Advanced page',
                page: () => [
                  {
                    name: 'Nested option',
                    control: { type: 'text', key: 'nested', defaultValue: 'ok' },
                  },
                ],
              },
            ];
          }
        }
        module.exports = class DeclarativePreviewPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ previewCount: 0, nested: 'ok' }, await this.loadData() || {});
            await this.saveData(this.settings);
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-preview-plugin' }));

    const settingsRoute = await importSettingsRoute();
    const getRes = await settingsRoute.GET();
    const getJson = await getRes.json();

    const dataFile = path.join(mindRoot, '.plugins', 'declarative-preview-plugin', 'data.json');
    const initialData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    expect(initialData).toEqual({ previewCount: 0, nested: 'ok' });

    expect(getRes.status).toBe(200);
    expect(getJson.plugins[0].declarativeSettingTabs[0].items).toEqual([
      expect.objectContaining({
        kind: 'render',
        name: 'Rendered help',
        capabilities: expect.objectContaining({ canPreviewRender: true, hasCustomRender: true }),
        warnings: ['Custom render callbacks can be previewed only as safe snapshots after explicit confirmation; plugin DOM/events are not mounted.'],
      }),
      expect.objectContaining({
        kind: 'page',
        name: 'Advanced page',
        capabilities: expect.objectContaining({ canPreviewPage: true, hasCustomPage: true }),
        warnings: ['Custom setting pages can be previewed only as safe snapshots after explicit confirmation; plugin DOM/events are not mounted.'],
      }),
    ]);

    let res = await settingsRoute.POST(settingsPostRequest({
      action: 'preview-render',
      source: 'declarative',
      pluginId: 'declarative-preview-plugin',
      tabIndex: 0,
      path: [0],
    }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Declarative render/page previews require explicit confirmation.' });
    expect(JSON.parse(fs.readFileSync(dataFile, 'utf-8'))).toEqual(initialData);

    res = await settingsRoute.POST(settingsPostRequest({
      action: 'preview-render',
      source: 'declarative',
      pluginId: 'declarative-preview-plugin',
      tabIndex: 0,
      path: [0],
      confirmAction: true,
    }));
    const renderJson = await res.json();

    expect(res.status).toBe(200);
    expect(renderJson.ok).toBe(true);
    expect(renderJson.preview).toMatchObject({
      kind: 'render',
      path: [0],
      label: 'Rendered help',
      text: 'Rendered snapshot',
      cleanupCalled: true,
      warnings: ['Static snapshot only; plugin DOM nodes, event listeners, and arbitrary browser access are not mounted.'],
    });
    expect(renderJson.preview.nodes[0]).toMatchObject({
      tag: 'div',
      children: [expect.objectContaining({ tag: 'p', text: 'Rendered snapshot' })],
    });
    expect(JSON.parse(fs.readFileSync(dataFile, 'utf-8'))).toEqual(initialData);

    res = await settingsRoute.POST(settingsPostRequest({
      action: 'preview-page',
      source: 'declarative',
      pluginId: 'declarative-preview-plugin',
      tabIndex: 0,
      path: [1],
      confirmAction: true,
    }));
    const pageJson = await res.json();

    expect(res.status).toBe(200);
    expect(pageJson.ok).toBe(true);
    expect(pageJson.preview).toMatchObject({
      kind: 'page',
      path: [1],
      label: 'Advanced page',
      pageItems: [
        expect.objectContaining({
          name: 'Nested option',
          kind: 'control',
          capabilities: expect.objectContaining({ canChange: true }),
        }),
      ],
      warnings: ['Static snapshot only; custom page DOM/events are not mounted in the browser settings surface.'],
    });
    expect(JSON.parse(fs.readFileSync(dataFile, 'utf-8'))).toEqual(initialData);
  });

  it('restores plugin data when a declarative preview callback fails', async () => {
    writePlugin(
      'declarative-preview-rollback-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                name: 'Broken render',
                render: async () => {
                  this.plugin.settings.previewCount += 1;
                  await this.plugin.saveData(this.plugin.settings);
                  throw new Error('render failed');
                },
              },
            ];
          }
        }
        module.exports = class DeclarativePreviewRollbackPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ previewCount: 0 }, await this.loadData() || {});
            await this.saveData(this.settings);
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-preview-rollback-plugin' }));

    const settingsRoute = await importSettingsRoute();
    await settingsRoute.GET();

    const dataFile = path.join(mindRoot, '.plugins', 'declarative-preview-rollback-plugin', 'data.json');
    const initialData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    const res = await settingsRoute.POST(settingsPostRequest({
      action: 'preview-render',
      source: 'declarative',
      pluginId: 'declarative-preview-rollback-plugin',
      tabIndex: 0,
      path: [0],
      confirmAction: true,
    }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      error: 'Declarative preview failed; plugin data was restored: render failed',
    });
    expect(JSON.parse(fs.readFileSync(dataFile, 'utf-8'))).toEqual(initialData);
  });

  it('updates declarative setting controls through setControlValue and persists plugin data', async () => {
    writePlugin(
      'declarative-edit-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                type: 'group',
                heading: 'Capture',
                items: [
                  {
                    name: 'Mode',
                    control: {
                      type: 'dropdown',
                      key: 'mode',
                      defaultValue: 'inbox',
                      options: { inbox: 'Inbox', daily: 'Daily' },
                    },
                  },
                  {
                    name: 'Enabled',
                    control: { type: 'toggle', key: 'enabled', defaultValue: false },
                  },
                ],
              },
            ];
          }
        }
        module.exports = class DeclarativeEditPlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ mode: 'inbox', enabled: false }, await this.loadData() || {});
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-edit-plugin' }));

    const settingsRoute = await importSettingsRoute();
    const res = await settingsRoute.POST(settingsPostRequest({
      action: 'set-value',
      source: 'declarative',
      pluginId: 'declarative-edit-plugin',
      tabIndex: 0,
      path: [0, 0],
      value: 'daily',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.plugins[0].declarativeSettingTabs[0].items[0].children[0]).toMatchObject({
      name: 'Mode',
      value: 'daily',
      capabilities: expect.objectContaining({ canChange: true }),
    });
    expect(JSON.parse(fs.readFileSync(path.join(mindRoot, '.plugins', 'declarative-edit-plugin', 'data.json'), 'utf-8'))).toEqual({
      mode: 'daily',
      enabled: false,
    });
  });

  it('rejects invalid declarative setting values before persisting plugin data', async () => {
    writePlugin(
      'declarative-validate-plugin',
      `
        const { Plugin, PluginSettingTab } = require('obsidian');
        class DeclarativeTab extends PluginSettingTab {
          getSettingDefinitions() {
            return [
              {
                name: 'Capture path',
                control: {
                  type: 'text',
                  key: 'path',
                  defaultValue: 'Inbox.md',
                  validate: (value) => value.trim() ? undefined : 'Capture path is required.',
                },
              },
            ];
          }
        }
        module.exports = class DeclarativeValidatePlugin extends Plugin {
          async onload() {
            this.settings = Object.assign({ path: 'Inbox.md' }, await this.loadData() || {});
            this.addSettingTab(new DeclarativeTab(this.app, this));
          }
        };
      `,
    );

    const lifecycle = await importLifecycleRoute();
    await lifecycle.POST(postRequest({ action: 'enable', pluginId: 'declarative-validate-plugin' }));

    const settingsRoute = await importSettingsRoute();
    const res = await settingsRoute.POST(settingsPostRequest({
      action: 'set-value',
      source: 'declarative',
      pluginId: 'declarative-validate-plugin',
      tabIndex: 0,
      path: [0],
      value: '',
    }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Capture path is required.' });
    expect(fs.existsSync(path.join(mindRoot, '.plugins', 'declarative-validate-plugin', 'data.json'))).toBe(false);
  });
});
