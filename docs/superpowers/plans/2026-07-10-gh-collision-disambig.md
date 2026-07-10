# 大空洞碰撞消歧（A/B 点选）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基础版 Great Hollow 地形在剩余正好 2 个碰撞种子（5 对之一）时，额外显示 A、B 两个点选点位，复用现有 POI「点击→弹类型菜单→选→实时过滤」交互，把结果收敛到唯一种子。

**Architecture:** A/B 点是一套**条件显示的独立点位系统**，不进入 `POIS_BY_MAP`（因其类型集合是 BOSS 名 / 血毒，与教堂法师塔无关）。它复用 POI 的交互形态：canvas 圆点 + 右键/长按/点击弹菜单 + 选中换图标 + 参与过滤。菜单是**动态生成**的（A 的 BOSS 选项随当前碰撞对变化；B 固定血/毒）。枢纽状态 `disambigActive` 由 `updateSeedFiltering` 末尾的碰撞对检测设置，驱动渲染与二次过滤。

**Tech Stack:** 原生 JavaScript（无框架/无构建/无测试框架）, Canvas 2D, `data-i18n` 翻译绑定。验证靠浏览器手动操作。

## Global Constraints

- 所有代码注释、commit 消息、用户可见文案使用**简体中文**。
- 本项目**无构建步骤、无打包器、无 linter、无测试套件**——每个任务用浏览器手动验证，不写自动化测试。
- 暂存只用 `git add <具体文件>`，**禁止** `git add -A`/`git add ./`/`git add -u`/`git add -f`。
- commit 消息以 `Co-Authored-By: Claude <noreply@anthropic.com>` 结尾。仅本地提交，不推 origin。
- 本功能**不碰** `dataset/dataset.json`（尤其 0-319）、`extraction.html`、高级版（`app-advanced.js`/`index-advanced.html`/`translations-advanced.js`）。
- 坐标空间：基础版 canvas 为 **768 空间**（与 `POIS_BY_MAP` 一致）。A=(416,351)、B=(164,406) 已是 768 坐标。
- A/B 数据源自源 CSV（`CONSTRUCT.csv` 的 4xxxx boss @ A、52500/52520 遗迹 @ B），经 `integrate_dlc.py` 提取核对后**手工写入 `data.js`**（不进 dataset.json 分类体系，因其 `basic` 分类为 `other`）。

---

## File Structure

- **`data.js`** — 新增两个常量：`GH_DISAMBIG_POINTS`（A/B 坐标+元数据）、`GH_DISAMBIG`（10 个碰撞种子的 bossA/ruinB 查表）。纯数据，无逻辑。
- **`index.html`** — 新增 `#disambig-menu` 空容器（JS 动态填充菜单项），复用现有 `.context-menu` / `.context-menu-item` 样式。
- **`i18n/translations.js`** — zh/en 各新增 `gh.disambig.*` 文案键（提示、A/B 标签、血/毒）。
- **`script.js`** — 消歧全部逻辑：构造函数状态、碰撞检测、渲染、命中、动态菜单、事件绑定、过滤集成、重置清理。

---

## 现有 POI 点选机制（执行者必读，A/B 点要复用它）

- `this.currentPOIs = POIS_BY_MAP[map]`，每个 POI 形如 `{ id, x, y }`（768 空间）。
- `this.poiStates[poi.id]` 存类型字符串：`'dot'`(未选)/`'church'`/`'mage'`/`'village'`/`'empty'`/`'carriage'`/`'unknown'`。
- `drawMap(mapImage)`（script.js:761）遍历 `currentPOIs` 调 `drawPOI(poi, state)`；`drawPOI`（script.js:822）按 state 画图标；`drawDot(x,y,label,color)`（script.js:856）画圆点。
- 命中检测 `findClickedPOI(x,y)`（script.js:1216），半径 `ICON_SIZE/2*1.5`。
- 交互 handler（均在 `setupCanvasEventListeners`，script.js:903 起）：
  - **click**（919）：spawn 阶段 spawn 优先；地标阶段 `findClickedPOI` 命中则循环 `church`↔`dot`，未命中则改选出生点。
  - **contextmenu**（1162）：`findClickedPOI` 命中 → `showContextMenu` 弹 `#poi-context-menu`。
  - **touchstart**（1015）/ **touchend**（1073）/ **longPressHandler**（974）：移动端短按循环 `church`↔`dot`，长按弹菜单。
