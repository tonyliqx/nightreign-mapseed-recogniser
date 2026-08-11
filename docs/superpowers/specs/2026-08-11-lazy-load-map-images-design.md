# 地形底图懒加载设计

**日期**：2026-08-11
**影响版本**：基础版（`index.html` / `script.js` / `data.js`）
**状态**：已确认，待实现

## 背景与现状

基础版地图种子识别器共有 6 张地形底图，由 [data.js:108](../../../data.js#L108) 的 `MAP_IMAGES` 定义，指向 `assets/images/*-POI.jpg`，每张约 700KB，**合计约 4.3MB**。

当前这些底图在应用启动时**一次性全量预加载**：[script.js:161-176](../../../script.js#L161-L176) 的 `setupImages()` 遍历 `MAP_IMAGES`，对每张图 `new Image()` 并立即设 `src`，全部存入 `this.images.maps`。结果是不管用户最终使用哪种地形，首屏都要下载全部 6 张（约 4.3MB）。

关键利好：绘制层（`drawMap(mapImage)` 等约 20 处调用点）已经对"图片尚未就绪"做了容错——
- [script.js:752-763](../../../script.js#L752-L763)：未 `complete` 时绑 `onload` 回调重绘
- [script.js:402](../../../script.js#L402)、[script.js:425](../../../script.js#L425)：判断 `complete && naturalWidth > 0`，否则走占位
- `drawMap` 内有灰色背景 + 文案的 fallback（[script.js:772-797](../../../script.js#L772-L797)）

因此懒加载几乎不需要改动绘制层，只需改变"何时创建 `Image` 并设 `src`"。

## 目标

- 地形底图改为**按需加载**：用到哪个地形才下载哪个。
- 首屏只下载默认地形 `Default`（约 750KB），相比现状节省约 3.5MB。
- 最小改动，复用绘制层已有的容错与占位逻辑。

## 非目标（YAGNI）

- 不改 POI 类型图标 `typeImages` 的全量加载（图标体积小，收益低）。
- 不引入鼠标悬停预热（移动端无悬停事件，收益有限）。
- 不新增 loading 转圈/进度 UI（沿用现有灰色占位）。
- 不改高级版（`index-advanced.html` / `app-advanced.js`）的底图加载逻辑。

## 设计

保持 `this.images.maps`（name → Image 字典）的结构不变，只是从"启动时填满 6 张"改为"按需填充"。

### 改动 1 — `setupImages()` 瘦身（[script.js:143-177](../../../script.js#L143-L177)）

删除遍历 `MAP_IMAGES` 的全量预加载循环（161-176 行），改为**只对 `'Default'` 预加载**。`Default` 仍预加载的原因：它是最常用地形，且 `drawDefaultMapWithImage()`（[script.js:397](../../../script.js#L397)）在未选地形等场景会用到它，预加载可避免首次显示空白。

POI 类型图标 `typeImages` 的加载逻辑（148-153 行）保持不变。

### 改动 2 — 新增 `ensureMapLoaded(mapName)` 方法

幂等的懒加载入口：
- 若 `this.images.maps[mapName]` 已存在，直接返回（命中缓存）。
- 否则 `new Image()`、设 `src`（指向 `MAP_IMAGES[mapName]`），并绑定：
  - `onload`：触发当前画布重绘（见改动 4 的守卫）。
  - `onerror`：保留现有 `console.warn` 行为；失败时 `drawMap` 自然走灰色占位，不崩。

`setupImages()` 对 `Default` 的预加载也复用这个方法，统一加载路径。

### 改动 3 — `selectMap(map)` 接入（[script.js:493](../../../script.js#L493)）

在 `this.chosenMap = map` 赋值之后、`updateGameState()` 之前，调用 `ensureMapLoaded(map)`。这样用户点击地形按钮才触发该地形图的下载；已下载的直接命中缓存。

### 改动 4（必要的小修复）— `onload` 防串图守卫

懒加载会让"某地形首次下载"耗时变长，引入竞态风险：用户选 A（A 还在下载）→ 切到 B，若此时 A 的 `onload` 触发，会把 A 图错误地画到当前应为 B 的画布上。现有 [script.js:757-759](../../../script.js#L757-L759) 的 `onload` 没有此守卫。

在统一的加载/重绘逻辑中加守卫：`onload` 回调里先判断"触发加载的那张图是否仍是当前 `chosenMap` 对应的图"（`img === this.images.maps[this.chosenMap]`），是才重绘。此风险由懒加载直接放大，属本工作范围内的必要修复，不视为范围蔓延。

### 不改动范围

- `drawMap` 及其约 20 处调用点（已对图片未就绪容错）。
- `drawDefaultMapWithImage`（用的 `Default` 已预加载）。
- 现有灰色占位与错误 fallback 逻辑。
- POI 类型图标 `typeImages` 全量加载。

## 验证方式

本项目无构建步骤、无测试套件（见 CLAUDE.md），在浏览器手动验证：

1. **首屏**：打开 DevTools → Network，刷新后底图请求应**只见 `Default-POI.jpg`**，不再出现其余 5 张。
2. **懒加载触发**：点击"山顶"按钮，Network 中出现 `Mountaintop-POI.jpg` 请求；画布先显示灰色占位，图加载完自动重绘出地图。
3. **缓存命中**：再次点击"山顶"（或切换走又切回），Network 不应重复请求该图。
4. **防串图**：清空缓存后，连续快速点击两个未缓存的地形按钮，最终画布显示的应是最后选中的那个地形，不被先前加载完的图覆盖。
5. **错误兜底**：在 DevTools 里把某张地形图请求 block 掉，选中该地形，验证画布显示灰色占位且控制台 warn，不报错崩溃。

## 影响文件

- `script.js`：`setupImages()`（改）、新增 `ensureMapLoaded(mapName)`（增）、`selectMap(map)`（加一行接入）、加载/重绘逻辑加守卫。
- `data.js`：无改动。
- `index.html`：无改动。
