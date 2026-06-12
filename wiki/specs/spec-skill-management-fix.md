# Spec: Skill Management Fix — 统一 (skill × agent) 矩阵与符号链接传导

> Status: **Implemented** —— 2026-06-13 完成（as-implemented 文档，以实际落地实现为准）
> Date: 2026-06-13（原始草稿 2026-06-11，实现过程中大量演进，见「方案」「边界 case」）
> 关联: `wiki/archive/task-spec-mcp-skill-gui.md`（已归档标记"已完成"，其 Skill 管理部分的回归即本 spec 起因）
> Scope: **仅 Skill 管理。MCP server 配置（`mcpServers` 条目读写）完全不在范围内**；`mcp-install.ts` 的改动仅限剥离混入的 skill 副作用。
>
> **用户决策记录**（实现中与原草稿的三处显式偏离/确立）：
> 1. **builtin 不加禁用限制**：原草稿计划"禁止从 MindOS 自身禁用 builtin skill"（含验收项 `disabling a builtin skill for MindOS itself is rejected`），用户决策不加此限制——`toggle` 对所有 skill 一视同仁，该验收项移除。
> 2. **agent 自有 skill 只读化**：`~/.agents/skills`（共享池）与 custom 路径（如 `~/.codex/skills`）指向外部 agent 自己的目录，其中的 skill 在 MindOS 中降级为只读展示（`source: 'builtin'`、`editable: false`，无 Edit/Delete，管理权归 agent 自己）；新 skill 应在 MindOS 托管根（`{mindRoot}/.skills`）创建，再经矩阵 link 暴露给各 agent。
> 3. **停用 = 可逆停放而非删除**：agent 自有技能的"停用"是把目录整体移入 `{skillDir}/.mindos-disabled/` 暂存（所有 agent 扫描器都跳过点开头目录），恢复 = 原样移回，本体零改动、永不删除。

---

## 目标

让 GUI 上对 skill 的每一次安装/卸载/停用操作**真正传导到下游 agent 的文件系统**（agent 看得到、用得到、卸得掉），并把 Settings chips、Agents 页 By Skill / By Agent、Agent 详情页等所有视图收敛到**同一个 (skill × agent) 启用矩阵**之上——单一事实源 = 文件系统链接存在性，MindOS 自身作为矩阵中的 self 列一并纳入，使"视图不一致"在构造上不可能。

## 现状分析

### 修复前（原草稿坐实的根因）

1. **两套割裂的开关机制**：机制 A（`~/.mindos/config.json` 的 `disabledSkills`，只管 MindOS 自身注入 system prompt）与机制 B（`installedSkillAgents[]` 记账，本应把 skill 暴露给下游 agent）各自为政，无统一模型。
2. **三条安装链路、卸载全部残缺**：
   - `POST /api/skills { action: 'record-install' }` 只往 `installedSkillAgents[]` 记账，**零文件操作**，无卸载分支；
   - `POST /api/mcp/install` 的 `recordInstallSideEffects` 只对 `unsupported` 模式 agent 真实拷贝，`additional` 模式只 `mkdirSync` 空目录；对应 uninstall 只删 MCP server 配置条目、**不清理已拷贝文件**；
   - `POST /api/mcp/install-skill` 硬编码只支持 `mindos`/`mindos-zh`，无卸载。
   - 结果：**既装不上也卸不掉**——操作后下游 agent 的 skill 目录文件没有任何增减。
3. **两个视图接了不同状态源**：Skill 视图（`McpSkillsSection`）只读 `disabledSkills`，Agent 视图（`McpAgentInstall`）只走静态注册表 + 一次性安装，不存在 per-cell 持久化矩阵。
4. `settings.ts` 只有 `recordSkillInstall`，没有任何移除记录的函数。

### 实现过程中暴露的新问题（同样在本次修复）

