# Hermes Agent Harness 调研

> Last verified: 2026-06-13
> Source quality: 高。官方 developer docs 对 `AIAgent`、tool registry、approval、terminal backend、session persistence 描述非常具体。

## 一句话定位

Hermes Agent 是 NousResearch 的本地/网关/ACP 多入口 agent runtime，核心是 `run_agent.py` 中的 `AIAgent`：一个可插拔 provider、tool registry、plugin hook、session DB、approval 和 gateway 的 agent loop harness。

## 用户入口

公开文档显示 Hermes 可通过 CLI、gateway、cron、ACP 和 auxiliary calls 等入口运行。它不是单一 IDE agent，而是一个 platform-agnostic core，外层可以是终端、消息平台、ACP editor client 或后台任务。

## Harness 架构

官方 agent-loop docs 把 `AIAgent` 描述为核心 orchestration engine，职责包括：

- system prompt 和 tool schema assembly。
- provider/API mode selection。
- interruptible model calls。
- sequential / concurrent tool execution。
- OpenAI-style conversation history。
- compression、retry、fallback model switching。
- parent/child iteration budgets。
- context 丢失前 flush persistent memory。

抽象结构：

```text
entrypoint: chat / run_conversation / gateway / ACP / cron
  -> AIAgent
  -> prompt_builder + provider resolver
  -> OpenAI-style internal messages
  -> model API mode: chat_completions / codex_responses / anthropic_messages
  -> tool calls
  -> registry / agent-level tools / plugin hooks / approval
  -> session SQLite + FTS + compression + memory flush
```

## Agent Loop / 执行模型

一次 turn 的生命周期：

1. 生成 task id。
2. append user message。
3. build/reuse cached system prompt。
4. preflight compression，阈值约为上下文 50%。
5. build API messages。
6. 注入 ephemeral prompt layers。
7. Anthropic 场景下应用 prompt caching markers。
8. interruptible API call。
9. 若模型返回 tool calls，则执行工具并 append tool result，回到 model call；若返回 text，则 persist session、flush memory、return。

Tool calls 的并发模型：

- 单工具调用直接执行。
- 多工具调用用 `ThreadPoolExecutor` 并发。
- interactive tools 强制顺序。
- 结果按原始 tool call 顺序回插。

## Tools / MCP / Skills / Extensions

Hermes 的 tool system 是典型 registry harness：

- 每个 tool module 在 import 时调用 `registry.register(...)`。
- `model_tools.py` 负责 discover/import tool modules，并构建模型 schema。
- discovery 会扫描 `tools/*.py` 中顶层 `registry.register()`。
- MCP tools 由 `tools.mcp_tool.discover_mcp_tools()` 发现。
- plugin tools 由 `hermes_cli.plugins.discover_plugins()` 加载。
- `check_fn` 控制 tool 是否可用；异常时 fail-safe unavailable。
- toolset resolution 支持 explicit enabled/disabled、platform presets、dynamic MCP、special sets。

有四类 agent-level tools 会在 agent loop 中拦截：

- `todo`
- `memory`
- `session_search`
- `delegate_task`

## Context / Memory / Workspace

Hermes 通过 SQLite session store 和压缩策略维护长期运行：

- conversation history 使用 OpenAI-compatible message format。
- compression 会保护最近 N 条 turn，并保持 tool/result pair 不拆散。
- context 高压时先 flush memory，再 summarize middle turns。
- session resume 通过 `/resume` 或 `hermes chat --resume`。
- `session_search` 是一等工具，说明历史检索进入 agent loop，而不是只在 UI 里搜索。

## Permissions / Sandbox / Approvals

Hermes 的危险命令审批比较明确：

- `tools/approval.py` 维护 dangerous patterns。
- 覆盖 recursive deletes、filesystem formatting、SQL destructive operations、system config overwrites、service manipulation、`curl | sh`、fork bombs、process kills 等。
- CLI 模式可 approve / deny / allow permanently。
- Gateway 模式通过 async approval callback。
- session state 跟踪已批准项。
- permanent allowlist 写入 config。

Terminal runtime backend 支持：

- local
- docker
- ssh
- singularity
- modal
- daytona

还支持 per-task cwd、background process、PTY、approval callback。

## Session / Task / PR / Diff 模型

Hermes 文档重点是 session、task id、delegate_task、cron、gateway，不是 PR-first 产品。它更像一个可嵌入 agent runtime：

- session DB 存储 conversation history。
- task id 用于工具调用和状态。
- delegate_task 可生成子任务/子 agent。
- cron 可运行定时 agent task。

PR/diff handoff 不是已确认核心对象。

## UI / Observability

`AIAgent` 暴露多个 callback surface：

- tool progress
- thinking
- reasoning
- clarify
- step
- stream delta
- tool generation
- status

这说明 Hermes harness 从底层就给 UI / gateway / log 留出了结构化事件面。

## 对 MindOS 的启发

1. Tool registry 不应由 UI hardcode；应该自注册、可发现、可 check availability。
2. Approval 不只是 UI 弹窗，而是 terminal runtime 的执行前策略。
3. Provider mode 差异可以在 adapter 内收敛成统一 internal message format。
4. `session_search`、`memory`、`todo`、`delegate_task` 这类 agent-level tools 值得 MindOS 单独建模。
5. Gateway / ACP / CLI 可以共享一个 agent core，但 UI event callback 必须稳定。

## 未确认 / 风险

- 公开 docs 里 PR/diff/checkpoint UI 不是主线，不能推断 Hermes 已有完整 PR handoff。
- 70+ tools、20 platform adapters 等数量来自 architecture docs，应以后续版本变动为准。
- 插件和 gateway 权限边界需要单独审计代码实现。

## Sources

- Hermes agent loop docs: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/agent-loop.md
- Hermes tools runtime docs: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/tools-runtime.md
- Hermes architecture docs: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/architecture.md
