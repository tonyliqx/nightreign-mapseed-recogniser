# 单页合并 + 高级模式开关 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把基础版与高级版合并为单一页面 `index.html`，新增「高级模式」开关——关=仅 landmark（基础版行为），开=全部 5 类 category（高级版行为）。

**Architecture:** 以基础版 `script.js` 为基座。新增全局 `advancedMode` 开关控制 `loadSeedData` 的 category filter 范围。开关复用现有 `#switch-to-advanced-btn` 位置改造为 toggle，切换时用缓存的原始 JSON 重建 `POI_SLOTS_BY_MAP`（不重新 fetch）并重画。非 landmark 点位按 category 给默认 icon + 金色配色，suggestion 浮窗与 `drawPOI` 统一 icon 回退逻辑。

**Tech Stack:** 原生 JS（无框架/无模块系统，全局变量）、Canvas 2D（768 数据空间 + 1536 canvas + setTransform 2x）、CSS、`data-i18n` 翻译。

## Global Constraints

- **无构建/无打包/无 linter/无测试套件**——改完在浏览器手动验证（`node server.js` → `http://localhost:8000`）。不引入任何测试框架。
- **CSV 是种子数据单一数据源**，JSON 由脚本生成。本计划**不动**数据源（`dataset/nightreignMapPatterns.json` 只读取）。
- **UI 文本走 `data-i18n`**，新增/改义文本同步 `i18n/translations.js` 中英双语。
- 项目主语言**简体中文**（代码注释、commit 消息）。
- 在 **`feature/merge-advanced-toggle`** 分支开发，完全验收后合并 master。post-commit 钩子会 push feature 分支到 NAS（不碰 prod），故 feature 分支提交安全；**禁止在 master 直接提交**（会触发 prod 同步）。
- 设计文档：`docs/superpowers/specs/2026-08-11-merge-advanced-toggle-design.md`。

## File Structure

| 文件 | 职责 | 本计划改动 |
|------|------|-----------|
| `script.js` | 基础版主逻辑（`NightreignMapRecogniser` 类 + 全局数据层） | Task 1-6, 8 主体改动 |
| `index.html` | 单页入口 | Task 6 开关 toggle UI |
| `styles.css` | 基础版样式 | Task 6 toggle 样式 |
| `i18n/translations.js` | 中英翻译字典 | Task 7 i18n 合并 |
| `index-advanced.html` | 原 advanced 入口 | Task 8 改为重定向跳板 |
| `data.js`（可选） | 内联常量 | Task 9 死代码清理 |

---

## Task 1: 开关状态基础设施

**Files:**
- Modify: `script.js`（顶部全局区，`SEED_POIS_RAW` 定义后约 `:7` 之后；`loadSeedData` 调用点之前）

**Interfaces:**
- Produces: 全局 `advancedMode`(bool)、`getActiveCategories()`→string[]、`initAdvancedMode()`、`ADVANCED_STORAGE_KEY`。后续所有任务依赖。

- [ ] **Step 1: 在 `script.js` 顶部全局区加开关状态与 helper**

在 `SEED_POIS_RAW` 定义行（约 `:7`）之后、`TYPE_ICON_MAP`（`:12`）之前插入：

```js
// === 高级模式开关 ===
// 关=仅 landmark（基础版行为）；开=全部 5 类 category（高级版行为）。
// 状态来源优先级：URL ?advanced=1 > localStorage > 默认关。
let advancedMode = false;
const ADVANCED_CATEGORIES = ['landmark', 'stronghold', 'fieldBoss', 'scaleMerchant', 'merchant'];
const BASIC_CATEGORIES = ['landmark'];
const ADVANCED_STORAGE_KEY = 'advanced-mode';

function getActiveCategories() {
    return advancedMode ? ADVANCED_CATEGORIES : BASIC_CATEGORIES;
}

function initAdvancedMode() {
    const urlAdv = new URLSearchParams(location.search).get('advanced');
    if (urlAdv === '1') {
        advancedMode = true;
    } else {
        advancedMode = (localStorage.getItem(ADVANCED_STORAGE_KEY) === '1');
    }
}
```

