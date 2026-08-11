// Main application for Nightreign seed recognition
// === 新数据层：权威源 dataset/nightreignMapPatterns.json（NAME 分类 + 聚类槽位 + 内嵌中文 type）===
// 弃用旧体系：seedDataMatrix（data.js 种子身份）+ CV_CLASSIFICATION_DATA（dataset.json 5 值简化分类）。
// 出生点数据 SEED_SPAWN / SPAWN_POINTS_BY_MAP 仍保留在 data.js（768 权威落地点，与 JSON 种子按 seedNum 关联）。
let SEED_REGISTRY = [];        // [{seedNumber, nightlord, mapType}] 全部种子身份（替代 seedDataMatrix 的 row[0/1/2]）
let POI_SLOTS_BY_MAP = {};     // {mapType: [{id, name, x(768), y(768), category, index}]} 仅 landmark 槽位（替代 POI_SLOTS_BY_MAP）
let SEED_POIS_RAW = null;      // JSON 原始 seeds 对象（key=seedNumber 字符串），供 findRealPOITypeAtCoordinate 按坐标查 type

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

// 切换开关后重建 POI_SLOTS_BY_MAP（用缓存 raw，不重新 fetch）。categories 省略则取当前活跃集。
function rebuildPOISlots(categories) {
    if (!RAW_POI_LOOKUP) return;
    POI_SLOTS_BY_MAP = buildPOISlots(
        RAW_POI_LOOKUP,
        categories || getActiveCategories(),
        (typeof POIS_BY_MAP !== 'undefined') ? POIS_BY_MAP : {}
    );
}

// landmark type（中文）→ icon 路径。源自 nightreignMapPatterns.json 的 landmark type 集合：
// 教堂/法师塔/马车/特殊商人/破败小屋（icon 分别 church/rise/carriage/merchant/blessing）。
// 'empty'（无建筑）与未命中 type 走 createPOISuggestionUI 内部兜底，不在此表。
const TYPE_ICON_MAP = {
    '教堂': 'assets/icons/church.png',
    '法师塔': 'assets/icons/rise.png',
    '马车': 'assets/icons/carriage.png',
    '特殊商人': 'assets/icons/merchant.png',
    '破败小屋': 'assets/icons/blessing.png',
};

// type 显示名映射：内部 type 值（参与匹配/排序/状态机）与界面显示文字解耦。
// 仅影响渲染文字，不动数据源（JSON/CSV/vendor NAME.xlsx）。新增显示别名在此追加。
const TYPE_DISPLAY_MAP = {
    '特殊商人': '大商人',  // 移动端浮窗 4 字换行 → 改 3 字「大商人」
    '破败小屋': '祷告屋',  // 同上，4 字 → 3 字
};

// category → 默认 icon（已选态用）。landmark 走 TYPE_ICON_MAP（按 type），其余按 category 统一 icon。
// 依据 nightreignMapPatterns.json：fieldBoss 27 种 type 共用 field_boss，stronghold 47 种共用 camp_blank。
const CATEGORY_ICON_MAP = {
    'fieldBoss': 'assets/icons/field_boss.png',
    'stronghold': 'assets/icons/camp_blank.png',
    'scaleMerchant': 'assets/icons/merchant.png',
    'merchant': 'assets/icons/merchant.png',
};

// category → dot 未标记态颜色。landmark 橙（现状）；scaleMerchant 红（持秤商人单独高亮）；其余金。
const CATEGORY_DOT_COLOR = {
    'landmark': '#ff8c00',
    'fieldBoss': '#ffd700',
    'stronghold': '#ffd700',
    'scaleMerchant': '#ff2d2d',
    'merchant': '#ffd700',
};

// 出生点 label 圈数字 → 阿拉伯数字（英文版 drawSpawnMarker 渲染 SP1/SP2… 用；中文版沿用原 label）
const CIRCLED_TO_NUM = { '①':'1','②':'2','③':'3','④':'4','⑤':'5','⑥':'6','⑦':'7','⑧':'8','⑨':'9' };

// 共享点位浮窗「方向覆盖」坐标集（768 空间，容差±3px）。命中则按 dir 渲染，跳过 originalId 偏移表。
// 各地形同坐标点的 originalId 不同，故按坐标判断而非 originalId。新增条目向数组追加 {x,y,dir}。
// 已知条目（verify_pool 标定图，均四地形 Default/Mountaintop/Crater/Rotted Woods 同坐标）：
//   #300 (158.8,542.5) below ｜ #301 (162.7,425.4) left
const POI_RENDER_OVERRIDE = [
    { x: 158.8, y: 542.5, dir: 'below' },                                // #300（全平台）
    { x: 162.7, y: 425.4, dir: 'left' },                                 // #301（全平台）
    { x: 594.6, y: 273.4, dir: 'right', valign: 'bottom', vertical: true, mobile: true }, // #116 移动端：点位右侧+底对齐，竖排（向上展开）
    { x: 615.3, y: 445.1, dir: 'right', valign: 'top', vertical: true, mobile: true },    // #312 移动端：点位右侧+顶对齐，竖排（向下展开）
    { x: 530.65, y: 281.3, noTail: true, mobile: true },                   // #314 移动端：无箭头，右上角锚定点位最右侧，向左下方展开
    { x: 349.15, y: 531.15, noTail: true, valign: 'top', mobile: true },   // #305 移动端：无箭头，右下角锚定点位最右侧，向左上方展开
    { x: 725.4, y: 499.25, dir: 'left', noTail: true, vertical: true },   // #1153 大空洞：无箭头贴边，竖向左侧居中（PC+移动端）
    { x: 472.65, y: 399.15, dir: 'right', noTail: true, vertical: true, mobile: true }, // #1152 大空洞：无箭头贴边，竖向右侧居中
];

// 气泡尾 SVG（白填充 + 蓝描边 #4fc3f7，匹配浮窗边框）。尖朝向 POI 那一侧。
const BUBBLE_TAIL_SVG = {
    below: '<svg width="22" height="12" viewBox="0 0 22 12"><polygon points="11,1 21,11 1,11" fill="rgba(255,255,255,0.98)" stroke="#4fc3f7" stroke-width="2" stroke-linejoin="round"/></svg>',
    above: '<svg width="22" height="12" viewBox="0 0 22 12"><polygon points="11,11 21,1 1,1" fill="rgba(255,255,255,0.98)" stroke="#4fc3f7" stroke-width="2" stroke-linejoin="round"/></svg>',
    left:  '<svg width="12" height="22" viewBox="0 0 12 22"><polygon points="11,11 1,1 1,21" fill="rgba(255,255,255,0.98)" stroke="#4fc3f7" stroke-width="2" stroke-linejoin="round"/></svg>',
    right: '<svg width="12" height="22" viewBox="0 0 12 22"><polygon points="1,11 11,1 11,21" fill="rgba(255,255,255,0.98)" stroke="#4fc3f7" stroke-width="2" stroke-linejoin="round"/></svg>',
};

async function loadSeedData() {
    try {
        const response = await fetch('dataset/nightreignMapPatterns.json');
        const data = await response.json();

        const seeds = data.seeds || {};
        SEED_POIS_RAW = seeds;
        SEED_REGISTRY = Object.values(seeds).map(s => ({
            seedNumber: s.seedNumber,
            nightlord: s.nightlord,
            mapType: s.mapType
        }));

        // 缓存原始 poiLookupByMapType，供切换开关时 rebuildPOISlots 重建（不重新 fetch）
        RAW_POI_LOOKUP = data.poiLookupByMapType || {};
        POI_SLOTS_BY_MAP = buildPOISlots(RAW_POI_LOOKUP, getActiveCategories(), (typeof POIS_BY_MAP !== 'undefined') ? POIS_BY_MAP : {});

        console.log('✅ 种子数据已加载:', SEED_REGISTRY.length, '颗种子,', Object.keys(POI_SLOTS_BY_MAP).length, '地形');
        return true;
    } catch (error) {
        console.error('❌ 加载 nightreignMapPatterns.json 失败:', error);
        return false;
    }
}


class NightreignMapRecogniser {
    constructor() {
        this.languageManager = new LanguageManager();
        this.chosenNightlord = null;
        this.chosenMap = null;
        this.selectedSpawn = null;   // 选中的出生点值（如 "13000"），null=未选/跳过
        this.spawnPhase = true;      // true=出生点阶段（锁地标），false=地标阶段
        this.currentPOIs = [];
        this.poiStates = {};
        // 大空洞碰撞消歧状态：A=A点 fieldBoss type, B=B点 stronghold 据点；null=未选
        this.disambigStates = { A: null, B: null };
        this.disambigActive = false;        // 当前是否处于消歧模式（GH + 剩 2 碰撞种子）
        this.currentDisambigPair = null;    // 当前碰撞对 [seedNum1, seedNum2]（升序）
        this.currentDisambigPoint = null;   // 当前正在选择的消歧点（GH_DISAMBIG_POINTS.A/B）
        this.disambigMenus = { A: null, B: null };  // #disambig-menu-a/b DOM 引用（setupContextMenu 初始化）
        this.images = {
            maps: {},
            empty: new Image(),  // POI "空"标记图标（drawPOI 用）
        };
        this.showingSeedImage = false;
        this.canvas = null;
        this.ctx = null;
        this.contextMenu = null;
        this.currentRightClickedPOI = null;
        this.canvasEventListenersSetup = false; // 新增标志
        this.userIsClearing = false; // Flag to track when user is clearing an existing POI.

        this.init();
    }

    async init() {
        // Wait for language manager to initialize
        await this.languageManager.init();
        
        this.setupImages();
        this.setupEventListeners();
        await this.loadInitialData();
        this.showSelectionSection();
        
        // Listen for language changes
        window.addEventListener('languageChanged', (e) => {
            this.onLanguageChanged(e.detail.language);
        });
    }


