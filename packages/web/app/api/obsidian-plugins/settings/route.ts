import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { readSettings } from '@/lib/settings';
import { withObsidianPluginRuntime } from '@/lib/obsidian-compat/runtime-service';
import type { LoadedPlugin } from '@/lib/obsidian-compat/loader';
import type { PluginSettingItem, PluginSettingTab, SettingControl, SettingDefinitionItem } from '@/lib/obsidian-compat/types';
import { createObsidianElement } from '@/lib/obsidian-compat/shims/dom';

export const dynamic = 'force-dynamic';

type SettingAction = 'set-value' | 'click-button' | 'list-add' | 'list-delete' | 'list-reorder' | 'preview-render' | 'preview-page';
type SettingActionSource = 'legacy' | 'declarative';

interface SerializedSettingItem {
  name?: string;
  desc?: string;
  kind?: PluginSettingItem['kind'];
  value?: unknown;
  placeholder?: string;
  disabled?: boolean;
  cta?: boolean;
  buttonText?: string;
  options?: Array<{ value: string; label: string }>;
  canChange: boolean;
  canClick: boolean;
}

interface SerializedDeclarativeSettingControl {
  type: string;
  key?: string;
  defaultValue?: unknown;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number | 'any';
  rows?: number;
  includeRoot?: boolean;
  hasValidate: boolean;
  hasFilter: boolean;
  disabledState: 'enabled' | 'disabled' | 'dynamic';
}

interface SerializedDeclarativeSettingItem {
  path: number[];
  kind: 'control' | 'action' | 'render' | 'empty' | 'group' | 'list' | 'page' | 'unknown';
  type?: string;
  name?: string;
  heading?: string;
  desc?: string;
  aliases?: string[];
  searchableState: 'searchable' | 'hidden' | 'dynamic';
  visibleState: 'visible' | 'hidden' | 'dynamic';
  control?: SerializedDeclarativeSettingControl;
  value?: unknown;
  displayValue?: string;
  status?: 'warning' | null | 'dynamic';
  childCount?: number;
  children?: SerializedDeclarativeSettingItem[];
  capabilities: {
    canChange: boolean;
    canRunAction: boolean;
    canAddListItem: boolean;
    canDeleteListItem: boolean;
    canReorderListItems: boolean;
    canPreviewRender: boolean;
    canPreviewPage: boolean;
    hasCustomRender: boolean;
    hasCustomPage: boolean;
    hasListMutation: boolean;
  };
  warnings: string[];
}

interface SerializedDeclarativeSettingPreviewNode {
  tag: string;
  text?: string;
  children?: SerializedDeclarativeSettingPreviewNode[];
}

interface SerializedDeclarativeSettingPreview {
  kind: 'render' | 'page';
  path: number[];
  label: string;
  text?: string;
  nodes?: SerializedDeclarativeSettingPreviewNode[];
  pageItems?: SerializedDeclarativeSettingItem[];
  cleanupCalled?: boolean;
  warnings: string[];
}

interface SerializedDeclarativeSettingTab {
  error?: string;
  items: SerializedDeclarativeSettingItem[];
}

interface SettingActionBody {
  action?: SettingAction;
  source?: SettingActionSource;
  pluginId?: string;
  tabIndex?: number;
  itemIndex?: number;
  path?: unknown;
  confirmAction?: unknown;
  listItemIndex?: unknown;
  newIndex?: unknown;
  value?: unknown;
}

interface ParsedSettingAction {
  action: SettingAction;
  source: SettingActionSource;
  pluginId: string;
  tabIndex: number;
  itemIndex?: number;
  path?: number[];
  confirmAction: boolean;
  listItemIndex?: number;
  newIndex?: number;
  value?: unknown;
}

interface PluginDataSnapshot {
  hadSettings: boolean;
  settings?: unknown;
  hadDataFile: boolean;
  dataFileRaw?: string;
}

function resetTab(tab: PluginSettingTab): void {
  if (Array.isArray(tab.items)) {
    tab.items.length = 0;
  }
  const container = tab.containerEl as HTMLElement & {
    empty?: () => void;
    __obsidianSettingItems?: PluginSettingItem[];
  };
  if (typeof container.empty === 'function') {
    container.empty();
  } else if (Array.isArray(tab.items)) {
    container.__obsidianSettingItems = tab.items;
  }
}