- 菜单选中回调（`setupContextMenu`，script.js:541）：写 `poiStates[id]` → `drawMap` → `updateSeedFiltering`。
- `updateSeedFiltering()`（script.js:1358）：按 nightlord+map+spawn 过滤 → `possibleSeeds`；按 `poiStates` 过滤 → `filteredSeeds`（`const`，1375 行）；auto-fill（1448）；显示建议/结果。

---

### Task 1: 数据层 — GH 消歧常量（data.js）

**Files:**
- Modify: `data.js`（在 `POIS_BY_MAP` 结束的 `};` 之后，即第 75 行之后插入）

**Interfaces:**
- Produces: 全局常量 `GH_DISAMBIG_POINTS`（`{ A: {id,x,y,kind,labelKey}, B: {...} }`，768 空间）、`GH_DISAMBIG`（`{ <种子号>: {bossA, ruinB} }`）。后续任务直接引用这两个名字。

- [ ] **Step 1: 在 data.js 第 75 行 `};`（POIS_BY_MAP 结束）之后插入两个常量**

```js
// === Great Hollow 碰撞消歧 ===
// 当 GH 地形剩余正好 2 个碰撞种子（5 对之一）时，额外显示这两个点选位，
// 复用 POI「点击→弹菜单→选→过滤」交互，把结果收敛到唯一种子。
//   A=(416,351) 紧邻 POI1，选「守教堂的野外 BOSS」名 —— 区分全部 5 对
//   B=(164,406) 在 POI2 左下方，选「血遗迹/毒遗迹」—— 区分 4 对（1182/1183 都毒，靠 A 兜底）
// 坐标空间 768（与 POIS_BY_MAP 一致）。数据源自源 CSV：
//   A 点 4xxxx field boss（红狼/王室幽魂/接肢/萨米尔）、B 点 52500(血)/52520(毒) 遗迹，
//   经 integrate_dlc.py 提取核对。注意：这两个点 basic 分类为 other，不进 dataset.json，
//   故独立维护于此，不并入 POIS_BY_MAP。
const GH_DISAMBIG_POINTS = {
  A: { id: 'ghDisambigA', x: 416, y: 351, kind: 'boss',  labelKey: 'gh.disambig.aLabel' },
  B: { id: 'ghDisambigB', x: 164, y: 406, kind: 'ruin',  labelKey: 'gh.disambig.bLabel' },
};

const GH_DISAMBIG = {
  1120: { bossA: '红狼',     ruinB: '血' },
  1133: { bossA: '王室幽魂', ruinB: '毒' },
  1125: { bossA: '接肢',     ruinB: '毒' },
  1132: { bossA: '红狼',     ruinB: '血' },
  1182: { bossA: '红狼',     ruinB: '毒' },
  1183: { bossA: '萨米尔',   ruinB: '毒' },
  1188: { bossA: '接肢',     ruinB: '血' },
  1189: { bossA: '萨米尔',   ruinB: '毒' },
  1192: { bossA: '接肢',     ruinB: '血' },
  1193: { bossA: '王室幽魂', ruinB: '毒' },
};
```

- [ ] **Step 2: 浏览器验证常量已加载**

打开 `index.html`（`node server.js` 后访问 `http://localhost:8000`），按 F12 控制台执行：
```js
console.log(GH_DISAMBIG['1192'], GH_DISAMBIG['1193'], GH_DISAMBIG_POINTS.A);
```
预期输出：`{bossA: '接肢', ruinB: '血'}` `{bossA: '王室幽魂', ruinB: '毒'}` `{id: 'ghDisambigA', x: 416, y: 351, kind: 'boss', ...}`。页面其余功能不受影响。

- [ ] **Step 3: Commit**