- [ ] **Step 2: 在 `loadSeedData()` 首次调用之前调用 `initAdvancedMode()`**

先定位调用点：

```bash
grep -n "loadSeedData()" script.js
```

在 `loadSeedData()` 被调用的那一行**之前**插入 `initAdvancedMode();`（通常在 `DOMContentLoaded` 回调或 `NightreignMapRecogniser` 初始化方法内）。理由：filter 必须在数据加载前确定。

- [ ] **Step 3: 浏览器验证**

启动 `node server.js`，打开 `http://localhost:8000`，控制台执行：

```js
initAdvancedMode(); advancedMode;            // 预期 false
getActiveCategories();                        // 预期 ['landmark']
advancedMode = true; getActiveCategories();   // 预期 5 类
```

再访问 `http://localhost:8000/?advanced=1`，控制台执行 `advancedMode`（若已 init）预期 `true`。

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "feat(mode): 新增 advancedMode 开关状态基础设施

URL ?advanced=1 > localStorage > 默认关；getActiveCategories() 返回当前 category 集合。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 数据层 filter 改可配置

**Files:**
- Modify: `script.js:53-94`（`loadSeedData`）+ 新增 `rebuildPOISlots()`

**Interfaces:**
- Consumes: Task 1 的 `getActiveCategories()`
- Produces: 全局 `RAW_POI_LOOKUP`（缓存的原始 JSON poiLookupByMapType）、`rebuildPOISlots(categories)`。Task 6 切换开关时调用 `rebuildPOISlots` 重建槽位（不重新 fetch）。

- [ ] **Step 1: 抽取 filter+map 逻辑为独立函数，并缓存原始 JSON**

把 `script.js:66-86` 的槽位构建逻辑改为：先缓存 raw，再调抽取函数。替换 `loadSeedData` 内 `// 各地形 landmark 槽位...` 到 `});`（`:66-86`）这一段为：

```js
        // 缓存原始 poiLookupByMapType，供切换开关时 rebuildPOISlots 重建（不重新 fetch）
        RAW_POI_LOOKUP = data.poiLookupByMapType || {};
        POI_SLOTS_BY_MAP = buildPOISlots(RAW_POI_LOOKUP, getActiveCategories(), (typeof POIS_BY_MAP !== 'undefined') ? POIS_BY_MAP : {});
```

- [ ] **Step 2: 在顶部全局区（Task 1 的开关块之后）加 `RAW_POI_LOOKUP` 声明与 `buildPOISlots` 函数**

```js
let RAW_POI_LOOKUP = null;  // 缓存 JSON 原始 poiLookupByMapType，供 rebuildPOISlots 复用

// 按 categories 集合过滤槽位，坐标 1536→768（×0.5），landmark 按 POIS_BY_MAP 最近邻继承 originalId。
// 抽自 loadSeedData，供开关切换时重建 POI_SLOTS_BY_MAP（不重新 fetch）。
function buildPOISlots(plm, categories, legacyMap) {
    const catSet = new Set(categories);
    const result = {};
    Object.keys(plm).forEach(mt => {
        const legMap = legacyMap[mt] || [];
        result[mt] = plm[mt]
            .filter(p => catSet.has(p.category))
            .map(p => {
                const x = p.coordinates.x * 0.5, y = p.coordinates.y * 0.5;
                let originalId = p.id;
                let best = Infinity;
                legMap.forEach(lp => {
                    const d = (lp.x - x) ** 2 + (lp.y - y) ** 2;
                    if (d < best) { best = d; originalId = lp.id; }
                });
                return { id: p.id, originalId, name: p.name || p.id, x, y, category: p.category, index: p.index };
            });
    });
    return result;
}
```

- [ ] **Step 3: 加 `rebuildPOISlots` 供切换调用**

```js
// 切换开关后重建 POI_SLOTS_BY_MAP（用缓存 raw，不重新 fetch）。categories 省略则取当前活跃集。
function rebuildPOISlots(categories) {
    if (!RAW_POI_LOOKUP) return;
    POI_SLOTS_BY_MAP = buildPOISlots(
        RAW_POI_LOOKUP,
        categories || getActiveCategories(),
        (typeof POIS_BY_MAP !== 'undefined') ? POIS_BY_MAP : {}
    );
}
```

