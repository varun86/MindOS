# Roo Code Harness 调研

> Last verified: 2026-06-13
> Source quality: 中高。官方 docs 页面和 GitHub/marketplace 可验证 VS Code extension、MCP、modes、tool controls；完整 SDK/event schema 不如 Cline/Codex 公开。

## 一句话定位

Roo Code 是开源 VS Code coding agent extension。它的 harness 重心是 editor-side tools、modes、MCP server 管理、auto approve 和可配置工具边界。

## 用户入口

- VS Code Marketplace extension。
- Open VSX。
- GitHub repo。
- VS Code sidebar/chat interface。

## Harness 架构

```text
VS Code extension UI
  -> chat / mode selection
  -> workspace context
  -> built-in tools
  -> MCP servers
  -> tool approval / auto approve
  -> file edits / terminal / browser-like operations
```

Roo 与 Cline 同源生态接近，但 Roo 更偏 VS Code extension 体验和 MCP 管理面。

## Agent Loop / 执行模型

公开 docs 显示 Roo 支持 modes、tools、MCP、task/chat interface。内部 loop schema 未公开到 Codex app-server 那种层级。

## Tools / MCP / Skills / Extensions

Roo 的 MCP docs 明确说明：

- MCP servers 可启用/禁用。
- 禁用 MCP 会从 system prompt 移除 MCP 相关逻辑和定义，从而降低 token usage。
- 可禁用 MCP Server Creation，只移除创建 server 的 instructions，不移除运行 server 的上下文。
- Roo 可以根据用户请求创建 MCP server。
- 创建 server 时会 scaffold TypeScript 项目，处理 API 调用，必要时通过 `ask_followup_question` 询问 secrets，并写入 global `mcp_settings.json` 或 project `.roo/mcp.json`。
- 支持 stdio、Streamable HTTP、legacy SSE。
- server config 支持 `alwaysAllow`、`disabled`、`timeout`、`disabledTools` 等。

## Context / Memory / Workspace

Roo 的 context 主要来自 VS Code workspace、context mentions、modes、MCP 配置。它也把 MCP instructions 是否进入 prompt 作为显式开关，说明“工具上下文”会影响 token 和模型行为。

## Permissions / Sandbox / Approvals

Roo 的 MCP config 支持：

- `alwaysAllow`：自动批准某些 server tools。
- `disabledTools`：禁用某些 tools。
- `disabled`：禁用 server。
- network timeout。
- UI 中可启用/禁用 server、重启、删除。

这比“全局开关 MCP”更细。

## Session / Task / PR / Diff 模型

Roo 是 editor extension first；本次未确认独立 PR/cloud task 模型。代码变更和 review 主要发生在 VS Code workspace 中。

## UI / Observability

Roo 的 MCP 管理 UI 是重点：

- 顶部 server icon 打开 MCP settings。
- server 列表。
- 单 server config panel。
- 删除、重启、启用/禁用。
- network timeout。
- auto approve tools。

对 MindOS 来说，MCP server 不应只显示“已安装”，还要能展示启停、工具级 allow/deny、timeout 和错误。

## 对 MindOS 的启发

1. MCP 开关会影响 prompt 和 token；UI 应让用户知道启用 MCP 的成本。
2. MCP Server Creation 应和 MCP Tool Usage 分开开关。
3. 工具 secret 应通过 question/approval flow 获取，不应写进普通 prompt。
4. `alwaysAllow` 和 `disabledTools` 是工具级控制的实用最小模型。
5. MCP server 管理需要 restart / delete / disable / timeout，不只是安装。

## 未确认 / 风险

- Roo docs 的 canonical 路径有 roocodeinc.github.io 和 docs.roocode.com 两套入口，链接需定期复核。
- 未确认 Roo 的完整 session store、checkpoint、event stream。
- Auto approve 的安全边界需要结合具体版本代码审计。

## Sources

- Roo Code docs: https://docs.roocode.com/
- Roo MCP docs: https://docs.roocode.com/features/mcp/using-mcp-in-roo
- Roo Code GitHub: https://github.com/RooCodeInc/Roo-Code
