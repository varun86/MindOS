# Agent Dreaming 机制调研与 MindOS 落地

> 日期：2026-06-13
> 状态：Research + MVP implementation note
> 关联实现：`packages/web/lib/dreaming.ts`

## 1. 研究问题

这里的 Dreaming 指 Agent 在用户没有主动发起编辑时，后台周期性或手动触发地整理记忆/知识库。它不是普通搜索，也不是“追名/name resolution”。它更像人类睡眠时的记忆巩固：

- 收集最近会话、文件变化、用户反馈、知识健康信号。
- 找出重复、过时、冲突、孤立、需要归档的内容。
- 生成可审计的建议或新的整理后记忆。
- 在安全边界内把结果写回 memory store / metadata store / review queue。
- 默认不直接破坏原始用户输入。

MindOS 要借鉴的是这种“后台整理机制”：让系统自动帮用户维护本地知识库，但必须保守、透明、可回滚。

## 2. 外部系统调研

### 2.1 OpenClaw Dreaming

OpenClaw 的 Dreaming 是最接近 MindOS 需求的模型。它把后台记忆整理设计成三段：

```text
Light -> REM -> Deep
```

典型含义：

- Light：收集短期信号，例如最近对话、memory traces、用户行为、候选片段。
- REM：发现主题、模式、重复、矛盾，把 raw traces 组织成候选记忆。
- Deep：把高价值结果沉淀到长期 memory，例如 `MEMORY.md` 或类似长期存储。

这个设计的核心不是“跑一次 summarization”，而是把后台整理拆成不同风险级别：

- Light 是低风险采集。
- REM 是分析与聚类。
- Deep 才是长期写回。

对 MindOS 的启发：

- Dreaming 不能直接从“扫描到问题”跳到“修改用户文件”。
- 必须先写中间状态：候选、分析、待确认动作。
- Deep 阶段也不一定直接改用户正文，可以先写 review proposals。
- 每次 Dreaming run 都要有 run id 和 artifact，方便回看。

需要注意：

- OpenClaw 面向 agent memory，更强调从隐式会话提炼长期记忆。
- MindOS 的输入主要是用户已有显式 Markdown 知识库，所以第一版应该先整理文件健康信号，而不是全量抽象记忆。

参考：

