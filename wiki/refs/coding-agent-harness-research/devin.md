# Devin Harness 调研

> Last verified: 2026-06-13
> Source quality: 中高。官方 docs index 可验证 sessions、messages、attachments、knowledge、playbooks、secrets、repo indexing、schedules、PR/session metrics、audit、guardrails 等 API surface；完整 runtime/event schema 不公开。

## 一句话定位

Devin 是 cloud software engineer 产品，harness 的核心是云端 workspace、repo/organization 集成、长期 session、知识/Playbook、secrets、验证和 PR handoff，而不是本地 CLI。

## 用户入口

官方 docs 暴露的入口包括：

- Web app / 团队工作流。
- API sessions：create/list/get/send message/terminate/update tags/archive。
- Attachments：上传文件供 Devin 在 session 中使用，或下载 session 附件。
- Knowledge / notes / folders：组织或企业级知识。
- Playbooks：团队可复用工作流。
- Schedules：创建 scheduled session。
- PR review / metrics / usage metrics / audit logs。

## Harness 架构

可从官方 docs 抽象为：

```text
user task / API session / schedule / repo context
  -> org / RBAC / service user
  -> Devin session
  -> repo indexing + workspace / snapshot
  -> secrets + attachments + knowledge + playbook
  -> coding agent loop
  -> shell/browser/editor-like actions
  -> tests / verification / insights
  -> branch / PR / handoff / metrics
```

Devin 的产品形态决定了它是 cloud workspace harness，而不是 local runtime harness。

## Agent Loop / 执行模型

公开资料不会暴露 agent loop 内部实现，但 API surface 已经说明它不是普通 chat：

- session 是核心对象，可创建、列出、获取、归档、终止、打 tags。
- message 是 session 内对象，可追加消息；v3 docs 表明发送消息会在 session suspended 时自动 resume。
- session insights 可按需生成，且 enterprise/org API 能列出 detailed insights、message counts、session size classification、AI-generated analysis。
- attachments 是 session 输入/输出对象。
- schedules 可创建 scheduled session。

## Tools / MCP / Skills / Extensions

官方资料更强调 cloud workspace 的产品对象，而不是开源 tool registry：

- Knowledge / notes / folders。
- Playbooks。
- Secrets。
- Repository indexing / git connections。
- Attachments。
- Session messages / insights / tags。
- Metrics and audit APIs。

未看到可确认的 MCP / plugin / skills registry 公开配置，因此不要把 Devin 当作 MCP-first runtime。

## Context / Memory / Workspace

Devin 的关键上下文对象：

- repository access。
- repository indexing and branch configuration。
- workspace / snapshot / machine state。
- knowledge / notes / folders。
- playbooks。
- secrets。
- attachments。
- session history / tags / insights。

这类产品的 context 不只是 prompt，而是完整开发机器状态。

## Permissions / Sandbox / Approvals

Devin 的权限重点是：

- organization / enterprise RBAC。
- service users / API keys。
- repo / git connection permissions。
- secrets metadata and storage。
- audit logs。
- guardrail violations。
- workspace isolation。

相比 Cline/OpenCode 的 per-tool approval，Devin 更像“授予一个 cloud engineer 访问 workspace 的权限”，然后通过 PR review 收口风险。

## Session / Task / PR / Diff 模型

Devin 的典型对象链是：

```text
session
  -> messages / attachments / tags / insights
  -> repo / workspace / secrets / knowledge
  -> code changes
  -> pull request / review / metrics
```

它适合长期异步任务，不适合当作 MindOS Chat Panel 的普通单轮 assistant。

## UI / Observability

Devin 的 UI 价值应在：

- 任务进度。
- workspace 状态。
- 代码变更 diff。
- 测试/命令结果。
- session messages / attachments。
- insights / metrics。
- PR handoff。

公开资料不足以确认完整 event stream schema。

## 对 MindOS 的启发

1. Cloud engineer harness 要先建 workspace/environment，不是先建聊天 UI。
2. 对这种 agent，MindOS 应展示 task/branch/PR，而不是强行塞进 chat transcript。
3. Secrets 和 repo access scope 必须独立于 assistant profile。
4. 验证证据是核心产物：命令、截图、日志、测试结果。
5. 与 Devin 这类 runtime 集成时，MindOS 至少要保存 external session id、message cursor、attachment ids、PR refs 和 schedule ids。

## 未确认 / 风险

- 未确认 Devin 是否公开 MCP / plugin / tool registry 配置。
- 未确认完整 event schema、checkpoint、rollback 的公开模型。
- 官方 API surface 很完整，但它证明的是产品对象，不等于内部 agent loop 细节。

## Sources

- Devin docs index: https://docs.devin.ai/llms.txt
- Devin docs: https://docs.devin.ai/
- Devin repo setup docs: https://docs.devin.ai/onboard-devin/repo-setup
