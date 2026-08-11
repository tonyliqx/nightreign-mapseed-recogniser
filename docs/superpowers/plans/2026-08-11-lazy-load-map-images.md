# 地形底图懒加载 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把基础版 6 张地形底图（约 4.3MB）从启动时全量预加载，改为 Default 仍预加载、其余 5 种选中地形时才按需加载。

**Architecture:** 保持 `this.images.maps`（name → Image 字典）结构不变，新增幂等方法 `ensureMapLoaded(mapName)` 统一加载入口；`setupImages` 只对 `'Default'` 预加载；`selectMap` 选中地形时调 `ensureMapLoaded`。复用绘制层 `drawMap` 已有的"图片未就绪走灰色占位、加载完重绘"容错；将"绑 onload 重绘"的责任统一收归 `ensureMapLoaded`（带防串图守卫），`renderMap` 不再自行绑 onload 以免覆盖。

**Tech Stack:** 原生 JavaScript（ES6 class）、Canvas 2D、HTML；无构建工具/打包器/框架。

## Global Constraints

- **本项目无构建步骤、无打包器、无 linter、无测试套件**（见 CLAUDE.md）。验证一律用浏览器手动验证（DevTools + 画布观察），不引入任何测试框架（YAGNI）。
- 代码注释与 commit 消息使用简体中文（项目约定）。
- 改动 `script.js` 后必须 bump `index.html` 里 `<script src="script.js?v=...">` 的版本号以破缓存。
- 本仓库 `post-commit` 钩子会自动把提交同步到 NAS 镜像与 prod（master 触发），属正常行为，无需手动处理。

## File Structure

| 文件 | 职责 | 本次改动 |
|------|------|----------|
| `script.js` | 基础版主逻辑类 `NightreignMapRecogniser` | 新增 `ensureMapLoaded`；改 `setupImages`；`selectMap` 加一行；`renderMap` else 分支简化 |
| `index.html` | 入口页 | bump `script.js?v` 版本号 |
| `data.js` | 定义 `MAP_IMAGES`（不改） | 无 |
| `docs/superpowers/specs/2026-08-11-lazy-load-map-images-design.md` | 设计文档 | 无（已完成） |

---

## Task 1: 重构加载入口（纯重构，行为不变）

引入 `ensureMapLoaded(mapName)` 统一加载入口（带防串图守卫），让 `setupImages` 改走它但仍**全量**加载所有 6 张；`renderMap` 的 else 分支去掉自行绑定的 onload，改由 `ensureMapLoaded` 统一负责重绘。本任务结束时**对外行为零变化**（首屏仍下 6 张图），只是把加载路径重构干净，为 Task 2 的懒加载切换铺路。

**Files:**
- Modify: `script.js`（`setupImages` 约 143-177、新增 `ensureMapLoaded`、`renderMap` 约 755-762）

**Interfaces:**
- Produces: 实例方法 `ensureMapLoaded(mapName: string): HTMLImageElement | null` —— 幂等；已加载/加载中返回缓存的 `Image`，否则创建、开始下载并返回；`mapName` 不在 `MAP_IMAGES` 时返回 `null`。

- [ ] **Step 1: 新增 `ensureMapLoaded` 方法**

在 `script.js` 的 `setupImages()` 方法**之后**（即第 177 行 `}` 之后、第 179 行 `onLanguageChanged` 之前）插入：

```js
    /**
     * 幂等懒加载地形底图：已加载/加载中则返回缓存 Image，否则创建并开始下载。
     * 加载完成时带守卫重绘——仅当该图仍是当前 chosenMap 的图才重绘，
     * 避免用户快速切换地形时，前一张后加载完把当前地形覆盖（串图）。
     */
    ensureMapLoaded(mapName) {
        if (this.images.maps[mapName]) {
            return this.images.maps[mapName];
        }
        const url = MAP_IMAGES[mapName];
        if (!url) {
            console.warn(`Unknown map: ${mapName}`);
            return null;
        }
        const img = new Image();
        img.onload = () => {
            console.log(`Map image loaded: ${mapName}`);
            // 防串图守卫：仅当该图仍是当前选中地形时才重绘
            if (img === this.images.maps[this.chosenMap]) {
                this.drawMap(img);
            }
        };
        img.onerror = () => {
            console.warn(`Failed to load map image: ${mapName}`, url);
        };
        img.src = url;
        this.images.maps[mapName] = img;
        return img;
    }
```

- [ ] **Step 2: `setupImages` 的地图加载段改走 `ensureMapLoaded`**

把 `setupImages()` 内第 160-176 行这段：

```js
        // Load map images with error handling
        Object.entries(MAP_IMAGES).forEach(([mapName, url]) => {
            const img = new Image();
            // Don't need crossOrigin for local images
            // img.crossOrigin = 'anonymous';
            img.onload = () => {
                console.log(`Map image loaded: ${mapName}`);
            };
            img.onerror = () => {
                console.warn(`Failed to load map image: ${mapName}`, url);
            };

            // Load real images
            img.src = url;

            this.images.maps[mapName] = img;
        });
```

替换为（本任务仍全量加载，行为不变，只是统一走新方法）：

```js
        // 加载地形底图（统一走 ensureMapLoaded，便于 Task 2 切换懒加载）
        Object.keys(MAP_IMAGES).forEach((mapName) => {
            this.ensureMapLoaded(mapName);
        });
```

- [ ] **Step 3: 简化 `renderMap` 的 else 分支（避免覆盖 ensureMapLoaded 的 onload）**

`renderMap()` 内第 755-762 行这段：

```js
        } else {
            console.log(`Waiting for map image to load: ${this.chosenMap}`);
            mapImage.onload = () => {
                console.log(`Map image loaded: ${this.chosenMap}`);
                this.drawMap(mapImage);
            };
            // Also draw immediately with what we have
            this.drawMap(mapImage);
        }
```