- [ ] **Step 4: 浏览器验证（开关关=回归）**

`http://localhost:8000`，进地图后控制台：

```js
Object.values(POI_SLOTS_BY_MAP)[0].length   // 开关关：仅 landmark，应与改造前一致
Object.values(POI_SLOTS_BY_MAP['Default']).filter(p=>p.category==='landmark').length  // landmark 数
```

- [ ] **Step 5: 浏览器验证（开关开=全部 category）**

控制台临时切开关并重建：

```js
advancedMode = true;
rebuildPOISlots();
POI_SLOTS_BY_MAP['Default'].filter(p=>p.category==='stronghold').length  // 预期 >0（Default 有 stronghold）
POI_SLOTS_BY_MAP['Default'].map(p=>p.category)  // 预期含 landmark/stronghold/fieldBoss/...
```

- [ ] **Step 6: Commit**

```bash
git add script.js
git commit -m "refactor(data): loadSeedData filter 改可配置 + rebuildPOISlots

filter 由 getActiveCategories() 决定；缓存 RAW_POI_LOOKUP 供切换重建不重新 fetch。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: category 默认 icon/配色常量 + categoryImages 预加载

**Files:**
- Modify: `script.js`（顶部常量区 + `setupImages` 内 `:148-152`）

**Interfaces:**
- Consumes: 无
- Produces: 顶部常量 `CATEGORY_ICON_MAP`、`CATEGORY_DOT_COLOR`；实例属性 `this.categoryImages`。Task 4/5 依赖。

- [ ] **Step 1: 在顶部常量区（`TYPE_DISPLAY_MAP` 之后约 `:25`）加 category 映射**

```js
// category → 默认 icon（已选态用）。landmark 走 TYPE_ICON_MAP（按 type），其余按 category 统一 icon。
// 依据 nightreignMapPatterns.json：fieldBoss 27 种 type 共用 field_boss，stronghold 47 种共用 camp_blank。
const CATEGORY_ICON_MAP = {
    'fieldBoss': 'assets/icons/field_boss.png',
    'stronghold': 'assets/icons/camp_blank.png',
    'scaleMerchant': 'assets/icons/merchant.png',
    'merchant': 'assets/icons/merchant.png',
};

// category → dot 未标记态颜色。landmark 橙（现状），其余金（区分共享点位 vs 额外点位）。
const CATEGORY_DOT_COLOR = {
    'landmark': '#ff8c00',
    'fieldBoss': '#ffd700',
    'stronghold': '#ffd700',
    'scaleMerchant': '#ffd700',
    'merchant': '#ffd700',
};
```

- [ ] **Step 2: 在 `setupImages`（`:148` `this.typeImages = {}` 附近）追加 categoryImages 预加载**

定位：

```bash
grep -n "this.typeImages = {}" script.js
```

在该 typeImages 加载循环（约 `:149-152` 遍历 `TYPE_ICON_MAP`）**之后**追加：

```js
        this.categoryImages = {};
        Object.entries(CATEGORY_ICON_MAP).forEach(([cat, src]) => {
            const img = new Image();
            img.src = src;
            this.categoryImages[cat] = img;
        });
```

- [ ] **Step 3: 浏览器验证**

进地图后控制台：

```js
rec.categoryImages   // rec = window 实例；预期 {fieldBoss:img, stronghold:img, ...}
rec.categoryImages.fieldBoss.src   // 预期含 field_boss.png
```

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "feat(render): category 默认 icon/配色常量 + categoryImages 预加载

CATEGORY_ICON_MAP/CATEGORY_DOT_COLOR；setupImages 预加载 categoryImages。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: drawPOI 渲染改造（配色 + landmark 放大 + category icon 回退）

**Files:**
- Modify: `script.js:852-906`（`drawPOI` / `drawDot` / `drawIcon`）

**Interfaces:**
- Consumes: Task 3 的 `CATEGORY_DOT_COLOR`、`this.categoryImages`、全局 `advancedMode`
- Produces: `drawDot(x,y,label,color,scale)`、`drawIcon(image,x,y,scale)` 支持 scale 参数。

- [ ] **Step 1: 给 `drawDot` 加 `scale` 参数**

`script.js:875` `drawDot(x, y, label, color)` 改为：

```js
    drawDot(x, y, label, color, scale = 1) {
        const r = (ICON_SIZE / 2) * scale;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r, 0, 2 * Math.PI);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        if (label) {
            this.ctx.fillStyle = '#000000';
            this.ctx.font = 'bold 16px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(label, x, y);
        }
    }