- **自链自毁**：skill 本体住在目标 agent 的 skill 目录里时（典型：universal agent 共享池 `~/.agents/skills` 同时是 skill root），link/迁移会先删本体再建指向自身的悬空环——已在真实环境复现并损坏 `~/.agents/skills/mindos`。
- **停放失踪**：技能本体目录同时是 MindOS 技能根（如 `~/.codex/skills`）时，停放会把它移出根目录，从列表和矩阵中彻底消失且无恢复入口。
- **universal 私房盲区**：Codex 等 universal agent 除共享池外还有自己的私房目录（`~/.codex/skills`）；不感知它会把"agent 自带的技能"误判为未启用，对它执行 link 会向共享池泄漏一条对所有 universal agent 可见的链接。
- **幽灵 agent**：注册表中所有 universal 模式 agent（含未安装的 kilo-code/kimi/cline 等）因扫描同一个共享池而被列为技能拥有者，且无法移除。
- **stdio MCP 启动崩溃**：打包运行时（`~/.mindos/runtime`）附带 `src/` 但没有 monorepo 构建脚本，`package.json` 落盘晚于 MCP bundle 导致每次 `mindos mcp` 启动都触发注定失败的重建，且 "Rebuilding…" 打到 stdout 污染 JSON-RPC 流（客户端报 `invalid character 'R'`）。

## 数据流 / 状态流

**单一事实源 = 文件系统**。矩阵不持久化、不缓存任何启用状态，每次读取都从磁盘现算；`installedSkillAgents[]` 记账被一次性迁移后删除。

```
读路径（谁读）
══════════════════════════════════════════════════════════════════
  文件系统（唯一权威，四个判定来源）
    ① {agentSkillDir}/{skill}                共享池 / additional agent 目录
    ② {nativeSkillDir}/{skill}               universal agent 私房目录（如 ~/.codex/skills）
    ③ {dir}/.mindos-disabled/{skill}         可逆停放区（①②各自一份）
    ④ ~/.mindos/config.json → disabledSkills 仅供 MindOS self 列
         │
         │  per-cell 判定链（statusInDir × cellDirsOf 双目录）：
         │    lstat {dir}/{skill}
         │      ├─ 不存在   → ③有停放? → native-disabled : none
         │      ├─ symlink  → stat 解引用为目录? → linked : broken
         │      ├─ 真实目录 → 含 .mindos-managed? → copied : conflict(agent 自有，实际在加载)
         │      └─ 其他文件 → conflict
         │    cellDirsOf(agent) = [skillDir(共享池优先), nativeSkillDir(私房)]，
         │    依序判定，首个非 none 即该格状态
         │    enabled = linked | copied | conflict
         ▼
  buildSkillMatrix()                     packages/mindos …/skill-links.ts
    · 第一列恒为 self（mindos）：enabled = !disabledSkills.includes(name)
    · 并入"仅存在于停放区"的技能（collectParkedOnlySkills，防失踪）
         ▼
  GET /api/skills/matrix                 （首次访问顺带执行遗留 copy 安装 → symlink 迁移）
         ▼
  ┌───────────────────────────────────────────────────────────────┐
  │ useSkillMatrix hook（监听 mindos:skills-changed 自动重拉）       │
  │   ├─ Agents 页 By Skill（AgentsSkillsSection，持有 hook）        │
  │   │    └─ By Agent 卡片（AgentsSkillsByAgent，经 props 接矩阵）  │
  │   └─ Agent 详情页 + 详情弹窗（AgentDetailContent）              │
  │ Settings Skills 区（McpSkillsSection 本地 refreshMatrix，       │
  │   同一接口 → SkillRow 展开后的 per-agent chips）                │
  └───────────────────────────────────────────────────────────────┘

写路径（谁写）
══════════════════════════════════════════════════════════════════
  任一视图点击格子
         │  nextSkillCellAction(status)（lib/skill-cell-actions.ts，三视图共用）：
         │    linked/copied      → unlink
         │    conflict           → disable-native（停放，可逆）
         │    native-disabled    → enable-native（恢复）
         │    none/broken        → link（broken 先清悬空再重建）
         ▼
  POST /api/skills { action, name, agentKey }     （self 列仍走 action:'toggle' 写 disabledSkills）
         ▼
  handleSkillsPost → setSkillLinked
         ├─ link            → linkSkillToAgent      建 symlink → junction → copy+marker
         ├─ unlink          → unlinkSkillFromAgent  删链接/标记副本/无损副本
         ├─ disable-native  → disableNativeSkill    renameSync 进 .mindos-disabled/
         └─ enable-native   → enableNativeSkill     renameSync 移回原位
         ▼
  文件系统变更（与读路径同一权威）
         ▼
  window.dispatchEvent('mindos:skills-changed')
         ▼
  所有 useSkillMatrix 消费者重拉矩阵 → 三视图同步，无任何中间缓存层
```

## 方案

### 1. 核心引擎：`packages/mindos/src/server/handlers/skill-links.ts`（新建）