替换为（去掉自行绑定的 onload，避免覆盖 `ensureMapLoaded` 设的带守卫 onload；图加载完由 `ensureMapLoaded` 的 onload 重绘）：

```js
        } else {
            console.log(`Waiting for map image to load: ${this.chosenMap}`);
            // 图正在加载：ensureMapLoaded 已绑 onload（带防串图守卫）负责加载完重绘，此处先画占位
            this.drawMap(mapImage);
        }
```

- [ ] **Step 4: 浏览器手动验证（确认零回归）**

启动开发服务器（任选其一）：
```bash
node server.js      # 端口 8000
# 或 python server.py
```
本机访问 `http://localhost:8000`，打开 DevTools → Network → 刷新页面：
- **预期**：Network 中仍出现全部 6 张 `*-POI.jpg` 请求（Default/Mountaintop/Crater/Noklateo/RottedWoods/GreatHollow），与改动前一致。
- 依次点击每种地形按钮，画布正常显示对应地形底图与 POI，控制台无新增报错。
- 若 6 张图未全部加载或某地形无图，说明 Step 2 遍历有误，回查。

- [ ] **Step 5: 提交**

```bash
git add script.js
git commit -m "$(cat <<'EOF'
refactor(map): 地形底图加载统一走 ensureMapLoaded

抽幂等方法 ensureMapLoaded(mapName) 作为加载入口（带防串图守卫），
setupImages 与 renderMap 改走它；renderMap 不再自行绑 onload 以免
覆盖。纯重构，对外行为不变（首屏仍全量加载 6 张）。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 切换为懒加载（Default 预加载 + 选中才加载）

把 `setupImages` 的全量加载改为只预加载 `'Default'`；在 `selectMap` 新选地形时调 `ensureMapLoaded` 触发该地形按需下载。bump `script.js` 缓存版本号。

**Files:**
- Modify: `script.js`（`setupImages` 地图加载段、`selectMap` 约 503）
- Modify: `index.html:221`（`script.js?v=2.2.12` → `2.2.13`）

**Interfaces:**
- Consumes: Task 1 的 `ensureMapLoaded(mapName)`。

- [ ] **Step 1: `setupImages` 改为只预加载 Default**

把 Task 1 Step 2 写入的这段：

```js
        // 加载地形底图（统一走 ensureMapLoaded，便于 Task 2 切换懒加载）
        Object.keys(MAP_IMAGES).forEach((mapName) => {
            this.ensureMapLoaded(mapName);
        });
```

替换为：

```js
        // 预加载默认地形（最常用，且 drawDefaultMapWithImage 在未选地形时会用到）；
        // 其余 5 种地形改为懒加载——selectMap 选中时由 ensureMapLoaded 按需下载。
        this.ensureMapLoaded('Default');
```

- [ ] **Step 2: `selectMap` 新选分支接入懒加载**

`selectMap(map)` 内第 501-503 行这段：

```js
        } else {
            // Select the new map
            this.chosenMap = map;
```

在 `this.chosenMap = map;` **之后**追加一行（仅新选分支需要；再次点击同一地形的分支 `chosenMap` 未变，图早已缓存）：

```js
        } else {
            // Select the new map
            this.chosenMap = map;
            this.ensureMapLoaded(map);  // 懒加载该地形底图（已加载则命中缓存）
```

- [ ] **Step 3: bump script.js 缓存版本号**

`index.html` 第 221 行：

```html
    <script src="script.js?v=2.2.12"></script>
```

改为：

```html
    <script src="script.js?v=2.2.13"></script>
```

- [ ] **Step 4: 浏览器手动验证（懒加载行为）**

启动服务器并打开 `http://localhost:8000`，DevTools → Network → 勾选 "Disable cache" 后刷新：

1. **首屏只下 Default**：Network 中底图请求**只见 `Default-POI.jpg`**，不应出现其余 5 张。
2. **懒加载触发**：点击"山顶"按钮 → Network 出现 `Mountaintop-POI.jpg` 请求；画布先显示灰色占位，图加载完自动重绘出山顶地图（控制台打印 `Map image loaded: Mountaintop`）。
3. **缓存命中**：再次点击"山顶"（或切到别的地形再切回）→ Network **不重复**请求 `Mountaintop-POI.jpg`。
4. **防串图**：清空缓存（Network → Clear）后刷新，尽快连续点击两个未缓存的地形（如先点"火山"立刻点"隐城"）→ 最终画布显示的是最后选中的那个地形，不被先前加载完的图覆盖。
5. **错误兜底**：DevTools → Network → 右键 block 某 `*-POI.jpg` 域名/路径，选中该地形 → 画布显示灰色占位、控制台 warn `Failed to load map image`，不报错崩溃。

任一项不符则回查对应 Step。

- [ ] **Step 5: 提交**

```bash
git add script.js index.html
git commit -m "$(cat <<'EOF'
feat(map): 地形底图改为懒加载

setupImages 只预加载 Default（约 750KB），其余 5 种地形在 selectMap
选中时由 ensureMapLoaded 按需加载；首屏节省约 3.5MB。bump script.js
缓存版本号至 2.2.13。

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## 验证总结（对应 spec 的验收项）

| spec 验收项 | 对应步骤 |
|------|------|
| 首屏只见 Default | Task 2 Step 4-① |
| 点地形才下该图 + 自动出图 | Task 2 Step 4-② |
| 缓存命中不重复请求 | Task 2 Step 4-③ |
| 快速切地形不串图 | Task 2 Step 4-④（守卫 = Task 1 Step 1） |
| 断点占位不崩 | Task 2 Step 4-⑤ |
