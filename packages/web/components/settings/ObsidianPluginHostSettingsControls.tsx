'use client';

import { useEffect, useState } from 'react';
import { Eye, Loader2, Play, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Input, Select, Toggle } from './Primitives';
import type {
  ObsidianDeclarativeSettingItem,
  ObsidianDeclarativeSettingPreview,
  ObsidianSettingItem,
  SettingAction,
} from './ObsidianPluginHostModel';

export interface DeclarativeActionTarget {
  pluginId: string;
  pluginName: string;
  tabIndex: number;
  path: number[];
  label: string;
  desc?: string;
}

export interface DeclarativeListMutationTarget {
  pluginId: string;
  pluginName: string;
  tabIndex: number;
  path: number[];
  action: Extract<SettingAction, 'list-add' | 'list-delete' | 'list-reorder'>;
  label: string;
  listItemIndex?: number;
  newIndex?: number;
}

export interface DeclarativePreviewTarget {
  pluginId: string;
  pluginName: string;
  tabIndex: number;
  path: number[];
  action: Extract<SettingAction, 'preview-render' | 'preview-page'>;
  label: string;
}

export function settingValueAsString(value: unknown): string {
  return value == null ? '' : String(value);
}

export function SettingControl({
  item,
  busy,
  onAction,
}: {
  item: ObsidianSettingItem;
  busy: boolean;
  onAction: (action: SettingAction, value?: unknown) => void;
}) {
  const [draft, setDraft] = useState(settingValueAsString(item.value));

  useEffect(() => {
    setDraft(settingValueAsString(item.value));
  }, [item.value]);

  if (item.kind === 'toggle') {
    return (
      <Toggle
        size="sm"
        checked={item.value === true}
        disabled={!item.canChange || item.disabled || busy}
        title={item.value === true ? 'Disable setting' : 'Enable setting'}
        onChange={(next) => onAction('set-value', next)}
      />
    );
  }

  if (item.kind === 'dropdown') {
    return (
      <Select
        size="sm"
        value={settingValueAsString(item.value)}
        disabled={!item.canChange || item.disabled || busy}
        onChange={(event) => onAction('set-value', event.target.value)}
        className="min-w-32"
      >
        {(item.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    );
  }

  if (item.kind === 'button') {
    return (
      <button
        type="button"
        disabled={!item.canClick || item.disabled || busy}
        onClick={() => onAction('click-button')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          item.cta
            ? 'bg-[var(--amber)] text-[var(--amber-foreground)]'
            : 'border border-border bg-background text-foreground hover:bg-muted/60'
        }`}
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
        {item.buttonText ?? 'Run'}
      </button>
    );
  }

  return (
    <form
      className="flex min-w-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onAction('set-value', draft);
      }}
    >
      <Input
        value={draft}
        disabled={!item.canChange || item.disabled || busy}
        placeholder={item.placeholder}
        onChange={(event) => setDraft(event.target.value)}
        className="h-8 min-w-32 py-1.5 text-xs"
      />
      <button
        type="submit"
        disabled={!item.canChange || item.disabled || busy || draft === settingValueAsString(item.value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
        Apply
      </button>
    </form>
  );
}

export function declarativePreviewKey(pluginId: string, tabIndex: number, path: number[]): string {
  return `${pluginId}:${tabIndex}:${path.join('.')}`;
}

export function hasInteractiveDeclarativeItems(items: ObsidianDeclarativeSettingItem[]): boolean {
  return items.some((item) => (
    item.capabilities.canChange
    || item.capabilities.canRunAction
    || item.capabilities.canAddListItem
    || item.capabilities.canDeleteListItem
    || item.capabilities.canReorderListItems
    || item.capabilities.canPreviewRender
    || item.capabilities.canPreviewPage
    || hasInteractiveDeclarativeItems(item.children ?? [])
  ));
}

function declarativeValueAsText(value: unknown): string {
  if (value == null) return 'unset';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  return 'complex value';
}

function declarativeItemLabel(item: ObsidianDeclarativeSettingItem): string {
  return item.name ?? item.heading ?? item.control?.key ?? item.type ?? item.kind;
}

function listChildCount(item: ObsidianDeclarativeSettingItem): number {
  return item.children?.length ?? item.childCount ?? 0;
}

function DeclarativePreviewNodeSummary({ node }: { node: NonNullable<ObsidianDeclarativeSettingPreview['nodes']>[number] }) {
  return (
    <li className="truncate">
      <span className="font-mono text-muted-foreground">&lt;{node.tag}&gt;</span>
      {node.text && <span> {node.text}</span>}
      {node.children && node.children.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-3">
          {node.children.slice(0, 4).map((child, index) => (
            <DeclarativePreviewNodeSummary key={`${child.tag}:${index}`} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function DeclarativePreviewCard({ preview }: { preview: ObsidianDeclarativeSettingPreview }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-2xs text-muted-foreground">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-foreground">Snapshot preview</span>
        <span className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono">{preview.kind}</span>
        {preview.cleanupCalled && (
          <span className="rounded border border-success/30 bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-1.5 py-0.5 text-success">
            cleanup called
          </span>
        )}
      </div>
      {preview.text && <p className="mb-1 text-foreground">{preview.text}</p>}
      {preview.pageItems && preview.pageItems.length > 0 && (
        <div className="mb-1">
          <span className="font-medium text-foreground">Page items:</span>
          <span className="ml-1">{preview.pageItems.map(declarativeItemLabel).join(', ')}</span>
        </div>
      )}
      {preview.nodes && preview.nodes.length > 0 && (
        <ul className="space-y-0.5">
          {preview.nodes.slice(0, 4).map((node, index) => (
            <DeclarativePreviewNodeSummary key={`${node.tag}:${index}`} node={node} />
          ))}
        </ul>
      )}
      {preview.warnings.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
    </div>
  );
}

function DeclarativeSettingControl({
  item,
  busy,
  onChange,
}: {
  item: ObsidianDeclarativeSettingItem;
  busy: boolean;
  onChange: (value: unknown) => void;
}) {
  const control = item.control;
  const valueText = settingValueAsString(item.value ?? control?.defaultValue);
  const [draft, setDraft] = useState(valueText);

  useEffect(() => {
    setDraft(settingValueAsString(item.value ?? control?.defaultValue));
  }, [control?.defaultValue, item.value]);

  if (!control || !item.capabilities.canChange) return null;

  if (control.type === 'toggle') {
    return (
      <Toggle
        size="sm"
        checked={item.value === true}
        disabled={busy}
        title={item.value === true ? 'Disable setting' : 'Enable setting'}
        onChange={onChange}
      />
    );
  }

  if (control.type === 'dropdown') {
    return (
      <Select
        size="sm"
        value={settingValueAsString(item.value ?? control.defaultValue)}
        disabled={busy}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-32"
      >
        {(control.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
    );
  }

  const numeric = control.type === 'number' || control.type === 'slider';
  const multiline = control.type === 'textarea';

  return (
    <form
      className="flex min-w-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onChange(numeric ? Number(draft) : draft);
      }}
    >
      {multiline ? (
        <textarea
          value={draft}
          disabled={busy}
          rows={Math.max(2, Math.min(control.rows ?? 2, 6))}
          placeholder={control.placeholder}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-16 min-w-40 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
      ) : (
        <Input
          type={numeric ? 'number' : 'text'}
          value={draft}
          disabled={busy}
          min={control.min}
          max={control.max}
          step={control.step}
          placeholder={control.placeholder}
          onChange={(event) => setDraft(event.target.value)}
          className="h-8 min-w-32 py-1.5 text-xs"
        />
      )}
      <button
        type="submit"
        disabled={busy || draft === valueText}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
        Apply
      </button>
    </form>
  );
}

export function DeclarativeSettingsCatalog({
  items,
  pluginId,
  pluginName,
  tabIndex,
  settingsBusyKey,
  previews,
  onChange,
  onRunAction,
  onRunListMutation,
  onPreview,
  level = 0,
}: {
  items: ObsidianDeclarativeSettingItem[];
  pluginId: string;
  pluginName: string;
  tabIndex: number;
  settingsBusyKey: string | null;
  previews: Record<string, ObsidianDeclarativeSettingPreview>;
  onChange: (pluginId: string, tabIndex: number, path: number[], value: unknown) => void;
  onRunAction: (target: DeclarativeActionTarget) => void;
  onRunListMutation: (target: DeclarativeListMutationTarget) => void;
  onPreview: (target: DeclarativePreviewTarget) => void;
  level?: number;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.path.join('.')}
          className="space-y-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2"
          style={{ marginLeft: level > 0 ? Math.min(level, 3) * 10 : 0 }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{declarativeItemLabel(item)}</p>
              {item.desc && <p className="mt-0.5 text-2xs text-muted-foreground">{item.desc}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              <span className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground">
                {item.kind}
              </span>
              {item.control && (
                <span className="rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground">
                  {item.control.type}
                </span>
              )}
              {item.status === 'warning' && (
                <span className="rounded border border-[var(--amber)]/30 bg-[var(--amber)]/10 px-1.5 py-0.5 text-2xs text-[var(--amber)]">
                  warning
                </span>
              )}
            </div>
          </div>

          {item.control && item.capabilities.canChange && (
            <div className="flex justify-end">
              <DeclarativeSettingControl
                item={item}
                busy={settingsBusyKey === `settings:${pluginId}:${tabIndex}:declarative:${item.path.join('.')}`}
                onChange={(value) => onChange(pluginId, tabIndex, item.path, value)}
              />
            </div>
          )}

          {item.kind === 'action' && item.capabilities.canRunAction && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={settingsBusyKey !== null}
                onClick={() => onRunAction({
                  pluginId,
                  pluginName,
                  tabIndex,
                  path: item.path,
                  label: declarativeItemLabel(item),
                  desc: item.desc,
                })}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {settingsBusyKey === `settings:${pluginId}:${tabIndex}:declarative-action:${item.path.join('.')}`
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Play size={11} />}
                Run
              </button>
            </div>
          )}

          {((item.kind === 'render' && item.capabilities.canPreviewRender) || (item.kind === 'page' && item.capabilities.canPreviewPage)) && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={settingsBusyKey !== null}
                onClick={() => onPreview({
                  pluginId,
                  pluginName,
                  tabIndex,
                  path: item.path,
                  action: item.kind === 'render' ? 'preview-render' : 'preview-page',
                  label: declarativeItemLabel(item),
                })}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {settingsBusyKey === `settings:${pluginId}:${tabIndex}:declarative-preview:${item.path.join('.')}`
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Eye size={11} />}
                Preview
              </button>
            </div>
          )}

          {item.kind === 'list' && item.capabilities.hasListMutation && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {item.capabilities.canAddListItem && (
                <button
                  type="button"
                  disabled={settingsBusyKey !== null}
                  onClick={() => onRunListMutation({
                    pluginId,
                    pluginName,
                    tabIndex,
                    path: item.path,
                    action: 'list-add',
                    label: declarativeItemLabel(item),
                  })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {settingsBusyKey === `settings:${pluginId}:${tabIndex}:declarative-list:list-add:${item.path.join('.')}`
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Play size={11} />}
                  Add
                </button>
              )}
              {item.capabilities.canReorderListItems && listChildCount(item) > 1 && (
                <button
                  type="button"
                  disabled={settingsBusyKey !== null}
                  onClick={() => onRunListMutation({
                    pluginId,
                    pluginName,
                    tabIndex,
                    path: item.path,
                    action: 'list-reorder',
                    label: declarativeItemLabel(item),
                    listItemIndex: 0,
                    newIndex: 1,
                  })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {settingsBusyKey === `settings:${pluginId}:${tabIndex}:declarative-list:list-reorder:${item.path.join('.')}:0:1`
                    ? <Loader2 size={11} className="animate-spin" />
                    : <RefreshCw size={11} />}
                  Move first down
                </button>
              )}
              {item.capabilities.canDeleteListItem && listChildCount(item) > 0 && (
                <button
                  type="button"
                  disabled={settingsBusyKey !== null}
                  onClick={() => onRunListMutation({
                    pluginId,
                    pluginName,
                    tabIndex,
                    path: item.path,
                    action: 'list-delete',
                    label: declarativeItemLabel(item),
                    listItemIndex: listChildCount(item) - 1,
                  })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:border-error/40 hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {settingsBusyKey === `settings:${pluginId}:${tabIndex}:declarative-list:list-delete:${item.path.join('.')}:${listChildCount(item) - 1}`
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Trash2 size={11} />}
                  Delete last
                </button>
              )}
            </div>
          )}

          {(item.control || item.displayValue || item.visibleState !== 'visible' || item.searchableState !== 'searchable') && (
            <div className="flex flex-wrap gap-1.5 text-2xs text-muted-foreground">
              {item.control?.key && <span>key: {item.control.key}</span>}
              {item.control && <span>value: {declarativeValueAsText(item.value)}</span>}
              {item.displayValue && <span>display: {item.displayValue}</span>}
              {item.visibleState !== 'visible' && <span>visible: {item.visibleState}</span>}
              {item.searchableState !== 'searchable' && <span>search: {item.searchableState}</span>}
              {item.control?.disabledState !== 'enabled' && <span>disabled: {item.control?.disabledState}</span>}
              {item.control?.hasValidate && <span>validate</span>}
              {item.control?.hasFilter && <span>filter</span>}
            </div>
          )}

          {previews[declarativePreviewKey(pluginId, tabIndex, item.path)] && (
            <DeclarativePreviewCard preview={previews[declarativePreviewKey(pluginId, tabIndex, item.path)]} />
          )}

          {item.warnings.length > 0 && (
            <div className="space-y-1">
              {item.warnings.map((warning) => (
                <p key={warning} className="text-2xs text-muted-foreground">{warning}</p>
              ))}
            </div>
          )}

          {item.children && item.children.length > 0 && (
            <DeclarativeSettingsCatalog
              items={item.children}
              pluginId={pluginId}
              pluginName={pluginName}
              tabIndex={tabIndex}
              settingsBusyKey={settingsBusyKey}
              previews={previews}
              onChange={onChange}
              onRunAction={onRunAction}
              onRunListMutation={onRunListMutation}
              onPreview={onPreview}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}