```

- [ ] **Step 2: 给 `drawIcon` 加 `scale` 参数**

`script.js:893` `drawIcon(image, x, y)` 改为（用 `ICON_SIZE * scale` 做 contain）：

```js
    drawIcon(image, x, y, scale = 1) {
        if (!image.complete) return;
        const nw = image.naturalWidth, nh = image.naturalHeight;
        const box = ICON_SIZE * scale;
        if (!nw || !nh) {
            this.ctx.drawImage(image, x - box / 2, y - box / 2, box, box);
            return;
        }
        const s = Math.min(box / nw, box / nh);
        const w = nw * s, h = nh * s;
        this.ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
    }
```

- [ ] **Step 3: 改造 `drawPOI` 主逻辑**

`script.js:852-873` 整个 `drawPOI(poi, state)` 替换为：

```js
    drawPOI(poi, state) {
        const { x, y } = poi;
        const cat = poi.category || 'landmark';
        // landmark 在开关开时放大 1.5x（突出共享点位）；开关关时保持 1x（零回归）
        const scale = (advancedMode && cat === 'landmark') ? 1.5 : 1;

        if (state === 'dot') {
            const color = CATEGORY_DOT_COLOR[cat] || '#ffd700';
            this.drawDot(x, y, '', color, scale);
        } else if (state === 'empty') {
            this.drawIcon(this.images.empty, x, y, scale);
        } else if (state === 'hidden') {
            // 候选种子在此坐标均无 POI：不画
        } else {
            // 已选 type：先查 type 专属 icon（landmark），再查 category 默认 icon
            const img = (this.typeImages && this.typeImages[state])
                || (this.categoryImages && this.categoryImages[cat]);
            if (img) {
                this.drawIcon(img, x, y, scale);
            } else {
                this.drawDot(x, y, '', '#ff8c00', scale);
            }
        }
    }
```

- [ ] **Step 4: 浏览器验证（开关关=零回归）**

`http://localhost:8000`，正常选夜王+地形+POI，**人眼确认**：landmark dot 仍橙色、尺寸不变（与改造前一致），icon 尺寸不变。

- [ ] **Step 5: 浏览器验证（开关开=视觉区分）**

控制台切开关并重画（地图状态下）：

```js
advancedMode = true; rebuildPOISlots(); rec.chosenMap && rec.renderMap();
```

**人眼确认**：landmark（橙、放大）vs stronghold/fieldBoss（金、正常）区分明显。若已标记某 stronghold 点（控制台 `rec.poiStates` 手动赋值或浮窗选），确认其 icon 走 camp_blank/field_boss。

- [ ] **Step 6: Commit**

```bash
git add script.js
git commit -m "feat(render): drawPOI 按 category 配色 + landmark 放大 + category icon 回退

dot 态 landmark 橙/其余金；开关开时 landmark 1.5x；已选态非 landmark type 走 category 默认 icon。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: suggestion 浮窗候选 icon 按 category 回退

**Files:**
- Modify: `script.js:1792`（`createPOISuggestionUI` 内 iconPath 计算）

**Interfaces:**
- Consumes: Task 3 的 `CATEGORY_ICON_MAP`、`poi.category`

- [ ] **Step 1: 改候选 type 的 iconPath 回退链**

`script.js:1792` 当前：

```js
            const iconPath = (type === 'empty') ? 'assets/images/empty.png' : (TYPE_ICON_MAP[type] || 'assets/icons/unknown.png');