    setupImages() {
        // Load icon images (POI "空"标记图标)
        this.images.empty.src = ICON_ASSETS.empty;

        // POI type 图标（中文 type → Image，源自 TYPE_ICON_MAP，对齐 nightreignMapPatterns.json）
        this.typeImages = {};
        Object.entries(TYPE_ICON_MAP).forEach(([type, src]) => {
            const img = new Image();
            img.src = src;
            this.typeImages[type] = img;
        });

        // category 默认图标（非 landmark 的 category 统一 icon，预加载供 Task 4/5 渲染用）
        this.categoryImages = {};
        Object.entries(CATEGORY_ICON_MAP).forEach(([cat, src]) => {
            const img = new Image();
            img.src = src;
            this.categoryImages[cat] = img;
        });

        // Add error handling for images
        this.images.empty.onerror = () => {
            console.warn('Failed to load empty icon');
        };

        // 预加载默认地形（最常用，且 drawDefaultMapWithImage 在未选地形时会用到）；
        // 其余 5 种地形改为懒加载——selectMap 选中时由 ensureMapLoaded 按需下载。
        this.ensureMapLoaded('Default');
    }

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
            } else if (mapName === 'Default' && !this.chosenMap && this.ctx) {
                // 冷加载首屏：Default 预加载完时用户尚未选地形（chosenMap=null），
                // 主守卫恒 false 不重绘——补画到默认视图，让首屏看到真实 Default 底图
                this.drawDefaultMapWithImage();
            }
        };
        img.onerror = () => {
            console.warn(`Failed to load map image: ${mapName}`, url);
        };
        img.src = url;
        this.images.maps[mapName] = img;
        return img;
    }

    onLanguageChanged(language) {
        console.log('Language changed to:', language);
        
        // Refresh seed image if currently displayed (handles pattern images)
        if (this.showingSeedImage) {
            this.refreshSeedImage();
        }
        
        // Update loading status messages if they exist
        this.updateLoadingStatusMessages();
    }


    refreshSeedImage() {
        // Refresh the currently displayed seed image with new language
        if (this.showingSeedImage && this.lastSeedRow) {
            this.showSeedImage(this.lastSeedRow);
        }
    }

    updateLoadingStatusMessages() {
        // Update loading status messages if they exist
        const statusElement = document.getElementById('cv-status');
        if (statusElement && statusElement.dataset.loadingType) {
            const loadingType = statusElement.dataset.loadingType;
            const seedCount = parseInt(statusElement.dataset.seedCount);
            
            if (loadingType === 'classified') {
                const classCount = parseInt(statusElement.dataset.classCount);
                statusElement.innerHTML = `<span style="color: #28a745;">✅ ${this.getText('loading.classified', { count: seedCount, classified: classCount })}</span>`;
            } else if (loadingType === 'seeds') {
                statusElement.innerHTML = `<span style="color: #28a745;">✅ ${this.getText('loading.seeds', { count: seedCount })}</span>`;
            }
        }
    }





    setupEventListeners() {
        // Nightlord selection
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const nightlord = btn.dataset.nightlord;
                this.selectNightlord(nightlord);
            });
        });

        // Map selection
        document.querySelectorAll('.map-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const map = btn.dataset.map;
                this.selectMap(map);
            });
        });

        // Reset button
        document.getElementById('reset-map-btn').addEventListener('click', () => {
            this.resetMap();
        });

        // Skip spawn point button
        document.getElementById('skip-spawn-btn').addEventListener('click', () => {
            this.skipSpawn();
        });

        // CV Classification data loader

        // Help button and modal
        document.getElementById('help-btn').addEventListener('click', () => {
            this.showHelpModal();
        });

        document.getElementById('close-help').addEventListener('click', () => {
            this.hideHelpModal();
        });

        // Close modal when clicking outside
        document.getElementById('help-modal').addEventListener('click', (e) => {
            if (e.target.id === 'help-modal') {
                this.hideHelpModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideHelpModal();
            }
        });

        this.setupAdvancedToggle();

        // Context menu setup
        this.setupContextMenu();

        // 消歧菜单为 fixed 定位，页面滚动/缩放后需重算屏幕坐标以继续贴在紫点旁
        this.repositionHandler = () => this.repositionDisambigMenus();
        window.addEventListener('scroll', this.repositionHandler, true);  // capture：捕获任意滚动容器
        window.addEventListener('resize', this.repositionHandler);
    }

    async loadInitialData() {
        try {
            // 高级模式开关必须先于数据加载确定（数据层会根据 category 集合过滤）
            initAdvancedMode();
            // 加载权威种子数据（nightreignMapPatterns.json）
            await loadSeedData();
            const seedCount = SEED_REGISTRY.length;

            // Update status display
            const statusElement = document.getElementById('cv-status');
            if (statusElement) {
                statusElement.dataset.loadingType = 'seeds';
                statusElement.dataset.seedCount = seedCount;
                statusElement.innerHTML = `<span style="color: #28a745;">✅ ${this.getText('loading.seeds', { count: seedCount })}</span>`;
            }

            this.hideLoadingSection();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError(this.getText('error.load_failed'));
        }
    }

    hideLoadingSection() {
        const loadingSection = document.getElementById('loading-section');
        if (loadingSection) {
            loadingSection.style.display = 'none';
        }
    }

    showSelectionSection() {
        // 选择区（夜王/地形）已并入 results-sidebar 常驻显示，这里只需确保 results-section 显示
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';
        this.updateSeedCount();

        // Show default map immediately so users can start clicking
        this.showDefaultMap();
    }

    showDefaultMap() {
        // Set up a default map (Default map type) for immediate interaction
        this.currentPOIs = POI_SLOTS_BY_MAP['Default'] || [];
        this.poiStates = this.initializePOIStates();

        // 操作按钮已常驻 results-sidebar，无需单独显示 interaction-section
        // Render the default map
        this.renderDefaultMap();
    }

    renderDefaultMap() {
        console.log('Rendering default map for immediate interaction');

        const canvas = document.getElementById('map-canvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }

        canvas.style.display = 'block';
        document.getElementById('seed-image-container').style.display = 'none';

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Try to load the default POI image, fall back to placeholder if needed
        this.drawDefaultMapWithImage();
        this.setupCanvasEventListeners();
    }

    drawDefaultMap() {
        // canvas 内部分辨率提至 1536（与底图源 1:1 清晰，CSS 再缩小填充右栏＝与种子图同等大小），
        // 数据/坐标/字体/图标仍为 768 空间不变，setTransform(2) 把 768 坐标系映射到 1536 canvas。
        this.ctx.setTransform(2, 0, 0, 2, 0, 0);
        this.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Draw a nice default background
        const gradient = this.ctx.createRadialGradient(CANVAS_SIZE/2, CANVAS_SIZE/2, 0, CANVAS_SIZE/2, CANVAS_SIZE/2, CANVAS_SIZE/2);
        gradient.addColorStop(0, '#34495e');
        gradient.addColorStop(0.7, '#2c3e50');
        gradient.addColorStop(1, '#1a1a2e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Add decorative border
        this.ctx.strokeStyle = '#4fc3f7';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(10, 10, CANVAS_SIZE - 20, CANVAS_SIZE - 20);

        // Add title
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = 'bold 28px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const mapTitle = this.chosenMap ? `${this.chosenMap} Map Area` : 'Default Map Area';
        this.ctx.fillText(mapTitle, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 60);

        this.ctx.fillStyle = '#4fc3f7';
        this.ctx.font = 'bold 18px Inter, sans-serif';
        this.ctx.fillText(this.getText('map.click_dots'), CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Inter, sans-serif';
        this.ctx.fillText(this.getText('map.select_parameters'), CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);

        // Draw POIs for Default map
        this.currentPOIs.forEach(poi => {
            const state = this.poiStates[poi.id];
            this.drawPOI(poi, state);
        });

        console.log(`Drew default map with ${this.currentPOIs.length} POIs`);
    }

    drawDefaultMapWithImage() {
        this.ctx.setTransform(2, 0, 0, 2, 0, 0);  // 768 数据空间 → 1536 canvas（见 drawDefaultMap 注释）
        // Try to use the actual Default POI image if available
        const defaultMapImg = this.images.maps['Default'];

        if (defaultMapImg && defaultMapImg.complete && defaultMapImg.naturalWidth > 0) {
            // Use the actual POI image
            this.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            this.ctx.drawImage(defaultMapImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // Draw POIs on top
            this.currentPOIs.forEach(poi => {
                const state = this.poiStates[poi.id];
                this.drawPOI(poi, state);
            });

            console.log(`Drew default map with actual POI image and ${this.currentPOIs.length} POIs`);
        } else {
            // Fall back to placeholder
            this.drawDefaultMap();
        }
    }

    drawMapWithSelectedImage() {
        this.ctx.setTransform(2, 0, 0, 2, 0, 0);  // 768 数据空间 → 1536 canvas（见 drawDefaultMap 注释）
        // Use the selected map's POI image if available
        const mapImg = this.images.maps[this.chosenMap];

        if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
            // Use the actual POI image for the selected map
            this.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            this.ctx.drawImage(mapImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // Draw POIs on top
            this.currentPOIs.forEach(poi => {
                const state = this.poiStates[poi.id];
                this.drawPOI(poi, state);
            });

            console.log(`Drew ${this.chosenMap} map with actual POI image and ${this.currentPOIs.length} POIs`);
        } else {
            // Fall back to placeholder with map name
            this.drawDefaultMap();
        }
    }

    // 更新「当前选择」显示；基础版已移除该 UI，元素不存在时安全跳过
    setChosenText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

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

    selectNightlord(nightlord) {
        // If the same nightlord is clicked again, clear the selection
        if (this.chosenNightlord === nightlord) {
            this.chosenNightlord = null;

            // Update UI
            this.setChosenText('chosen-nightlord', this.getText('nightlord.none'));

            // Clear all button states
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            console.log('Cleared nightlord selection');
        } else {
            // Select the new nightlord
            this.chosenNightlord = nightlord;

            // Update UI
            this.setChosenText('chosen-nightlord', this.getNightlordTranslatedName(nightlord));

            // Update button states
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.nightlord === nightlord);
            });

            console.log(`Selected nightlord: ${nightlord}`);
        }

        // 切换夜王重置地图：清出生点、回出生点阶段（POI 标记由 updateGameState→initializePOIStates 重置为全 dot，消歧由 resetDisambig 清）
        this.selectedSpawn = null;
        this.spawnPhase = true;

        this.updateGameState();
        // 移动端选夜王后滚回夜王选择区，使夜王/地形两区都进入视口；PC 仍滚到地图区
        if (window.matchMedia('(max-width: 1024px)').matches) {
            requestAnimationFrame(() => {
                document.querySelector('.results-sidebar .selection-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
        } else {
            this.scrollMapIntoView();
        }
    }

    selectMap(map) {
        // 再次点击已选地形：重置当前地图标记（回出生点阶段、清 POI），保留地形选中
        // 与夜王选择（夜王/地形是独立维度）；与新选地形一致，末尾同样滚动到地图区
        if (this.chosenMap === map) {
            this.selectedSpawn = null;
            this.spawnPhase = true;
            this.hidePOISuggestions();
            console.log(`Reset markers for map: ${map}`);
        } else {
            // Select the new map
            this.chosenMap = map;
            this.ensureMapLoaded(map);  // 懒加载该地形底图（已加载则命中缓存）
            this.currentPOIs = POI_SLOTS_BY_MAP[map] || [];
            this.poiStates = this.initializePOIStates();
            this.selectedSpawn = null;   // 切地图重置出生点
            this.spawnPhase = true;      // 新地图默认回到出生点阶段

            console.log(`Selected map: ${map}, POIs: ${this.currentPOIs.length}`);

            // Update UI
            this.setChosenText('chosen-map', this.getMapTranslatedName(map));

            // Update button states
            document.querySelectorAll('.map-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.map === map);
            });

            console.log(`Selected map: ${map}`);
        }

        this.updateGameState();
        this.scrollMapIntoView('end');
    }

    // 选夜王/地形后滚动地图区：PC（≥1024px）滚到视口顶部——map-area 在
    // @media(min-width:1024px) 下 min-height:100vh + justify-content:center，画布落在屏幕
    // 上下中央（与最终种子图同机制）。移动端默认不滚；调用方传 mobileBlock 时按其对齐
    // （selectMap 传 'end'：选地形后画布与窗口底部对齐）。
    scrollMapIntoView(mobileBlock = null) {
        const isPC = window.matchMedia('(min-width: 1024px)').matches;
        const block = isPC ? 'start' : mobileBlock;
        if (block) {
            requestAnimationFrame(() => {
                document.querySelector('.map-area')?.scrollIntoView({ block, behavior: 'smooth' });
            });
        }
    }

    initializePOIStates() {
        const states = {};
        this.currentPOIs.forEach(poi => {
            states[poi.id] = 'dot';
        });
        return states;
    }

    // 检测剩余种子是否存在 landmark 碰撞（任意两种子的 landmark type 向量相同 → 无法仅靠 landmark 区分）。
    // 动态判定，不依赖硬编码 GH_DISAMBIG：碰撞种子的区分值由 A/B 点位实时从 JSON 读取。
    detectHasLandmarkCollision(filteredSeeds) {
        if (this.chosenMap !== 'Great Hollow') return false;
        if (!filteredSeeds || filteredSeeds.length < 2) return false;
        // 消歧是共享 landmark 穷尽后的最后手段：所有共享点位都已确定（无 dot 未标记）才考虑，
        // 否则优先让用户继续标 landmark（未标完时消歧菜单会提前冒出、干扰判断）
        const allMarked = this.currentPOIs.every(poi => this.poiStates[poi.id] !== 'dot');
        if (!allMarked) return false;
        // 所有 landmark 标定后仍存在向量重复 → 真正无法靠 landmark 区分 → 触发消歧
        const vectors = new Set();
        for (const s of filteredSeeds) {
            const vec = JSON.stringify(this.currentPOIs.map(poi =>
                this.findRealPOITypeAtCoordinate(s.seedNumber, poi.x, poi.y)));
            if (vectors.has(vec)) return true;  // 向量重复 → 碰撞
            vectors.add(vec);
        }
        return false;
    }

    // 渲染碰撞消歧点位（仅消歧模式；由 drawMap 调用）。紫色圆点，与 POI 'dot' 视觉一致。
    drawDisambigPoints() {
        if (!this.disambigActive) return;
        ['A', 'B'].forEach(k => {
            const pt = GH_DISAMBIG_POINTS[k];
            const state = this.disambigStates[k];
            const { x, y } = pt;
            if (!state) {
                // 未选：紫色圆点
                this.drawDot(x, y, '', '#b266ff');
            } else {
                // 已选/已锁定：紫色实心圆 + 圆下方文字标签（完整 type 名；单值点直接展示结果）
                this.ctx.beginPath();
                this.ctx.arc(x, y, ICON_SIZE / 2, 0, 2 * Math.PI);
                this.ctx.fillStyle = '#b266ff';
                this.ctx.fill();
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                this.ctx.font = 'bold 11px Inter, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                const ty = y + ICON_SIZE / 2 + 10;
                this.ctx.lineWidth = 3;
                this.ctx.strokeStyle = '#000000';
                const disp = this.displayName(state);  // 显示名（如 特殊商人→大商人）
                this.ctx.strokeText(disp, x, ty);  // 黑描边，地图杂色上保证可读
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillText(disp, x, ty);
            }
        });
    }

    updateGameState() {
        this.resetDisambig();  // 切换地图时清除上一张图的消歧状态（避免 A/B 坐标错画到新地图）

        // 换夜王/地图 = 全新查询：退出"单种子结果图"模式。
        // 否则 showingSeedImage=true 会让 renderMap() 直接 return（画布卡在旧种子图），
        // 且 drawDefaultMapWithImage 会画在仍被 showSeedImage 隐藏的 canvas 上。
        if (this.showingSeedImage) {
            this.showingSeedImage = false;
            this.hideSeedDetails();
            const canvas = document.getElementById('map-canvas');
            const seedImageContainer = document.getElementById('seed-image-container');
            if (canvas) canvas.style.display = 'block';
            if (seedImageContainer) seedImageContainer.style.display = 'none';
        }

        if (this.chosenMap) {
            // Map is selected - show full functionality
            this.currentPOIs = POI_SLOTS_BY_MAP[this.chosenMap] || [];
            this.poiStates = this.initializePOIStates();

            this.showInteractionSection();
            this.showResultsSection();
            this.renderMap();
            this.updateSeedFiltering();
            this.hideSelectionOverlay();
        } else {
            // No map selected - show default view but keep interaction available
            this.currentPOIs = POI_SLOTS_BY_MAP['Default'] || [];
            this.poiStates = this.initializePOIStates();

            this.showInteractionSection();
            this.showResultsSection();

            // Draw default map if canvas exists
            if (this.canvas && this.ctx) {
                this.drawDefaultMapWithImage();
            }

            // Update seed count and show overlay
            this.updateSeedCount();
            this.showSelectionOverlay();
        }
    }

    showInteractionSection() {
        // 操作按钮（重置/跳过/帮助）已常驻 results-sidebar，无需切换 section
    }

    showResultsSection() {
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';
    }



    showSelectionOverlay() {
        const overlay = document.getElementById('selection-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    hideSelectionOverlay() {
        const overlay = document.getElementById('selection-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    setupContextMenu() {
        // 旧右键 4 类菜单（#poi-context-menu）已移除，POI 标记改用 suggestion 浮窗。
        // 此处仅保留消歧菜单 DOM 引用初始化。
        this.disambigMenus = {
            A: document.getElementById('disambig-menu-a'),
            B: document.getElementById('disambig-menu-b'),
        };
    }


    // 长按指示器方法
    showLongPressIndicator(x, y) {
        // 清除任何现有的指示器
        this.hideLongPressIndicator();

        // 创建一个新的指示器元素
        const indicator = document.createElement('div');
        indicator.id = 'long-press-indicator';

        // 计算指示器位置
        const canvas = document.getElementById('map-canvas');
        const rect = canvas.getBoundingClientRect();
        const scaleX = (canvas.width / 2) / rect.width;   // canvas 1536 / 数据 768 空间
        const scaleY = (canvas.height / 2) / rect.height;

        const screenX = (x / scaleX) + rect.left - 30;
        const screenY = (y / scaleY) + rect.top - 30;

        indicator.style.left = `${screenX}px`;
        indicator.style.top = `${screenY}px`;

        // 添加到文档
        document.body.appendChild(indicator);

        // 强制重绘以确保动画生效
        setTimeout(() => {
            indicator.style.opacity = '0.9';
        }, 10);
    }

    hideLongPressIndicator() {
        const indicator = document.getElementById('long-press-indicator');
        if (indicator) {
            // 添加淡出效果
            indicator.style.opacity = '0';
            indicator.style.transition = 'opacity 0.2s';

            // 等待淡出完成后移除元素
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 200);
        }
    }

    renderMap() {
        if (this.showingSeedImage) return;

        console.log(`Rendering map for ${this.chosenMap}`);

        const mapContainer = document.querySelector('.map-container');
        const canvas = document.getElementById('map-canvas');
        const seedImageContainer = document.getElementById('seed-image-container');

        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }

        canvas.style.display = 'block';
        seedImageContainer.style.display = 'none';

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        const mapImage = this.images.maps[this.chosenMap];

        if (!mapImage) {
            console.error(`Map image not found for ${this.chosenMap}`);
            // Draw anyway with placeholder
            this.drawMap(null);
        } else if (mapImage.complete) {
            console.log(`Map image ready for ${this.chosenMap}`);
            this.drawMap(mapImage);
        } else {
            console.log(`Waiting for map image to load: ${this.chosenMap}`);
            // 图正在加载：ensureMapLoaded 已绑 onload（带防串图守卫）负责加载完重绘，此处先画占位
            this.drawMap(mapImage);
        }

        this.setupCanvasEventListeners();
    }

    drawMap(mapImage) {
        this.ctx.setTransform(2, 0, 0, 2, 0, 0);  // 768 数据空间 → 1536 canvas（见 drawDefaultMap 注释）
        this.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Always draw a background first
        this.ctx.fillStyle = '#2b2b2b';
        this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Draw map image if available
        if (mapImage && mapImage.complete && mapImage.naturalWidth > 0) {
            try {
                this.ctx.drawImage(mapImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
            } catch (error) {
                console.warn('Error drawing map image:', error);
                // Draw placeholder background
                const gradient = this.ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                gradient.addColorStop(0, '#2c3e50');
                gradient.addColorStop(1, '#34495e');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

                // Add text
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 20px Inter, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(`${this.chosenMap} Map`, CANVAS_SIZE / 2, CANVAS_SIZE / 2);
                this.ctx.font = '14px Inter, sans-serif';
                this.ctx.fillText(this.getText('map.click_dots'), CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 30);
            }
        }

        // 出生点候选（提前计算，用于决定地标是否展示）：按当前夜王+地形过滤掉不可能出现的出生点
        const spawns = this.getValidSpawns();

        // 画地标 POI：出生点阶段且有出生点数据时隐藏（选完出生点后再展示，避免地标圆点遮挡出生点）
        if (!(this.spawnPhase && spawns.length > 0)) {
            if (this.spawnPhase) this.ctx.globalAlpha = 0.3;
            this.currentPOIs.forEach(poi => {
                const state = this.poiStates[poi.id];
                this.drawPOI(poi, state);
            });
            this.ctx.globalAlpha = 1.0;
        }

        // 碰撞消歧点位（仅消歧模式：GH 剩 2 碰撞种子时由 updateSeedFiltering 置位）
        this.drawDisambigPoints();

        // 画出生点标记（蓝色三角）：仅出生点阶段显示；选完进入地标阶段后隐藏（用户反馈：选完不再显示点位标志）
        if (this.spawnPhase) {
            spawns.forEach(sp => this.drawSpawnMarker(sp));
        }

        // 出生点阶段顶部提示
        if (this.spawnPhase && spawns.length > 0) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, CANVAS_SIZE, 40);
            this.ctx.fillStyle = '#00e5ff';
            this.ctx.font = 'bold 16px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.getText('map.spawn_hint'), CANVAS_SIZE / 2, 20);
        }

        console.log(`Drew map with ${this.currentPOIs.length} POIs and ${spawns.length} spawn points for ${this.chosenMap}`);
    }

    drawPOI(poi, state) {
        const { x, y } = poi;
        const cat = poi.category || 'landmark';
        // 高级模式额外点位（非 landmark）缩小 50%；scaleMerchant 持秤商人在此基础上再缩 50% → 0.25；共享点位保持基础尺寸
        const scale = (advancedMode && cat === 'scaleMerchant') ? 0.25
            : (advancedMode && cat !== 'landmark') ? 0.5 : 1;

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

    // type 显示名（内部 type 值 → 界面文字；仅渲染层映射，不改数据源/匹配/排序逻辑）
    displayName(type) {
        if (this.languageManager && this.languageManager.getCurrentLanguage() === 'en'
            && typeof POI_TYPE_EN !== 'undefined' && POI_TYPE_EN[type]) {
            return POI_TYPE_EN[type];
        }
        return TYPE_DISPLAY_MAP[type] || type;
    }

    drawSpawnMarker(sp) {
        const { x, y, value, label } = sp;
        const selected = this.selectedSpawn === value;
        const r = ICON_SIZE / 2;
        // 蓝色实心三角（选中时青色高亮）
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - r);
        this.ctx.lineTo(x + r, y + r);
        this.ctx.lineTo(x - r, y + r);
        this.ctx.closePath();
        this.ctx.fillStyle = selected ? '#00e5ff' : '#2196f3';
        this.ctx.fill();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        // 序号 label：中文「出生点①」/ 英文「SP1」（圈数字→阿拉伯数字）
        const spawnText = this.languageManager.getCurrentLanguage() === 'en'
            ? 'SP' + (CIRCLED_TO_NUM[(label.match(/[①-⑨]/) || [])[0]] || '')
            : label;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 11px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(spawnText, x, y + r * 0.3);
    }

    setupCanvasEventListeners() {
        // 如果监听器已经设置过，直接返回
        if (this.canvasEventListenersSetup) {
            return;
        }

        // Track touch start time for long press detection
        let touchStartTime = 0;
        let touchTimeout = null;
        let lastTouchPos = { x: 0, y: 0 };
        let touchStarted = false;
        let touchMoved = false;
        let lastTouchedPoi = null;
        let spawnToggledInTouchstart = false;  // 防止 touchend 对 spawn 阶段 touchstart 已处理的 spawn 二次切换

        // Left click - place church
        this.canvas.addEventListener('click', (e) => {
            if (!this.chosenMap) {
                console.log('Please select Map before marking POIs');
                return;
            }
            const pos = this.getMousePos(e);

            // spawn 阶段：spawn 优先，地标锁定
            if (this.spawnPhase) {
                const spawn = this.findClickedSpawn(pos.x, pos.y);
                if (spawn) {
                    this.selectedSpawn = (this.selectedSpawn === spawn.value) ? null : spawn.value;
                    if (this.selectedSpawn) this.spawnPhase = false;  // 选定出生点 → 进地标阶段
                    this.drawMap(this.images.maps[this.chosenMap]);
                    this.updateSeedFiltering();
                    console.log(`Spawn ${this.selectedSpawn ? 'selected' : 'cleared'}: ${spawn.value}`);
                } else {
                    console.log('Spawn phase active - landmark clicks ignored (select spawn or skip)');
                }
                return;
            }

            // 地标阶段：POI 优先
            const poi = this.findClickedPOI(pos.x, pos.y);
            if (poi) {
                // 已选点位 → 清回 dot（保留 userIsClearing 抑制 auto-fill 把值填回）
                if (this.poiStates[poi.id] !== 'dot' && this.poiStates[poi.id] !== 'hidden') {
                    this.poiStates[poi.id] = 'dot';
                    this.userIsClearing = true;
                    this.drawMap(this.images.maps[this.chosenMap]);
                    this.updateSeedFiltering();
                    this.userIsClearing = false;
                    this.hidePOISuggestions();
                } else {
                    // dot/hidden → 左键快捷标记教堂（候选含教堂），否则弹 suggestion 浮窗
                    this.markChurchOrSuggest(poi);
                }
                return;   // POI 命中后 return，不再查 spawn
            }

            // 地标阶段、POI 未命中：允许改选/取消出生点（不改变 spawnPhase）
            const spawn = this.findClickedSpawn(pos.x, pos.y);
            if (spawn) {
                this.selectedSpawn = (this.selectedSpawn === spawn.value) ? null : spawn.value;
                this.drawMap(this.images.maps[this.chosenMap]);
                this.updateSeedFiltering();
                console.log(`Spawn ${this.selectedSpawn ? 'selected' : 'cleared'}: ${spawn.value}`);
            }
        });

        // 专门为安卓设备添加的长按处理
        let longPressHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!touchStarted || touchMoved || !lastTouchedPoi) return;

            console.log("Long press detected!");

            // 长按 = 弹 suggestion 浮窗（等同短按/左键，单层交互）
            this.showPOISuggestionAt(lastTouchedPoi);

            // 隐藏长按指示器
            this.hideLongPressIndicator();

            // 添加振动反馈
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            // 清理状态
            touchStarted = false;
            touchMoved = false;
            lastTouchedPoi = null;

            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }
        };

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            // Prevent default to avoid scrolling
            e.preventDefault();

            if (!this.chosenMap) {
                console.log('Please select Map before marking POIs');
                return;
            }

            // 记录触摸开始时间
            touchStartTime = Date.now();
            touchStarted = true;
            touchMoved = false;

            // 获取触摸位置
            const touch = e.touches[0];
            const pos = this.getMousePos(touch);
            lastTouchPos = pos;
            spawnToggledInTouchstart = false;  // 每次触摸重置

            // spawn 阶段：spawn 优先，地标锁定（不设 lastTouchedPoi → touchend 短按与长按都不触发）
            if (this.spawnPhase) {
                const spawn = this.findClickedSpawn(pos.x, pos.y);
                if (spawn) {
                    this.selectedSpawn = (this.selectedSpawn === spawn.value) ? null : spawn.value;
                    if (this.selectedSpawn) this.spawnPhase = false;
                    this.drawMap(this.images.maps[this.chosenMap]);
                    this.updateSeedFiltering();
                    console.log(`Spawn ${this.selectedSpawn ? 'selected' : 'cleared'}: ${spawn.value}`);
                    spawnToggledInTouchstart = true;  // 标记本次触摸已处理 spawn，touchend 不再二次切换
                } else {
                    console.log('Spawn phase active - landmark touch ignored (select spawn or skip)');
                }
                return;
            }

            // 地标阶段：POI 优先（保持既有长按/短按逻辑完全不变）
            const poi = this.findClickedPOI(pos.x, pos.y);
            lastTouchedPoi = poi;

            if (poi) {
                console.log(`Touched POI ${poi.id} at (${poi.x}, ${poi.y})`);

                // 显示长按视觉反馈
                this.showLongPressIndicator(poi.x, poi.y);

                // 设置长按超时
                if (touchTimeout) {
                    clearTimeout(touchTimeout);
                }

                touchTimeout = setTimeout(() => {
                    longPressHandler(e);
                }, 500);
            }
            // POI 未命中时不启动长按计时；spawn 改选在 touchend 短按分支处理（见 Step 3）
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();

            // 隐藏长按指示器
            this.hideLongPressIndicator();

            // 如果是短暂点击（不是长按）
            const touchDuration = Date.now() - touchStartTime;
            console.log(`Touch duration: ${touchDuration}ms, moved: ${touchMoved}`);

            if (touchDuration < 500 && !touchMoved) {
                if (lastTouchedPoi) {
                    // 已选点位 → 清回 dot；dot/hidden → 弹 suggestion 浮窗（等同左键）
                    if (this.poiStates[lastTouchedPoi.id] !== 'dot' && this.poiStates[lastTouchedPoi.id] !== 'hidden') {
                        this.poiStates[lastTouchedPoi.id] = 'dot';
                        this.userIsClearing = true;
                        this.drawMap(this.images.maps[this.chosenMap]);
                        this.updateSeedFiltering();
                        this.userIsClearing = false;
                        this.hidePOISuggestions();
                    } else {
                        // 单点快捷标记教堂（候选含教堂），否则弹 suggestion 浮窗
                        this.markChurchOrSuggest(lastTouchedPoi);
                    }
                } else if (!this.spawnPhase && !spawnToggledInTouchstart) {
                    // 地标阶段、POI 未命中的短按：允许改选/取消出生点（排除 spawn 阶段 touchstart 已处理的触摸）
                    const spawn = this.findClickedSpawn(lastTouchPos.x, lastTouchPos.y);
                    if (spawn) {
                        this.selectedSpawn = (this.selectedSpawn === spawn.value) ? null : spawn.value;
                        this.drawMap(this.images.maps[this.chosenMap]);
                        this.updateSeedFiltering();
                        console.log(`Spawn ${this.selectedSpawn ? 'selected' : 'cleared'}: ${spawn.value}`);
                    }
                }
            }

            // 清理状态
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }

            touchStarted = false;
            lastTouchedPoi = null;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            // 标记为已移动，防止意外点击
            const touch = e.touches[0];
            const pos = this.getMousePos(touch);
            const dx = pos.x - lastTouchPos.x;
            const dy = pos.y - lastTouchPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // 只有移动超过一定距离才算移动
            if (distance > 10) {
                touchMoved = true;
                console.log("Touch moved");

                // 取消长按
                if (touchTimeout) {
                    clearTimeout(touchTimeout);
                    touchTimeout = null;
                }

                // 隐藏长按指示器
                this.hideLongPressIndicator();
            }
        }, { passive: false });

        // 确保在触摸取消时也清理
        this.canvas.addEventListener('touchcancel', (e) => {
            console.log("Touch cancelled");
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }
            this.hideLongPressIndicator();
            touchStarted = false;
            lastTouchedPoi = null;
        }, { passive: true });

        // Right click - show suggestion (single-layer, 同左键)
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.chosenMap) {
                console.log('Please select Map before marking POIs');
                return;
            }
            const pos = this.getMousePos(e);
            const poi = this.findClickedPOI(pos.x, pos.y);
            if (poi) {
                this.showPOISuggestionAt(poi);
            }
        });

        // Middle click - show suggestion (single-layer, 同左/右键)
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                if (!this.chosenMap) {
                    console.log('Please select Map before marking POIs');
                    return;
                }
                const pos = this.getMousePos(e);
                const poi = this.findClickedPOI(pos.x, pos.y);
                if (poi) {
                    this.showPOISuggestionAt(poi);
                }
            }
        });

        // Prevent middle click scroll
        this.canvas.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        });

        // 标记监听器已设置
        this.canvasEventListenersSetup = true;
    }

    getMousePos(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = (this.canvas.width / 2) / rect.width;   // canvas 1536 / 数据 768 空间
        const scaleY = (this.canvas.height / 2) / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY
        };
    }

    findClickedPOI(x, y) {
        return this.currentPOIs.find(poi => {
            const dx = x - poi.x;
            const dy = y - poi.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            // 增加移动端触控判定面积，使用1.5倍图标半径
            const touchRadius = ICON_SIZE / 2 * 1.5;
            return distance <= touchRadius;
        });
    }

    findClickedSpawn(x, y) {
        const spawns = this.getValidSpawns();
        return spawns.find(sp => {
            const dx = x - sp.x;
            const dy = y - sp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= ICON_SIZE / 2 * 1.5;  // 与 findClickedPOI 同触控半径
        });
    }

    // 动态生成 A、B 两个独立小菜单，各自依附在紫色点位右侧（空间不足翻左侧/下方）。
    // 消歧模式下由 updateSeedFiltering 自动调用，常驻显示直到退出消歧模式。
    // A 菜单：A 点 fieldBoss type（中文，无图标）；B 菜单：B 点 stronghold 据点名（中文，无图标）。
    // 动态生成 A/B 消歧菜单：从剩余种子在 A/B 坐标的实际 type（JSON 内嵌）读取，去重保序。
    // 弃用硬编码 GH_DISAMBIG —— 该表只录部分夜王种子，无法覆盖 GH 全部 22 个碰撞组。
    showDisambigMenu() {
        const seeds = this.lastFilteredSeeds || [];
        const ptA = GH_DISAMBIG_POINTS.A, ptB = GH_DISAMBIG_POINTS.B;

        // 收集某点在剩余种子的候选 type（去重保序）
        const collect = (pt) => {
            const vals = [];
            seeds.forEach(s => {
                const v = this.findRealPOITypeAtCoordinate(s.seedNumber, pt.x, pt.y);
                if (v && !vals.includes(v)) vals.push(v);
            });
            return vals;
        };
        const bossVals = collect(ptA);        // A 点 fieldBoss 候选
        const strongholdVals = collect(ptB);  // B 点 stronghold 据点候选

        // 仅多值点弹菜单；单值点已自动锁定（见 updateSeedFiltering），drawDisambigPoints 直接展示已选态，不弹单项菜单
        if (bossVals.length >= 2) {
            this.renderDisambigMenu(ptA, this.disambigMenus.A, 'A',
                bossVals.map(v => ({ value: v, label: v })));
        } else if (this.disambigMenus.A) {
            this.disambigMenus.A.style.display = 'none';
        }
        if (strongholdVals.length >= 2) {
            this.renderDisambigMenu(ptB, this.disambigMenus.B, 'B',
                strongholdVals.map(v => ({ value: v, label: v })));
        } else if (this.disambigMenus.B) {
            this.disambigMenus.B.style.display = 'none';
        }
    }

    // 渲染单个消歧菜单并依附到对应点位（常驻：选中后由 updateSeedFiltering 刷新高亮，不关闭）
    renderDisambigMenu(point, menuEl, key, items, t) {
        if (!menuEl) return;
        const iconImg = (src) => src ? `<img src="assets/icons/${src}" style="width:16px;height:16px;">` : '';
        const selStyle = (on) => on ? ' style="background:rgba(178,102,255,0.25);"' : '';
        let html = '';
        items.forEach(it => {
            const label = it.label ? `<span style="white-space:nowrap;">${this.displayName(it.label)}</span>` : '';
            html += `<div class="context-menu-item" data-value="${it.value}"${selStyle(it.value === this.disambigStates[key])}>${iconImg(it.icon)}${label}</div>`;
        });
        menuEl.innerHTML = html;
        menuEl.style.minWidth = '0';  // 覆盖 .context-menu 的 min-width:220px，宽度随内容收缩
        menuEl.querySelectorAll('.context-menu-item').forEach(item => {
            const choose = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setDisambigState(point, item.dataset.value || null);
            };
            item.addEventListener('click', choose);
            item.addEventListener('touchend', choose);
        });

        const firstShow = menuEl.style.display !== 'block';
        menuEl.style.display = 'block';
        this.positionDisambigMenu(point, menuEl);
        if (firstShow) {
            menuEl.style.opacity = '0';
            menuEl.style.transform = 'scale(0.95)';
            menuEl.style.transition = 'opacity 0.2s, transform 0.2s';
            setTimeout(() => {
                menuEl.style.opacity = '1';
                menuEl.style.transform = 'scale(1)';
            }, 10);
        }
    }

    // 单个消歧菜单定位：贴在对应紫色点位右侧、纵向居中于该点；
    // 右侧放不下翻左侧，仍放不下（窄屏）改点位正下方。canvas 坐标(768 空间)→屏幕坐标。
    positionDisambigMenu(point, menuEl) {
        if (!menuEl || !this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width / CANVAS_SIZE;
        const scaleY = rect.height / CANVAS_SIZE;
        const dotX = rect.left + point.x * scaleX;
        const dotY = rect.top + point.y * scaleY;
        const menuWidth = menuEl.offsetWidth || 180;
        const menuHeight = menuEl.offsetHeight || 120;
        const gap = 18;  // 点边缘到菜单的间距

        // 移动端：B 点(stronghold 据点)菜单放点位正下方，避免向右延伸落在 A、B 两点之间造成混淆
        const preferBelow = window.innerWidth <= 768 && point.kind === 'stronghold';

        let x, y;
        if (preferBelow) {
            x = dotX - menuWidth / 2;
            y = dotY + gap;
        } else {
            x = dotX + gap;
            y = dotY - menuHeight / 2;
            // 右侧放不下 → 翻左侧
            if (x + menuWidth > window.innerWidth - 8) x = dotX - gap - menuWidth;
            // 仍放不下（屏幕过窄）→ 放点位正下方
            if (x < 8) {
                x = Math.max(8, Math.min(dotX - menuWidth / 2, window.innerWidth - menuWidth - 8));
                y = dotY + gap;
            }
        }
        // 水平/垂直边界 clamp
        if (x < 8) x = 8;
        if (x + menuWidth > window.innerWidth - 8) x = window.innerWidth - menuWidth - 8;
        if (y < 8) y = 8;
        if (y + menuHeight > window.innerHeight - 8) y = window.innerHeight - menuHeight - 8;
        menuEl.style.left = `${x}px`;
        menuEl.style.top = `${y}px`;
    }

    // 滚动/缩放时重定位显示中的消歧菜单，使其继续贴在紫点旁
    repositionDisambigMenus() {
        if (!this.disambigActive) return;
        ['A', 'B'].forEach(k => {
            const m = this.disambigMenus[k];
            if (m && m.style.display === 'block') {
                this.positionDisambigMenu(GH_DISAMBIG_POINTS[k], m);
            }
        });
    }

    // 设置某个消歧点的选择值（null=清除），然后重绘 + 过滤
    setDisambigState(point, value) {
        const key = (point.kind === 'fieldBoss') ? 'A' : 'B';
        this.disambigStates[key] = value;
        this.drawMap(this.images.maps[this.chosenMap]);
        this.updateSeedFiltering();
    }

    hideDisambigMenu() {
        ['A', 'B'].forEach(k => {
            const m = this.disambigMenus[k];
            if (m && m.style.display === 'block') {
                m.style.opacity = '0';
                m.style.transform = 'scale(0.95)';
                setTimeout(() => { if (m) m.style.display = 'none'; }, 200);
            }
        });
        this.currentDisambigPoint = null;
    }

    // 重置所有消歧状态（切换地图 / 重置标记时调用）
    resetDisambig() {
        this.disambigStates = { A: null, B: null };
        this.disambigActive = false;
        this.currentDisambigPair = null;
        this.currentDisambigPoint = null;
        this.hideDisambigMenu();
    }

    getValidSpawns() {
        const candidates = (typeof SPAWN_POINTS_BY_MAP !== 'undefined' && SPAWN_POINTS_BY_MAP[this.chosenMap]) || [];
        // 未选夜王：该地形的每个出生点在「某些夜王下」都可能出现，全部显示
        if (!this.chosenNightlord) return candidates;
        // 已选夜王：只保留该夜王 + 该地形下实际有种子使用的出生点，其余永不出现 → 不显示
        const possibleValues = new Set(
            SEED_REGISTRY
                .filter(s => s.nightlord === this.chosenNightlord && s.mapType === this.chosenMap)
                .map(s => SEED_SPAWN[s.seedNumber])
        );
        return candidates.filter(sp => possibleValues.has(sp.value));
    }

    resetMap() {
        // 恢复画布显示（showSeedImage 会隐藏 canvas、显示种子图），否则重绘不可见
        const canvas = document.getElementById('map-canvas');
        const seedImageContainer = document.getElementById('seed-image-container');
        if (canvas) canvas.style.display = 'block';
        if (seedImageContainer) seedImageContainer.style.display = 'none';

        // Clear only nightlord selection and POI states, keep map selection
        this.chosenNightlord = null;
        this.poiStates = this.initializePOIStates();
        this.resetDisambig();  // 清除大空洞碰撞消歧状态
        this.showingSeedImage = false;

        // Hide POI suggestions and nightlord info
        this.hidePOISuggestions();
        this.hideNightlordInfo();

        // Update UI for nightlord selection
        this.setChosenText('chosen-nightlord', this.getText('nightlord.none'));
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // If a map is selected, keep it and redraw with reset POIs
        if (this.chosenMap) {
            // Reinitialize POI states for current map
            this.currentPOIs = POI_SLOTS_BY_MAP[this.chosenMap] || [];
            this.poiStates = this.initializePOIStates();
            this.selectedSpawn = null;
            this.spawnPhase = true;

            // Redraw current map with reset POIs
            if (this.canvas && this.ctx) {
                this.drawMap(this.images.maps[this.chosenMap]);
            }

            // Update seed filtering
            this.updateSeedFiltering();
        } else {
            // No map selected - reset to default
            this.currentPOIs = POI_SLOTS_BY_MAP['Default'] || [];
            this.poiStates = this.initializePOIStates();

            // Draw default map
            if (this.canvas && this.ctx) {
                this.drawDefaultMapWithImage();
            }

            this.updateSeedCount();
            this.showSelectionOverlay();
        }

        console.log('Reset completed - cleared nightlord selection and POI states, kept map selection');

        // 移动端：重置后滚回夜王选择区，方便重新开始（PC 分栏布局下夜王常驻可见，无需滚动）
        if (window.matchMedia('(max-width: 1024px)').matches) {
            requestAnimationFrame(() => {
                document.querySelector('.results-sidebar .selection-card')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
        }
    }

    skipSpawn() {
        // 跳过出生点：不设筛选条件，直接进入地标阶段
        this.selectedSpawn = null;
        this.spawnPhase = false;
        if (this.canvas && this.ctx && this.chosenMap) {
            this.drawMap(this.images.maps[this.chosenMap]);
        }
        this.updateSeedFiltering();
        console.log('Skipped spawn selection, entered landmark phase');
    }

    hideNightlordInfo() {
        const nightlordInfo = document.getElementById('nightlord-info');
        if (nightlordInfo) {
            nightlordInfo.style.display = 'none';
        }
    }


    hideSeedDetails() {
        this.hideNightlordInfo();
        this.hidePOISuggestions();
    }


    updateSeedCount() {
        if (!this.chosenNightlord && !this.chosenMap) {
            document.getElementById('seed-count').textContent = SEED_REGISTRY.length;
            return;
        }

        // Use actual seed data to count seeds
        let count = 0;
        if (this.chosenNightlord && this.chosenMap) {
            count = SEED_REGISTRY.filter(s =>
                s.nightlord === this.chosenNightlord && s.mapType === this.chosenMap
            ).length;
        } else if (this.chosenNightlord) {
            count = SEED_REGISTRY.filter(s =>
                s.nightlord === this.chosenNightlord
            ).length;
        } else if (this.chosenMap) {
            count = SEED_REGISTRY.filter(s =>
                s.mapType === this.chosenMap
            ).length;
        }

        this.updateSeedCountDisplay(count);
    }

    updateSeedFiltering() {
        if (!this.chosenMap) {
            this.updateSeedCount();
            this.hideSeedDetails();
            return;
        }

        // Filter seeds by nightlord and map
        const possibleSeeds = SEED_REGISTRY.filter(s => {
            const allNightlords = !this.chosenNightlord || s.nightlord === this.chosenNightlord;
            const spawnOk = !this.selectedSpawn || SEED_SPAWN[s.seedNumber] === this.selectedSpawn;
            return allNightlords && s.mapType === this.chosenMap && spawnOk;
        });

        console.log(`Found ${possibleSeeds.length} seeds for ${this.chosenNightlord} + ${this.chosenMap}`);

        // Filter by POI states using coordinate-based matching
        // poiStates 值：'dot'(未标记) / 中文名 type(用户选定或 auto-fill) / 'empty'(无建筑) / 'hidden'(全空,不画)
        let filteredSeeds = possibleSeeds.filter(s => {
            const seedNum = s.seedNumber;

            for (const poi of this.currentPOIs) {
                const userState = this.poiStates[poi.id];

                // 未标记 / 隐藏点位 不参与匹配
                if (userState === 'dot' || userState === 'hidden') continue;

                // 该坐标在真实种子里中文 type（无建筑→null）
                const realType = this.findRealPOITypeAtCoordinate(seedNum, poi.x, poi.y);

                if (userState === 'empty') {
                    // 用户标记"空"：仅当真实数据也无建筑（null）时通过
                    if (realType !== null) return false;
                } else {
                    // 用户标了具体中文 type：必须严格相等
                    if (realType !== userState) return false;
                }
            }
            return true;
        });

        this.updateSeedCountDisplay(filteredSeeds.length);

        // Auto-fill：剩余种子对该 POI 收敛到单值时自动填充（仅作用于用户未手标的 dot 位点）
        // IMPORTANT: 用户正在清除时禁用 auto-fill，避免刚清掉的值又被自动填回。
        // 归零防护：possibleTypes 让每个候选种子都贡献一项（有建筑→type，无建筑→null），
        // autoSet 的值必然存在于 filteredSeeds，不会选到导致归零的选项（见 memory: elimination-zero-seed-bug）。
        if (filteredSeeds.length > 0 && !this.userIsClearing) {
            this.currentPOIs.forEach(poi => {
                if (this.poiStates[poi.id] === 'dot') {
                    const possibleTypes = new Set();
                    filteredSeeds.forEach(s => {
                        possibleTypes.add(this.findRealPOITypeAtCoordinate(s.seedNumber, poi.x, poi.y));
                    });

                    if (possibleTypes.size === 1) {
                        const determinedType = possibleTypes.values().next().value;
                        if (determinedType === null || determinedType === undefined) {
                            // 所有剩余种子该坐标都无建筑：隐藏，避免用户去点必然归零的空位点
                            this.poiStates[poi.id] = 'hidden';
                        } else {
                            // 全部种子同 type：自动填该中文 type
                            this.poiStates[poi.id] = determinedType;
                        }
                    }
                }
            });
        }

        // === 大空洞碰撞消歧（A=fieldBoss + B=stronghold 双点；动态：从剩余种子 JSON 实际值生成）===
        const wasActive = this.disambigActive;
        const prevStates = { A: this.disambigStates.A, B: this.disambigStates.B };

        // 1) 检测 landmark 碰撞；进入/退出碰撞 → 清空旧 A/B 选择，避免旧值错过滤新种子集合
        const hasCollision = this.detectHasLandmarkCollision(filteredSeeds);
        if (hasCollision !== wasActive) {
            this.disambigStates = { A: null, B: null };
        }

        // 2) 单值消歧点自动锁定 + 按已选/锁定值二次过滤（迭代至稳定）
        //    某点在剩余种子只有一种 type → 无消歧价值，直接锁定展示，不弹单项菜单让用户点；
        //    A 锁定过滤后 B 可能由多值变单值，故迭代至无新单值。
        if (hasCollision) {
            const ptA = GH_DISAMBIG_POINTS.A, ptB = GH_DISAMBIG_POINTS.B;
            let changed = true;
            while (changed) {
                changed = false;
                for (const [key, pt] of [['A', ptA], ['B', ptB]]) {
                    if (this.disambigStates[key]) continue;  // 已锁定 / 用户已选
                    const vals = new Set();
                    filteredSeeds.forEach(s => {
                        const v = this.findRealPOITypeAtCoordinate(s.seedNumber, pt.x, pt.y);
                        if (v) vals.add(v);
                    });
                    if (vals.size === 1) {                    // 唯一值 → 自动锁定（直接展示）
                        this.disambigStates[key] = vals.values().next().value;
                        changed = true;
                    }
                }
                // 按已锁定/已选值过滤，影响下一轮另一点的候选判断
                filteredSeeds = filteredSeeds.filter(s => {
                    if (this.disambigStates.A &&
                        this.findRealPOITypeAtCoordinate(s.seedNumber, ptA.x, ptA.y) !== this.disambigStates.A) return false;
                    if (this.disambigStates.B &&
                        this.findRealPOITypeAtCoordinate(s.seedNumber, ptB.x, ptB.y) !== this.disambigStates.B) return false;
                    return true;
                });
            }
        }

        // 3) 缓存二次过滤后的候选种子（动态消歧菜单据此生成多值点候选）
        this.lastFilteredSeeds = filteredSeeds;

        // 4) 二次过滤后重新检测：仍碰撞 → 消歧继续；收敛到唯一答案 / 退出 → 清状态
        this.disambigActive = this.detectHasLandmarkCollision(filteredSeeds);
        if (!this.disambigActive) {
            this.disambigStates = { A: null, B: null };
        }

        // 5) 消歧状态变化（进入/退出 / 单值自动锁定）→ 重绘以更新紫点显隐与已选展示态
        const statesChanged = prevStates.A !== this.disambigStates.A || prevStates.B !== this.disambigStates.B;
        if (wasActive !== this.disambigActive || statesChanged) {
            this.drawMap(this.images.maps[this.chosenMap]);
        }
        // 6) 消歧菜单：仅多值点弹菜单（单值点已自动锁定，drawDisambigPoints 直接展示已选态）
        if (this.disambigActive) {
            this.showDisambigMenu();
        } else if (wasActive) {
            this.hideDisambigMenu();
        }

        // 消歧二次过滤后刷新「已匹配地图数」——消歧（单值锁定 / 用户选 A/B）可能把数量收敛到 1，
        // 1451 行那次用的是消歧前的旧值（如收敛到 1 仍显示 2），此处用最终 filteredSeeds 覆盖
        this.updateSeedCountDisplay(filteredSeeds.length);

        // === 选完出生点后自动批量展示 POI 类型推荐（原版行为，迁移时丢失，现恢复）===
        // 仅基础模式自动展示；高级模式改由用户点击 POI 触发（额外点位多，自动浮窗过密）
        // 大空洞 POI 少：选完出生点即展示全部；其余地形种子收敛到阈值内才展示，避免浮窗过多
        if (!advancedMode && !this.spawnPhase && filteredSeeds.length > 1) {
            const isMobile = window.innerWidth <= 768;
            const isGreatHollow = this.chosenMap === 'Great Hollow';
            const desktopThreshold = 10, mobileThreshold = 4;
            const shouldShow = isGreatHollow ||
                (isMobile ? filteredSeeds.length <= mobileThreshold : filteredSeeds.length <= desktopThreshold);
            if (shouldShow) {
                this.showAllPOISuggestions(filteredSeeds, isMobile);
            } else {
                this.hidePOISuggestions();  // 种子数超阈值：清掉自动批量浮窗，改由用户手动点 POI 触发
            }
        }

        if (filteredSeeds.length === 0) {
            this.showNoSeedsFound();
        } else if (filteredSeeds.length === 1) {
            this.showSingleSeed(filteredSeeds[0]);
        } else {
            this.showingSeedImage = false;
            this.renderMap();
        }
    }

    updateSeedCountDisplay(count) {
        const seedCountElement = document.getElementById('seed-count');
        seedCountElement.textContent = count;
        seedCountElement.className = count === 0 ? 'seed-count no-seeds' : 'seed-count';
    }

    showNoSeedsFound() {
        const seedCountElement = document.getElementById('seed-count');
        seedCountElement.innerHTML = `<span style="color: #e74c3c; font-weight: 600;">${this.getText('results.no_seeds')}</span>`;
    }

    showSingleSeed(seedRow) {
        this.showingSeedImage = true;

        // Hide any POI suggestions since we found the final seed
        this.hidePOISuggestions();

        // Show seed image with nightlord info
        this.showSeedImage(seedRow);
    }

    // 点击 landmark（dot 态）时弹出该点位在剩余种子里的候选 type 浮窗 —— 单层交互的载体。
    // 候选 = 该坐标在 lastFilteredSeeds（updateSeedFiltering 缓存）中的中文 type 集合，无建筑→'empty'。
    // 选完出生点后自动批量展示所有未标记 POI 的类型推荐（恢复原版引导式标记行为）
    // 触发于 updateSeedFiltering 末尾：!spawnPhase && 剩余>1种子 && (大空洞豁免 || 种子数≤阈值)
    // 浮窗候选按固定顺序排列：教堂 → 法师塔 → 特殊商人 → 马车 → 破败小屋 → 空白
    // （其余未命中 type 兜底排末尾，保证跨点位浮窗顺序一致）
    sortPOITypes(types) {
        const order = ['教堂', '法师塔', '特殊商人', '马车', '破败小屋', 'empty'];
        return types.slice().sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
        });
    }

    showAllPOISuggestions(filteredSeeds, isMobile) {
        this.hidePOISuggestions();
        this.currentPOIs.forEach(poi => {
            if (this.poiStates[poi.id] !== 'dot') return;  // 只展示未标记的多值位点（auto-fill 已收敛的不展示）
            const possibleTypes = new Set();
            filteredSeeds.forEach(s => {
                possibleTypes.add(this.findRealPOITypeAtCoordinate(s.seedNumber, poi.x, poi.y));
            });
            const types = this.sortPOITypes(Array.from(possibleTypes).map(t => (t === null || t === undefined) ? 'empty' : t));
            if (types.length > 0) {
                this.createPOISuggestionUI(poi.id, types, isMobile);
            }
        });
    }

    // 左键/单击快捷标记：候选含「教堂」→ 直接标记教堂（恢复原版快捷行为）；否则弹 suggestion 浮窗
    // （候选不含教堂时强标会归零，fallback 让用户从候选里选）。右键/长按始终弹浮窗（精细选任意 type）。
    markChurchOrSuggest(poi) {
        if (!poi) return;
        const candidates = new Set();
        (this.lastFilteredSeeds || []).forEach(s => {
            candidates.add(this.findRealPOITypeAtCoordinate(s.seedNumber, poi.x, poi.y));
        });
        // 仅基础模式保留「自动标记教堂」快捷行为；高级模式始终弹完整浮窗供精细选择
        if (!advancedMode && candidates.has('教堂')) {
            this.hidePOISuggestions();
            this.poiStates[poi.id] = '教堂';
            this.drawMap(this.images.maps[this.chosenMap]);
            this.updateSeedFiltering();
        } else {
            this.showPOISuggestionAt(poi);
        }
    }

    showPOISuggestionAt(poi) {
        if (!poi) return;
        this.hidePOISuggestions();

        const seeds = this.lastFilteredSeeds || [];
        const possibleTypes = new Set();
        seeds.forEach(s => {
            possibleTypes.add(this.findRealPOITypeAtCoordinate(s.seedNumber, poi.x, poi.y));
        });
        // null/undefined → 'empty'（无建筑选项）
        const types = this.sortPOITypes(Array.from(possibleTypes).map(t => (t === null || t === undefined) ? 'empty' : t));
        if (types.length === 0) return;

        this.createPOISuggestionUI(poi.id, types, window.innerWidth <= 768);
    }

    createPOISuggestionUI(poiId, possibleTypes, isMobile = false) {
        // POI id 来自 JSON（字符串），poiStates 全程以字符串 id 为 key；
        // 用 String() 双向归一，避免 parseInt 转 number 后与字符串 id === 比较失败（曾导致浮窗从不创建）
        const poi = this.currentPOIs.find(p => String(p.id) === String(poiId));
        if (!poi) return;

        const suggestionContainer = document.createElement('div');
        suggestionContainer.className = 'poi-suggestion-container';
        suggestionContainer.id = `suggestion-${poiId}`;
        // 高级模式非共享点位：纯文字选项纵向撑满、字体加大（见 CSS .non-landmark-suggestion）；
        // 此类点位不走 mobile-suggestion（避免移动端 scale(0.5) 缩小 + 中文版 span 隐藏——纯文字浮窗需正常尺寸）
        const isNonLandmark = advancedMode && poi.category !== 'landmark';
        if (isNonLandmark) {
            suggestionContainer.classList.add('non-landmark-suggestion');
        } else if (isMobile) {
            suggestionContainer.classList.add('mobile-suggestion');
            // POI3（originalId=3）强制竖向单列
            if (parseInt(poi.originalId, 10) === 3) suggestionContainer.classList.add('single-column');
        }

        // 候选按钮：每个 type 一个（icon + 中文名），'empty' 用空图标，未命中 type 用 unknown 兜底
        possibleTypes.forEach(type => {
            const button = document.createElement('button');
            button.className = 'poi-suggestion-btn';
            button.dataset.type = type;
            button.dataset.poiId = poiId;
            const iconPath = (type === 'empty')
                ? 'assets/images/empty.png'
                : (TYPE_ICON_MAP[type] || CATEGORY_ICON_MAP[poi.category] || 'assets/icons/unknown.png');
            const label = (type === 'empty') ? this.getText('poi.empty') : this.displayName(type);
            // 共享点位（landmark）显示图标；高级模式额外点位（非 landmark）仅显示名称，无图标
            const showIcon = poi.category === 'landmark';
            button.innerHTML = showIcon
                ? `<img src="${iconPath}" class="suggestion-icon" alt="${label}"><span>${label}</span>`
                : `<span>${label}</span>`;
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectSuggestedPOI(poiId, type);
            };
            button.addEventListener('click', handler);
            button.addEventListener('touchstart', handler, { passive: false });
            suggestionContainer.appendChild(button);
        });

        // mobile：按钮渲染后检测是否竖排（≤1 按钮或第二行落在第一行下方），竖排则加 single-column
        if (isMobile) {
            setTimeout(() => {
                const btns = suggestionContainer.querySelectorAll('.poi-suggestion-btn');
                if (btns.length <= 1) {
                    suggestionContainer.classList.add('single-column');
                } else if (btns[1].getBoundingClientRect().top > btns[0].getBoundingClientRect().bottom) {
                    suggestionContainer.classList.add('single-column');
                }
            }, 50);
        }

        // 定位：沿用原版按 POI 语义 id（originalId，1-11）的防重叠偏移 + translateX(-50%) 居中。
        // originalId 由 loadSeedData 按 JSON 坐标最近邻匹配 POIS_BY_MAP（data.js）继承，各地形通用。
        const mapContainer = document.querySelector('.map-container');
        const canvas = document.getElementById('map-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = mapContainer.getBoundingClientRect();
        const scaleX = canvasRect.width / (canvas.width / 2);   // canvas 1536 / 数据 768 空间
        const scaleY = canvasRect.height / (canvas.height / 2);
        const relativeX = (canvasRect.left - containerRect.left) + (poi.x * scaleX);
        const relativeY = (canvasRect.top - containerRect.top) + (poi.y * scaleY);

        // 高级模式额外点位（非 landmark）：无三角、紧贴点位上方展示。
        // 这类点位由用户逐个点击触发浮窗（不批量自动展示），不会拥挤，故去掉气泡尾、紧贴点位。
        // early return：跳过下方 landmark 专用的 override/originalId 偏移 + 三角逻辑。
        if (advancedMode && poi.category !== 'landmark') {
            const r = 19 * scaleX * 0.5;  // 非共享点位缩小 0.5 后的显示半径
            suggestionContainer.style.position = 'absolute';
            suggestionContainer.style.transform = 'translate(-50%, -100%)';  // 水平居中、底边贴点位上边缘
            suggestionContainer.style.left = `${relativeX}px`;
            suggestionContainer.style.top = `${relativeY - r}px`;
            mapContainer.appendChild(suggestionContainer);
            requestAnimationFrame(() => suggestionContainer.classList.add('visible'));
            return;
        }

        const oid = poi.originalId != null ? parseInt(poi.originalId, 10) : null;
        // 命中「方向覆盖」坐标集：mobile:true 项仅移动端命中，其余全平台。按 dir 渲染，跳过 originalId 偏移表。
        const ov = POI_RENDER_OVERRIDE.find(c => {
            if (Math.abs(poi.x - c.x) > 3 || Math.abs(poi.y - c.y) > 3) return false;
            if (c.mobile && !isMobile) return false;
            return true;
        });
        let dx = 0, dy = 0, transform = 'translateX(-50%)';
        let tailDir = null;  // 气泡尾方向；null=不加（浮窗靠上点位时）
        if (ov) {
            if (ov.noTail) {
                const r = 19 * scaleX;  // 点位显示半径
                if (ov.dir === 'left') {
                    // 无箭头贴边：浮窗右边贴点位左边缘，垂直居中
                    dx = -r; dy = 0; transform = 'translate(-100%, -50%)';
                } else if (ov.dir === 'right') {
                    // 无箭头贴边：浮窗左边贴点位右边缘，垂直居中
                    dx = r; dy = 0; transform = 'translate(0%, -50%)';
                } else {
                    // #314/#305：右角锚定点位最右侧（右边=点位右边缘 x）
                    dx = r; dy = 0;
                    transform = (ov.valign === 'top') ? 'translate(-100%, -100%)' : 'translate(-100%, 0%)';
                }
                // tailDir 保持 null → 不创建 .bubble-tail
            } else {
                tailDir = ov.dir;
                // off = 点位显示半径(19×scaleX) + 尾长，让尾尖恰好指向点位边缘、浮窗主体不压点位
                const off = 19 * scaleX + 8;
                if (ov.dir === 'below') { dx = 0; dy = off; }
                else if (ov.dir === 'left') { dx = -off; transform = 'translate(-100%, -50%)'; }
                else if (ov.dir === 'right') {
                    dx = off;
                    const r = 19 * scaleX;  // 点位显示半径
                    // valign：浮窗底/顶边对齐到点位的下/上边缘（非中心），主体向反方向展开；箭头指向点位中心
                    if (ov.valign === 'bottom') { dy = r;  transform = 'translate(0%, -100%)'; }
                    else if (ov.valign === 'top') { dy = -r; transform = 'translate(0%, 0%)'; }
                    else transform = 'translate(0%, -50%)';
                }
            }
        } else if (isMobile) {
            switch (oid) {
                case 2:  dx = -20; dy = -38; break;
                case 3:  dx = -25; dy = -20; break;
                case 4:  dx =  10; dy = -40; break;
                case 5:  dx = -20; dy = -50; break;
                case 6:  dx =   0; dy =  10; break;
                case 8:  dx =  10; dy =  10; break;
                case 9:  dx = -20; dy =  10; break;
                case 10: dx =  20; dy = -40; break;
                default: dx =   0; dy = -40; break;
            }
        } else {
            switch (oid) {
                case 2:  dx = -30; dy =  20; break;
                case 4:  dx =  20; dy = -80; break;
                case 5:  dx = -40; dy = -100; break;
                case 6:  dx =   0; dy =  20; break;
                case 8:  dx =  20; dy =  20; break;
                case 9:  dx = -40; dy =  20; break;
                case 10: dx =  40; dy = -80; break;
                default: dx =   0; dy = -80; break;
            }
        }

        // 非 override 且浮窗没「靠上」点位（|dy| 大）：下方 dy>0→顶边朝上箭头、上方 dy<0→底边朝下箭头；dy 拉开含尾长
        if (!ov && dy > 0) {
            tailDir = 'below';
            dy = Math.max(dy, 19 * scaleX + 8);
        } else if (!ov && dy < 0) {
            tailDir = 'above';
            dy = Math.min(dy, -(19 * scaleX + 8));
        }
        // noTail 且 vertical：竖排浮窗（noTail 不进 if(tailDir)，需单独加 vertical 类）
        if (ov && ov.noTail && ov.vertical) suggestionContainer.classList.add('vertical');
        // 气泡尾（override 三方向 + 下方浮窗）；靠上点位（上方 dy<0）不加。
        if (tailDir) {
            suggestionContainer.classList.add(`pointer-${tailDir}`);
            if (tailDir === 'left' || (ov && ov.vertical)) suggestionContainer.classList.add('vertical');  // 左侧浮窗(#301)或标记 vertical 的点位竖排
            const tail = document.createElement('div');
            tail.className = `bubble-tail tail-${tailDir}`;
            tail.innerHTML = BUBBLE_TAIL_SVG[tailDir];
            suggestionContainer.appendChild(tail);
            // 箭头沿尾根边滑向点位实际方向（点位未必在浮窗正上/下/左/右居中）：
            // below→顶边水平偏移 -dx；left/right→侧边垂直偏移 -dy。渲染后按框宽 clamp 在边缘内。
            requestAnimationFrame(() => {
                const boxH = suggestionContainer.offsetHeight;
                const radius = 19 * scaleX;  // POI 显示半径
                const gap = 8;               // 尾长
                if (tailDir === 'below' || tailDir === 'above') {
                    // 水平：箭头沿水平边滑向点位方向（-dx）
                    const maxOffX = Math.max(0, suggestionContainer.offsetWidth / 2 - 14);
                    const offX = Math.max(-maxOffX, Math.min(maxOffX, -dx));
                    tail.style.left = `calc(50% + ${offX}px)`;
                    // 垂直：按浮窗实际高度动态拉开，确保浮窗完全离开点位、尾尖贴点位边缘。
                    // 固定 dy 在移动端高浮窗（竖排/换行）下量不够，会让浮窗跨越点位，使朝上/朝下箭头指反。
                    if (tailDir === 'below') {
                        const needDy = radius + gap;
                        const finalDy = Math.max(dy, needDy);
                        if (finalDy !== dy) suggestionContainer.style.top = `${relativeY + finalDy}px`;
                    } else {
                        const needDy = -(boxH + radius + gap);
                        const finalDy = Math.min(dy, needDy);
                        if (finalDy !== dy) suggestionContainer.style.top = `${relativeY + finalDy}px`;
                    }
                } else {  // left / right：箭头在浮窗侧边，垂直位置随 valign
                    const maxOffY = Math.max(0, boxH / 2 - 14);
                    let offY;
                    if (tailDir === 'right' && ov && ov.valign === 'bottom') {
                        offY = boxH / 2 - radius;     // 底对齐：浮窗底边=点位下边缘，箭头指向点位中心（距底 radius）
                    } else if (tailDir === 'right' && ov && ov.valign === 'top') {
                        offY = -(boxH / 2 - radius);  // 顶对齐：浮窗顶边=点位上边缘，箭头指向点位中心（距顶 radius）
                    } else {
                        offY = Math.max(-maxOffY, Math.min(maxOffY, -dy));  // 默认指向点位（-dy），clamp 在侧边内
                    }
                    tail.style.top = `calc(50% + ${offY}px)`;
                }
                // 移动端统一缩小箭头：s=min(1, radius/11)，与点位显示半径匹配；
                // PC 端 radius 大（≈19）→ s=1 不缩。套用到所有方向（below/above/left/right）。
                const s = Math.min(1, radius / 11);
                if (s < 1) {
                    const svg = tail.querySelector('svg');
                    if (svg) {
                        if (tailDir === 'below' || tailDir === 'above') {
                            svg.style.width = `${22 * s}px`;
                            svg.style.height = `${12 * s}px`;
                        } else {  // left / right
                            svg.style.width = `${12 * s}px`;
                            svg.style.height = `${22 * s}px`;
                        }
                    }
                    // 尾长（箭头根伸出浮窗边缘外的距离）同步按 s 缩短，与缩小后的箭头等比
                    if (tailDir === 'below') tail.style.top = `${-10 * s}px`;
                    else if (tailDir === 'above') tail.style.bottom = `${-10 * s}px`;
                    else if (tailDir === 'left') tail.style.right = `${-6 * s}px`;
                    else if (tailDir === 'right') tail.style.left = `${-6 * s}px`;
                }
            });
        }

        suggestionContainer.style.position = 'absolute';
        suggestionContainer.style.transform = transform;
        suggestionContainer.style.left = `${relativeX + dx}px`;
        suggestionContainer.style.top = `${relativeY + dy}px`;
        mapContainer.appendChild(suggestionContainer);

        requestAnimationFrame(() => {
            suggestionContainer.classList.add('visible');
        });
    }

    selectSuggestedPOI(poiId, type) {
        // type 为中文 type 名或 'empty'；写入 poiStates 触发重过滤
        this.poiStates[poiId] = type;
        this.hidePOISuggestions();
        this.drawMap(this.images.maps[this.chosenMap]);
        this.updateSeedFiltering();
    }

    hidePOISuggestions() {
        // Remove all existing suggestion containers
        document.querySelectorAll('.poi-suggestion-container').forEach(container => {
            container.classList.add('hiding');
            setTimeout(() => {
                if (container.parentNode) {
                    container.remove();
                }
            }, 200);
        });
    }

    showSeedImage(seedRow) {
        const mapSeed = seedRow.seedNumber;
        const nightlord = seedRow.nightlord || this.getText('nightlord.unknown');
        const mapType = seedRow.mapType || this.getText('map.default');

        // Store the seed row for refresh purposes
        this.lastSeedRow = seedRow;

        // Get translated nightlord name
        const nightlordTranslated = this.getNightlordTranslatedName(nightlord);

        // 在种子计数器区域显示夜王信息
        this.updateNightlordInfo(nightlordTranslated);

        const canvas = document.getElementById('map-canvas');
        const seedImageContainer = document.getElementById('seed-image-container');

        canvas.style.display = 'none';
        seedImageContainer.style.display = 'flex';
        // 检查是否为移动设备（供模板共用）
        const isMobile = window.innerWidth <= 768;
        // 滚动策略：仅 PC 滚到顶部（种子图在 100vh 区垂直居中）；移动端不自动滚动，
        // 避免标记出最终种子时页面突兀跳动（用户保持在当前标记位置查看）
        this.scrollMapIntoView();

        const seedStr = mapSeed.toString().padStart(3, '0');
        const currentLang = this.languageManager.getCurrentLanguage();
        // 种子结果图：本体(0-319, 3位补零)与 DLC(1000-1199, 4位) 均按语言目录存放
        const seedImageUrl = `assets/pattern/${currentLang}/${seedStr}.jpg`;

        seedImageContainer.innerHTML = `
            <div class="seed-result-container">
                <a href="${seedImageUrl}" target="_blank" class="seed-image-link">
                    <img src="${seedImageUrl}" alt="${this.getText('seed.alt_text', { seed: mapSeed })}" class="seed-image">
                </a>
                <div class="seed-info">
                    <span class="seed-number">${this.getText('seed.number', { seed: mapSeed })}</span>
                    ${isMobile && nightlordTranslated ? `<span class="seed-info-separator">|</span><span class="seed-nightlord">${this.getText('seed.nightlord', { nightlord: nightlordTranslated })}</span>` : ''}
                    <small class="seed-hint">${isMobile ? this.getText('seed.click_mobile') : this.getText('seed.click_large')}</small>
                </div>
            </div>
        `;
    }

    updateNightlordInfo(nightlordChinese) {
        const nightlordInfo = document.getElementById('nightlord-info');
        const nightlordName = document.getElementById('nightlord-name');

        if (nightlordInfo && nightlordName) {
            nightlordName.textContent = nightlordChinese;
            nightlordInfo.style.display = 'block';
        }
    }

    getText(key, params = {}) {
        return this.languageManager.getText(key, params);
    }

    getNightlordTranslatedName(englishName) {
        return this.getText(`nightlord.${englishName.toLowerCase()}`);
    }

    getMapTranslatedName(englishName) {
        return this.getText(`map.${englishName.toLowerCase().replace(/\s+/g, '_')}`);
    }



    showError(message) {
        const loadingSection = document.getElementById('loading-section');
        loadingSection.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-exclamation-triangle"></i>
                <p style="color: #e74c3c;" data-i18n="error.load_failed">${message}</p>
            </div>
        `;
    }

    showHelpModal() {
        const helpModal = document.getElementById('help-modal');
        helpModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    hideHelpModal() {
        const helpModal = document.getElementById('help-modal');
        helpModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    findRealPOITypeAtCoordinate(seedNum, clickX, clickY) {
        // clickX/clickY 为 768 空间（currentPOIs 的 poi 坐标），×2 转 1536 与 seed.pois 匹配（容差 2）。
        // 直接按坐标匹配，不依赖 slot id —— 不同地形坐标天然不同，不会跨地形错位
        // （possibleSeeds 已按 mapType 过滤，seed 必属于当前地形）。见 memory: elimination-zero-seed-bug #3。
        const seed = SEED_POIS_RAW && SEED_POIS_RAW[String(seedNum)];
        if (!seed || !seed.pois) return null;
        const tx = clickX * 2, ty = clickY * 2;
        for (const poi of Object.values(seed.pois)) {
            if (Math.abs(poi.coordinates.x - tx) <= 2 && Math.abs(poi.coordinates.y - ty) <= 2) {
                return poi.type || null;  // 中文名 type；无建筑时字段缺失→null
            }
        }
        return null;
    }

}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NightreignMapRecogniser();
});