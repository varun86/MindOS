# Cline Harness 调研

> Last verified: 2026-06-13
> Source quality: 高。官方 `llms.txt`、Plan/Act、Auto Approve、Checkpoints、SDK Hub-Spoke、ClineCore docs 可直接读取。

## 一句话定位

Cline 是 VS Code / CLI / SDK / Kanban 多入口 coding agent。它最值得研究的是 **ClineCore full harness**：built-in tools、sessions、approvals、scheduling、hub support、plugins，以及 editor checkpoint UI。

## 用户入口

官方 docs index 覆盖：

- IDE extension。
- CLI / TUI。
- Kanban。
- SDK。
- ACP editor integrations。
- Connectors：Telegram、Slack、Discord、Google Chat、WhatsApp 等。
- GitHub Actions integration。
- Scheduling。

## Harness 架构

Cline SDK 的 hub-spoke 模型非常清楚：

```text
Client: CLI / VS Code / JetBrains / custom app
  -> WebSocket
Hub: singleton daemon per machine
  -> session coordination / event routing / approvals / schedules
Spoke: worker process running @cline/core
  -> agent loop / tools / stream output
  -> events back to hub
```

`ClineCore` 是 full harness；`Agent` / `AgentRuntime` 是更低层 core loop。

## Agent Loop / 执行模型

Cline 有 Plan & Act 模式：

- Plan mode：可读代码、搜索、讨论策略，但不能改文件或执行命令。
- Act mode：保留 Plan 上下文，可以改文件、跑命令、执行计划。

SDK `Agent` 的核心 loop：

```text
run() / continue()
  -> model request
  -> tool calls
  -> tool results
  -> repeat until complete
```

`ClineCore` 则包上 session、message history、tools、approvals、scheduling、plugins、hub/remote/local backend。

## Tools / MCP / Skills / Extensions

Cline docs index 显示：

- MCP。
- Skills。
- Plugins。
- Hooks。
- Built-in tools：files、shell、search、web fetch 等。
- SDK custom tools。
- multi-agent teams。

`ClineCore` 可配置 built-in tools，也可使用 plugin paths/extensions。

## Context / Memory / Workspace

Cline 有 Memory Bank 文档，用结构化文档帮助跨 session 保持上下文。ClineCore 保存 session manifests 和 messages；Hub 维护 SQLite index + JSON snapshots：

```text
~/.cline/data/sessions/
  sessions.db
  [session-id].json
```

这使 session 可以在窗口关闭后继续，多个 client 可重新 attach。

## Permissions / Sandbox / Approvals

Cline 的 Auto Approve 是 per-tool-call 评估：

- read project files
- read all files
- edit project files
- edit all files
- execute safe commands
- execute all commands
- browser
- MCP servers

YOLO Mode 会自动批准文件、命令、browser、MCP、mode transitions，官方明确警告危险。

SDK 中可用 toolPolicies 或 `requestToolApproval` callback 动态决定。

## Session / Task / PR / Diff 模型

Checkpoints 是 Cline 非常强的安全网：

- 每次文件修改或命令运行后保存 snapshot。
- 使用 shadow Git repository，不污染用户 Git history。
- 可 Compare 和 Restore。
- Restore Files、Restore Task Only、Restore Files & Task 三种恢复。
- Checkpoints persist across editor sessions。

Kanban / GitHub Actions / scheduling 则把 agent 扩展到多任务和自动化。

## UI / Observability

Cline 的 UI/observability 来自：

- editor diff viewer。
- checkpoint indicator。
- hub event fan-out。
- session events。
- accumulated token/cost usage。
- OpenTelemetry / enterprise monitoring。

## 对 MindOS 的启发

1. Hub/Spoke 是本地多端 agent harness 的优秀架构：client 参与，spoke 执行，hub 协调。
2. Checkpoint 应独立于用户 Git history，避免污染 repo。
3. Permission UI 要和 tool policy 绑定，不要只有一个“自动模式”开关。
4. Plan/Act mode 用权限边界解释用户心智，很适合 MindOS runtime mode。
5. Session persistence 应保存 tool call records 和 metadata，而不是只保存 messages。

## 未确认 / 风险

- Cline 产品面很大，IDE、CLI、SDK、Kanban、Enterprise 不是所有能力都在同一个部署形态可用。
- YOLO mode 不能作为 MindOS 默认能力，应只作为明确高风险配置。
- Cline SDK 文档和实际 npm package 版本需在实现时逐版本检测。

## Sources

- Cline docs index: https://docs.cline.bot/llms.txt
- Plan & Act Mode: https://docs.cline.bot/core-workflows/plan-and-act.md
- Auto Approve & YOLO Mode: https://docs.cline.bot/features/auto-approve.md
- Checkpoints: https://docs.cline.bot/core-workflows/checkpoints.md
- Hub-Spoke Architecture: https://docs.cline.bot/sdk/architecture/hub-spoke.md
- ClineCore: https://docs.cline.bot/sdk/clinecore.md