```bash
git add data.js
git commit -m "feat: 新增大空洞碰撞消歧数据常量 GH_DISAMBIG_POINTS/GH_DISAMBIG

A 点(416,351)守教堂BOSS + B 点(164,406)血/毒遗迹，10 个碰撞种子查表。
源自源 CSV 经 integrate_dlc.py 核对。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: HTML 菜单容器 + i18n 文案

**Files:**
- Modify: `index.html`（在 `#poi-context-menu` 的闭合 `</div>` 之后，即第 199 行之后插入）
- Modify: `i18n/translations.js`（zh 段第 80 行 `'poi.carriage'` 之后、en 段第 201 行 `'poi.carriage'` 之后插入）

**Interfaces:**
- Produces: id 为 `disambig-menu` 的 DOM 容器（初始 `display:none`，由 JS 动态 `innerHTML` 填充 `.context-menu-item`）；i18n 键 `gh.disambig.hint`/`aLabel`/`bLabel`/`blood`/`poison`。

- [ ] **Step 1: index.html 第 199 行（`#poi-context-menu` 的 `</div>`）之后插入消歧菜单容器**

```html

    <!-- 大空洞碰撞消歧菜单（菜单项由 JS 动态生成） -->
    <div id="disambig-menu" class="context-menu" style="display: none;">
    </div>
```

- [ ] **Step 2: translations.js zh 段（第 80 行 `'poi.carriage': '马车',` 之后）插入中文文案**

```js
    'gh.disambig.hint': '已锁定到 2 个种子，标记下方紫色 A/B 两点可进一步区分',
    'gh.disambig.aLabel': '守教堂BOSS',
    'gh.disambig.bLabel': 'POI2左下遗迹',
    'gh.disambig.blood': '血遗迹',
    'gh.disambig.poison': '毒遗迹',
```

- [ ] **Step 3: translations.js en 段（第 201 行 `'poi.carriage': 'Carriage',` 之后）插入英文文案**

```js
    'gh.disambig.hint': 'Narrowed to 2 seeds — mark the purple A/B points below to distinguish',
    'gh.disambig.aLabel': 'Church-guarding Boss',
    'gh.disambig.bLabel': 'Ruin SW of POI2',
    'gh.disambig.blood': 'Blood Ruin',
    'gh.disambig.poison': 'Poison Ruin',
```

- [ ] **Step 4: 浏览器验证**

刷新页面，切换中/英文，控制台执行：
```js
document.getElementById('disambig-menu')  // 应为 <div id="disambig-menu" ... style="display: none;">
```
确认元素存在且初始隐藏；页面无报错。

- [ ] **Step 5: Commit**

```bash
git add index.html i18n/translations.js
git commit -m "feat: 新增碰撞消歧菜单容器 #disambig-menu 与 gh.disambig.* 文案

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 碰撞检测 + 渲染 + 过滤集成（核心数据流）

**Files:**
- Modify: `script.js`（构造函数、`drawMap`、`updateSeedFiltering`、新增两个方法）

**Interfaces:**
- Consumes: `GH_DISAMBIG_POINTS`、`GH_DISAMBIG`（Task 1）。
- Produces: 实例状态 `this.disambigStates`(`{A,B}`)、`this.disambigActive`(bool)、`this.currentDisambigPair`(`[n1,n2]|null`)；方法 `detectDisambigPair(filteredSeeds)`、`drawDisambigPoints()`。Task 4/5 依赖这些名字。

- [ ] **Step 1: 构造函数初始化消歧状态**

在 `script.js:32`（`this.poiStates = {};`）之后插入：

```js
        // 大空洞碰撞消歧状态：A=守教堂BOSS名, B='血'|'毒'；null=未选
        this.disambigStates = { A: null, B: null };
        this.disambigActive = false;        // 当前是否处于消歧模式（GH + 剩 2 碰撞种子）
        this.currentDisambigPair = null;    // 当前碰撞对 [seedNum1, seedNum2]（升序）
