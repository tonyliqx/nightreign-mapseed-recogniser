# 单页合并 + 高级模式开关 设计文档

- 日期：2026-08-11
- 状态：待用户审阅
- 作者：Claude（brainstorming 产出）

## 1. 背景与动机

项目现有两个并行维护的前端应用版本：

| 版本 | 入口 | 逻辑类 | 数据层 |
|------|------|--------|--------|
| 基础版（中文为主） | `index.html` | `script.js` — `NightreignMapRecogniser` | `data.js` 内联 + JSON fetch |
| 高级版（英文为主） | `index-advanced.html` | `app-advanced.js` — `NightreignApp` | JSON fetch（`poi-data-advanced.js`） |

调查发现两版本**底层高度同构**：

- **数据源相同**：最终都依赖 `dataset/nightreignMapPatterns.json`。基础版 `loadSeedData()`（`script.js:53-94`）已从该 JSON 构建种子数据三件套（`SEED_REGISTRY` 身份 / `POI_SLOTS_BY_MAP` 槽位 / `SEED_POIS_RAW` 按坐标查 type）。
- **坐标系相同**：两版本数据空间都是 768（基础版用 1536 canvas + `setTransform(2,2)` 高清映射，高级版用 768 canvas 1:1）。
- **POI 选择本质相同**：都是「列出该坐标在剩余种子里的候选中文 type，点一个过滤」——基础版用 suggestion 浮窗，高级版用单层 context-menu（高级版的「双层菜单」是死代码，实际也是单层）。
- **底图懒加载机制相同**。

真正的差异只有 5 点：

1. **POI 的 category 过滤范围**——基础版只取 `landmark`（`script.js:75`），高级版取全部 5 类（`landmark` / `stronghold` / `fieldBoss` / `scaleMerchant` / `merchant`）。这是「只能点共享点位 vs 也能点 BOSS 点位」的全部来源，差一个 filter。
2. **UI 组织**——基础版单页双列（夜王+地形+POI 同画面），高级版多屏切换（selection→spawn→recognition）。
3. **移动端自动滚动**——基础版有 `scrollMapIntoView`（`script.js:551`），高级版完全没有。
4. **canvas 缓冲**——基础版 1536 高清、高级版 768。
5. **死代码**——高级版有大量死代码（`result-screen`、双层菜单 `generateTwoLayerMenu`、spawn 敌人选择均未接上）。

维护两套几乎相同的代码是明显技术债。合并成单页 + 开关可从源头消除。

> 注：CLAUDE.md 中「基础版分类（教堂/法师塔/村庄/空）」与「高级版分类（major base / minor base / field boss / evergaol / rotted woods）」均**已过时**。实际 POI category 为 NAME.xlsx 的 5 类：`landmark` / `stronghold` / `fieldBoss` / `scaleMerchant` / `merchant`。`evergaol` / `rotted woods` 只出现在 icon 文件名和地形名里，不是 category。

## 2. 目标

将两个版本合并为**单一页面应用**（`index.html`），新增一个「高级模式」开关：

- **开关关**（默认）：画布只加载 `landmark` category，行为与现有基础版完全一致。
- **开关开**：画布加载全部 5 类 category，等价于现高级版能力。

一套 JS / CSS / 数据 / i18n，消除双版本维护负担。

## 3. 决策记录

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| 总体方向 | 合并成单页 + 开关 | 保留双页对齐 UI / 共用 JS 双入口 | 底层同构，合并从源头消除技术债 |
| 代码基座 | 以基础版 `script.js` 为基座 | 以高级版为基座 | 基础版功能更全（移动端滚动、大空洞消歧、suggestion 浮窗、1536 高清），且已用 JSON；改动面最小 |
| 点位配色 | landmark 橙色突出、其余 category 金色 | — | 用户确认，沿用高级版 `app-advanced.js:875-877` 视觉，便于区分共享点位 vs 额外点位 |
| 开关默认 | 关 | 开 | 用户确认，保护现有基础版用户体验 |
| 入口形态 | 现有 `#switch-to-advanced-btn` 原地改造为 toggle 开关 | 新增开关位置 | 用户确认，复用原按钮位置，不新增 UI 元素 |

## 4. 设计

### §1 整体架构

- **唯一入口**：`index.html`。`index-advanced.html` 降级为重定向跳板（见 §6）。
- **开关位置**：现有 header 的 `#switch-to-advanced-btn`（`index.html:21`）原地改造为 toggle 开关，与语言切换、夜王反推按钮并列。不新增 UI 位置。
- **开关关**：画布只加载 `landmark` → 现有基础版行为，零变化。
- **开关开**：画布加载全部 5 类 category（`landmark` / `stronghold` / `fieldBoss` / `scaleMerchant` / `merchant`）→ 等价高级版能力。
- 一套 JS（`script.js` 改造）、一套 CSS（`styles.css` 增补）、一套数据（JSON）、一套 i18n（`translations.js` 合并）。

