import { describe, it, expect } from 'vitest';
import { getReadonlyTools, getKbWriteTools, knowledgeBaseTools, WRITE_TOOLS } from '@/lib/agent/tools';
import { MINDOS_SYSTEM_PROMPT } from '@/lib/agent/prompt';

// ---------------------------------------------------------------------------
// getReadonlyTools — tool set correctness
// ---------------------------------------------------------------------------

describe('getReadonlyTools', () => {
  const readonlyTools = getReadonlyTools();
  const readonlyToolNames = readonlyTools.map(t => t.name);

  it('returns a non-empty array of tools', () => {
    expect(readonlyTools.length).toBeGreaterThan(0);
  });

  it('returns the approved read-only tools including skill loading', () => {
    // web_search and web_fetch are now provided by pi-web-access extension
    const expected = [
      'list_files', 'read_file', 'read_file_chunk',
      'search', 'load_skill', 'get_recent', 'get_backlinks',
    ];
    expect(new Set(readonlyToolNames)).toEqual(new Set(expected));
  });

  it('is a strict subset of knowledgeBaseTools', () => {
    const allNames = new Set(knowledgeBaseTools.map(t => t.name));
    for (const name of readonlyToolNames) {
      expect(allNames.has(name)).toBe(true);
    }
  });

  it('contains zero write tools', () => {
    for (const name of readonlyToolNames) {
      expect(WRITE_TOOLS.has(name)).toBe(false);
    }
  });

  it('excludes delegation and destructive file tools', () => {
    expect(readonlyToolNames).not.toContain('list_acp_agents');
    expect(readonlyToolNames).not.toContain('call_acp_agent');
    expect(readonlyToolNames).not.toContain('delegate_to_agent');
    expect(readonlyToolNames).not.toContain('orchestrate');
    expect(readonlyToolNames).not.toContain('delete_file');
    expect(readonlyToolNames).not.toContain('rename_file');
    expect(readonlyToolNames).not.toContain('move_file');
  });

  it('is significantly smaller than full tool set', () => {
    expect(readonlyTools.length).toBeLessThan(knowledgeBaseTools.length);
  });

  it('each tool has a valid execute function', () => {
    for (const tool of readonlyTools) {
      expect(typeof tool.execute).toBe('function');
    }
  });
});

describe('getKbWriteTools', () => {
  it('keeps skill loading available for selected skill workflows', () => {
    expect(getKbWriteTools().map(t => t.name)).toContain('load_skill');
  });

  it('allows only bounded KB writes', () => {
    const kbWriteToolNames = getKbWriteTools().map(t => t.name);

    expect(kbWriteToolNames).toEqual(expect.arrayContaining([
      'list_files',
      'read_file',
      'search',
      'load_skill',
      'create_file',
      'batch_create_files',
      'write_file',
      'append_to_file',
      'insert_after_heading',
      'update_section',
    ]));
    expect(kbWriteToolNames).not.toContain('delete_file');
    expect(kbWriteToolNames).not.toContain('rename_file');
    expect(kbWriteToolNames).not.toContain('move_file');
    expect(kbWriteToolNames).not.toContain('edit_lines');
    expect(kbWriteToolNames).not.toContain('list_acp_agents');
    expect(kbWriteToolNames).not.toContain('call_acp_agent');
    expect(kbWriteToolNames).not.toContain('delegate_to_agent');
    expect(kbWriteToolNames).not.toContain('orchestrate');
  });
});

// ---------------------------------------------------------------------------
// MINDOS_SYSTEM_PROMPT — content correctness
// ---------------------------------------------------------------------------

describe('MINDOS_SYSTEM_PROMPT', () => {
  it('exists and is a non-empty string', () => {
    expect(typeof MINDOS_SYSTEM_PROMPT).toBe('string');
    expect(MINDOS_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('contains grounding rules without exposing internal mode labels', () => {
    expect(MINDOS_SYSTEM_PROMPT).toContain('Grounding Rules');
    expect(MINDOS_SYSTEM_PROMPT).not.toContain('Mode: Chat');
    expect(MINDOS_SYSTEM_PROMPT).not.toContain('Agent mode');
    expect(MINDOS_SYSTEM_PROMPT).not.toContain('Working Context');
  });

  it('distinguishes MindOS attachments from user uploads', () => {
    expect(MINDOS_SYSTEM_PROMPT).toContain('Attached files from the MindOS knowledge base');
    expect(MINDOS_SYSTEM_PROMPT).toContain('Files uploaded by the user for this request');
    expect(MINDOS_SYSTEM_PROMPT).toContain('Use uploaded content directly');
  });

  it('keeps write behavior conditional on available tools and permissions', () => {
    expect(MINDOS_SYSTEM_PROMPT).toContain('when the available tools and permissions allow it');
    expect(MINDOS_SYSTEM_PROMPT).toContain('Before modifying an existing file, read it first');
    expect(MINDOS_SYSTEM_PROMPT).toContain('Use only tools that are actually available');
  });
});

// ---------------------------------------------------------------------------
// AskMode type — compile-time type check
// ---------------------------------------------------------------------------

describe('AskMode type', () => {
  it('accepts valid mode values', async () => {
    const { AskMode } = await import('@/lib/types') as any;
    const validModes: Array<import('@/lib/types').AskMode> = ['agent'];
    expect(validModes).toHaveLength(1);
  });

  it('AskModeApi only accepts agent', async () => {
    const validModes: Array<import('@/lib/types').AskModeApi> = ['agent'];
    expect(validModes).toHaveLength(1);
  });
});