```

- [ ] **Step 2: 新增碰撞检测 + 渲染方法**

在 `initializePOIStates()`（`script.js:477-483`）的闭合 `}` 之后插入：

```js
    // 检测 POI 过滤后的剩余种子是否正好是 GH_DISAMBIG 里的某个碰撞对。
    // 返回 [seedNum1, seedNum2]（升序）或 null。
    detectDisambigPair(filteredSeeds) {
        if (this.chosenMap !== 'Great Hollow') return null;
        if (!filteredSeeds || filteredSeeds.length !== 2) return null;
        const nums = filteredSeeds.map(r => r[0]).sort((a, b) => a - b);
        if (GH_DISAMBIG[nums[0]] && GH_DISAMBIG[nums[1]]) {
            return nums;
        }
        return null;
    }

    // 渲染碰撞消歧点位（仅消歧模式；由 drawMap 调用）。紫色圆点，与 POI 'dot' 视觉一致。
    drawDisambigPoints() {
        if (!this.disambigActive) return;
        const points = [GH_DISAMBIG_POINTS.A, GH_DISAMBIG_POINTS.B];
        points.forEach(pt => {
            const state = (pt.kind === 'boss') ? this.disambigStates.A : this.disambigStates.B;
            const tag = (pt.kind === 'boss') ? 'A' : 'B';
            if (!state) {
                // 未选：紫色圆点 + A/B 标签
                this.drawDot(pt.x, pt.y, tag, '#b266ff');
            } else {
                // 已选：紫色实心圆 + 选中值文字
                this.ctx.beginPath();
                this.ctx.arc(pt.x, pt.y, ICON_SIZE / 2, 0, 2 * Math.PI);
                this.ctx.fillStyle = '#b266ff';
                this.ctx.fill();
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 11px Inter, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(state, pt.x, pt.y);
            }
        });
    }
```

- [ ] **Step 3: drawMap 中调用渲染**

在 `drawMap` 的 POI 绘制块之后调用。定位 `script.js:802`（`this.ctx.globalAlpha = 1.0;`，POI 绘制块结束）与 `script.js:805`（`// 画出生点标记`注释）之间，插入一行：

```js
        // 碰撞消歧点位（仅消歧模式：GH 剩 2 碰撞种子时由 updateSeedFiltering 置位）
        this.drawDisambigPoints();
```

（插入后，spawn 标记 `spawns.forEach(sp => this.drawSpawnMarker(sp));` 仍在其后。）

- [ ] **Step 4: updateSeedFiltering 集成碰撞检测 + 二次过滤**

4a. 把 `script.js:1375` 的 `const filteredSeeds = possibleSeeds.filter(...)` 改为 `let`：

```js
        let filteredSeeds = possibleSeeds.filter(row => {
```

（函数体不变，只改 `const`→`let`。）

4b. 在 auto-fill 块结束之后插入消歧逻辑。auto-fill 块是 `script.js:1448` 的 `if (filteredSeeds.length > 0 && !this.userIsClearing) { ... }`，到 `script.js:1479` 的闭合 `}`。在该 `}` 之后、`// Check if we should show POI suggestions`（1481）之前，插入：

```js
        // === 大空洞碰撞消歧 ===
        // 检测 POI 过滤后是否剩 2 个碰撞种子 → 进入消歧模式（显示 A/B 点）
        const wasActive = this.disambigActive;
        const prevPair = this.currentDisambigPair;
        const pair = this.detectDisambigPair(filteredSeeds);
        this.disambigActive = (pair !== null);
        if (pair) {
            // 碰撞对换了（种子号不同）→ 清空旧选择，避免旧 A/B 值把新碰撞对过滤成 0 种子
            if (!prevPair || prevPair[0] !== pair[0] || prevPair[1] !== pair[1]) {
                this.disambigStates = { A: null, B: null };
            }
            this.currentDisambigPair = pair;
        } else {
            // 不再处于碰撞对（用户改了 POI/夜王/出生点选择）→ 清空消歧选择
            this.currentDisambigPair = null;
            this.disambigStates = { A: null, B: null };
        }
        // 消歧二次过滤：按用户已选的 A/B 值进一步收敛
        if (this.disambigActive && (this.disambigStates.A || this.disambigStates.B)) {
            filteredSeeds = filteredSeeds.filter(row => {
                const d = GH_DISAMBIG[row[0]];
                if (!d) return true;
                if (this.disambigStates.A && d.bossA !== this.disambigStates.A) return false;
                if (this.disambigStates.B && d.ruinB !== this.disambigStates.B) return false;
                return true;
            });
        }
        // 消歧模式切换（进入/退出）→ 重绘以显示/隐藏 A/B 点
        if (wasActive !== this.disambigActive) {
            this.drawMap(this.images.maps[this.chosenMap]);
        }
```