```

改为（非 landmark type 回退到 category 默认 icon）：

```js
            const iconPath = (type === 'empty')
                ? 'assets/images/empty.png'
                : (TYPE_ICON_MAP[type] || CATEGORY_ICON_MAP[poi.category] || 'assets/icons/unknown.png');
```

- [ ] **Step 2: 浏览器验证（开关开，非 landmark 浮窗 icon）**

控制台切开关：`advancedMode=true; rebuildPOISlots(); rec.renderMap();`。选 Default 地形，**人眼确认**：右键/长按一个 stronghold（金点）→ 浮窗候选（火焰修士/卢恩熊…）icon 应为 camp_blank（而非 unknown）；fieldBoss 点位浮窗候选 icon 应为 field_boss。

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "fix(ui): suggestion 浮窗候选 icon 按 category 回退

非 landmark type（红狼/火焰修士等）回退到 CATEGORY_ICON_MAP[poi.category]，不再统一 unknown。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 开关 UI（按钮→toggle）+ 切换重置 + i18n 标签

**Files:**
- Modify: `index.html:21-24`（`#switch-to-advanced-btn`）
- Modify: `styles.css`（新增 toggle 样式）
- Modify: `script.js`（按钮事件改造 + `toggleAdvancedMode`/`resetForCategoryChange`）
- Modify: `i18n/translations.js:16,145`（`nav.advanced` 改义）

**Interfaces:**
- Consumes: Task 1-3（`advancedMode`、`rebuildPOISlots`、`CATEGORY_*`）
- Produces: `toggleAdvancedMode()`、`resetForCategoryChange()`、`updateAdvancedToggleUI()`。

- [ ] **Step 1: 改 `index.html` 按钮为 toggle 结构**

`index.html:20-24` 当前：

```html
                <!-- 入口：跳转高级版「地图缺失模式」index-advanced.html -->
                <button id="switch-to-advanced-btn" class="control-btn">
                    <i class="fas fa-arrow-right"></i>
                    <span data-i18n="nav.advanced">地图缺失模式</span>
                </button>
```

替换为 toggle 开关（保留原 id 供 JS 绑定）：

```html
                <!-- 高级模式开关：开=全部 category 点位，关=仅共享点位（基础版行为） -->
                <button id="switch-to-advanced-btn" class="advanced-toggle" type="button" role="switch" aria-checked="false">
                    <i class="fas fa-layer-group"></i>
                    <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    <span data-i18n="nav.advanced">高级模式</span>
                </button>
```

- [ ] **Step 2: 在 `styles.css` 末尾加 toggle 样式**

```css
/* 高级模式开关 toggle */
.advanced-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: 1px solid rgba(255,255,255,0.2);
    color: #ccc; padding: 4px 10px; border-radius: 20px;
    cursor: pointer; font-size: 13px; user-select: none;
}
.advanced-toggle .toggle-track {
    position: relative; width: 32px; height: 16px;
    background: #555; border-radius: 10px; transition: background .2s;
}
.advanced-toggle .toggle-thumb {
    position: absolute; top: 2px; left: 2px;
    width: 12px; height: 12px; background: #fff;
    border-radius: 50%; transition: left .2s;
}
.advanced-toggle.active { color: #00e5ff; border-color: #00e5ff; }
.advanced-toggle.active .toggle-track { background: #00e5ff; }
.advanced-toggle.active .toggle-thumb { left: 18px; }
```

- [ ] **Step 3: 在 `script.js` 加 toggle 逻辑（类方法）**

在 `NightreignMapRecogniser` 类内合适位置（如 `selectNightlord` 附近）加：