function serializeSettingItem(item: PluginSettingItem): SerializedSettingItem {
  return {
    name: item.name,
    desc: item.desc,
    kind: item.kind,
    value: item.value,
    placeholder: item.placeholder,
    disabled: item.disabled,
    cta: item.cta,
    buttonText: item.buttonText,
    options: item.options,
    canChange: typeof item.onChange === 'function' && !item.disabled,
    canClick: typeof item.onClick === 'function' && !item.disabled,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function textFromRichText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'textContent' in value) {
    const textContent = (value as { textContent?: unknown }).textContent;
    return typeof textContent === 'string' ? textContent : undefined;
  }
  return undefined;
}

function booleanState(value: unknown, truthy: 'searchable', falsy: 'hidden'): 'searchable' | 'hidden' | 'dynamic';
function booleanState(value: unknown, truthy: 'visible', falsy: 'hidden'): 'visible' | 'hidden' | 'dynamic';
function booleanState(value: unknown, truthy: 'searchable' | 'visible', falsy: 'hidden'): 'searchable' | 'visible' | 'hidden' | 'dynamic' {
  if (typeof value === 'function') return 'dynamic';
  if (value === false) return falsy;
  return truthy;
}

function disabledState(value: unknown): SerializedDeclarativeSettingControl['disabledState'] {
  if (typeof value === 'function') return 'dynamic';
  return value === true ? 'disabled' : 'enabled';
}

function simpleValue(value: unknown): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.every((item) => item == null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
      ? value
      : undefined;
  }
  return undefined;
}