（后续 `updateSeedCountDisplay(filteredSeeds.length)`、`showPOISuggestions(filteredSeeds,...)`、`showSingleSeed` 等自动使用消歧后的 `filteredSeeds`，无需改动。）

- [ ] **Step 5: 浏览器验证 A/B 点出现**

刷新页面 → 选地图 **Great Hollow** → 选夜王 **Harmonia（七仙女）** 或 **Straghess（垃圾王）**（5 对碰撞都在这两个夜王下）→ 选出生点 → 按 POI 建议逐个标记地标，观察右上角种子数逐步下降。**当种子数收敛到 2 时**，预期：
- POI1（id:1）旁出现紫色「A」圆点；
- POI2（id:2）左下方出现紫色「B」圆点；
- 控制台无报错。

若选了 Harmonia/Straghess 后无论怎么标都到不了 2，换另一个夜王重试。验证完不要选 A/B（Task 4 才有菜单），只确认两个紫点在正确位置出现即可。

- [ ] **Step 6: Commit**

```bash
git add script.js
git commit -m "feat: 大空洞碰撞消歧——检测、渲染、过滤集成

剩余 2 碰撞种子时显示 A/B 紫点；updateSeedFiltering 末尾按 disambigStates 二次过滤。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 命中检测 + 动态菜单 + 事件绑定

**Files:**
- Modify: `script.js`（新增 3 个方法、修改 click/contextmenu/touchstart 三个 handler、setupContextMenu 增关闭逻辑）

**Interfaces:**
- Consumes: `this.disambigActive`、`this.currentDisambigPair`、`GH_DISAMBIG`/`GH_DISAMBIG_POINTS`（Task 1/3）。
- Produces: 方法 `findClickedDisambigPoint(x,y)`、`showDisambigMenu(point,clientX,clientY)`、`hideDisambigMenu()`；写 `this.disambigStates.A/B` 后触发 `drawMap`+`updateSeedFiltering`。

- [ ] **Step 1: 新增命中检测 + 菜单方法**

在 Task 3 新增的 `drawDisambigPoints()` 方法之后插入：

```js
    // 命中检测：消歧模式下找点击/触摸命中的 A/B 点，返回点位对象或 null
    findClickedDisambigPoint(x, y) {
        if (!this.disambigActive) return null;
        const radius = ICON_SIZE / 2 * 1.5;  // 与 findClickedPOI 同触控半径
        for (const pt of [GH_DISAMBIG_POINTS.A, GH_DISAMBIG_POINTS.B]) {
            const dx = x - pt.x;
            const dy = y - pt.y;
            if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                return pt;
            }
        }
        return null;
    }

    // 显示消歧菜单：按当前碰撞对动态生成选项
    showDisambigMenu(point, clientX, clientY) {
        this.currentDisambigPoint = point;
        const menu = document.getElementById('disambig-menu');
        const [s1, s2] = this.currentDisambigPair;
        let items = [];
        if (point.kind === 'boss') {
            // A：碰撞对两个种子的 bossA（去重保序）
            const seen = new Set();
            [s1, s2].forEach(s => {
                const v = GH_DISAMBIG[s].bossA;
                if (!seen.has(v)) { seen.add(v); items.push({ label: v, raw: v }); }
            });
        } else {
            // B：血/毒（两种子 ruinB 不同才有区分力；相同则单选项）
            const r1 = GH_DISAMBIG[s1].ruinB, r2 = GH_DISAMBIG[s2].ruinB;
            const lbl = { '血': this.getText('gh.disambig.blood'), '毒': this.getText('gh.disambig.poison') };
            items.push({ label: lbl[r1], raw: r1 });
            if (r1 !== r2) items.push({ label: lbl[r2], raw: r2 });
        }
        menu.innerHTML = items.map(it =>
            `<div class="context-menu-item" data-raw="${it.raw}">${it.label}</div>`
        ).join('');
        const select = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const raw = e.currentTarget.dataset.raw;
            if (point.kind === 'boss') this.disambigStates.A = raw;
            else this.disambigStates.B = raw;
            this.hideDisambigMenu();
            this.drawMap(this.images.maps[this.chosenMap]);
            this.updateSeedFiltering();
        };
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', select);
            item.addEventListener('touchend', select);
        });
        // 定位 + 显示（确保不超出视口）
        const vw = window.innerWidth, vh = window.innerHeight;
        menu.style.left = `${Math.min(clientX, vw - 180)}px`;
        menu.style.top = `${Math.min(clientY, vh - 60 - items.length * 44)}px`;
        menu.style.display = 'block';
    }

    hideDisambigMenu() {
        const menu = document.getElementById('disambig-menu');
        if (menu) menu.style.display = 'none';
        this.currentDisambigPoint = null;
    }