```js
    // 绑定高级模式开关（替代原跳转按钮）
    setupAdvancedToggle() {
        const btn = document.getElementById('switch-to-advanced-btn');
        if (!btn || this._advToggleBound) return;
        this._advToggleBound = true;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAdvancedMode();
        });
        this.updateAdvancedToggleUI();
    }

    updateAdvancedToggleUI() {
        const btn = document.getElementById('switch-to-advanced-btn');
        if (!btn) return;
        btn.classList.toggle('active', advancedMode);
        btn.setAttribute('aria-checked', advancedMode ? 'true' : 'false');
    }

    toggleAdvancedMode() {
        advancedMode = !advancedMode;
        localStorage.setItem(ADVANCED_STORAGE_KEY, advancedMode ? '1' : '0');
        this.updateAdvancedToggleUI();
        this.resetForCategoryChange();
    }

    // 切换 category 范围后：退出种子图模式 + 清标记 + 重建槽位 + 重画
    resetForCategoryChange() {
        // 退出单种子图模式（若在展示结果图）
        const imgContainer = document.getElementById('seed-image-container');
        if (imgContainer) imgContainer.style.display = 'none';
        this.canvas && (this.canvas.style.display = '');

        // 清标记状态
        this.poiStates = {};
        this.selectedSpawn = null;
        this.spawnPhase = false;
        this.lastFilteredSeeds = null;

        // 重建槽位（用缓存 raw，不重新 fetch）
        rebuildPOISlots();

        // 显式重赋 currentPOIs：renderMap 只重画现有 currentPOIs，
        // 切换 category 后必须重新从 POI_SLOTS_BY_MAP 取新点位集（参考 script.js:345/525 的赋值模式）
        if (this.chosenMap) {
            this.currentPOIs = (POI_SLOTS_BY_MAP[this.chosenMap] || []).slice();
            this.ensureMapLoaded(this.chosenMap);
            this.renderMap();
        }
    }
```

- [ ] **Step 4: 在初始化流程调用 `setupAdvancedToggle()`**

定位原跳转按钮的绑定（`grep -n "switch-to-advanced-btn" script.js`），把那处跳转逻辑（`window.location.href = 'index-advanced.html'` 之类）**替换为** `this.setupAdvancedToggle();`。若原绑定在 `DOMContentLoaded`，确保在数据加载后、UI 显示后调用。

- [ ] **Step 5: 改 `translations.js` 的 `nav.advanced` 文案**

`translations.js:16`（中）改：

```js
    'nav.advanced': '高级模式',
```

`translations.js:145`（英）改：

```js
    'nav.advanced': 'Advanced',
```

- [ ] **Step 6: 浏览器验证（toggle 交互 + 持久化 + 重置）**

`http://localhost:8000`：
1. 点 header「高级模式」→ toggle 滑动、变青色；画布刷新出金色额外点位。
2. 标记几个 POI 后再点 toggle 关 → 标记清空、回到仅 landmark。
3. 刷新页面 → toggle 状态保持（localStorage）。
4. **人眼确认**切换后画布正确重画、不残留旧标记。

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css script.js i18n/translations.js
git commit -m "feat(ui): 高级模式开关 toggle（原跳转按钮原地改造）

开关切换重置画布+重建槽位；localStorage 持久化；nav.advanced 改义。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: i18n 合并（POI_TYPE_EN + category 中文名 + displayName 英文接入）

**Files:**
- Modify: `i18n/translations.js`（并入 `POI_TYPE_EN`）
- Modify: `script.js:908-911`（`displayName` 接入英文）

**Interfaces:**
- Consumes: 高级版 `i18n/translations-advanced.js:458` 的 `POI_TYPE_EN` 对象。

- [ ] **Step 1: 复制 `POI_TYPE_EN` 到 `translations.js`**

打开 `i18n/translations-advanced.js:458`，把整个 `const POI_TYPE_EN = { ... };` 对象**完整复制**到 `i18n/translations.js` 末尾（含约 77 项中文 type→英文映射）。不要删 translations-advanced.js 里的原件（Task 9 统一处理废弃文件）。

- [ ] **Step 2: 加 category 中文显示名 i18n key**

在 `translations.js` 中文区加：

```js
    'category.landmark': '共享点位',
    'category.stronghold': '野外据点',
    'category.fieldBoss': '野外BOSS',
    'category.scaleMerchant': '山羊事件商人',
    'category.merchant': '商人',
```

英文区加：

```js
    'category.landmark': 'Landmark',
    'category.stronghold': 'Stronghold',
    'category.fieldBoss': 'Field Boss',
    'category.scaleMerchant': 'Scale Merchant',
    'category.merchant': 'Merchant',
```

