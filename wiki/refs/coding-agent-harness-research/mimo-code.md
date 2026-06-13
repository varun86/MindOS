# MiMo Code Harness 调研

> Last verified: 2026-06-13
> Source quality: 高。官方 GitHub README 对 memory、agent、subagent、goal、config、OpenCode 关系描述完整。

## 一句话定位

MiMo Code 是小米 MiMo 团队开源的 terminal-native AI coding agent，核心卖点不是普通 CLI，而是 **cross-session memory + context reconstruction + subagent orchestration + goal judge** 的长程工程 harness。

## 用户入口

- 安装：`curl -fsSL https://mimo.xiaomi.com/install | bash` 或 `npm install -g @mimo-ai/cli`。
- 首次启动引导配置 provider。
- 支持 MiMo Auto、Xiaomi MiMo Platform OAuth、从 Claude Code 导入认证、自定义 OpenAI-compatible provider。
- 用户在 TUI 中用 `Tab` 切换 primary agents：`build`、`plan`、`compose`。

## Harness 架构

MiMo Code 明确说自己是 OpenCode fork，保留 providers、TUI、LSP、MCP、plugins，并新增 memory/context/subagent/goal/compose/dream/distill。

可抽象为：

```text
TUI command/session
  -> primary agent mode: build / plan / compose
  -> provider/model config
  -> project memory + checkpoint + task progress
  -> context reconstruction / budgeted injection
  -> tool permissions + MCP + Git/shell/file tools
  -> subagent execution
  -> judge model checks goal before stop
```

## Agent Loop / 执行模型

- `build`：默认开发 agent，具备完整工具权限。
- `plan`：只读分析，用于代码探索和方案设计。
- `compose`：面向 specs-driven development 和 skill-driven workflow 的编排模式。
- Subagents 可由系统按需创建，共享当前 session context，可并行/background 执行，支持 lifecycle tracking 和 cancellation。
- `/goal` 设定 stop condition；agent 试图停止时，由独立 judge model 判断目标是否真的满足。

## Tools / MCP / Skills / Extensions

README 明确提到：

- 保留 OpenCode 的 MCP 和 plugins。
- config 可配置 MCP server connections。
- compose mode 有 planning、execution、code review、TDD、debugging、verification、merging 等内置 skills。
- `/distill` 会把重复工作流包装成 reusable skills、subagents 或 commands。

## Context / Memory / Workspace

MiMo 的核心区别在 memory：

- `MEMORY.md`：项目级持久知识、规则、架构决策。
- `checkpoint.md`：自动维护的结构化 session snapshot。
- `notes.md`：agent 临时 scratch。
- `tasks/<id>/progress.md`：任务级进展日志。
- SQLite FTS5：跨 session 全文检索。
- automatic checkpoint：根据 context window 判断保存时机。
- context reconstruction：接近上下文上限时，用 checkpoint、project memory、task progress 和近期消息重建上下文。
- budgeted injection：按 token budget 和重要性注入记忆。

## Permissions / Sandbox / Approvals

README 只给出总体配置点：agent permissions and custom agents。官方 permissions docs 还说明 agent permission 可用 `ask / deny` 等策略，并可在 agent frontmatter 中配置。

对 MindOS 来说，MiMo 的重点不是“权限 UI 多复杂”，而是权限被绑到 agent mode：`plan` 天然只读，`build` 才是全工具开发。

## Session / Task / PR / Diff 模型

- 任务系统是树状：`T1`、`T1.1`、`T1.2`。
- task progress 和 checkpoint 集成，session resume 后不会丢失当前任务状态。
- README 未确认是否有独立 PR handoff UI；它更偏本地 CLI/TUI harness。

## UI / Observability

- TUI 是主入口。
- Voice input 是额外输入面：`/voice` 使用 TenVAD + MiMo ASR。
- `/dream` 和 `/distill` 是独特的可见 maintenance commands：一个整理长期记忆，一个抽取可复用技能。

## 对 MindOS 的启发

1. 长程 coding agent 不能只靠 transcript；需要 checkpoint、task progress、memory 三层。
2. “Plan 只读 / Build 可写 / Compose 编排”比单一 mode 更容易让用户理解风险。
3. stop condition 需要可验证，不应让 agent 自己乐观结束。
4. Dreaming 不应只是摘要功能，应该能移除 outdated memory 并维护项目知识。
5. Assistant profile 可以生成 subagent/skill，但 subagent 是运行期实例，不是静态卡片。

## 未确认 / 风险

- README 未详细说明 file checkpoint 的 rollback 机制。
- PR / branch / worktree handoff 能力未在 README 中展开。
- MiMo hosted services 的使用限制、隐私和企业部署边界需要单独读条款。

## Sources

- MiMo Code GitHub README: https://github.com/XiaomiMiMo/MiMo-Code
- MiMo Code start docs: https://mimo.xiaomi.com/mimocode/start
- MiMo Code permissions docs: https://mimo.xiaomi.com/mimocode/permissions
- MiMo Code long-horizon blog: https://mimo.xiaomi.com/blog/mimo-code-long-horizon