```

- [ ] **Step 2: contextmenu handler 插入消歧点优先检测**

`script.js:1168`（`const pos = this.getMousePos(e);`）之后、`const poi = this.findClickedPOI(pos.x, pos.y);`（1169）之前，插入：

```js
            // 消歧点优先（仅消歧模式）
            if (this.disambigActive) {
                const dpt = this.findClickedDisambigPoint(pos.x, pos.y);
                if (dpt) {
                    this.showDisambigMenu(dpt, e.clientX, e.clientY);
                    return;
                }
            }
```

- [ ] **Step 3: click handler 地标阶段插入消歧点优先检测**

`script.js:941`（`// 地标阶段：POI 优先`注释）与 `const poi = this.findClickedPOI(pos.x, pos.y);`（942）之间，插入：

```js
            // 地标阶段：消歧点优先（仅消歧模式），命中则弹菜单（A/B 无循环语义，左键也弹菜单）
            if (this.disambigActive) {
                const dpt = this.findClickedDisambigPoint(pos.x, pos.y);
                if (dpt) {
                    this.showDisambigMenu(dpt, e.clientX, e.clientY);
                    return;
                }
            }
```

- [ ] **Step 4: touchstart handler 地标阶段插入消歧点优先检测**

`script.js:1051`（`// 地标阶段：POI 优先...`注释）与 `const poi = this.findClickedPOI(pos.x, pos.y);`（1052）之间，插入：

```js
            // 地标阶段：消歧点优先（仅消歧模式，直接弹菜单，不进长按/短按流程）
            if (this.disambigActive) {
                const dpt = this.findClickedDisambigPoint(pos.x, pos.y);
                if (dpt) {
                    const t = e.touches[0];
                    this.showDisambigMenu(dpt,
                        Math.min(t.clientX, window.innerWidth - 180),
                        Math.min(t.clientY, window.innerHeight - 150));
                    return;
                }
            }
```

- [ ] **Step 5: 点击菜单外区域关闭消歧菜单**

在 `setupContextMenu()`（`script.js:541`）的方法体末尾、闭合 `}`（605）之前，追加：

```js
        // 点击/触摸菜单外区域关闭消歧菜单（排除 canvas 自身——canvas 点击负责打开菜单）
        const closeDisambig = (e) => {
            const dm = document.getElementById('disambig-menu');
            if (dm && dm.style.display === 'block' && !dm.contains(e.target) && e.target !== this.canvas) {
                this.hideDisambigMenu();
            }
        };
        document.addEventListener('click', closeDisambig);
        document.addEventListener('touchstart', closeDisambig, { passive: true });
```

- [ ] **Step 6: 浏览器验证点选交互**

