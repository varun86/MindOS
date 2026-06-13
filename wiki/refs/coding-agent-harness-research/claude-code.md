# Claude Code Harness 调研

> Last verified: 2026-06-13
> Source quality: 高。官方 Claude Code docs / Agent SDK docs 覆盖 SDK、permissions、sessions、subagents、MCP、hooks、checkpointing 等主题。

## 一句话定位

Claude Code 是 Anthropic 的本地 coding agent runtime；Agent SDK 把 Claude Code 的工具、agent loop、context management、permissions 和 session 能力开放为可嵌入库。

## 用户入口

- Claude Code CLI。
- IDE integrations。
- Claude Agent SDK：TypeScript / Python。
- Subagents、slash commands、skills、hooks、MCP 等可扩展入口。

## Harness 架构

Claude Code 的关键不是“Claude 模型调用”，而是本地 runtime：

```text
CLI / IDE / SDK client
  -> Claude Code runtime
  -> session / transcript / context manager
  -> built-in tools: read, write, shell, etc.
  -> MCP / skills / hooks / subagents
  -> permission mode / rules / canUseTool
  -> stream events / tool results / session history
```

SDK docs 明确定位：使用 Claude Code 作为 library 构建 production AI agents，复用 Claude Code 的 tools、agent loop 和 context management。

## Agent Loop / 执行模型

Claude Agent SDK 暴露可编程运行面，而不是只执行一条 CLI 命令。关键能力包括：

- streaming query / async generator。
- interrupt / stop task。
- permission mode 切换。
- model selection。
- structured outputs。
- subagents。
- todo tracking、cost tracking、observability。

Claude Code CLI 仍可作为 fallback，但 rich integration 应优先 SDK。

## Tools / MCP / Skills / Extensions

官方 docs index 显示 Agent SDK 有：

- custom tools。
- MCP。
- tool search。
- subagents。
- slash commands。
- skills。
- plugins。
- hooks。

Claude Code 原生也有 subagents：用 Markdown + YAML frontmatter 定义，支持用户级和项目级，能通过 `/agents` 管理，可自动委派或显式调用。

## Context / Memory / Workspace

Claude Code session 是 runtime 自己拥有的上下文，不等于 MindOS chat message list。

已确认概念：

- session history / resume / continue。
- SDK session store 方向。
- project/user-level instructions、skills、subagents。
- hooks 和 status/observability 事件。

对 MindOS 来说，外部 `session_id` 应作为 native binding，而不是复制 Claude transcript 到 MindOS 普通消息里。

## Permissions / Sandbox / Approvals

官方 Agent SDK permissions 体系包括：

- permission modes。
- allow / deny / ask rules。
- `canUseTool` 回调。
- hook 可以先参与判断。
- deny rules 优先级高。
- plan mode 会把 file-edit 和 shell-write 类工具转给 `canUseTool`。
- `dontAsk` 下 unresolved permission 会直接 deny。

MindOS 的正确边界是把 Claude 的 permission request 转成 inline approval / question UI，再把结果还给 Claude runtime。

## Session / Task / PR / Diff 模型

Claude Code 强 session / transcript / resume；文件回滚、diff/checkpoint 属于更深集成能力，不应和 session resume 混淆：

- session resume 恢复 conversation。
- file checkpoint 才能恢复 workspace。
- subagents 可以处理专项任务，但运行仍归 Claude runtime。

## UI / Observability

Claude Code 通过 CLI/SDK streaming 暴露：

- assistant output。
- tool use。
- permission requests。
- questions。
- retry/status events。

SDK 还提供 observability、cost tracking、todo list 等文档主题。MindOS 应把这些渲染为 runtime events，不要混进 assistant 正文。

## 对 MindOS 的启发

1. Claude Code integration 应 SDK-first，CLI stream-json 只做 fallback。
2. Claude session 由 Claude runtime 拥有；MindOS 只保存 typed binding。
3. Permission bridge 应使用 SDK `canUseTool` 或官方 permission prompt surface。
4. Claude subagent 是 runtime 内部能力；MindOS Assistant 不要假装自己拥有 Claude subagent lifecycle。
5. Model picker 应显示“managed by Claude Code”，而不是把 Claude Code 当 MindOS provider。

## 未确认 / 风险

- Claude Code docs 页面由 Mintlify 动态渲染，不同页面路径可能随版本变化；文档链接需定期复核。
- SDK 功能面变化较快，MindOS 应按 installed SDK/CLI capability detection 决定 UI。
- 直接读取 `~/.claude` transcript 可能涉及隐私和格式漂移，不应作为 P0 依赖。

## Sources

- Claude Code docs: https://code.claude.com/docs
- Claude Agent SDK overview: https://code.claude.com/docs/en/agent-sdk/overview
- Claude Agent SDK permissions: https://code.claude.com/docs/en/agent-sdk/permissions
- Claude Code subagents: https://docs.anthropic.com/en/docs/claude-code/sub-agents
