# 全链路 1536 坐标迁移设计

日期：2026-08-18
状态：已确认（用户拍板三项决策）

## 背景

基础版历史数据空间为 768px。`6883310`（2026-08-08）做了画布清晰化：canvas 物理分辨率升 1536，但通过 `setTransform(2)` 映射 768 数据空间，**数据层未迁移**。由此形成双体系：

- 基础版 data.js：768 空间
- 高级版 nightreignMapPatterns.json：1536 空间（= 768 × 2）
- script.js 内部：从高级版 JSON 拉数据时 ×0.5 转回 768（桥）
- Python 管线：768 为权威源，写高级版时 ×2

代价：每次坐标改动要维护两套值（昨日大空洞落地点校准即如此），768/1536 换算散落 7 个脚本。

## 目标

消灭 768 数据体系：data.js 活坐标、script.js 渲染层、Python 管线全部统一 1536 空间。×2 换算从此只存在于历史提交。

## 决策记录（用户确认）

| 决策点 | 结论 |
|--------|------|
| dataset.json | **瘦身**：删 poiDatabase（320 种子 768 坐标，零消费方），保留 classifications（integrate_dlc.py Rosetta 学习 + 4 个分析脚本在用；写回逻辑已验证兼容瘦身） |
| Python 管线 | **全量同步** 1536 口径，重跑任何生成脚本不回退 |
| 验证 | 程序化逐值 diff + 用户人眼比对 |

## 改动清单

### A. data.js（数据 ×2）

- `POIS_BY_MAP`（6 地形 POI 槽位 x/y）：×2
- `GH_DISAMBIG_POINTS`（A/B 消歧点）：×2
- `SPAWN_POINTS_BY_MAP`（12 出生点 x/y）：×2
- `CANVAS_SIZE = 768` → `1536`；`ICON_SIZE = 38` → `76`
- `seedDataMatrix` / `SEED_SPAWN`：无坐标，不动（seedDataMatrix 虽弃用但 integrate_dlc.py:124 依赖其 [2] 列读 mapType，删除另行立项）

### B. dataset.json（瘦身）

- 删除 `poiDatabase` 键（含 320 种子坐标）
- 保留 `classifications` 及元信息键
- `currentSeed` / `currentNightlord` / `currentMapType` 等应用状态键：一并清理（应用已不读）

### C. script.js（渲染层 1536 化）

- 删除 4 处 `setTransform(2)`（~615/658/681/1078），canvas 1536 与数据 1536 恒等
- 点击/长按换算：`(canvas.width / 2) / rect.width` → `canvas.width / rect.width`（长按指示器 scaleX/scaleY 等）
- `buildPOISlots` 桥：poiLookupByMapType（1536）×0.5 转 768 的逻辑删除，`POI_SLOTS_BY_MAP` 直接 1536
- `COORD_EXCLUDE_BY_MAP`：本就是 1536 空间（匹配 poiLookupByMapType 原始值），**不动**——迁移后反而空间统一
- `POI_RENDER_OVERRIDE`（方向覆盖表）：坐标 ×2，容差 ±3px → ±6px（同物理距离）
- 768 逻辑空间绘制字面量 ×2：9 处字号（28/18/14/11/20/16px…）、边框 10→20、标题栏 40→80、文字偏移（-60/-20/+20/+30…）、长按指示器 -30→-60 等
- 注释更新：script.js:4/6 等「768 权威」表述改为 1536

### D. Python 管线（1536 口径）

| 文件 | 改动 |
|------|------|
| `dataset/dlc-params/spawn_calib.json` | 值 ×2（768→1536） |
| `calibrate_spawn.py` | `transform_coord_*(…, 768)` → 1536 |
| `integrate_dlc.py` | 读 POIS_BY_MAP（:156 注释 768）与写 SPAWN_POINTS_BY_MAP/POIS_BY_MAP GH 片段改 1536 口径 |
| `tools/build_advanced_json.py` | `SPAWN_768` → `SPAWN_1536`，×2 写 JSON 改直接写 |
| `tools/render_terrain_cats.py` | 源 1536 后 `SPAWN_SCALE = 2` → 1（或删） |
| `tools/render_default_cats.py` | 同上口径检查 |
| `tools/generate_poi_maps.py` | 注释「坐标 768 背景 1536 渲染 ×2」→ 直接 1536 |
| `tools/export_full_seed_csv.py` | viewer 分数 = 基础坐标÷768 → 1536÷1536（分数值不变，等价改写） |

## 不做什么

- **poi-viewer 外部仓库**：其落地点基准取自基础版 768 值，迁移后需用户另行同步（本次仅在完成后提醒）
- **高级版**：本就 1536，零改动
- **seedDataMatrix 删除**：integrate_dlc 依赖，另行立项
- **4 个读 classifications 的分析脚本**（eval_basic_remap / inspect_representative / inspect_seed / quantify_spawn_ambiguity）：继续可用，不动

## 验证计划

1. **程序化 diff（我来）**：
   - 迁移前备份 data.js / dataset.json
   - 脚本断言：新 data.js 坐标 == 旧 ×2（逐值，POIS_BY_MAP/GH_DISAMBIG/SPAWN_POINTS/POI_RENDER_OVERRIDE）
   - dataset.json：classifications 与旧文件逐字节等价；poiDatabase 不存在
2. **渲染等价（数学）**：旧 768 + setTransform(2) ≡ 新 1536 + 恒等，最终物理像素坐标一致
3. **人眼比对（用户）**：6 地形出生点圆点、POI 图标、浮窗位置/方向覆盖、长按指示器、标记→消除法计数抽查

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| script.js 字面量 ×2 遗漏（视觉偏小一半） | 人眼比对兜底；逐段 diff 审查 |
| Python 脚本改漏口径 | 全文 grep `768` 复查；渲染工具出图抽查 |
| poi-viewer 未同步 | 完成后明确提醒，不同步则 viewer 分数基准过期 |
| 分支合并冲突（迁移期间 master 有改动） | 迁移分支短周期完成，只动坐标相关文件 |