纯函数 + 文件系统，无外部状态。导出：

- 常量：`MINDOS_MANAGED_MARKER`（`.mindos-managed`，copy fallback 副本识别标记）、`MINDOS_DISABLED_DIR`（`.mindos-disabled`，停放目录）、`MINDOS_SELF_AGENT_KEY`。
- 读模型：`getSkillCellStatus` / `isSkillCellEnabled` / `buildSkillMatrix`（格子状态六态：`linked | copied | broken | conflict | native-disabled | none`；self 列另用 `enabled | disabled`）。
- 写操作（全部返回 `MindosSkillLinkOutcome`，幂等）：
  - **`linkSkillToAgent`**：私房目录已有本体 → `already`（绝不向共享池泄漏）；私房/共享池有停放副本 → 就地恢复而非建链遮蔽（停放副本可能是唯一本体，故此检查先于 source 解析）；source 解析（user root 优先于 builtin root，支持 frontmatter name ≠ 目录名）；**source 与 link 同路径 → no-op（防自链自毁）**；悬空链接 → 清理重建；内容一致的遗留拷贝 → 就地转为链接；内容不一致的真实目录/文件 → 409 conflict 拒绝覆盖；`mkdirSync` 补齐目录后 `symlink('dir')` → Windows 下失败再试 `'junction'` → 仍失败 `cpSync` + 写入 `.mindos-managed` 标记。
  - **`unlinkSkillFromAgent`**：在 `cellDirsOf`（共享池优先、私房其次）中找到实际持有该条目的目录操作；symlink → 只删链接本身（永不递归删 target）；带标记副本 → 安全删除；**无标记但内容与本体逐字节一致的副本（旧 copy 链路产物）→ 无损删除**；内容有差异 → 409 拒删。
  - **`disableNativeSkill` / `enableNativeSkill`**：`renameSync` 整体移入/移出 `.mindos-disabled/`；对 MindOS 托管链接拒绝停用（应走 unlink）；恢复时原位被新目录占用 → 409；停放目录空了顺手 `rmdirSync`。
- 迁移：`migrateInstalledSkillAgents`——遍历遗留记录，内容一致的拷贝替换为 symlink、用户改过的保留并写入 managed 标记 + warn、install path 即本体的跳过（防自毁）、单条失败不抛出。
- 错误码映射（`skills.ts`）：缺 `name`/`agentKey` → 400，`skill-not-found`/未知 agent → 404，`conflict` → 409，`io-error` → 500。失败一律显式报错，不静默成功。

### 2. 统一读接口：`GET /api/skills/matrix`

mindos http server（`server/http.ts`）与 Web route（`app/api/skills/matrix/route.ts`）双实现，均返回 `{ skills, agents, state, cells }`：`agents[0]` 恒为 `{ key: 'mindos', mode: 'self' }`，其余为 `resolveSkillLinkAgents` 解析出的本机存在、skill-capable（universal/additional）的下游 agent；`unsupported` 模式与缺席 agent 不出现。Web 侧 `listSkillLinkAgents` 额外并入 custom agents（按其 `skillDir`/`baseDir/skills`，additional 模式）。universal agent 的私房目录（hiddenRoot + `/skills` ≠ 共享池时）记入 `nativeSkillDir`。首次访问矩阵时执行一次性迁移（见 §5）。路由契约（`contract.ts` / `route-ownership.ts`）与 `wiki/30-api-reference.md` 同步登记。

### 3. 统一写接口：`POST /api/skills` 五个 action

`link` / `unlink` / `disable-native` / `enable-native` 四个新 action 走 §1 引擎；`toggle`（self 列，写 `disabledSkills`）保留原语义且**不加 builtin 限制**（用户决策 1）；`record-install` 仅作兼容保留。前端三视图共用 `lib/skill-cell-actions.ts` 的 `nextSkillCellAction`（状态→动作映射）与 `postSkillCellAction`（POST + 派发 `mindos:skills-changed` 事件）。

### 4. 三视图同源改造