刷新 → 重复 Task 3 Step 5 的操作到达「剩 2 碰撞种子、A/B 紫点出现」状态，然后：
- **左键点 A 点** → 弹出菜单，列出当前碰撞对两个种子的 BOSS 名（如 1192/1193 对应「接肢 / 王室幽魂」）；
- 选「接肢」→ A 点变为紫色实心圆显示「接肢」，种子数从 2 收敛到 **1**，显示唯一种子（1192）；
- 再次左键点 A 点 → 菜单重新弹出，选「王室幽魂」→ 收敛到 1193；
- **右键点 B 点** → 弹出「血遗迹 / 毒遗迹」，选「血」→ B 点显示「血遗迹」，种子收敛；
- 点 A/B 菜单外区域 → 菜单关闭；
- 移动端（或浏览器设备模拟）短按 A 点 → 同样弹菜单。

- [ ] **Step 7: Commit**

```bash
git add script.js
git commit -m "feat: 大空洞碰撞消歧——A/B 点选交互与动态菜单

点击/右键/长按 A/B 弹动态菜单（A随碰撞对、B血/毒），选后收敛到唯一种子。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 重置与切地形清理

**Files:**
- Modify: `script.js`（新增 `resetDisambig()`、在 `resetMap` 与 `updateGameState` 调用）

**Interfaces:**
- Consumes: Task 3 的 `this.disambigStates/Active/currentDisambigPair`。
- Produces: 方法 `resetDisambig()`。

- [ ] **Step 1: 新增 resetDisambig 方法**

在 Task 4 新增的 `hideDisambigMenu()` 方法之后插入：

```js
    // 重置消歧状态：切地图/重置/换夜王时调用，避免残留选择污染新场景
    resetDisambig() {
        this.disambigStates = { A: null, B: null };
        this.disambigActive = false;
        this.currentDisambigPair = null;
        this.hideDisambigMenu();
    }
```

- [ ] **Step 2: resetMap 中调用**

在 `resetMap()`（`script.js:1250`）里，`this.poiStates = this.initializePOIStates();`（1253）之后插入：

```js
        this.resetDisambig();
```

- [ ] **Step 3: updateGameState 两个分支都调用**

`updateGameState()`（`script.js:485`）有两个分支，各自有 `this.poiStates = this.initializePOIStates();`（489 与 499）。在**两处** `initializePOIStates()` 调用之后各插入一行：

```js
            this.resetDisambig();
```

（即 489 行后一次、499 行后一次。）

- [ ] **Step 4: 浏览器验证清理**

刷新 → 到达消歧模式（A/B 出现，甚至选过 A）→ 点页面「重置」按钮（或重选地图/夜王）→ 预期：
- A/B 紫点消失，`disambigActive` 复位；
- 切到其他地形（如 Default）再切回 Great Hollow → A/B 不残留、需重新到达碰撞对才再次出现；
- 控制台无报错，原有 POI/出生点功能正常。

- [ ] **Step 5: Commit**

```bash
git add script.js
git commit -m "feat: 大空洞碰撞消歧——重置与切地形清理

resetMap/updateGameState 调用 resetDisambig，避免消歧状态残留。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 完成后的整体验证清单

到达「GH + Harmonia/Straghess + 剩 2 碰撞种子」状态后，逐一验证 5 个碰撞对都能靠 A/B 收敛：

| 碰撞对 | A 区分 | B 区分 | 预期 |
|--------|--------|--------|------|
| 1120/1133 | 红狼/王室幽魂 | 血/毒 | A 或 B 任选其一即收敛 |
| 1125/1132 | 接肢/红狼 | 毒/血 | A 或 B 任选 |
| 1182/1183 | 红狼/萨米尔 | 毒/毒（B 无区分力，菜单只 1 项） | **只能靠 A** 收敛；B 菜单单选项不改变结果 |
| 1188/1189 | 接肢/萨米尔 | 血/毒 | A 或 B 任选 |
| 1192/1193 | 接肢/王室幽魂 | 血/毒 | A 或 B 任选 |

同时确认：非 GH 地形、或剩 ≠2 种子时，A/B 点绝不出现；现有教堂/法师塔/出生点点选功能完全不受影响。