function clippedText(value: unknown, max = 500): string | undefined {
  if (value == null) return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function elementChildren(element: HTMLElement): HTMLElement[] {
  return Array.from((element as unknown as { children?: Iterable<HTMLElement> }).children ?? []);
}

function elementText(element: HTMLElement): string {
  const children = elementChildren(element);
  const ownText = String((element as unknown as { textContent?: unknown }).textContent ?? '').trim();
  if (children.length === 0) return ownText;
  const childText = children.map(elementText).filter(Boolean).join(' ').trim();
  if (!childText) return ownText;
  if (ownText && ownText.includes(childText)) return ownText;
  return [ownText, childText].filter(Boolean).join(' ').trim();
}

function serializeElementNode(element: HTMLElement, depth = 0): SerializedDeclarativeSettingPreviewNode {
  const tag = String((element as unknown as { tagName?: unknown; nodeName?: unknown }).tagName ?? (element as unknown as { nodeName?: unknown }).nodeName ?? 'element').toLowerCase();
  const children = depth >= 3 ? [] : elementChildren(element).slice(0, 12).map((child) => serializeElementNode(child, depth + 1));
  return {
    tag,
    ...(clippedText(elementText(element), 240) ? { text: clippedText(elementText(element), 240) } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

function isElementLike(value: unknown): value is HTMLElement {
  return Boolean(value && typeof value === 'object' && ('textContent' in value || 'children' in value || 'tagName' in value || 'nodeName' in value));
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
}

function serializeOptions(value: unknown): Array<{ value: string; label: string }> | undefined {
  if (Array.isArray(value)) {
    const options = value.flatMap((item) => {
      if (typeof item === 'string') return [{ value: item, label: item }];
      if (isRecord(item) && typeof item.value === 'string') {
        return [{ value: item.value, label: typeof item.label === 'string' ? item.label : item.value }];
      }
      return [];
    });
    return options.length > 0 ? options : undefined;
  }
  if (isRecord(value)) {
    const options = Object.entries(value).flatMap(([optionValue, label]) => (
      typeof label === 'string' ? [{ value: optionValue, label }] : []
    ));
    return options.length > 0 ? options : undefined;
  }
  return undefined;
}

function asSettingControl(value: unknown): SettingControl | undefined {
  if (!isRecord(value)) return undefined;
  return value as unknown as SettingControl;
}

function editableDeclarativeControlReason(control: SettingControl): string | null {
  if (typeof control.key !== 'string' || control.key.trim().length === 0) {
    return 'Declarative control is missing a settings key.';
  }
  if (typeof control.disabled === 'function') {
    return 'Dynamic disabled controls are cataloged until MindOS has a live declarative settings page host.';
  }
  if (control.disabled === true) {
    return 'Declarative control is disabled.';
  }
  const type = typeof control.type === 'string' ? control.type : 'unknown';
  if (!['toggle', 'dropdown', 'text', 'textarea', 'number', 'slider', 'color', 'file', 'folder'].includes(type)) {
    return `Declarative control type is cataloged but not editable yet: ${type}`;
  }
  return null;
}

function runnableDeclarativeActionReason(definition: Record<string, unknown>): string | null {
  if (typeof definition.action !== 'function') {
    return 'Declarative setting is not an executable action.';
  }
  if (typeof definition.disabled === 'function') {
    return 'Dynamic disabled actions are cataloged until MindOS has a live declarative settings page host.';
  }
  if (definition.disabled === true) {
    return 'Declarative action is disabled.';
  }
  return null;
}

function mutableDeclarativeListReason(definition: Record<string, unknown>, action: SettingAction): string | null {
  if (definition.type !== 'list') {
    return 'Declarative setting is not a list.';
  }
  if (action === 'list-add') {
    if (!isRecord(definition.addItem) || typeof definition.addItem.action !== 'function') {
      return 'Declarative list does not support adding items.';
    }
    return null;
  }
  if (action === 'list-delete') {
    if (typeof definition.onDelete !== 'function') {
      return 'Declarative list does not support deleting items.';
    }
    return null;
  }
  if (action === 'list-reorder') {
    if (typeof definition.onReorder !== 'function') {
      return 'Declarative list does not support reordering items.';
    }
    return null;
  }
  return 'Declarative list mutation is not supported for this action.';
}

function previewableDeclarativeRenderReason(definition: Record<string, unknown>): string | null {
  if (typeof definition.render !== 'function') {
    return 'Declarative setting is not a custom render item.';
  }
  return null;
}

function previewableDeclarativePageReason(definition: Record<string, unknown>): string | null {
  if (definition.type !== 'page') {
    return 'Declarative setting is not a page.';
  }
  if (typeof definition.page !== 'function' && !Array.isArray(definition.items)) {
    return 'Declarative page does not expose page content or child items.';
  }
  return null;
}

function normalizeDeclarativeControlValue(control: SettingControl, value: unknown): unknown {
  const type = typeof control.type === 'string' ? control.type : 'unknown';
  if (type === 'toggle') {
    if (typeof value !== 'boolean') throw new Error('Toggle controls require a boolean value.');
    return value;
  }
  if (type === 'dropdown') {
    if (typeof value !== 'string') throw new Error('Dropdown controls require a string value.');
    const options = serializeOptions(control.options);
    if (options && !options.some((option) => option.value === value)) {
      throw new Error(`Dropdown value is not one of the declared options: ${value}`);
    }
    return value;
  }
  if (type === 'number' || type === 'slider') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${type === 'slider' ? 'Slider' : 'Number'} controls require a finite number value.`);
    }
    if (typeof control.min === 'number' && value < control.min) {
      throw new Error(`Value must be greater than or equal to ${control.min}.`);
    }
    if (typeof control.max === 'number' && value > control.max) {
      throw new Error(`Value must be less than or equal to ${control.max}.`);
    }
    return value;
  }
  if (['text', 'textarea', 'color', 'file', 'folder'].includes(type)) {
    if (typeof value !== 'string') throw new Error(`${type} controls require a string value.`);
    return value;
  }
  throw new Error(`Declarative control type is cataloged but not editable yet: ${type}`);
}

async function validateDeclarativeControlValue(control: SettingControl, value: unknown): Promise<void> {
  if (typeof control.validate !== 'function') return;
  const message = await Promise.resolve(control.validate(value));
  if (typeof message === 'string' && message.trim().length > 0) {
    throw new Error(message);
  }
}

function valueForControl(tab: PluginSettingTab, control: SettingControl): unknown {
  if (typeof control.key !== 'string' || control.key.trim().length === 0) {
    return simpleValue(control.defaultValue);
  }
  try {
    const value = tab.getControlValue(control.key);
    return simpleValue(value ?? control.defaultValue);
  } catch {
    return simpleValue(control.defaultValue);
  }
}

function serializeControl(control: SettingControl): SerializedDeclarativeSettingControl {
  return {
    type: typeof control.type === 'string' ? control.type : 'unknown',
    ...(typeof control.key === 'string' ? { key: control.key } : {}),
    ...(simpleValue(control.defaultValue) !== undefined ? { defaultValue: simpleValue(control.defaultValue) } : {}),
    ...(typeof control.placeholder === 'string' ? { placeholder: control.placeholder } : {}),
    ...(serializeOptions(control.options) ? { options: serializeOptions(control.options) } : {}),
    ...(typeof control.min === 'number' ? { min: control.min } : {}),
    ...(typeof control.max === 'number' ? { max: control.max } : {}),
    ...(typeof control.step === 'number' || control.step === 'any' ? { step: control.step } : {}),
    ...(typeof control.rows === 'number' ? { rows: control.rows } : {}),
    ...(typeof control.includeRoot === 'boolean' ? { includeRoot: control.includeRoot } : {}),
    hasValidate: typeof control.validate === 'function',
    hasFilter: typeof control.filter === 'function',
    disabledState: disabledState(control.disabled),
  };
}

function declarativeKind(source: Record<string, unknown>): SerializedDeclarativeSettingItem['kind'] {
  if (source.type === 'group') return 'group';
  if (source.type === 'list') return 'list';
  if (source.type === 'page') return 'page';
  if (isRecord(source.control)) return 'control';
  if (typeof source.action === 'function') return 'action';
  if (typeof source.render === 'function') return 'render';
  if ('name' in source) return 'empty';
  return 'unknown';
}

function serializeDeclarativeItem(
  tab: PluginSettingTab,
  definition: unknown,
  path: number[],
  depth = 0,
): SerializedDeclarativeSettingItem {
  if (!isRecord(definition)) {
    return {
      path,
      kind: 'unknown',
      searchableState: 'searchable',
      visibleState: 'visible',
    capabilities: {
      canChange: false,
      canRunAction: false,
      canAddListItem: false,
      canDeleteListItem: false,
      canReorderListItems: false,
      canPreviewRender: false,
      canPreviewPage: false,
      hasCustomRender: false,
      hasCustomPage: false,
      hasListMutation: false,
    },
      warnings: ['Definition is not an object.'],
    };
  }

  const kind = declarativeKind(definition);
  const controlSource = asSettingControl(definition.control);
  const control = controlSource ? serializeControl(controlSource) : undefined;
  const childDefinitions = Array.isArray(definition.items) && depth < 4
    ? definition.items as SettingDefinitionItem[]
    : [];
  const children = childDefinitions.map((item, index) => serializeDeclarativeItem(tab, item, [...path, index], depth + 1));
  const warnings: string[] = [];
  const actionReadOnlyReason = kind === 'action' ? runnableDeclarativeActionReason(definition) : null;
  if (kind === 'action') {
    warnings.push(actionReadOnlyReason ?? 'Action callbacks require explicit confirmation before execution.');
  }
  if (kind === 'render') warnings.push('Custom render callbacks can be previewed only as safe snapshots after explicit confirmation; plugin DOM/events are not mounted.');
  if (kind === 'page' && (typeof definition.page === 'function' || Array.isArray(definition.items))) warnings.push('Custom setting pages can be previewed only as safe snapshots after explicit confirmation; plugin DOM/events are not mounted.');
  if (kind === 'list' && (typeof definition.onReorder === 'function' || typeof definition.onDelete === 'function' || isRecord(definition.addItem))) {
    warnings.push('List mutations require explicit confirmation and roll back plugin data on callback failure.');
  }
  const controlReadOnlyReason = controlSource ? editableDeclarativeControlReason(controlSource) : null;
  if (controlReadOnlyReason) warnings.push(controlReadOnlyReason);

  return {
    path,
    kind,
    ...(typeof definition.type === 'string' ? { type: definition.type } : {}),
    ...(typeof definition.name === 'string' ? { name: definition.name } : {}),
    ...(typeof definition.heading === 'string' ? { heading: definition.heading } : {}),
    ...(textFromRichText(definition.desc) ? { desc: textFromRichText(definition.desc) } : {}),
    ...(stringArray(definition.aliases) ? { aliases: stringArray(definition.aliases) } : {}),
    searchableState: booleanState(definition.searchable, 'searchable', 'hidden'),
    visibleState: booleanState(definition.visible, 'visible', 'hidden'),
    ...(control ? { control } : {}),
    ...(controlSource ? { value: valueForControl(tab, controlSource) } : {}),
    ...(typeof definition.displayValue === 'string' ? { displayValue: definition.displayValue } : {}),
    ...(definition.status === 'warning' || definition.status === null ? { status: definition.status } : typeof definition.status === 'function' ? { status: 'dynamic' as const } : {}),
    ...(childDefinitions.length > 0 ? { childCount: childDefinitions.length, children } : {}),
    capabilities: {
      canChange: Boolean(controlSource && !controlReadOnlyReason),
      canRunAction: kind === 'action' && !actionReadOnlyReason,
      canAddListItem: kind === 'list' && !mutableDeclarativeListReason(definition, 'list-add'),
      canDeleteListItem: kind === 'list' && !mutableDeclarativeListReason(definition, 'list-delete'),
      canReorderListItems: kind === 'list' && !mutableDeclarativeListReason(definition, 'list-reorder'),
      canPreviewRender: kind === 'render' && !previewableDeclarativeRenderReason(definition),
      canPreviewPage: kind === 'page' && !previewableDeclarativePageReason(definition),
      hasCustomRender: typeof definition.render === 'function',
      hasCustomPage: typeof definition.page === 'function',
      hasListMutation: typeof definition.onReorder === 'function' || typeof definition.onDelete === 'function' || isRecord(definition.addItem),
    },
    warnings,
  };
}

function collectDeclarativeSettingTab(tab: PluginSettingTab): SerializedDeclarativeSettingTab | null {
  if (typeof tab.getSettingDefinitions !== 'function') return null;

  try {
    const definitions = tab.getSettingDefinitions();
    if (!Array.isArray(definitions) || definitions.length === 0) {
      return null;
    }
    tab.settingItems = definitions;
    return {
      items: definitions.map((definition, index) => serializeDeclarativeItem(tab, definition, [index])),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      items: [],
    };
  }
}

function collectPluginSettings(plugin: LoadedPlugin) {
  const settingTabs = plugin.instance.settingTabs || [];

  return {
    id: plugin.manifest.id,
    name: plugin.manifest.name,
    version: plugin.manifest.version,
    settingTabs: settingTabs.map((tab) => {
      let error: string | undefined;
      try {
        resetTab(tab);
        tab.display();
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        console.error(`Failed to display settings for ${plugin.manifest.id}:`, err);
      }

      return {
        error,
        items: (tab.items || []).map(serializeSettingItem),
      };
    }),
    declarativeSettingTabs: settingTabs
      .map(collectDeclarativeSettingTab)
      .filter((tab): tab is SerializedDeclarativeSettingTab => Boolean(tab)),
  };
}

function normalizeDeclarativePath(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) return null;
  const path = value.map((item) => Number.isInteger(item) ? item as number : -1);
  return path.every((item) => item >= 0) ? path : null;
}

function normalizeOptionalIndex(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

function childDefinitionsFor(definition: unknown): unknown[] {
  return isRecord(definition) && Array.isArray(definition.items) ? definition.items : [];
}

function findDeclarativeDefinition(definitions: unknown[], path: number[]): unknown {
  let items = definitions;
  let current: unknown;
  for (const index of path) {
    current = items[index];
    if (current === undefined) return undefined;
    items = childDefinitionsFor(current);
  }
  return current;
}

function requireSettingAction(body: SettingActionBody): ParsedSettingAction {
  if (
    body.action !== 'set-value'
    && body.action !== 'click-button'
    && body.action !== 'list-add'
    && body.action !== 'list-delete'
    && body.action !== 'list-reorder'
    && body.action !== 'preview-render'
    && body.action !== 'preview-page'
  ) {
    throw new Error('Invalid settings action');
  }
  const source = body.source ?? 'legacy';
  if (source !== 'legacy' && source !== 'declarative') {
    throw new Error('Invalid settings source');
  }
  if (typeof body.pluginId !== 'string' || body.pluginId.trim().length === 0) {
    throw new Error('Missing pluginId');
  }
  if (!Number.isInteger(body.tabIndex) || (body.tabIndex ?? -1) < 0) {
    throw new Error('Missing tabIndex');
  }
  const tabIndex = body.tabIndex as number;
  const itemIndex = body.itemIndex as number | undefined;
  const path = normalizeDeclarativePath(body.path);
  if (source === 'legacy') {
    if (body.action !== 'set-value' && body.action !== 'click-button') {
      throw new Error('Legacy settings only support set-value and click-button actions');
    }
    if (!Number.isInteger(itemIndex) || (itemIndex ?? -1) < 0) {
      throw new Error('Missing itemIndex');
    }
  } else if (!path) {
    throw new Error('Missing declarative setting path');
  }
  return {
    action: body.action,
    source,
    pluginId: body.pluginId.trim(),
    tabIndex,
    ...(source === 'legacy' ? { itemIndex: itemIndex as number } : { path: path as number[] }),
    confirmAction: body.confirmAction === true,
    ...(normalizeOptionalIndex(body.listItemIndex) !== undefined ? { listItemIndex: normalizeOptionalIndex(body.listItemIndex) } : {}),
    ...(normalizeOptionalIndex(body.newIndex) !== undefined ? { newIndex: normalizeOptionalIndex(body.newIndex) } : {}),
    value: body.value,
  };
}

function cloneJsonValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function capturePluginDataSnapshot(plugin: LoadedPlugin): PluginDataSnapshot {
  const instance = plugin.instance as { settings?: unknown };
  const dataFilePath = path.join(plugin.pluginDir, 'data.json');
  return {
    hadSettings: Object.prototype.hasOwnProperty.call(instance, 'settings'),
    settings: cloneJsonValue(instance.settings),
    hadDataFile: fs.existsSync(dataFilePath),
    ...(fs.existsSync(dataFilePath) ? { dataFileRaw: fs.readFileSync(dataFilePath, 'utf-8') } : {}),
  };
}

function restorePluginDataSnapshot(plugin: LoadedPlugin, snapshot: PluginDataSnapshot): void {
  const instance = plugin.instance as { settings?: unknown };
  if (snapshot.hadSettings) {
    instance.settings = cloneJsonValue(snapshot.settings);
  } else {
    delete instance.settings;
  }

  const dataFilePath = path.join(plugin.pluginDir, 'data.json');
  if (snapshot.hadDataFile) {
    fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
    fs.writeFileSync(dataFilePath, snapshot.dataFileRaw ?? '', 'utf-8');
  } else {
    fs.rmSync(dataFilePath, { force: true });
  }
}

async function runWithPluginDataRollback(plugin: LoadedPlugin, callback: () => Promise<void>): Promise<void> {
  const snapshot = capturePluginDataSnapshot(plugin);
  try {
    await callback();
  } catch (error) {
    try {
      restorePluginDataSnapshot(plugin, snapshot);
    } catch (rollbackError) {
      const originalMessage = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      throw new Error(`${originalMessage}; rollback failed: ${rollbackMessage}`);
    }
    throw error;
  }
}

async function runWithPluginDataRestore<T>(plugin: LoadedPlugin, callback: () => Promise<T>): Promise<T> {
  const snapshot = capturePluginDataSnapshot(plugin);
  try {
    return await callback();
  } finally {
    restorePluginDataSnapshot(plugin, snapshot);
  }
}

function listItemCount(definition: Record<string, unknown>): number {
  return Array.isArray(definition.items) ? definition.items.length : 0;
}

async function applyDeclarativeListMutation(
  plugin: LoadedPlugin,
  tab: PluginSettingTab,
  definition: Record<string, unknown>,
  action: ParsedSettingAction,
): Promise<void | NextResponse> {
  const readOnlyReason = mutableDeclarativeListReason(definition, action.action);
  if (readOnlyReason) {
    return NextResponse.json({ ok: false, error: readOnlyReason }, { status: 400 });
  }
  if (!action.confirmAction) {
    return NextResponse.json({ ok: false, error: 'Declarative list mutations require explicit confirmation.' }, { status: 400 });
  }

  const count = listItemCount(definition);
  try {
    await runWithPluginDataRollback(plugin, async () => {
      if (action.action === 'list-add') {
        const addAction = (definition.addItem as { action: (el: HTMLElement) => unknown }).action;
        await Promise.resolve(addAction(createObsidianElement('div') as HTMLElement));
      } else if (action.action === 'list-delete') {
        if (action.listItemIndex === undefined || action.listItemIndex >= count) {
          throw new Error(`List delete index is out of range: ${action.listItemIndex ?? 'missing'}`);
        }
        await Promise.resolve((definition.onDelete as (index: number) => unknown)(action.listItemIndex));
      } else if (action.action === 'list-reorder') {
        if (action.listItemIndex === undefined || action.listItemIndex >= count) {
          throw new Error(`List reorder source index is out of range: ${action.listItemIndex ?? 'missing'}`);
        }
        if (action.newIndex === undefined || action.newIndex >= count) {
          throw new Error(`List reorder target index is out of range: ${action.newIndex ?? 'missing'}`);
        }
        await Promise.resolve((definition.onReorder as (oldIndex: number, newIndex: number) => unknown)(action.listItemIndex, action.newIndex));
      }
      await Promise.resolve(tab.refreshDomState());
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? `Declarative list mutation failed; plugin data was rolled back: ${error.message}` : 'Declarative list mutation failed; plugin data was rolled back.',
    }, { status: 400 });
  }
}

function declarativeItemLabel(definition: Record<string, unknown>): string {
  return typeof definition.name === 'string'
    ? definition.name
    : typeof definition.heading === 'string'
      ? definition.heading
      : typeof definition.type === 'string'
        ? definition.type
        : 'setting';
}

async function buildDeclarativeRenderPreview(definition: Record<string, unknown>, path: number[]): Promise<SerializedDeclarativeSettingPreview> {
  const renderReason = previewableDeclarativeRenderReason(definition);
  if (renderReason) {
    throw new Error(renderReason);
  }
  const container = createObsidianElement('div') as HTMLElement;
  const cleanup = await Promise.resolve((definition.render as (el: HTMLElement) => void | (() => void))(container));
  let cleanupCalled = false;
  if (typeof cleanup === 'function') {
    await Promise.resolve(cleanup());
    cleanupCalled = true;
  }
  return {
    kind: 'render',
    path,
    label: declarativeItemLabel(definition),
    ...(clippedText(elementText(container)) ? { text: clippedText(elementText(container)) } : {}),
    nodes: [serializeElementNode(container)],
    cleanupCalled,
    warnings: ['Static snapshot only; plugin DOM nodes, event listeners, and arbitrary browser access are not mounted.'],
  };
}

async function buildDeclarativePagePreview(tab: PluginSettingTab, definition: Record<string, unknown>, path: number[]): Promise<SerializedDeclarativeSettingPreview> {
  const pageReason = previewableDeclarativePageReason(definition);
  if (pageReason) {
    throw new Error(pageReason);
  }
  const warnings = ['Static snapshot only; custom page DOM/events are not mounted in the browser settings surface.'];
  let pageItems = Array.isArray(definition.items)
    ? (definition.items as SettingDefinitionItem[]).map((item, index) => serializeDeclarativeItem(tab, item, [...path, index], 1))
    : undefined;
  let text: string | undefined;
  let nodes: SerializedDeclarativeSettingPreviewNode[] | undefined;

  if (typeof definition.page === 'function') {
    const pageResult = await Promise.resolve(definition.page());
    if (Array.isArray(pageResult)) {
      pageItems = pageResult.map((item, index) => serializeDeclarativeItem(tab, item, [...path, index], 1));
    } else if (isRecord(pageResult) && Array.isArray(pageResult.items)) {
      pageItems = (pageResult.items as SettingDefinitionItem[]).map((item, index) => serializeDeclarativeItem(tab, item, [...path, index], 1));
    } else if (isElementLike(pageResult)) {
      const element = pageResult as HTMLElement;
      text = clippedText(elementText(element));
      nodes = [serializeElementNode(element)];
    } else if (pageResult !== undefined && pageResult !== null) {
      text = clippedText(pageResult);
    }
  }

  return {
    kind: 'page',
    path,
    label: declarativeItemLabel(definition),
    ...(text ? { text } : {}),
    ...(nodes ? { nodes } : {}),
    ...(pageItems ? { pageItems } : {}),
    warnings,
  };
}

async function applyDeclarativePreview(
  plugin: LoadedPlugin,
  tab: PluginSettingTab,
  definition: Record<string, unknown>,
  action: ParsedSettingAction,
): Promise<SerializedDeclarativeSettingPreview | NextResponse> {
  if (!action.confirmAction) {
    return NextResponse.json({ ok: false, error: 'Declarative render/page previews require explicit confirmation.' }, { status: 400 });
  }

  try {
    return await runWithPluginDataRestore(plugin, async () => {
      if (action.action === 'preview-render') {
        return buildDeclarativeRenderPreview(definition, action.path ?? []);
      }
      if (action.action === 'preview-page') {
        return buildDeclarativePagePreview(tab, definition, action.path ?? []);
      }
      throw new Error('Invalid declarative preview action.');
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? `Declarative preview failed; plugin data was restored: ${error.message}` : 'Declarative preview failed; plugin data was restored.',
    }, { status: 400 });
  }
}

async function applyDeclarativeSettingAction(plugin: LoadedPlugin, tab: PluginSettingTab, action: ParsedSettingAction): Promise<void | NextResponse | SerializedDeclarativeSettingPreview> {
  let definitions: SettingDefinitionItem[];
  try {
    definitions = tab.getSettingDefinitions();
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Failed to read declarative settings' }, { status: 400 });
  }
  if (!Array.isArray(definitions)) {
    return NextResponse.json({ ok: false, error: 'Declarative settings tab did not return a definition list' }, { status: 400 });
  }
  const definition = findDeclarativeDefinition(definitions, action.path ?? []);
  if (!isRecord(definition)) {
    return NextResponse.json({ ok: false, error: `Unknown declarative setting path: ${(action.path ?? []).join('.')}` }, { status: 404 });
  }
  if (action.action === 'list-add' || action.action === 'list-delete' || action.action === 'list-reorder') {
    return applyDeclarativeListMutation(plugin, tab, definition, action);
  }
  if (action.action === 'preview-render' || action.action === 'preview-page') {
    return applyDeclarativePreview(plugin, tab, definition, action);
  }
  const control = asSettingControl(definition.control);
  if (control) {
    if (action.action !== 'set-value') {
      return NextResponse.json({ ok: false, error: 'Declarative controls do not support button clicks.' }, { status: 400 });
    }
    const readOnlyReason = editableDeclarativeControlReason(control);
    if (readOnlyReason) {
      return NextResponse.json({ ok: false, error: readOnlyReason }, { status: 400 });
    }
    let value: unknown;
    try {
      value = normalizeDeclarativeControlValue(control, action.value);
      await validateDeclarativeControlValue(control, value);
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Invalid declarative setting value' }, { status: 400 });
    }
    await Promise.resolve(tab.setControlValue(control.key.trim(), value));
    await Promise.resolve(tab.refreshDomState());
    return;
  }

  if (typeof definition.action === 'function') {
    if (action.action !== 'click-button') {
      return NextResponse.json({ ok: false, error: 'Declarative actions do not support value changes.' }, { status: 400 });
    }
    const readOnlyReason = runnableDeclarativeActionReason(definition);
    if (readOnlyReason) {
      return NextResponse.json({ ok: false, error: readOnlyReason }, { status: 400 });
    }
    if (!action.confirmAction) {
      return NextResponse.json({ ok: false, error: 'Declarative actions require explicit confirmation.' }, { status: 400 });
    }
    const actionEl = createObsidianElement('div') as HTMLElement;
    const actionIndex = action.path?.[action.path.length - 1] ?? 0;
    await Promise.resolve(definition.action(actionEl, actionIndex));
    await Promise.resolve(tab.refreshDomState());
    return;
  }

  if (!control) {
    return NextResponse.json({ ok: false, error: 'Declarative setting is not an editable control' }, { status: 400 });
  }
}

async function collectLoadedPluginSettings() {
  const settings = readSettings();
  return withObsidianPluginRuntime(settings.mindRoot, async (manager) => {
    const loadResult = await manager.loadEnabledPlugins();
    const pluginSettings = manager.getLoader().getLoadedPlugins().map(collectPluginSettings);
    return { loadResult, pluginSettings, status: manager.list() };
  });
}

/**
 * GET /api/obsidian-plugins/settings
 * Returns settings for all loaded Obsidian plugins
 */
export async function GET() {
  try {
    const { loadResult, pluginSettings, status } = await collectLoadedPluginSettings();

    return NextResponse.json({
      ok: true,
      loadResult,
      plugins: pluginSettings,
      status,
    });
  } catch (error) {
    console.error('Failed to get plugin settings:', error);
    return NextResponse.json(
      { error: 'Failed to get plugin settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const action = requireSettingAction(await req.json() as SettingActionBody);
    const settings = readSettings();
    return await withObsidianPluginRuntime(settings.mindRoot, async (manager) => {
      const loadResult = await manager.loadEnabledPlugins();
      const loadedPlugins = manager.getLoader().getLoadedPlugins();
      const plugin = loadedPlugins.find((item) => item.manifest.id === action.pluginId);
      if (!plugin) {
        return NextResponse.json({ ok: false, error: `Plugin is not enabled or failed to load: ${action.pluginId}` }, { status: 404 });
      }

      const tab = plugin.instance.settingTabs[action.tabIndex];
      if (!tab) {
        return NextResponse.json({ ok: false, error: `Unknown settings tab: ${action.tabIndex}` }, { status: 404 });
      }

      if (action.source === 'declarative') {
        const actionResult = await applyDeclarativeSettingAction(plugin, tab, action);
        if (actionResult instanceof NextResponse) return actionResult;
        const refreshedSettings = loadedPlugins.map(collectPluginSettings);
        return NextResponse.json({
          ok: true,
          loadResult,
          plugins: refreshedSettings,
          status: manager.list(),
          ...(actionResult ? { preview: actionResult } : {}),
        });
      }

      resetTab(tab);
      tab.display();
      const item = tab.items?.[action.itemIndex as number];
      if (!item) {
        return NextResponse.json({ ok: false, error: `Unknown settings item: ${action.itemIndex}` }, { status: 404 });
      }
      if (item.disabled) {
        return NextResponse.json({ ok: false, error: 'Settings item is disabled' }, { status: 400 });
      }

      if (action.action === 'set-value') {
        if (typeof item.onChange !== 'function') {
          return NextResponse.json({ ok: false, error: 'Settings item does not support value changes' }, { status: 400 });
        }
        await Promise.resolve(item.onChange(action.value));
      } else {
        if (typeof item.onClick !== 'function') {
          return NextResponse.json({ ok: false, error: 'Settings item does not support button clicks' }, { status: 400 });
        }
        await Promise.resolve(item.onClick());
      }

      const refreshedSettings = loadedPlugins.map(collectPluginSettings);
      return NextResponse.json({
        ok: true,
        loadResult,
        plugins: refreshedSettings,
        status: manager.list(),
      });
    });
  } catch (error) {
    console.error('Failed to update plugin settings:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update plugin settings' },
      { status: 400 }
    );
  }
}