- **Settings Skills 区**：`McpSkillRow` 展开后新增 per-agent chips（`McpSkillAgentChips`，新建）——linked/copied 高亮、broken 警示点击重链、conflict 虚线 amber（agent 自有，点击停放）、native-disabled 虚线灰（点击恢复）；对 universal agent 的"开启"附共享池提示；additional 模式操作成功 toast"下次启动生效"。来源标注：`agents-global`/`custom` origin 标 **Agent-owned**（不再误标 Built-in），非内置 skill 旁显示本体来源文件夹（`lib/skill-source.ts`，`~` 缩写、悬停全路径）。
- **Agents 页 By Agent**：每张卡 = 矩阵的一**列**，三组展示（已启用 / 已停放常驻，"可链接"折叠收纳），行级开关按格子状态自动选动作，状态徽章（Linked / Agent 自有 / 已停放 / 已损坏）；全局 MindOS 开关只留在 MindOS 自己的卡片上；缺席 agent 不显示共享池扫描结果；"来自 MindOS 的链接"与"原生技能"分组。
- **Agents 页 By Skill**：技能卡拥有者头像只统计本机 `present` 的 agent（幽灵 agent 过滤）；「移除 agent」从空操作改为真实 `unlink`（agent 自有本体 → 改走 `disable-native` 停放；409 → 提示到 agent 目录管理）；「+ 添加 agent」对 MindOS 管理的 skill 走统一 `link`，原生 skill 跨 agent 复制保留旧 copy-skill 链路。
- **Agent 详情页 + 详情弹窗**（`AgentDetailContent`）：行内 per-agent 开关替代全局开关（MindOS 详情页除外），availability 按**本体位置**判定（`agents-global` → Global、`custom` → Native private、托管未链接 → `unlinked`/"仅 MindOS"、已链接 → Linked），修复 0 链接技能误标 Global。
- 共享 `hooks/useSkillMatrix.ts`：监听 `mindos:skills-changed` 自动重拉，挂载即取。

### 5. 一次性迁移与旧链路退役

- 首次 `GET /api/skills/matrix` 时把遗留 `installedSkillAgents[]` 迁移为 symlink（§1 `migrateInstalledSkillAgents`），成功后清空记账字段（`clearInstalledSkillAgents`）；迁移失败只 warn、不阻塞请求、记录留待下次重试。
- `recordSkillInstall` 写函数从 `web/lib/settings.ts` 移除，替换为只读的 `readInstalledSkillAgents` + `clearInstalledSkillAgents`（仅供迁移）。
- `POST /api/mcp/install` 的 `recordInstallSideEffects`（skill 拷贝 + 记账）整体删除，MCP config 写入/transport 协商/uninstall 原样不动；前端 `McpAgentInstall` 在 Install 成功后对每个 skill-capable agent 追加调用统一 `link`（MCP 安装与 skill 链接是独立步骤，link 失败不回滚 MCP 安装），additional 模式附重启提示。

### 6. 顺带修复（同分支落地）

- **stdio MCP 启动崩溃**（`bin/lib/mcp-build.js`）：monorepo 构建脚本不存在（打包运行时）→ 直接信任随包 bundle、跳过重建；重建进度从 `console.log` 改为 `console.error`——stdio transport 下任何 stdout 杂音都会污染 JSON-RPC 流。
- **共享 skill 根只读化**（`server/runtime.ts`）：`agents-global` 与 `custom` 根降级为 `source: 'builtin'` / `editable: false`（用户决策 2）。
- **dev server 端口僵尸 / dist 重建撞车**：流程层面解决，无代码变更——记入 `wiki/41-dev-pitfall-patterns.md` 规则 10（重建被 dev server 消费的包之前先停 dev server；撞坏后清 `.next` 重启）。

### 7. 明确不在范围（沿用原草稿第八节）

- MCP server 配置的读写逻辑（`mcpServers` 条目增删）一概不碰。
- Skill marketplace / 在线安装。
- Skill 版本管理。
- 改动 skill 本体内容（本 spec 只做"暴露/隐藏/停放"，不编辑 skill 文件）。

## 影响范围

### 新建文件（11）

| 文件 | 角色 |
|------|------|
| `packages/mindos/src/server/handlers/skill-links.ts` | 核心引擎：链接/停放/矩阵/迁移 |
| `packages/mindos/src/server/handlers/skill-links.test.ts` | 引擎规格测试（46 条） |
| `packages/web/app/api/skills/matrix/route.ts` | Web 侧矩阵读接口 + 迁移触发 |
| `packages/web/hooks/useSkillMatrix.ts` | 共享矩阵 hook（事件驱动重拉） |
| `packages/web/lib/skill-cell-actions.ts` | 格子状态→动作映射 + 统一写调用 |
| `packages/web/lib/skill-source.ts` | 本体来源文件夹推导/缩写 |
| `packages/web/components/settings/McpSkillAgentChips.tsx` | Settings per-agent chips |
| `packages/web/__tests__/agents/agents-skills-section.test.tsx` | Agents 页视图规格（11 条） |
| `packages/web/__tests__/settings/mcp-skill-views-consistency.test.tsx` | 双视图一致性规格（2 条） |
| `packages/web/__tests__/api/skills-matrix.test.ts` | 矩阵 route 测试 |
| `packages/web/__tests__/core/skill-link-agents.test.ts` | agent 解析测试 |

