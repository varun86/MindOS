# OpenHands Harness 调研

> Last verified: 2026-06-13
> Source quality: 中高。官方 README 清楚区分 SDK、CLI、Local GUI、Cloud、Enterprise；docs 对 custom sandbox / Docker runtime 有可验证说明。

## 一句话定位

OpenHands 是开源 AI-driven development 平台，不只是一个 agent。它把 agentic tech 拆成 Software Agent SDK、CLI、Local GUI、Cloud、Enterprise，核心 harness 是 agent runtime + sandbox/container + GUI/API + cloud deployment。

## 用户入口

官方 README 列出：

- OpenHands Software Agent SDK：composable Python library。
- OpenHands CLI：类似 Claude Code / Codex 的 CLI。
- OpenHands Local GUI：本地 REST API + React SPA。
- OpenHands Cloud：hosted infrastructure。
- OpenHands Enterprise：自托管 cloud in VPC/Kubernetes。

## Harness 架构

```text
SDK / CLI / Local GUI / Cloud
  -> OpenHands agent runtime
  -> sandbox / Docker runtime
  -> repo/files/terminal/browser-like tools
  -> REST API / React UI
  -> cloud/team integrations
```

Local GUI 的体验被官方类比为 Devin 或 Jules；CLI 则类比 Claude Code/Codex。

## Agent Loop / 执行模型

README 未在主文档中展开完整 loop，但 SDK 被描述为包含全部 agentic tech 的 engine，可在本地运行或云端 scale 到大量 agents。

## Tools / MCP / Skills / Extensions

本次抓取的 README 未详细列 MCP/tool registry。OpenHands 更确定的能力是：

- agent SDK。
- CLI。
- Local GUI with REST API。
- sandbox/custom Docker image。
- cloud integrations with Slack/Jira/Linear。

## Context / Memory / Workspace

OpenHands 的关键上下文在 sandbox：

- docs 支持自定义 Docker image。
- 可通过 `SANDBOX_BASE_CONTAINER_IMAGE` 或 `config.toml` 的 `[sandbox] base_container_image` 指定 runtime 基础镜像。
- 可安装额外依赖，设置 runtime startup env vars，指定 platform。

这说明 OpenHands 把“agent 能不能完成任务”绑定到可控 runtime environment。

## Permissions / Sandbox / Approvals

OpenHands 的安全边界主要来自 container/sandbox、cloud RBAC 和部署边界。Enterprise 支持 multi-user、RBAC、permissions、collaboration。

## Session / Task / PR / Diff 模型

OpenHands Local GUI / Cloud 面向 agent work session；具体 PR/diff 模型需要深入 docs。README 提到 Cloud 支持 Slack、Jira、Linear、多用户、RBAC、conversation sharing。

## UI / Observability

Local GUI 提供 REST API + React SPA；Cloud 提供 hosted UI。对 MindOS 来说，OpenHands 是“开源 Devin/Jules-like GUI”参考，而不是单一 CLI。

## 对 MindOS 的启发

1. SDK、CLI、GUI、Cloud 是同一 agentic core 的不同 harness surface。
2. Sandbox image 是 runtime capability；MindOS 不应把它藏在 prompt 设置里。
3. Local GUI + REST API 是本地 app 接 agent runtime 的典型形态。
4. Enterprise/cloud 需要 RBAC、permission、conversation sharing，不应和个人 local-first 模型混淆。

## 未确认 / 风险

- 本次未完整审计 OpenHands SDK API 和 event schema。
- MCP/plugin/skills 能力需要另开文档确认。
- Cloud 和 Enterprise 有 source-available / license 边界，集成时需注意 license。

## Sources

- OpenHands GitHub README: https://github.com/OpenHands/OpenHands
- OpenHands docs: https://docs.openhands.dev/
- OpenHands custom sandbox docs: https://docs.openhands.dev/openhands/usage/advanced/custom-sandbox-guide
