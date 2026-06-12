# MindOS Assistant / Runtime / Mode 架构快照

日期：2026-06-12

本文记录当前实现形态，不是未来方案 spec。目的只有一个：把 Assistant、Runtime、Ask mode、权限策略和 session 绑定边界讲清楚，方便后续继续做产品和架构迭代。

## 简短结论

MindOS 现在有三个容易混淆、但必须分开的产品概念：

```text
Assistant = 这次要使用什么任务画像、prompt、默认上下文
Runtime   = 这次由谁执行
Ask mode  = 用户希望 Chat Panel 里的这轮对话按什么行为边界运行
```

当前契约是：

```text
Ask/API mode:                 chat | agent
MindOS internal mode:          chat | agent
External harness permission:   readonly | agent
Product run ledger mode:       chat | agent
```

`organize` 不是 mode、profile、API 字段、capability permission，也不是 runtime permission。Organizer 这类整理流程只属于 Assistant 行为：它运行时使用 `mode=agent`，并在 assistant/controller 层追加整理专用 prompt、选中文件和默认动作。

`readonly` 也不是产品侧 Ask mode。它只保留在 ACP/native runtime harness permission 层，因为外部 runtime 自身暴露的是这套安全边界。

## 概念边界

### Assistant

Assistant 是保存下来的任务画像和 prompt，通常位于：

```text
.mindos/assistants/<assistantId>/profile.json
.mindos/assistants/<assistantId>/prompt.md
```

相关源码：

```text
packages/mindos/src/server/handlers/assistants.ts
packages/web/lib/mind-system-assistants.ts
packages/web/lib/inbox-assistant.ts
packages/web/lib/mind-system-assistant-actions.ts
```

Assistant profile 支持类似这样的元数据：

```json
{
  "name": "Inbox Organizer",
  "description": "Review staged Inbox material...",
  "schemaVersion": 1,
  "preferredAgent": "mindos-agent",
  "skills": [],
  "mcp": []
}
```

当前行为：

- `/api/assistants` 负责列出、创建、删除和 health check Assistant profile。
- 内置 Assistant 受保护，不能被普通文件删除操作破坏。
- 大多数 Assistant 仍是 prompt template：运行时会打开 Ask UI，并填入生成好的 prompt。
- Inbox Organizer 集成得更深：它会调用 `/api/ask`，使用 `mode=agent`，并通过 prompt、文件列表和 controller state 传入整理上下文。

当前限制：

- 还没有统一的 `runAssistant(assistantId)` resolver。
- `preferredAgent`、`skills`、`mcp` 已经作为 Assistant metadata 存在，但普通 Assistant run 还不会自动把它们转成 runtime selection、skill loading 或 MCP allowlist。

### Runtime

Runtime 是 Chat Panel 某一轮对话的执行者。

当前 runtime 种类：

```text
mindos = 内置 MindOS Pi coding-agent runtime
codex  = 本地 Codex native runtime
claude = 本地 Claude Code native runtime
acp    = 已安装的 ACP agent runtime
a2a    = 远端 A2A agent surface，目前主要用于 capability / delegation
```

主要源码：

```text
packages/web/components/ask/RuntimeIconSwitcher.tsx
packages/web/components/ask/AskContent.tsx
packages/web/hooks/useAskChat.ts
packages/web/app/api/ask/route.ts
packages/web/app/api/agent-runtimes/route.ts
packages/web/lib/agent/capability-registry.ts
packages/mindos/src/server/handlers/agent-runtimes.ts
packages/mindos/src/agent-runtime/run.ts
```

Runtime 在 Chat Panel header 中选择。如果没有选择外部 runtime，这轮对话会使用内置 MindOS runtime。

### Ask Mode

Ask mode 是面向用户和 API 的 Chat Panel 模式。

源码事实来源：

```text
packages/web/lib/types.ts
packages/mindos/src/session/index.ts
packages/web/components/ask/ModeCapsule.tsx
packages/web/app/api/ask/route.ts
packages/mindos/src/server/handlers/ask.ts
```

当前公开值：

```ts
type AskMode = 'chat' | 'agent';
type AskModeApi = AskMode;
type MindosAskMode = 'chat' | 'agent';
```

语义：

```text
chat  = 对话 / 阅读 / 检索为主
agent = 任务执行，可使用完整 MindOS tools 和 extension scope
```

关键规则：

```text
/api/ask rejects mode=organize
/api/ask rejects toolProfile
MindOS runtime code does not export MindosAskProfile
```

### Permission Policy

Permission policy 是从 Ask mode 映射到产品权限、外部 harness 权限、KB tool scope 和 extension scope 的中心规则。

源码：