### 修改文件（36，`git diff origin/main --stat`）

- **mindos 包（后端）**：`handlers/skills.ts`（4 个新 action + `handleSkillMatrixGet` + `collectSkillInfos` 抽取）、`handlers/mcp-agents.ts`（`resolveSkillLinkAgents` + `nativeSkillDir` 解析）、`handlers/mcp-install.ts`（删除 `recordInstallSideEffects` 及相关 services 字段）、`http.ts`（矩阵路由 + 迁移 + `listLinkAgents` 注入）、`index.ts`（导出面）、`contract.ts` / `route-ownership.ts`（路由登记）、`runtime.ts`（共享根只读化）、`bin/lib/mcp-build.js`（打包运行时守卫 + stderr）、`server.test.ts` / `server.settings-protocols.test.ts`。
- **web 包（前端）**：`lib/mcp-agents.ts`（`listSkillLinkAgents`，含 custom agents）、`lib/settings.ts`（`recordSkillInstall` → 只读迁移辅助）、`app/api/skills/route.ts`（注入 `listLinkAgents`）、`app/api/mcp/install/route.ts`（剥离 skill 副作用 services）、`components/settings/{McpSkillsSection,McpSkillRow,McpAgentInstall,types}.tsx|ts`、`components/agents/{AgentsSkillsSection,AgentsSkillsByAgent,AgentDetailContent,agents-content-model}.tsx|ts`、i18n（`panels-en/panels-zh/settings`）、相关测试与 `__tests__/setup.ts`。
- **文档**：`wiki/30-api-reference.md`、`wiki/41-dev-pitfall-patterns.md`（规则 10）、`wiki/90-changelog.md`。
- **其他**：`tests/unit/mcp-build.test.ts`。

### 不受影响的模块及原因

- **MCP server 配置读写**：`handleMcpInstallPost` 的 config 路径解析、transport 协商、`handleMcpUninstallPost` 全部原样——本次只删除了其中混入的 skill 副作用函数。
- **`/api/ask` 注入链路**：`disabledSkills` 的读取语义未变，self 列只是把它投影进矩阵。
- **skill 编辑/创建/删除（MindOS 托管根）**：`read`/`save`/`delete` 等 action 未动；只读化仅影响 agent 自有根的 `editable` 标记。
- **copy-skill 链路（原生 skill 跨 agent 复制）**：保留——仅 MindOS 管理的 skill 的 add-agent 入口从 copy 切到 link。
- **`mcp-install-skill.ts`（npx skills add 链路）**：未改动，CLI 模式照旧。

### 是否破坏性变更

无对外 API 破坏（`/api/skills/matrix` 与四个 action 均为纯新增；`toggle`/`record-install` 兼容保留）。三处**有意的行为变化**：① `installedSkillAgents[]` 迁移后从 config.json 清除（纯内部记账，无外部消费者）；② `POST /api/mcp/install` 不再有 skill 拷贝/记账副作用（前端已同步改造为显式 link）；③ agent 自有 skill 在 GUI 中变为只读（用户决策 2）。

## 边界 case 与风险

实现中真实处理过的边界（每条均有对应测试，见验收标准）：

