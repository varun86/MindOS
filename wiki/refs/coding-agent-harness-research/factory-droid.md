# Factory Droid Harness 调研

> Last verified: 2026-06-13
> Source quality: 中高。Factory 官方 docs index 可验证 Droid CLI、Droid Computers、sessions API、MCP、skills、hooks、plugins、sandbox、enterprise audit 等产品对象；具体 runtime event schema 不完全公开。

## 一句话定位

Factory Droid 是企业/团队向的 AI-native software development platform。它把 coding agent 包装成 Droid：可以处理重构、incident response、迁移、PR review、CI/headless automation、团队工作流和长期 computer 环境。

## 用户入口

官方 docs 暴露的入口比较完整：

- Web / Factory App。
- Droid CLI，以及 `droid exec` 这种 headless/CI 入口。
- IDE 集成，包括 JetBrains via ACP、Zed MCP、自身 CLI 工作流。
- Slack、Linear、GitHub Action / PR review 等团队入口。
- API 入口：computers、sessions、service accounts、analytics。
- 企业入口：hierarchical settings、IAM、audit、telemetry export。

## Harness 架构

可抽象为：

```text
task / issue / PR / Slack / CLI / API
  -> organization/project settings
  -> Droid session
  -> computer / sandbox / local or managed environment
  -> AGENTS.md + skills + MCP + hooks + plugins
  -> model/tool/autonomy policy
  -> code changes / browser or desktop automation / validation
  -> diff / PR review / incident handoff / analytics
```

## Agent Loop / 执行模型

公开 docs 没有给出 Hermes/Cline 那样的 source-level loop，但已经能确认几个外层执行对象：

- sessions API：create/list/get/update/delete session、add message、get messages、interrupt session。
- Droid Exec：非交互式执行，适合 CI/CD 和自动化脚本。
- Autonomy Level：Off / Low / Medium / High，用于控制 Droid 不经重复确认能做多少事。
- Droid Computers：persistent, long-lived compute environments，可重启、刷新、重试依赖安装，并暴露 CPU/memory/disk metrics。
- Factory Missions：面向大型多功能项目的计划和执行编排。

## Tools / MCP / Skills / Extensions

官方 docs index 明确列出：

- `AGENTS.md`：项目级 agent 指令文件。
- Custom Droids / Subagents：专门 prompt、tool access、model 的 delegated agents。
- Custom Slash Commands：Markdown prompt 或可执行脚本形式的 CLI 扩展。
- MCP：连接自定义工具。
- Hooks：注册 shell commands 定制行为。
- Plugins：可分享的 skills、commands、tools 包。
- Skills：agent 按需调用的 reusable capabilities。
- BYOK / mixed models：模型可切换，且支持多家 provider。
- Droid Control：terminal、browser、desktop automation。

## Context / Memory / Workspace

Factory 的上下文重点包括：

- repo / org / project context。
- `AGENTS.md`、skills、plugins、custom commands。
- sessions history、messages、analytics。
- persistent memory / context management guidance。
- long-running Droid Computer environment。
- issue / PR / Slack / incident context。

对 MindOS 来说，它代表“团队工作流 agent”，不是 local-first knowledge agent。

## Permissions / Sandbox / Approvals

Factory 更像企业 control plane + 本地/远端 agent 混合体，权限对象包括：

- Autonomy Level：对自动执行范围做显式控制。
- Sandbox：OS-level filesystem/network isolation。
- Droid Shield / Shield Plus：secret detection、prompt injection / sensitive data protection。
- IAM / service accounts / API keys。
- hierarchical settings：org/project/folder/user 多层控制 models、tools、safety policies、telemetry。
- audit logs、OpenTelemetry export、enterprise control change history。

## Session / Task / PR / Diff 模型

Droid 更适合 task/session/computer/PR-first UI：

- 分派任务或从 Slack/Linear/GitHub 触发。
- 在 session 中追加消息、查看 message history、interrupt 运行。
- 在 persistent computer 上保留/恢复开发环境。
- 产出 diff、local code review 或 GitHub PR review。
- 通过 analytics/audit 回看运行效果。

不适合只用 chat session 表达。

## UI / Observability

应关注这些可观测面：

- session status / messages / stats。
- computer metrics：CPU、memory、disk。
- terminal/browser/desktop automation playback 或证据。
- local code review / GitHub PR review。
- readiness report、AutoWiki、analytics API。
- enterprise audit and telemetry。

公开资料仍不足以确认细粒度 event stream schema。

## 对 MindOS 的启发

1. 团队 coding agent 不是“多个 assistant 卡片”，而是 session + computer + task/review queue。
2. Enterprise harness 的关键是 autonomy policy、sandbox、IAM、audit、telemetry。
3. MindOS 如果接 Factory 类 runtime，应把它作为 `cloud-job` / `ide-extension` / `cli-stream` 混合 adapter，而不是普通 provider。
4. API 层要能保存 external session id、computer id、message id 和 interrupt/resume 状态。
5. `AGENTS.md`、skills、MCP、hooks、plugins 是一组 runtime capability，不能塞进 assistant prompt 字段。

## 未确认 / 风险

- 官方公开资料不足以写内部 agent loop / event schema。
- MCP、skills、hooks、plugins、sandbox 的具体配置字段需要后续逐页补证。
- Factory 产品迭代较快，不应把当前页面的 UI 名称写死进长期 schema。

## Sources

- Factory docs index: https://docs.factory.ai/llms.txt
- Factory docs: https://docs.factory.ai/
- Factory homepage: https://www.factory.ai/