- [OpenClaw Dreaming docs](https://docs.openclaw.ai/concepts/dreaming)

### 2.2 Anthropic Managed Agents Dreams

Anthropic Managed Agents 的 Dreams 机制把 Dream 设计成异步任务。它的关键点是：Dream 会读取旧 memory store 和指定 sessions，生成新的 memory store；旧输入不被原地改写。

机制要点：

- Dream 是 async job，不阻塞用户当前对话。
- 输入是旧 memory store 和一定数量的 sessions。
- 输出是新的 memory store。
- 系统默认把整理结果写成新版本，而不是直接破坏旧数据。
- 这天然支持审计、回滚和版本对比。

对 MindOS 的启发：

- Dreaming run 应该是有独立生命周期的后台 run。
- 输入和输出要分开：用户笔记是输入，`.mindos/dreaming` 是输出。
- 第一版不应让后台 agent 直接 mutate notes；应先产出 report / pending proposals。
- 后续可以把用户确认后的结果提升为新版长期 memory 或更新某些用户文件。

参考：

- [Anthropic Managed Agents Dreams](https://platform.claude.com/docs/en/managed-agents/dreams)

### 2.3 Harness / Agent Harness

“Harness”这类系统的重点不是某个固定 Dreaming 算法，而是 agent 运行壳：任务怎么被触发、如何记录、如何控制权限、如何要求人工审批、如何复跑失败任务。

对 Dreaming 来说，Harness 层非常关键，因为后台整理天然有风险：

- Agent 可能误判重复内容。
- Agent 可能把历史事实当成错误事实。
- Agent 可能删除用户还需要的笔记。
- 定时任务可能在用户不知情时写入大量内容。

一个好的 harness 会提供：

- 触发器：manual / schedule / event。
- 输入快照：本次 run 读取了哪些文件和信号。
- 权限边界：只读、metadata write、content write。
- 审批门：高风险动作进入 pending review。
- 日志：run id、状态、输出、错误、用量。
- 幂等性：重复跑不会重复破坏用户数据。
- 可观测性：UI 能看到最近一次 Dreaming 在做什么。

对 MindOS 的启发：

- Dreaming 应该首先是一个 run artifact，而不是一个隐藏副作用。
- 工具权限上应把 Dreaming 视为写类工具，即便它只写 `.mindos/dreaming` metadata。
- 自动整理必须分层授权：报告可自动写，正文变更需用户确认。
- 后台 schedule 可以后做，但手动 run 和 artifact schema 要先稳定。

参考：

- [Harness Developer Hub](https://developer.harness.io/)
- [MindOS discussion: Agent Command Center and Routines](../discussions/discussion-agent-command-center-and-routines.md)

### 2.4 LangGraph / LangSmith Cron Jobs

LangGraph / LangSmith 的价值在于把后台任务建模成可追踪 run，而不是 UI 按钮状态。Cron job 会绑定 assistant、schedule、payload、multitask strategy。

对 MindOS 的启发：

- Dreaming 后续应该支持 manual / schedule / event 三类 trigger。
- Schedule 只负责触发 run，不应把整理逻辑塞进 React state。
- 运行记录要可查，失败要可重试。
- 多个 Dreaming run 并发时要有策略：skip、queue、cancel previous 或 parallel。

参考：

- [LangSmith Cron jobs](https://docs.langchain.com/langsmith/cron-jobs)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)

## 3. 机制抽象

综合这些系统，Agent Dreaming 一般包含五层：

```text
Trigger
  -> Signal Capture
  -> Pattern Analysis
  -> Memory Consolidation
  -> Review / Promotion
```

### 3.1 Trigger

触发方式：

- Manual：用户点击或 agent 工具调用。
- Schedule：每天/每周固定时间。
- Event：Inbox 导入、文件变更、会话结束、git commit 后。
- Idle：系统空闲时整理。

MindOS MVP：先做 manual trigger。原因是 Dreaming 的输出形态需要打磨，直接 schedule 风险太高。

### 3.2 Signal Capture

收集信号但不判断：

- 最近修改文件。
- 知识健康扫描：broken links、orphans、stale、empty。
- Inbox aging。
- 同源 URL 重复保存。
- agent run 里被反复检索或反复失败的文件。
- 用户显式标记的 stale / useful / pin。

MindOS MVP：复用现有 `runLint()`，先捕获 deterministic health signals。

### 3.3 Pattern Analysis

把 raw signals 组织成主题：

- Broken links -> repair candidates。
- Stale files -> refresh candidates。
- Orphans -> organization candidates。
- Empty/stub files -> archive candidates。
- Duplicate source URL/content -> merge candidates。
- Conflicting claims -> review candidates。

MindOS MVP：先做非 LLM 分组。LLM 后续只作为 judge/summarizer，不直接写。

### 3.4 Memory Consolidation

长期整理可能有多种输出：

- 新 summary memory。
- 知识库维护报告。
- 待确认任务。
- alias/redirect metadata。
- 更新后的 README / overview。
- 用户确认后的正文 patch。

MindOS MVP：输出 `.mindos/dreaming/latest.json`、`pending.json`、`dreaming-report.md`，不改用户正文。

### 3.5 Review / Promotion

高风险动作必须经过 review：

- 删除文件。
- 合并文件。
- 批量修改链接。
- 给旧事实标记 superseded。
- 自动重写 README。

MindOS MVP：所有正文相关动作都只是 proposal。后续在 Review Queue UI 里确认后再执行。

## 4. MindOS 当前基础

MindOS 已经有几块可以复用：

- `packages/web/lib/lint.ts`：静态知识健康扫描。
- `packages/web/lib/core/link-index.ts`：正反向链接索引。
- `packages/web/data/skills/mindos/references/knowledge-health.md`：知识健康检查流程。
- `packages/web/lib/agent/tools.ts`：Agent 工具入口。
- `packages/mindos/src/protocols/mcp-server/index.ts`：MCP 工具入口。
- `wiki/discussions/discussion-agent-command-center-and-routines.md`：manual/schedule/event routine 方向。

缺口：

- 没有 Dreaming run artifact。
- 没有 Light/REM/Deep 分层。
- 没有 pending review proposals。
- 没有 API/MCP/Agent 统一入口。
- 没有默认保守写入边界。

## 5. 本次落地的 MVP

本次实现的目标不是完整 OpenClaw，而是把 MindOS 的 Dreaming 骨架立起来。

新增：

- `packages/web/lib/dreaming.ts`
- `packages/web/app/api/dreaming/route.ts`
- `packages/web/__tests__/lib/dreaming.test.ts`
- Agent tool: `dreaming`
- MCP tool: `mindos_dreaming`

运行后写入：

```text
{mindRoot}/.mindos/dreaming/runs/<run-id>.json
{mindRoot}/.mindos/dreaming/latest.json
{mindRoot}/.mindos/dreaming/pending.json
{mindRoot}/.mindos/dreaming/dreaming-report.md
```

阶段映射：

```text
Light
  runLint() deterministic scan

REM
  group signals into maintenance themes

Deep
  generate review-first proposals
```

安全边界：

- 不自动修改用户 Markdown / CSV。
- 不删除文件。
- 不合并文件。
- 不批量改链接。
- 只写 `.mindos/dreaming` 下的 run artifacts。
- Agent tool 被标记为写类工具，不进入只读 chat tool set。

## 6. 未来迭代建议

### 6.1 加入 LLM Analyze

在已有 deterministic proposals 之上，让 LLM 只做分析：

- 判断 orphan 应该链接到哪个 index。
- 给 stale file 生成验证 checklist。
- 判断 duplicate 是否真的可合并。
- 为 broken link 找候选目标。

LLM 输出仍然进入 pending review，不直接写正文。

### 6.2 接入 Review Queue UI

Dreaming proposal 应该进入 Inbox/Review Queue 或 Agent Command Center：

- 展示 proposal type、risk、evidence。
- 提供 Confirm / Ignore / Snooze / Convert to task。
- 对每类 action 做 preview diff。

### 6.3 Schedule

当 manual run 稳定后，再接入 schedule：

- 默认 disabled。
- 用户选择 daily / weekly。
- run lock 防并发。
- 失败后保留 last error。
- 只允许写 artifacts，正文写入仍需确认。

### 6.4 Memory Store 版本化

参考 Managed Agents Dreams，未来可把 Dreaming 输出写成新的 memory snapshot：

```text
memory-store-v1
  -> dream run
  -> memory-store-v2
```

这样可以 diff、回滚、审计。

## 7. 验收标准

已覆盖：

- Dreaming run 生成 Light/REM/Deep 三阶段。
- broken link / stale / orphan / empty 可以生成 pending proposals。
- 所有 proposals 都 `requiresUserReview: true`。
- 默认写 `.mindos/dreaming` artifacts。
- dry run 不写 artifacts。
- scope 可以限制到指定 space。
- Dreaming 不修改用户笔记内容。
- Agent tool 标记为写类工具。
- MCP tool 可调用 `/api/dreaming`。

后续应补：

- API route 单测。
- Review Queue UI。
- LLM analyze mock test。
- schedule run lock test。
- artifact schema migration test。

## 8. 参考资料

- [OpenClaw Dreaming docs](https://docs.openclaw.ai/concepts/dreaming)
- [Anthropic Managed Agents Dreams](https://platform.claude.com/docs/en/managed-agents/dreams)
- [Harness Developer Hub](https://developer.harness.io/)
- [LangSmith Cron jobs](https://docs.langchain.com/langsmith/cron-jobs)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [MindOS Agent Command Center and Routines](../discussions/discussion-agent-command-center-and-routines.md)
