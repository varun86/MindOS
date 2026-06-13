# Google Jules Harness 调研

> Last verified: 2026-06-13
> Source quality: 中高。官方 Jules docs 可验证 GitHub 授权、repo/branch 选择、VM clone/install/modify、plan approval、AGENTS.md、environment setup、running/scheduled tasks、repo view、REST API/CLI/integrations 等产品面；内部 event/tool schema 不公开。

## 一句话定位

Google Jules 是面向 GitHub repo 的 asynchronous coding agent。它帮助修 bug、补文档、做 feature，在远端 VM clone repo、安装依赖、修改文件，并以 plan / diff / review flow 交给用户。

## 用户入口

官方 onboarding flow 很清楚：

- 用 Google 登录。
- 连接 GitHub，并选择全部或特定 repo。
- 从 repo selector 选择 repo。
- 选择 branch，默认是默认分支。
- 可选填写 environment setup scripts。
- 点击 “Give me a plan”。
- Jules 先生成 plan，用户 review/approve 后才开始改代码。
- 通过 notifications 知道任务完成或需要输入。

## Harness 架构

抽象结构：

```text
Google login + GitHub authorization
  -> repo selector + branch + task prompt
  -> optional environment setup scripts
  -> cloud VM clone repo / install dependencies
  -> plan generation
  -> human approval
  -> code changes / checks when possible
  -> reviewing code / task and repo management / handoff
```

## Agent Loop / 执行模型

公开资料可确认的是：

- Jules 不依赖用户本地机器。
- Jules 在 virtual machine 中 clone code、安装依赖、修改文件。
- 任务开始前先生成 plan，用户确认后再改代码。
- 任务运行后用户可以离开，稍后 review 结果或处理需要输入的通知。
- docs sidebar 明确区分 Environment setup、Running tasks、Scheduled tasks、Suggested tasks、Planning、Reviewing code、Managing tasks and repos、Repo view、Errors and failures、REST API、CLI tools、integrations。

内部工具并发、memory、subagent 机制未公开。

## Tools / MCP / Skills / Extensions

官方公开资料没有像 Codex/Cline/Hermes 一样详细列出 MCP、plugin、skills registry。可确认的扩展/配置面是：

- Environment setup scripts。
- `AGENTS.md`：Jules 会自动查找 repo root 的 AGENTS.md，用于理解 repo、tools、input/output conventions。
- REST API / CLI tools / integrations 页面存在。

不要推断 Jules 有 MCP control plane。

## Context / Memory / Workspace

Jules 的 workspace 主要是 GitHub repo、branch、VM environment、environment setup scripts、AGENTS.md 和 task state。它的 memory 更可能来自 repo/task state，而不是用户本地长期知识库。

## Permissions / Sandbox / Approvals

Jules 需要 Google 登录和 GitHub 授权。风险收口点是：

- repo access scope。
- branch choice。
- plan approval before code changes。
- diff / code review。
- task/repo management。

它不是本地 per-command approval 模型。

## Session / Task / PR / Diff 模型

Jules 最重要的是 task-first：

- task。
- plan。
- approval。
- code diff。
- review/merge handoff。

它不是普通 chat-first 产品。

## UI / Observability

用户需要看到：

- Jules 理解任务的 plan。
- plan approval state。
- 代码变更。
- 测试/验证结果。
- running/scheduled task state。
- repo/branch context。
- review/merge 操作。

公开资料不足以确认实时 event stream 的粒度。

## 对 MindOS 的启发

1. 异步 coding agent 应该进入 MindOS 的 “Task / Review Queue” 语义，而不是普通 Ask session。
2. GitHub repo authorization、branch、environment setup 是 runtime capability，不是 assistant profile 字段。
3. plan approval 是低摩擦的人类控制点，比逐条 shell approval 更适合云端任务。
4. 对用户最重要的是 reviewable diff、验证证据和任务状态。
5. MindOS 若集成 Jules 类 agent，应把 adapter kind 归为 `cloud-job`，并显式保存 repo、branch、task id、plan approval state。

## 未确认 / 风险

- 未确认 Jules 是否支持 MCP、custom tools、secrets 或企业 hooks。
- 未确认 session persistence、checkpoint、rollback 的公开模型。
- Google 产品命名和可用地区可能变化，需要每次发版前复核官方 docs。

## Sources

- Google Jules docs: https://jules.google/docs
- Google Jules homepage: https://jules.google/
