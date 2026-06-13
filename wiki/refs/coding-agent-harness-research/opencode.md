# OpenCode Harness 调研

> Last verified: 2026-06-13
> Source quality: 高。官方 agents docs 可验证 agent config、prompt file、model override、permission ask/allow/deny、built-in/custom agent 等。

## 一句话定位

OpenCode 是本地 terminal/TUI coding agent。它的 harness 亮点是清晰的 agent profile 配置：primary agents、subagents、prompt file、model override、permissions、tools/MCP。

## 用户入口

- OpenCode TUI / CLI。
- 配置通过 global 或 project config。
- Agents 可在 `opencode.json` 中定义，也可用 Markdown agent files。

## Harness 架构

```text
TUI session
  -> selected primary agent
  -> optional subagent invocation
  -> provider/model config
  -> prompt file / instructions
  -> tool permission policy
  -> MCP/tools
  -> file/shell/git actions
```

MiMo Code fork OpenCode 并保留其核心 providers、TUI、LSP、MCP、plugins，说明 OpenCode 是一类成熟的本地 agent harness 基座。

## Agent Loop / 执行模型

OpenCode agents 分为：

- primary agent：用户当前直接交互的 agent。
- subagent：由 primary agent 调用的专项 agent。
- built-in agents 和 hidden system agents。
- custom agents。

Agent 可配置 prompt、model、temperature、permission 等。

## Tools / MCP / Skills / Extensions

OpenCode docs 中 `tools` 字段已 deprecated，推荐用 agent 的 `permission` 字段做更细粒度控制。旧工具配置可针对 write、bash、MCP server wildcard 等启停。

这说明 OpenCode 的工具能力不是“prompt 里说一下”，而是进入 config schema。

## Context / Memory / Workspace

OpenCode 基础 docs 更强调 agent/profile/tool，而非 MiMo 那种深度 memory。它的 workspace 是本地项目 config 和 cwd。

## Permissions / Sandbox / Approvals

OpenCode permission key 可设为：

- `ask`：运行前询问。
- `allow`：无需审批。
- `deny`：禁用。

Agent-specific config 会覆盖 global config。这个模型很适合 MindOS 借鉴：permission 应既能全局默认，也能按 assistant/runtime profile 覆盖。

## Session / Task / PR / Diff 模型

OpenCode 主要是 local session/TUI，不是 cloud PR worker。PR/diff 不是其公开 docs 的中心。

## UI / Observability

TUI 负责显示 agent 工作过程。对于 MindOS 而言，如果只用 CLI stdout 包装 OpenCode，会丢失 agent、permission、toolset 等结构，需要 adapter 尽量读 config 和事件。

## 对 MindOS 的启发

1. Built-in agent + custom agent 可以共存。
2. Markdown prompt file 和 JSON config 组合是可审计的好模式。
3. Permission ask/allow/deny 简洁、可被普通用户理解。
4. Agent-specific config override global config，应成为 MindOS Assistant profile 的设计参考。
5. 不要再用 deprecated `tools` 式布尔开关设计新 schema，应直接用 permission policy。

## 未确认 / 风险

- OpenCode docs HTML 动态页面内容很多；具体路径和字段名需随版本复核。
- 本次未深入 OpenCode session persistence 和 rollback。
- OpenCode 与 MiMo 分叉后能力会继续分化，不应混写。

## Sources

- OpenCode agents docs: https://opencode.ai/docs/agents/
- OpenCode config docs: https://opencode.ai/docs/config/
- OpenCode GitHub: https://github.com/anomalyco/opencode
