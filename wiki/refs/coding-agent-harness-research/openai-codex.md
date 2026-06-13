# OpenAI Codex Harness 调研

> Last verified: 2026-06-13
> Source quality: 高。官方 Codex repo 和 `codex-rs/app-server/README.md` 明确给出 protocol、thread/turn/item、events、approvals、skills、MCP、plugins。

## 一句话定位

Codex 不是单一 CLI。它同时有本地 CLI、本地 app、IDE extension、Codex Web；对 MindOS 最关键的是 **Codex app-server**，它是面向 rich client 的 JSON-RPC agent harness protocol。

## 用户入口

- `codex` CLI：本地 terminal agent。
- IDE extension：VS Code、Cursor、Windsurf 等编辑器入口。
- `codex app`：desktop app experience。
- Codex Web：cloud-based agent at ChatGPT。
- app-server：`codex app-server` 给富客户端接入。

## Harness 架构

Codex app-server 使用 JSON-RPC 2.0 风格双向消息，wire 上省略 `"jsonrpc":"2.0"`。支持 transport：

- stdio：默认 JSONL。
- websocket：experimental / unsupported。
- unix socket：local control-plane client。
- off。

核心不是 text stream，而是：

```text
Thread: conversation
  -> Turn: one user request and agent work
    -> Item: user message / reasoning / agent message / command / file edit / tool call
```

这使得 client 可以渲染完整运行过程，而不是只拼接 assistant 文本。

## Agent Loop / 执行模型

官方 lifecycle：

1. `initialize` / `initialized`。
2. `thread/start`、`thread/resume` 或 `thread/fork`。
3. `turn/start` 发送用户输入，可覆盖 model、cwd、sandbox policy、permissions profile、approval policy 等。
4. 服务端发送 `turn/started`、`item/started`、`item/*/delta`、tool progress 等 notifications。
5. `turn/completed` 返回 final turn state 和 token usage。
6. 支持 `turn/steer` 对 in-flight turn 加输入，`turn/interrupt` 中断。

## Tools / MCP / Skills / Extensions

app-server API 包含：

- `skills/list`
- `skills/extraRoots/set`
- `mcpServerStatus/list`
- `mcpServer/resource/read`
- `mcpServer/tool/call`
- `config/mcpServer/reload`
- plugin marketplace APIs：`plugin/list`、`plugin/read`、`plugin/install` 等。
- hooks discovery：`hooks/list`。

这说明 Codex harness 已把 skills、MCP、hooks、plugins 作为 runtime control-plane 对象，而不是散落在 prompt 里。

## Context / Memory / Workspace

Codex app-server 的 thread/start 和 turn/start 接受 cwd、runtime workspace roots、permissions、selected capability roots 等字段。thread 也有 memory mode：

- `thread/memoryMode/set`
- `memory/reset`

这表明 workspace roots、permission profile 和 memory eligibility 都是 thread/runtime state。

## Permissions / Sandbox / Approvals

app-server 支持：

- sandbox / sandboxPolicy。
- experimental permissions profile selection。
- `permissionProfile/list`。
- approval policy、approvals reviewer。
- server-initiated approvals。

对 client 来说，正确做法是：接收 runtime 发来的 approval request，渲染 inline approval，再把 decision 回写给 app-server。不要绕过 Codex 的原生权限系统。

## Session / Task / PR / Diff 模型

Thread API 很完整：

- `thread/start`
- `thread/resume`
- `thread/fork`
- `thread/list`
- `thread/read`
- `thread/archive`
- `thread/unarchive`
- `thread/delete`
- `thread/rollback`
- `thread/name/set`
- `thread/compact/start`

此外支持 file system APIs、command exec、process spawn、review/start、background terminals。对 MindOS 这类 client，Codex thread id 应是 external native session identity。

## UI / Observability

app-server 的价值就是 rich event stream：

- `item/started`
- `item/completed`
- `item/agentMessage/delta`
- command output deltas
- file edit items
- tool progress
- `turn/completed`
- `thread/status/changed`
- token usage

这使得 UI 可以显示运行状态、命令输出、文件变化、错误、审批，而不是“长时间转圈”。

## 对 MindOS 的启发

1. Codex 应优先通过 app-server 接入，不应退化为 CLI stdout 包装。
2. MindOS Chat Panel 需要 Thread/Turn/Item renderer。
3. Codex 的 model/account/status 应由 Codex runtime owner 提供，不应使用 MindOS provider picker。
4. app-server 的 permission request 是双向 JSON-RPC request，MindOS 可以作为 approval UI client。
5. `thread/fork/archive/rollback/compact` 是未来 external session browser 的关键能力。

## 未确认 / 风险

- websocket transport 官方标为 experimental / unsupported，生产接入应优先 stdio 或 unix socket proxy。
- plugin APIs 有些标记 under development，不应在生产 UI 里过早依赖。
- Codex Web 和 local app-server 的能力不是完全同一产品面，文档中需要区分。

## Sources

- Codex README: https://github.com/openai/codex
- Codex app-server README: https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md
- Codex docs: https://developers.openai.com/codex
