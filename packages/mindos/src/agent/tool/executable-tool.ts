export type MindosExecutableTool = {
  name: string;
  description?: string;
  parameters?: unknown;
  execute(
    toolCallId: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
    onUpdate?: (update: unknown) => void,
  ): Promise<{
    content: Array<{ type: string; text?: string }>;
  }>;
};
