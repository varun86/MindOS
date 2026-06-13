# Coding Agent Harness 调研总览

> Last verified: 2026-06-13
> Scope: 以官方文档、官方 README、官方 docs index 为主，关注 coding agent 的 harness 架构，而不是单纯功能营销。

## 研究问题

这里的 harness 指一个 Coding Agent 产品把模型能力包装成可工作的工程系统时，需要负责的外层运行框架：

```text
用户入口
  -> session / task / thread
  -> workspace / sandbox / environment
  -> context assembly
  -> model call / agent loop
  -> tool registry / MCP / plugins / skills
  -> permission / approval / policy
  -> event stream / UI observability
  -> checkpoint / diff / PR / handoff
  -> memory / profile / replay
```

结论先行：热门 Coding Agent 的核心差异已经不在“能不能调用模型写代码”，而在 **谁拥有 runtime、session、工具、权限、环境和交付物**。

## 调研对象

| Agent / Product | 类型 | 独立文档 | 资料强度 |
|---|---|---|---|
| MiMo Code | 本地 CLI/TUI + 长程记忆 + subagent | [mimo-code.md](./mimo-code.md) | 高 |
| Hermes Agent | 本地/网关/ACP agent loop + tool registry | [hermes-agent.md](./hermes-agent.md) | 高 |
| OpenAI Codex | 本地 CLI + app-server rich-client protocol + Codex Web | [openai-codex.md](./openai-codex.md) | 高 |
| Claude Code | CLI + Agent SDK + permissions/session/subagents | [claude-code.md](./claude-code.md) | 高 |
| Cursor | IDE agent + Cloud Agents + hooks/MCP | [cursor.md](./cursor.md) | 高 |
| Devin | 云端软件工程 workspace / PR handoff | [devin.md](./devin.md) | 中高 |
| Google Jules | 异步 GitHub coding agent | [google-jules.md](./google-jules.md) | 中高 |
| Factory Droid | 企业/团队 coding agent platform | [factory-droid.md](./factory-droid.md) | 中高 |
| OpenCode | 本地 TUI agent + agent profiles | [opencode.md](./opencode.md) | 高 |
| OpenHands | 开源 agent SDK / CLI / Local GUI / Cloud | [openhands.md](./openhands.md) | 中高 |
| Cline | VS Code / CLI / SDK / Kanban harness | [cline.md](./cline.md) | 高 |
| Roo Code | VS Code extension + modes + MCP controls | [roo-code.md](./roo-code.md) | 中高 |

## Harness 家族

### 1. 本地 CLI / TUI harness

代表：MiMo Code、Hermes Agent、OpenCode、Codex CLI、Claude Code CLI。

这类产品把当前机器作为执行环境。典型结构是：

```text
terminal input
  -> local session store
  -> prompt/context builder
  -> local tool registry
  -> shell/file/git/browser/MCP calls
  -> approval gate
  -> transcript/checkpoint/memory
```

优势是 local-first、低延迟、能直接复用用户本机 auth、git、文件和 CLI。风险是 UI 容易退化成文本流，难以完整表达工具事件、权限请求、diff 和可恢复状态。

### 2. IDE-native harness

代表：Cursor、Cline、Roo Code、Claude Code extension integrations。

IDE harness 的关键资产是 editor capability：打开文件、显示 diff、读取 selection、跑 terminal、展示 checkpoint、使用工作区状态。它的问题不是工具少，而是需要明确区分：

- IDE 拥有 UI 和 workspace context。
- Agent runtime 拥有模型循环和工具计划。
- 用户需要可见的 permission / auto-approve / rollback。

### 3. Cloud async workspace harness

代表：Cursor Cloud Agents、Devin、Google Jules、Factory Droid、OpenHands Cloud。

这类产品把 agent 放进隔离 VM / remote environment：

```text
task issue / prompt / Slack / web
  -> cloud workspace provision
  -> repo clone + secrets + dependencies
  -> agent run
  -> build/test/browser/desktop artifacts
  -> branch / PR / diff / handoff
```

优势是并行、异步、可以长期运行、不依赖用户电脑在线。真正的产品壁垒在 environment setup、secrets、artifact、PR handoff、remote desktop / preview，而不是聊天框。

### 4. Protocol / app-server harness

代表：Codex app-server、Claude Agent SDK、Cline SDK、Hermes ACP。

这类不是“一个 agent UI”，而是把 agent runtime 暴露成可嵌入协议或 SDK。典型对象模型会显式化：

- thread / turn / item
- session / message / tool call
- approval request / result
- event stream / delta
- model/account/status
- file change / command output
- abort / interrupt / resume

对 MindOS 来说，这比 CLI 包装更重要：它允许 MindOS 做真正的 rich client，而不是把外部 agent 的输出压扁成一段 assistant 文本。

### 5. Messaging / gateway harness

代表：Hermes Gateway、Cline connectors、Cursor Slack/GitHub triggers、Factory/Devin/Jules 的 issue/PR 工作流。

这里 agent 的入口不是 IDE，而是 Slack、Telegram、GitHub issue、Linear、cron 或 webhook。核心问题变成：

- 触发源如何绑定 session / workspace？
- 谁有权限访问 repo、secret、外部系统？
- 运行结果发回哪里？
- 中途需要 approval 或 clarification 时如何回到用户？

## 横向能力矩阵