1. **自链自毁**：skill 本体就在目标 agent 的 skill 目录里（共享池同时是 skill root）→ link 与迁移在 `resolve(linkPath) === resolve(sourceDir)` 时一律 no-op，绝不先删后链。
2. **停放目录 = 技能根**：本体目录同时是 MindOS 技能根（如 `~/.codex/skills`）时停放会让技能从所有列表消失 → 矩阵并入各 agent `.mindos-disabled` 中"仅存在于停放区"的技能（self 格判 disabled），UI 始终保有恢复句柄。
3. **universal 私房盲区**：Codex 等 agent 的私房 `~/.codex/skills` 与共享池并存 → `nativeSkillDir` 双目录判定链；私房本体显示"已启用（Agent 自有）"，对它 link 返回 `already`、绝不向共享池泄漏；停放/恢复在私房目录就地进行。
4. **幽灵 agent**：未安装的 universal agent 因共享池被列为技能拥有者 → 矩阵与拥有者头像只统计本机 `present` 的 agent。
5. **悬空链接**：target 已删/移走 → 格子报 `broken`（不算启用），重链先 `unlinkSync` 清掉再建，幂等。
6. **内容不一致拷贝**：unlink 对无标记副本先做逐字节内容比对——与本体一致（旧 copy 链路产物）才无损删除，有差异（用户改过）一律 409 拒删；迁移同理：改过的副本保留 + 写 managed 标记 + warn。
7. **Windows junction / copy fallback**：`symlink('dir')` 失败 → win32 降级 `'junction'`（免提权）→ 仍失败 `cpSync` + `.mindos-managed` 标记（卸载凭标记识别副本，不误删用户本体）；测试经 `MindosSkillLinkDeps` 注入模拟平台/失败。
8. **stdio stdout 污染**：MCP stdio transport 下重建提示打到 stdout 会损坏 JSON-RPC 流 → 构建脚本缺失时信任随包 bundle、重建进度一律走 stderr。
9. **用户手放真实目录冲突**：link 目标位置已有非托管真实目录且内容与本体不一致 → 409，不覆盖；UI 对 conflict 格提供"停放"而非"删除"。
10. **目录不可写/不存在**：返回显式 `io-error`（500），不静默成功；agent 在但 `skills/` 子目录不在 → 自动 `mkdirSync`。
11. **停放/恢复占位冲突**：停放时 `.mindos-disabled/{skill}` 已存在 → 409 要求先处理；恢复时原名被新目录占用 → 409 拒绝覆盖；活动条目与停放副本并存 → 显式恢复处理而非静默搁置。
12. **多 agent 隔离**：同一 skill 链到多个 agent，卸载其中一个不影响其他。
13. **dev server 端口僵尸 / dist 重建撞车**（流程层面）：dev server 运行期间重建 workspace 包 dist 会把半成品解析结果烙进 webpack 缓存（连带僵尸进程占端口）→ 无代码修复，固化为 `wiki/41-dev-pitfall-patterns.md` 规则 10（先停 dev server、撞坏后 `rm -rf .next` 重启）。

已知风险与 mitigation：

- **additional 模式 agent 仅启动时扫描**，链接变化非热加载 → 所有写操作成功后 UI toast"将在 agent 下次启动时生效"。
- **copy fallback 副本会随本体演进而过期** → 副本带 `.mindos-managed` 标记可识别可重建；symlink 为绝对主路径，copy 仅最后兜底。
- **迁移半途失败** → 单条 try/catch 不中断、整体失败只 warn 不阻塞矩阵请求、记录保留待下次访问重试。
- **共享池写入对所有 universal agent 可见** → universal agent 的"开启"操作附显式提示。

## 验收标准

> 用例名即规格。共 **67** 条，2026-06-13 在本分支 `vitest run` 全部通过（46 + 8 + 11 + 2）。

### 链接引擎与矩阵 — `packages/mindos/src/server/handlers/skill-links.test.ts`（46 条）