### §2 数据层

沿用基础版 `loadSeedData()`（`script.js:53-94`），它已从 `nightreignMapPatterns.json` 构建种子数据三件套。

**核心改动**：把 `script.js:75` 写死的 `.filter(p => p.category === 'landmark')` 改成由开关状态决定 category 集合：

- 开关关：`['landmark']`
- 开关开：`['landmark', 'stronghold', 'fieldBoss', 'scaleMerchant', 'merchant']`

**POI type 映射扩充**：基础版 `TYPE_ICON_MAP` / `TYPE_DISPLAY_MAP`（`script.js:12-25`，仅 6 种：church / rise / carriage / merchant / blessing / empty）并入高级版 `getCategoryDisplayName`（`app-advanced.js:1709`）及其 type→icon 映射，确保 stronghold / fieldBoss 等点位的候选 type 中文名与图标齐全。

**data.js 常量死活清单**（已核查，用于决定保留/清理）：

| 状态 | 常量 | 说明 |
|------|------|------|
| ✅ 活·须保留 | `POIS_BY_MAP` | 仅 `script.js:70` 一处真用（JSON landmark 按坐标最近邻继承 originalId 1-11） |
| ✅ 活·须保留 | `GH_DISAMBIG_POINTS` | 大空洞消歧点 A/B 坐标（`script.js:593,1257,1368,1610`） |
| ✅ 活·须保留 | `MAP_IMAGES` | 各地形背景图路径（`script.js:174`） |
| ✅ 活·须保留 | `ICON_ASSETS` | 仅用 `.empty` 一项（`script.js:145`） |
| ✅ 活·须保留 | `ICON_SIZE`(38)、`CANVAS_SIZE`(768) | 画布/绘制基准，多处引用 |
| ✅ 活·须保留 | `SEED_SPAWN`、`SPAWN_POINTS_BY_MAP` | 出生点（`script.js:1403,1410,1537`） |
| 🟡 仅注释 | `GH_DISAMBIG`、`seedDataMatrix` | 已弃用（区分值改动态读 JSON；身份由 `SEED_REGISTRY` 替代），仅注释提及 |
| ❌ 死代码 | `NIGHTLORDS`、`MAPS`、`HAS_REAL_SEED_DATA`、data.js 内 `loadSeedData()`(:17036) | script.js 零引用，可安全删 |
| 🚫 不存在 | `CLASSIFICATIONS`、`MAP_TYPES` | CLAUDE.md 过时描述，data.js 无定义 |

> data.js 内的 `loadSeedData()`（:17036）被 `script.js:53` 同名函数覆盖（`index.html` 中 script.js 在 data.js 之后加载），永不调用。

### §3 POI 选择交互（统一为一种）

- 开关开后，**所有 category 的点位统一走基础版 suggestion 浮窗** `showPOISuggestionAt`（`script.js:1755`）。浮窗逻辑本就与 category 无关（列该坐标在剩余种子的候选 type），直接复用。
- 移动端长按、右键/中键调浮窗、自动批量展示 `showAllPOISuggestions`（`script.js:1722`）、选完出生点后阈值触发——全部沿用，自动覆盖新增点位。
- **不保留**高级版的双层 context-menu（`generateTwoLayerMenu` 本就是死代码）。基础版浮窗的候选 type 读取逻辑（从 `SEED_POIS_RAW` + 剩余种子集合派生）本就与 category 无关，开关开后直接复用，无需移植高级版菜单逻辑。
- **出生点**：沿用基础版「同画布分阶段」（`spawnPhase`），不保留高级版独立 `spawn-screen` / `spawn-canvas`。出生点坐标仍走 `SEED_SPAWN` / `SPAWN_POINTS_BY_MAP`（data.js），无 per-seed 敌人数据（见 memory「spawn enemy 源+伪造值修复」）。

### §4 点位渲染（视觉区分）

- **开关关**：仅 landmark，样式不变。
- **开关开**：
  - **landmark（共享点位）**：橙色描边/光晕 + 放大 1.5x（参考高级版 `app-advanced.js:875-877` 的 1.5 倍 + `#ff8c00`），让用户一眼区分「共享点位 vs 额外点位」。
  - **stronghold / fieldBoss / scaleMerchant / merchant**：金色圆点（`#ffd700`）+ 对应 icon。
- **1536 高清 canvas 保留**（基础版优势）。

### §5 开关状态

- **持久化**：`localStorage`，key 如 `advanced-mode`（参考 `preferred-language` 模式），记住用户选择。
- **默认**：关。
- **URL 参数**：`?advanced=1` 打开页面时自动启用开关（供 `index-advanced.html` 重定向和老链接用）。
- **切换行为**：切换开关 = 重置当前会话（清空标记、按新 category 重建 `POI_SLOTS_BY_MAP`、重画）。参考 memory「换维度只重置画布、不清另一维度；updateGameState 须退出种子图模式」——切换开关须确保退出种子图模式（`showSingleSeed` 状态），避免状态错乱。