| 维度 | 最成熟形态 | 代表样本 | MindOS 启发 |
|---|---|---|---|
| Runtime identity | agent/runtime 和 model/provider 分离 | Codex, Claude, ClineCore | Chat Panel 不应只展示模型，应展示 runtime owner |
| Session model | thread/turn/item 或 session/message/tool-call | Codex, Cline, Hermes | 保存外部 session id 只是第一步，需要 event log |
| Workspace | local cwd 或 isolated VM | Cursor Cloud, Devin, OpenHands | Space 应绑定 workspace policy，不只是文件夹 |
| Tool registry | built-in tools + MCP + plugins/skills | Hermes, Codex, Cline, Roo | Tools/MCP/Skills 需要可见、可开关、可审批 |
| Permission | ask/allow/deny、auto-approve、sandbox policy | OpenCode, Cline, Codex, Hermes | MindOS 应桥接而不是绕过原生权限系统 |
| Memory | project memory、checkpoint、session search | MiMo, Hermes, Cline | Memory 必须有来源和生命周期，不应塞进 prompt 常量 |
| Subagents | delegate task / parallel agents | MiMo, Cline, Hermes, Claude | subagent 是运行期能力，assistant 是 profile |
| Checkpoint | file snapshot / rollback / diff | Cline, Codex, Devin/Cloud PR | UI 必须能解释“改了什么、如何回滚” |
| Cloud handoff | branch/PR/artifacts | Cursor Cloud, Devin, Jules, Factory | 异步 agent 的交付物是 PR + 证据，不是聊天总结 |

## 对 MindOS 的关键判断

### 判断 1：不要把 Coding Agent 当成普通模型 Provider

Codex、Claude Code、ClineCore、Hermes 这类 runtime 自己拥有 auth、model、session、tools、permissions 和 event stream。MindOS 应作为 **UI / context / permission bridge**，而不是把它们塞进 `provider + model` 下拉框。

### 判断 2：Assistant 和 Agent 必须继续分开

行业里越来越清楚：

- Assistant / subagent profile / mode / rule 是配置层。
- Agent runtime / harness 是执行层。
- Run / session / task 是实例层。

MindOS 里的 Assistant 应该是 `.mindos/assistants/<id>/` 这种本地 profile；Codex、Claude、Cline、Hermes 是 runtime adapter；一次用户请求产生 run/session。

### 判断 3：事件流必须结构化，不要只存最终文本

真正的 coding work 需要渲染：

- 计划 / reasoning 摘要
- shell command start/output/end
- file edit / diff
- MCP tool call
- permission request
- clarification
- error / retry / rate limit
- checkpoint / rollback
- PR / handoff

这也是 Codex app-server 和 ClineCore 这类 harness 的核心价值。

### 判断 4：权限模型要桥接原生 runtime，而不是 MindOS 自己“假批准”

好的模式是：

```text
external runtime asks approval
  -> MindOS renders inline permission UI
  -> user chooses allow/deny/always/session
  -> MindOS replies to runtime request id
  -> runtime continues under its own policy
```

这比在 MindOS 里维护一份平行权限表更可靠。

### 判断 5：Cloud agent 的核心是 environment，而不是“远程聊天”

Cursor Cloud Agents、Devin、Jules、Factory 的共同点是隔离工作区、依赖安装、secret 管理、测试验证、PR 交付。MindOS 如果做类似能力，应先建模：

- workspace snapshot / environment config
- repo access and branch policy
- secrets scope
- test/artifact collection
- human review and handoff

## 推荐的 MindOS adapter 分类

```ts
type CodingAgentAdapterKind =
  | "app-server"        // Codex app-server
  | "sdk"               // Claude Agent SDK, ClineCore
  | "cli-stream"        // Claude CLI, Codex CLI, MiMo/OpenCode text/event stream
  | "ide-extension"     // Cursor/Cline/Roo-like editor-hosted surface
  | "cloud-job"         // Devin/Jules/Factory/Cursor Cloud
  | "gateway";          // Slack/Telegram/GitHub/cron bridge
```

每个 adapter 至少要声明：

```ts
type CodingAgentHarnessCapability = {
  session: "none" | "local-id" | "native-thread" | "cloud-task";
  eventStream: "text" | "tool-events" | "thread-turn-item";
  workspace: "local-cwd" | "local-worktree" | "container" | "cloud-vm";
  permissions: "none" | "mindos-only" | "runtime-bridged";
  tools: Array<"shell" | "file" | "git" | "browser" | "mcp" | "plugins" | "skills">;
  output: Array<"text" | "diff" | "checkpoint" | "artifact" | "branch" | "pr">;
};
```

## Sources

- MiMo Code README: https://github.com/XiaomiMiMo/MiMo-Code
- Hermes Agent developer docs: https://github.com/NousResearch/hermes-agent/tree/main/website/docs/developer-guide
- OpenAI Codex app-server README: https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md
- OpenAI Codex README: https://github.com/openai/codex
- Claude Code docs: https://code.claude.com/docs
- Cursor Cloud Agents docs: https://cursor.com/docs/cloud-agent.md
- Devin docs: https://docs.devin.ai/
- Google Jules docs: https://jules.google/docs
- Factory docs: https://docs.factory.ai/
- OpenCode agents docs: https://opencode.ai/docs/agents/
- OpenHands README/docs: https://github.com/OpenHands/OpenHands and https://docs.openhands.dev/
- Cline docs index: https://docs.cline.bot/llms.txt
- Roo Code docs: https://docs.roocode.com/