- [ ] **Step 3: `script.js` `displayName` 接入英文模式**

`script.js:908-911` 当前：

```js
    displayName(type) {
        return TYPE_DISPLAY_MAP[type] || type;
    }
```

改为（英文模式查 `POI_TYPE_EN`，中文走 TYPE_DISPLAY_MAP）：

```js
    displayName(type) {
        if (this.languageManager && this.languageManager.getCurrentLanguage() === 'en'
            && typeof POI_TYPE_EN !== 'undefined' && POI_TYPE_EN[type]) {
            return POI_TYPE_EN[type];
        }
        return TYPE_DISPLAY_MAP[type] || type;
    }
```

- [ ] **Step 4: 浏览器验证（中英双语）**

1. 中文模式：开关开，点选 stronghold 点位，浮窗候选中文 BOSS 名正确（火焰修士/卢恩熊…）。
2. 切英文模式（语言按钮）：浮窗候选变英文名（POI_TYPE_EN 命中）；category 名若用到也是英文。
3. 中文模式浮窗候选 icon 仍正确（不受 i18n 影响）。

- [ ] **Step 5: Commit**

```bash
git add i18n/translations.js script.js
git commit -m "feat(i18n): 并入 POI_TYPE_EN + category 中文名 + displayName 英文接入

英文模式 POI type 走 POI_TYPE_EN 映射；新增 category.* 中英 key。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: index-advanced.html 重定向跳板

**Files:**
- Modify: `index-advanced.html`（全文替换为重定向）

- [ ] **Step 1: 用重定向页替换 `index-advanced.html` 全文**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>跳转中…</title>
    <script>
    // 高级版已合并入 index.html 的「高级模式」开关。
    // 保留此文件作为重定向跳板，兼容旧链接（README / commit / 分享 URL）。
    // ?advanced=1 让 index.html 自动启用开关；透传其余 query（如 ?lang=en）。
    var q = location.search || '';
    var sep = q ? (q.indexOf('?advanced') === -1 ? '&advanced=1' : '') : '?advanced=1';
    location.replace('index.html' + q + sep);
    </script>
</head>
<body>
    <p>已迁移到 <a href="index.html?advanced=1">主页面</a>，正在跳转…</p>
</body>
</html>
```

- [ ] **Step 2: 浏览器验证**

访问 `http://localhost:8000/index-advanced.html` → 应自动跳到 `index.html?advanced=1`，且开关自动开启（toggle 青色、画布显示额外点位）。访问 `index-advanced.html?lang=en` → 跳转后仍英文 + 开关开。

- [ ] **Step 3: Commit**