```text
packages/web/lib/agent/permission-policy.ts
```

当前矩阵：

```text
mode=chat
  product permissionMode=chat
  native runtime permission=readonly
  ACP permission=readonly
  KB tools=read/search/load_skill only
  write tools=not available
  extensions=safe read/question/web scopes

mode=agent
  product permissionMode=agent
  native runtime permission=agent
  ACP permission=agent
  KB tools=full MindOS KB tool set
  write tools=available with existing file protections
  extensions=user extensions, MCP adapter, IM, subagents, schedule prompt
```

兼容说明：

- `createMindosAgentPermissionPolicyFromContext()` 仍可能把历史 context 字符串，例如 `readonly`，归一成 `chat`。
- run ledger 在读取历史记录时，仍可能把旧落盘数据里的 `"organize"` 归一成 `agent`。这是为了兼容旧本地数据，不是当前 API 契约。

### Capability Registry

Capability 只使用产品侧 mode：

```ts
permissionRequired: 'chat' | 'agent';
```

源码：

```text
packages/mindos/src/server/handlers/agent-capabilities.ts
packages/web/lib/agent/capability-registry.ts
```

映射：

```text
chat capability
  chat 和 agent turn 都可用
  不隐含写权限

agent capability
  只在 agent turn 可用
  可能执行写入、delegation、subprocess 或外部 runtime action
```

## 主要数据流

普通 Chat Panel turn：

```text
AskContent / useAskChat
  -> POST /api/ask { mode: 'chat' | 'agent', runtime?: ... }
  -> packages/web/app/api/ask/route.ts
  -> createMindosAgentPermissionPolicy(mode)
  -> runtime selection
     - mindos: createMindosPiCodingAgentRuntime({ mode })
     - codex/claude: native runtime，harness permission 由 mode 派生
     - acp: ACP session，harness permission 由 mode 派生
  -> Agent run ledger 记录 permissionMode chat|agent
  -> SSE events 回流到 Chat Panel
```

Inbox Organizer flow：

```text
Inbox UI / useInboxOrganizeController
  -> selected readable Inbox files
  -> organizer prompt/context
  -> POST /api/ask { mode: 'agent' }
  -> MindOS runtime 获得完整 agent tool policy
  -> 整理行为来自 prompt/controller input，而不是独立 mode/profile
  -> 成功写入后清理已处理的 Inbox items
```

MindOS Pi runtime setup：

```text
createMindosPiCodingAgentRuntime({ mode })
  -> services.setKbMode(mode)
  -> requestTools = getMindosWebRequestTools(mode)
  -> getMindosWebPiRuntimePaths({ mode })
  -> chat mode 加载安全的 read/question/web extensions
  -> agent mode 加载完整 extension scopes，包括 subagents 和 MCP adapter
```

外部 runtime setup：

```text
mode=chat
  -> harness permission readonly

mode=agent
  -> harness permission agent
```

Codex 和 Claude Code 仍然可以执行自己的 runtime approval prompt。只要 native runtime 暴露这些 permission request，MindOS UI 就可以渲染它们；但 MindOS 自己的 mode 选择仍然只有 `chat | agent`。

## 已移除概念

以下概念已经从当前架构中移除：

```text
mode=organize
toolProfile
promptProfile
MindosAskProfile
AskToolProfile
permissionProfile=organize
permissionRequired=organize
```

不要把它们作为 alias 重新引入。如果某个流程需要 Organizer 行为，应放在 assistant/action 层：

```ts
await ask({
  mode: 'agent',
  messages: [
    { role: 'user', content: buildOrganizerPrompt(selectedFiles) },
  ],
});
```

## API 示例

阅读 / 检索为主的 chat：

```json
{
  "messages": [{ "role": "user", "content": "Summarize my notes about ACP." }],
  "mode": "chat"
}
```

任务执行：

```json
{
  "messages": [{ "role": "user", "content": "Organize these Inbox files into the right folders." }],
  "mode": "agent"
}
```

非法：

```json
{
  "mode": "organize"
}
```

非法：

```json
{
  "mode": "agent",
  "toolProfile": "organize"
}
```

## 验收清单

- `rg "MindosAskProfile|AskToolProfile|toolProfile|promptProfile"` 不应在当前源码 API/type 中命中。
- `rg "mode=organize|mode: 'organize'"` 不应在当前源码 API 中命中。
- `/api/ask` 只接受 `mode=chat` 和 `mode=agent`。
- Inbox Organizer 发送 `mode=agent`，不发送 `toolProfile`。
- Capability permission 只允许 `chat | agent`。
- Run ledger 可以读取 legacy `organize` 记录，但不能产生新的 `organize` 记录。