### §6 迁移与兼容

- **`#switch-to-advanced-btn` 原地改造**（`index.html:21`）：从跳转 `<button>` 改造为 toggle 开关。
  - 移除跳转逻辑（`script.js` 中该按钮的 click 监听改为 toggle 开关状态）。
  - i18n key `nav.advanced`（现「Advanced Mode / 地图缺失模式」）改为开关标签，如「高级模式 / Advanced」。
  - 开关样式：toggle on/off 视觉态，加到 `styles.css`。
- **`index-advanced.html`**：内容替换为一段 JS 重定向到 `index.html?advanced=1`（文件保留，外部老链接不碎）。
- **高级版资产**（`app-advanced.js` / `poi-data-advanced.js` / `styles-advanced.css` / `translations-advanced.js`）：抽出所需资产（type 映射、渲染参数、中文名）后标记废弃。**建议先保留不引用**，确认无回归后再物理删除。
- **`boss-reverse.html`**（夜王反推，`index.html:26`）：不受影响，保持原样。

### §7 i18n

- 高级版 `translations-advanced.js` 里 POI type 中文名、额外 category 名并入 `translations.js`。
- 开关标签 `nav.advanced` 改义（中英双语同步，`data-i18n`）。
- 中英双语对新增点位 type 必须齐全（参考 memory「高级版 POI 英文映射」——POI_TYPE_EN 渲染层映射 + NAME.xlsx 外部中英对照权威）。

### §8 风险与待验证

1. **大空洞消歧菜单**（disambig-menu-a/b）：开关开后加载了 stronghold/fieldBoss 等额外点位，`detectHasLandmarkCollision`（`script.js:571`）触发条件可能变化（`allMarked` 的判定、landmark type 向量重复检测）。须重新验证消歧在新 category 下仍正确。注意 `GH_DISAMBIG_POINTS.A` 本身就是 fieldBoss、B 是 stronghold——开关开后这些点会作为常规点位先被标记，可能影响消歧触发顺序。
2. **消除法归零 bug**（已知风险，见 memory）：点位 category 增多后候选 type 集合变大，须确认 `getAvailableOptions` / `checkPOIMatches` 每个候选种子仍正确贡献 type/Empty，不会误淘汰致归零。
3. **开关中途切换**：须确保切换时正确重置（见 §5），不残留旧 category 的标记。
4. **canvas 性能**：1536 + 更多点位图标，移动端实测。
5. **`originalId` 匹配**：基础版 `POIS_BY_MAP` 只覆盖 landmark 语义 id 1-11（`script.js:70`）。开关开后非 landmark 点位没有 originalId，须确认 suggestion 浮窗的防重叠偏移逻辑（依赖 originalId 1-11）对无 originalId 的点位不会出错。

## 5. 可选清理项（避免范围蔓延，列为可选）

合并过程中可顺手清理，降低 data.js 理解负担，但**不强制**：

- 删除死代码：`NIGHTLORDS`、`MAPS`、`HAS_REAL_SEED_DATA`、data.js 内 `loadSeedData()`(:17036)。
- 清理仅注释遗留：`GH_DISAMBIG`、`seedDataMatrix`（同步删 `script.js` 顶部相关注释）。
- 清理 `ICON_ASSETS` 中未被引用的 church/mage/village/carriage（仅保留 `.empty`）。

## 6. 验收标准

- [ ] **开关关**：行为与现基础版完全一致（夜王/地形/出生点/POI 标记/大空洞消歧/移动端滚动/结果展示全部回归零差异）。
- [ ] **开关开**：画布显示全部 5 类 category 点位；可点选 stronghold/fieldBoss/scaleMerchant/merchant；候选 type 中文名 + 图标正确；suggestion 浮窗对所有点位生效。
- [ ] **视觉区分**：开关开时 landmark 橙色突出、其余金色，肉眼可辨。
- [ ] **移动端**：自动滚动策略对额外点位同样生效；长按/短按交互正常。
- [ ] **开关状态**：localStorage 持久化；刷新后保持；`?advanced=1` 自动启用。
- [ ] **切换重置**：标记中途切换开关，正确清空标记 + 重画 + 退出种子图模式。
- [ ] **大空洞**：开关开下消歧菜单仍正确触发（须人工验证）。
- [ ] **入口兼容**：访问 `index-advanced.html` 重定向到 `index.html?advanced=1` 并自动开开关；header 开关 toggle 正常。
- [ ] **i18n**：中英双语下所有新增 type/category 中文名齐全。
- [ ] **消除法不归零**：开关开下标记任意 POI 不会导致候选种子误归零。