- [x] `linking a skill to an agent creates a symlink in that agent's skill directory pointing to the skill body`
- [x] `the downstream agent discovers and loads a newly linked skill on its next scan`
- [x] `unlinking a skill removes only the link, leaving the skill body untouched`
- [x] `the downstream agent no longer loads an unlinked skill on its next scan`
- [x] `linking falls back to a junction on Windows, and to a copy when linking is unavailable`
- [x] `copy fallback places a .mindos-managed marker inside the copied directory for identification`
- [x] `unlinking a copy-fallback skill removes the copied files but never the original body`
- [x] `linking the same skill to one agent does not affect its state in other agents`
- [x] `link/unlink is idempotent (re-linking an existing link, or unlinking a missing one, succeeds without error)`
- [x] `unlinking a builtin skill from a downstream agent succeeds (only the downstream link is removed)`
- [x] `a dangling symlink (target removed) is reported as disabled or broken in the matrix, and re-linking replaces it cleanly`
- [x] `linking to a path where a real (non-symlink) directory already exists returns a conflict error without overwriting`
- [x] `unlinking a real directory without the managed marker is refused`
- [x] `linking a skill whose body already lives inside the agent skill directory is a no-op that never deletes the body`
- [x] `unlinking an unmarked copy that is content-identical to the body removes it safely`
- [x] `unlinking an unmarked copy with diverged content is still refused even when skill roots are known`
- [x] `linking converts a content-identical legacy copy into a link instead of failing`
- [x] `link on an unwritable agent directory returns an explicit error, not silent success`
- [x] `disabling a native skill parks it under .mindos-disabled so the agent stops loading it, body untouched`
- [x] `re-enabling restores the directory exactly and the agent loads it again`
- [x] `disable and enable are idempotent`
- [x] `refuses to disable a MindOS-managed link (unlink is the right operation)`
- [x] `re-enabling is refused when a new directory occupies the original name`
- [x] `the matrix reports a disabled native skill as native-disabled (off), and link restores it instead of shadowing`
- [x] `a skill shipped in the agent's own dir reports as natively ON, not none`
- [x] `linking it to that agent is a no-op — the shared pool must stay clean`
- [x] `disabling parks it inside the agent's own dir, and the pool stays untouched`
- [x] `turning it back on restores the original dir instead of creating a pool link`
- [x] `unlink removes a managed link from whichever dir holds it`
- [x] `a parked skill whose body dir doubles as a skill root STAYS visible in the matrix and is restorable`
- [x] `a skill absent from its own dir still links into the pool as usual`
- [x] `prefers a user root over a builtin root when both contain the skill`
- [x] `resolves a skill whose frontmatter name differs from its directory name`
- [x] `returns null for an unknown skill`
- [x] `the skill-centric view and the agent-centric view report the same enabled state for every (skill, agent) cell`
- [x] `toggling MindOS's own skill updates disabledSkills and is reflected identically in both views`
- [x] `unsupported-mode agents do not appear in the skill matrix`
- [x] `link and unlink round-trip through the handler`
- [x] `link/unlink on a missing or unknown agent returns an explicit error, not silent success`
- [x] `link of an unknown skill returns 404 and a conflict returns 409`
- [x] `link/unlink without name or agentKey is rejected`
- [x] `replaces a content-identical legacy copy with a symlink to the body`
- [x] `keeps a user-modified copy untouched, marks it managed, and warns`
- [x] `skips absent agents and missing paths without throwing`
- [x] `skips a record whose install path is the skill body itself, leaving the body untouched`
- [x] `leaves an already-migrated symlink alone`

### Settings Skill 视图 — `packages/web/__tests__/settings/mcp-skills-section.test.tsx`（8 条）

- [x] `keeps the switch state and shows an error when store toggle fails`
- [x] `renders one agent chip per external matrix agent, mirroring each cell state`
- [x] `links an unlinked agent and unlinks a linked agent via the chips`
- [x] `parks an agent-owned skill via disable-native when its conflict chip is clicked`
- [x] `restores a parked native skill via enable-native when its chip is clicked`
- [x] `relinks a broken cell and toasts a restart hint for additional-mode agents`
- [x] `shows the link error inline on the skill row when the API rejects`
- [x] `shows a muted empty hint when no external agent supports skills`

### Agents 页视图 — `packages/web/__tests__/agents/agents-skills-section.test.tsx`（11 条）

- [x] `the by-agent card shows per-agent matrix toggles with state badges, unmanaged natives listed read-only`
- [x] `toggling a linked cell on the agent card unlinks it through the unified write interface`
- [x] `a parked-only skill (vanished from the skill list) still shows on the agent card via the matrix union`
- [x] `a parked native skill shows as Parked on the agent card and toggling restores it`
- [x] `the by-agent view shows no installed skills for agents absent from this machine`
- [x] `agents not present on this machine never appear as skill owners`
- [x] `removing a linked agent from a skill unlinks it through the unified write interface and refreshes`
- [x] `removing an agent-owned skill parks it via disable-native instead of refusing`
- [x] `an agent-owned real directory (409 conflict) falls back to the agent-owned hint instead of deleting`
- [x] `adding an agent to a MindOS-managed skill links it through the unified write interface`
- [x] `adding an agent to a native skill still goes through the copy-skill route with its source path`

### 双视图一致性 — `packages/web/__tests__/settings/mcp-skill-views-consistency.test.tsx`（2 条）

- [x] `the skill-centric chips report exactly the enabled state of the shared matrix cells`
- [x] `both views emit identical link writes for the same (skill, agent) cell`