```bash
git add index-advanced.html
git commit -m "feat(redirect): index-advanced.html 改为重定向跳板到 index.html?advanced=1

兼容旧链接；透传 query 参数。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 高风险回归验证 + 修复

**Files:**
- Modify: `script.js`（按验证发现修复，**不预先改**）

本任务为人工验证。对每个场景先**验证不动代码**，确认行为正确；仅当发现 bug 才修复并单独 commit。

- [ ] **Step 1: 开关关全量回归（零差异基准）**

开关关，6 地形（Default/Mountaintop/Crater/Rotted Woods/Noklateo/Great Hollow）各走一遍：选夜王→选地形→选出生点→标 POI→收敛到单种子图。**人眼确认**与改造前完全一致（点位数、颜色、尺寸、浮窗、消歧、结果图）。

- [ ] **Step 2: 大空洞消歧（开关开）**

开关开 + Great Hollow 地形。验证 `detectHasLandmarkCollision`（`script.js:571`）触发条件：开关开后 stronghold/fieldBoss 点位会先被标记，确认消歧菜单（disambig-menu-a/b）仍正确触发/不误触发。控制台观察实例状态：

```js
rec.disambigActive   // 预期：landmark 未全标时 false；landmark 全标且仍有碰撞时 true
```

若消歧异常 → 记录现象，修复（可能需调整 `allMarked` 判定仅算 landmark），单独 commit。

- [ ] **Step 3: 消除法不归零（开关开）**

开关开，Default 地形，逐个标记 POI，**人眼确认**候选种子数（顶部「已匹配」）单调递减、不突跳归零。若归零 → 参考 memory「消除法归零 bug」，检查 `getAvailableOptions`/`checkPOIMatches` 对新 category 的 type 集合是否每种子都贡献 type/Empty，修复后 commit。

- [ ] **Step 4: 非 landmark 点位 originalId 偏移（开关开）**

开关开，右键/长按非 landmark 点位（originalId 为 JSON id 如 "0"，非 1-11）。确认浮窗定位走 `createPOISuggestionUI` 的 default 分支（`script.js:1877/1888`），位置合理不溢出。若溢出 → 微调 default 偏移，commit。

- [ ] **Step 5: 移动端滚动（开关开）**

DevTools 切移动端视口（≤768px），开关开，选地形/夜王/POI。确认 `scrollMapIntoView`（`script.js:551`）对额外点位同样生效，长按/短按交互正常。

- [ ] **Step 6: Commit（仅当 Step 2-5 有修复）**

每个修复单独 commit，消息描述具体修了什么。若全部通过无修复 → 跳过本 commit，在 PR 描述记录验证结果。

---

## Task 10（可选）: data.js 死代码清理 + CLAUDE.md 更新

**Files:**
- Modify: `data.js`（删死代码）
- Modify: `CLAUDE.md`（单版本化描述）

> 可选。若希望最小化改动范围，可跳过本任务，留待后续。死代码不影响功能，仅增加理解负担。

- [ ] **Step 1: 删 `data.js` 死代码**

删除以下 script.js 零引用的常量（已核查）：
- `NIGHTLORDS`（`data.js:132`）
- `MAPS`（`data.js:139`）
- `HAS_REAL_SEED_DATA`（`data.js:17033`）
- data.js 内部 `loadSeedData()`（`data.js:17036`，被 script.js:53 同名覆盖，永不调用）

同步删 `script.js` 顶部对 `seedDataMatrix`/`GH_DISAMBIG` 的过时注释引用（`script.js:3` 等仅注释行）。

- [ ] **Step 2: 浏览器回归**

开关开/关各跑一遍 Default 地形，确认无报错（死代码删除不应影响行为）。

- [ ] **Step 3: 更新 `CLAUDE.md`**

- 「两个独立的应用版本」表 → 改为单版本说明（index.html + 高级模式开关）。
- 「数据流」移除高级版独立 fetch 描述（统一为 loadSeedData）。
- 修正过时描述：POI category 实际为 `landmark/stronghold/fieldBoss/scaleMerchant/merchant`（非「教堂/法师塔/村庄」也非「major base/minor base/evergaol/rotted woods」）。
- 「进行中的分支与数据导入」若与本分支相关，补充合并说明。

- [ ] **Step 4: Commit**

```bash
git add data.js CLAUDE.md script.js
git commit -m "chore: 清理 data.js 死代码 + CLAUDE.md 单版本化

删 NIGHTLORDS/MAPS/HAS_REAL_SEED_DATA/data.js loadSeedData；修正过时分类描述。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 验收清单（合并 master 前必须全过）

对照设计文档 `docs/superpowers/specs/2026-08-11-merge-advanced-toggle-design.md` 第 6 节：

- [ ] 开关关：6 地形行为与改造前完全一致（Task 9 Step 1）。
- [ ] 开关开：5 类 category 点位可点选，候选 type 中文名+icon 正确（Task 4/5/7）。
- [ ] landmark 橙色放大 vs 其余金色，肉眼可辨（Task 4）。
- [ ] 移动端滚动+长按/短按对额外点位生效（Task 9 Step 5）。
- [ ] toggle 状态 localStorage 持久化 + `?advanced=1` 自动启用（Task 6）。
- [ ] 切换开关正确重置（清标记+重画+退出种子图模式）（Task 6 Step 3）。
- [ ] 大空洞开关开下消歧仍正确（Task 9 Step 2）。
- [ ] `index-advanced.html` 重定向 + 自动开开关（Task 8）。
- [ ] 中英双语 type/category 名齐全（Task 7）。
- [ ] 开关开下标记任意 POI 不归零（Task 9 Step 3）。
