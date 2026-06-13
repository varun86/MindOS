# Cursor Harness 调研

> Last verified: 2026-06-13
> Source quality: 高。Cursor 官方 `llms.txt` 和 Cloud Agents markdown 可直接读取，覆盖 Agent、rules、skills、subagents、hooks、MCP、cloud agents、CLI、ACP 等。

## 一句话定位

Cursor 是 IDE-native coding agent，已经从本地编辑器 agent 扩展到 cloud async agents、CLI、ACP、Slack/GitHub/Linear triggers。它的 harness 重心是 **编辑器上下文 + cloud VM environment + PR/artifact handoff**。

## 用户入口

官方 docs index 列出入口：

- Cursor Desktop Agent。
- Cursor Web: `cursor.com/agents`。
- Slack `@cursor`。
- GitHub issue / PR comment `@cursor`。
- Linear。
- API。
- CLI / headless / ACP。

## Harness 架构

本地 IDE Agent：

```text
editor input / file selection
  -> agent mode / rules / skills / MCP
  -> terminal/browser/search/canvas tools
  -> worktree / diff / review UI
```

Cloud Agents：

```text
web/slack/github/linear/api trigger
  -> isolated cloud VM
  -> GitHub/GitLab repo clone
  -> selected environment
  -> branch work
  -> build/test/browser/desktop artifacts
  -> push changes / PR handoff
```

## Agent Loop / 执行模型

Cloud Agents 文档强调：agent 在完整 development environment 中运行，不依赖本地机器在线；可以并行运行多个；能 build/test/interact with changed software；支持 computer control of desktop and browser。

模型方面，Cloud Agents 使用 curated model selection，并且总是在 Max Mode。

## Tools / MCP / Skills / Extensions

Cursor docs index 显示 customization 包括：

- plugins
- rules
- skills
- subagents
- hooks
- MCP

Cloud Agents 明确支持 MCP：

- 团队配置 MCP servers。
- HTTP 和 stdio transports。
- OAuth。

Cloud hooks：

- repo 内 `.cursor/hooks.json`。
- Enterprise team / managed hooks。
- 支持 `beforeShellExecution`、`afterFileEdit`、`preToolUse`、`subagentStart`。
- 不支持本地 user-level `~/.cursor/hooks.json`，因为 cloud VM 不访问本地 home。

## Context / Memory / Workspace

Cursor 的长期上下文分为：

- 本地 IDE workspace context。
- project/user/team rules。
- cloud environment snapshot / Dockerfile / `.cursor/environment.json`。
- multi-repo environment。
- secrets workspace/team scope。

Cloud Agents 的关键前提是 environment setup；没有可运行依赖和 secret，agent 无法验证工作。

## Permissions / Sandbox / Approvals

Cloud Agents 需要 GitHub/GitLab repo read-write 权限；secret 通过 Cursor dashboard 的 Cloud Agents secrets 管理。Enterprise 场景有 managed hooks 和 network/security docs。

这里的权限更偏 cloud workspace 和 repo access，而非本地 shell approval。

## Session / Task / PR / Diff 模型

Cloud Agents：

- clone repo。
- separate branch。
- push changes for handoff。
- 支持 multi-repo。
- 产出 screenshots、videos、logs 等 artifacts。
- 用户可以 remote desktop control 进入 agent 环境测试。

这类 harness 的交付物是 branch/PR/artifact，不是 chat transcript。

## UI / Observability

Cloud dashboard 会显示 agent 使用的 environment、environment details、version history。Agent page 可查看环境。Artifacts 和 remote desktop 让用户观察和接管运行结果。

## 对 MindOS 的启发

1. Cloud agent 能力的核心不是“云端聊天”，而是 environment + repo + secret + artifact + branch。
2. Hooks 应区分 local user hooks、repo hooks、team managed hooks；云端不能读取本地 home。
3. MCP server 在 cloud 场景必须有 team-scoped auth/OAuth。
4. MindOS 若支持异步 agent，应把 environment profile 作为一等对象。
5. Runtime UI 应展示 agent 当前在哪里运行：local IDE、local CLI、cloud VM、remote desktop。

## 未确认 / 风险

- Cursor 产品变化非常快，model 名称和 Max Mode 策略需按 docs 当前版本复核。
- Cloud Agents billing/API 细节不应写死到 MindOS 产品逻辑。
- 本地 Cursor Agent 的完整内部 event schema 未公开到 app-server 层级。

## Sources

- Cursor docs index: https://cursor.com/llms.txt
- Cursor Cloud Agents: https://cursor.com/docs/cloud-agent.md
- Cursor MCP docs: https://cursor.com/docs/mcp.md
- Cursor hooks docs: https://cursor.com/docs/hooks.md
