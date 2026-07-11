// Main application for Nightreign seed recognition
let CV_CLASSIFICATION_DATA = null; // Will hold the exported classification results

// Load classification results from dataset.json
async function loadClassificationResults() {
    try {
        const response = await fetch('dataset/dataset.json');
        const data = await response.json();

        if (data.classifications) {
            CV_CLASSIFICATION_DATA = data.classifications;
            const seedCount = Object.keys(CV_CLASSIFICATION_DATA).length;
            console.log('✅ Loaded classification results:', seedCount, 'seeds');
            return true;
        }
        return false;
    } catch (error) {
        console.warn('⚠️ Dataset not found (this is normal if not yet created):', error.message);
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
        // 大空洞碰撞消歧状态：A=守教堂BOSS名, B='血'|'毒'；null=未选
        this.disambigStates = { A: null, B: null };
        this.disambigActive = false;        // 当前是否处于消歧模式（GH + 剩 2 碰撞种子）
        this.currentDisambigPair = null;    // 当前碰撞对 [seedNum1, seedNum2]（升序）
        this.currentDisambigPoint = null;   // 当前正在选择的消歧点（GH_DISAMBIG_POINTS.A/B）
        this.disambigMenus = { A: null, B: null };  // #disambig-menu-a/b DOM 引用（setupContextMenu 初始化）
        this.images = {
            maps: {},
            church: new Image(),
            mage: new Image(),
            village: new Image(),
            empty: new Image(),
            carriage: new Image(),
            favicon: new Image(),
            // 大空洞消歧点图标（与教堂法师塔同尺寸 ICON_SIZE）
            boss: new Image(),
            ruinBlank: new Image(),
            ruinBlood: new Image(),
            ruinPoison: new Image()
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
        // Load icon images (data URIs don't need crossOrigin)
        this.images.church.src = ICON_ASSETS.church;
        this.images.mage.src = ICON_ASSETS.mage;
        this.images.village.src = ICON_ASSETS.village;
        this.images.empty.src = ICON_ASSETS.empty;
        this.images.carriage.src = ICON_ASSETS.carriage;
        this.images.favicon.src = 'assets/images/church.png';
        // 大空洞消歧点图标
        this.images.boss.src = 'assets/icons/boss.png';
        this.images.ruinBlank.src = 'assets/icons/ruin_blank.png';
        this.images.ruinBlood.src = 'assets/icons/ruin_blood.png';
        this.images.ruinPoison.src = 'assets/icons/ruin_poison.png';

        // Add error handling for images
        this.images.church.onerror = () => {
            console.warn('Failed to load church icon');
        };
        this.images.mage.onerror = () => {
            console.warn('Failed to load mage icon');
        };
        this.images.favicon.onerror = () => {
            console.warn('Failed to load favicon icon');
        };
        this.images.village.onerror = () => {
            console.warn('Failed to load village icon');
        };
        this.images.empty.onerror = () => {
            console.warn('Failed to load empty icon');
        };
        this.images.carriage.onerror = () => {
            console.warn('Failed to load carriage icon');
        };

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
                this.hideContextMenu();
            }
        });

        // Switch to advanced mode
        document.getElementById('switch-to-advanced-btn').addEventListener('click', () => {
            window.location.href = 'index-advanced.html';
        });

        // Context menu setup
        this.setupContextMenu();

        // Hide context menu when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#poi-context-menu')) {
                this.hideContextMenu();
            }
        });
    }

    async loadInitialData() {
        try {
            // Load both seed data and classification data
            const hasClassifications = await loadClassificationResults();
            const seedCount = seedDataMatrix.length;

            // Update status display
            const statusElement = document.getElementById('cv-status');
            if (statusElement) {
                if (hasClassifications) {
                    const classCount = Object.keys(CV_CLASSIFICATION_DATA).length;
                    // Store parameters for language updates
                    statusElement.dataset.loadingType = 'classified';
                    statusElement.dataset.seedCount = seedCount;
                    statusElement.dataset.classCount = classCount;
                    statusElement.innerHTML = `<span style="color: #28a745;">✅ ${this.getText('loading.classified', { count: seedCount, classified: classCount })}</span>`;
                } else {
                    // Store parameters for language updates
                    statusElement.dataset.loadingType = 'seeds';
                    statusElement.dataset.seedCount = seedCount;
                    statusElement.innerHTML = `<span style="color: #28a745;">✅ ${this.getText('loading.seeds', { count: seedCount })}</span>`;
                }
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
        const selectionSection = document.getElementById('selection-section');
        selectionSection.style.display = 'block';

        // Also show results section with initial seed count
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';
        this.updateSeedCount();

        // Show default map immediately so users can start clicking
        this.showDefaultMap();
    }

    showDefaultMap() {
        // Set up a default map (Default map type) for immediate interaction
        this.currentPOIs = POIS_BY_MAP['Default'] || [];
        this.poiStates = this.initializePOIStates();

        // Show interaction section and instructions
        const interactionSection = document.getElementById('interaction-section');
        interactionSection.style.display = 'block';

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

    selectNightlord(nightlord) {
        // If the same nightlord is clicked again, clear the selection
        if (this.chosenNightlord === nightlord) {
            this.chosenNightlord = null;

            // Update UI
            document.getElementById('chosen-nightlord').textContent = this.getText('nightlord.none');

            // Clear all button states
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            console.log('Cleared nightlord selection');
        } else {
            // Select the new nightlord
            this.chosenNightlord = nightlord;

            // Update UI
            document.getElementById('chosen-nightlord').textContent = this.getNightlordTranslatedName(nightlord);

            // Update button states
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.nightlord === nightlord);
            });

            console.log(`Selected nightlord: ${nightlord}`);
        }

        // 切换夜王后，已选出生点可能在新夜王下不存在（该夜王的该地形从无此出生点）→ 清除并回出生点阶段，POI 标记保留
        if (this.selectedSpawn && this.chosenMap) {
            const validSpawns = this.getValidSpawns();
            if (!validSpawns.some(sp => sp.value === this.selectedSpawn)) {
                this.selectedSpawn = null;
                this.spawnPhase = true;
                console.log('Cleared spawn: not valid under new nightlord');
            }
        }

        this.updateGameState();
    }

    selectMap(map) {
        // If the same map is clicked again, clear the selection
        if (this.chosenMap === map) {
            this.chosenMap = null;
            this.currentPOIs = POIS_BY_MAP['Default'] || [];
            this.poiStates = this.initializePOIStates();

            // Update UI
            document.getElementById('chosen-map').textContent = this.getText('map.none');

            // Clear all button states
            document.querySelectorAll('.map-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            console.log('Cleared map selection');
        } else {
            // Select the new map
            this.chosenMap = map;
            this.currentPOIs = POIS_BY_MAP[map] || [];
            this.poiStates = this.initializePOIStates();
            this.selectedSpawn = null;   // 切地图重置出生点
            this.spawnPhase = true;      // 新地图默认回到出生点阶段

            console.log(`Selected map: ${map}, POIs: ${this.currentPOIs.length}`);

            // Update UI
            document.getElementById('chosen-map').textContent = this.getMapTranslatedName(map);

            // Update button states
            document.querySelectorAll('.map-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.map === map);
            });

            console.log(`Selected map: ${map}`);
        }

        this.updateGameState();
    }

    initializePOIStates() {
        const states = {};
        this.currentPOIs.forEach(poi => {
            states[poi.id] = 'dot';
        });
        return states;
    }

    // 检测 POI 过滤后的剩余种子是否正好是 GH_DISAMBIG 里的某个碰撞对。
    // 返回 [seedNum1, seedNum2]（升序）或 null。
    detectDisambigPair(filteredSeeds) {
        if (this.chosenMap !== 'Great Hollow') return null;
        if (!filteredSeeds || filteredSeeds.length !== 2) return null;
        const nums = filteredSeeds.map(r => r[0]).sort((a, b) => a - b);
        if (GH_DISAMBIG[nums[0]] && GH_DISAMBIG[nums[1]]) return nums;
        return null;
    }

    // 渲染碰撞消歧点位（仅消歧模式；由 drawMap 调用）。紫色圆点，与 POI 'dot' 视觉一致。
    drawDisambigPoints() {
        if (!this.disambigActive) return;
        [GH_DISAMBIG_POINTS.A, GH_DISAMBIG_POINTS.B].forEach(pt => {
            const state = (pt.kind === 'boss') ? this.disambigStates.A : this.disambigStates.B;
            const { x, y } = pt;
            // 已选 → 紫色环标识（已确认反馈）；未选 → 纯图标，与教堂法师塔 POI 完全一致
            if (state) {
                this.ctx.beginPath();
                this.ctx.arc(x, y, ICON_SIZE / 2 + 3, 0, 2 * Math.PI);
                this.ctx.strokeStyle = '#b266ff';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }
            // 图标（ICON_SIZE，与教堂法师塔同尺寸；不再画 A/B 字样）
            let img;
            if (pt.kind === 'boss') {
                img = this.images.boss;                   // A 点：守教堂 BOSS
            } else {
                img = state === '血' ? this.images.ruinBlood
                    : state === '毒' ? this.images.ruinPoison
                    : this.images.ruinBlank;              // B 点：未选通用遗迹 / 已选血·毒
            }
            this.drawIcon(img, x, y);
        });
    }

    updateGameState() {
        this.resetDisambig();  // 切换地图时清除上一张图的消歧状态（避免 A/B 坐标错画到新地图）
        if (this.chosenMap) {
            // Map is selected - show full functionality
            this.currentPOIs = POIS_BY_MAP[this.chosenMap] || [];
            this.poiStates = this.initializePOIStates();

            this.showInteractionSection();
            this.showResultsSection();
            this.renderMap();
            this.updateSeedFiltering();
            this.hideSelectionOverlay();
        } else {
            // No map selected - show default view but keep interaction available
            this.currentPOIs = POIS_BY_MAP['Default'] || [];
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
        const interactionSection = document.getElementById('interaction-section');
        interactionSection.style.display = 'block';
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
        this.contextMenu = document.getElementById('poi-context-menu');
        this.disambigMenus = {
            A: document.getElementById('disambig-menu-a'),
            B: document.getElementById('disambig-menu-b'),
        };

        // 处理上下文菜单项点击
        document.querySelectorAll('.context-menu-item').forEach(item => {
            // 同时处理点击和触摸事件
            const handleSelection = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // 添加触摸反馈效果
                item.classList.add('touch-feedback');

                // 获取POI类型
                const type = e.currentTarget.dataset.type;

                if (this.currentRightClickedPOI) {
                    console.log(`Selected ${type} for POI ${this.currentRightClickedPOI.id}`);

                    // 更新POI状态
                    this.poiStates[this.currentRightClickedPOI.id] = type;

                    // 重绘地图
                    this.drawMap(this.images.maps[this.chosenMap]);

                    // 更新种子过滤
                    this.updateSeedFiltering();

                    // 隐藏菜单
                    setTimeout(() => {
                        this.hideContextMenu();
                        this.currentRightClickedPOI = null;

                        // 移除触摸反馈效果
                        item.classList.remove('touch-feedback');
                    }, 150);
                }
            };

            // 添加点击事件监听器
            item.addEventListener('click', handleSelection);

            // 添加触摸事件监听器
            item.addEventListener('touchstart', (e) => {
                // 添加触摸反馈
                item.classList.add('touch-feedback');
            });

            item.addEventListener('touchend', handleSelection);

            item.addEventListener('touchcancel', (e) => {
                // 移除触摸反馈
                item.classList.remove('touch-feedback');
            });
        });

        // 点击其他区域关闭菜单
        document.addEventListener('touchstart', (e) => {
            if (this.contextMenu &&
                this.contextMenu.style.display === 'block' &&
                !this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        }, { passive: true });
    }

    showContextMenu(x, y) {
        this.hideDisambigMenu();  // 与消歧菜单互斥
        if (this.contextMenu) {
            console.log(`Showing context menu at (${x}, ${y})`);

            // 确保菜单在视口内
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const menuWidth = 240; // 更新的菜单宽度
            const menuHeight = 220; // 至多 4 项（mage/village/carriage/空白；大空洞隐藏 village）

            // 调整位置以确保菜单完全可见
            let adjustedX = x;
            let adjustedY = y;

            if (x + menuWidth > viewportWidth) {
                adjustedX = viewportWidth - menuWidth - 20;
            }

            if (y + menuHeight > viewportHeight) {
                adjustedY = viewportHeight - menuHeight - 20;
            }

            console.log(`Adjusted position: (${adjustedX}, ${adjustedY})`);

            // 大空洞地形无村庄候选点（数据层已确认全 0），隐藏 village 菜单项避免误导选点
            const villageItem = this.contextMenu.querySelector('.context-menu-item[data-type="village"]');
            if (villageItem) {
                villageItem.style.display = (this.chosenMap === 'Great Hollow') ? 'none' : '';
            }

            // 设置菜单位置并显示
            this.contextMenu.style.left = `${adjustedX}px`;
            this.contextMenu.style.top = `${adjustedY}px`;
            this.contextMenu.style.display = 'block';

            // 添加动画效果
            this.contextMenu.style.opacity = '0';
            this.contextMenu.style.transform = 'scale(0.95)';
            this.contextMenu.style.transition = 'opacity 0.2s, transform 0.2s';

            // 强制重绘以确保动画生效
            setTimeout(() => {
                this.contextMenu.style.opacity = '1';
                this.contextMenu.style.transform = 'scale(1)';
                console.log('Context menu animation completed');
            }, 10);

            // 确保菜单可见
            this.contextMenu.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    hideContextMenu() {
        if (this.contextMenu) {
            // 添加淡出效果
            this.contextMenu.style.opacity = '0';
            this.contextMenu.style.transform = 'scale(0.95)';

            // 等待淡出完成后隐藏
            setTimeout(() => {
                this.contextMenu.style.display = 'none';
            }, 200);
        }
        this.currentRightClickedPOI = null;
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
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

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
            mapImage.onload = () => {
                console.log(`Map image loaded: ${this.chosenMap}`);
                this.drawMap(mapImage);
            };
            // Also draw immediately with what we have
            this.drawMap(mapImage);
        }

        this.setupCanvasEventListeners();
    }

    drawMap(mapImage) {
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

        // 画出生点标记（蓝色三角，不受 spawnPhase 透明度影响）
        spawns.forEach(sp => this.drawSpawnMarker(sp));

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

        switch (state) {
            case 'dot':
                this.drawDot(x, y, '', '#ff8c00');
                break;
            case 'church':
                // Use favicon if available, otherwise fallback to church icon
                if (this.images.favicon.complete && this.images.favicon.naturalWidth > 0) {
                    this.drawIcon(this.images.favicon, x, y);
                } else {
                    this.drawIcon(this.images.church, x, y);
                }
                break;
            case 'mage':
                this.drawIcon(this.images.mage, x, y);
                break;
            case 'village':
                this.drawIcon(this.images.village, x, y);
                break;
            case 'empty':
                // 该坐标无建筑（dataset 'nothing'→null），用户主动标记为"空"
                this.drawIcon(this.images.empty, x, y);
                break;
            case 'carriage':
                this.drawIcon(this.images.carriage, x, y);
                break;
            case 'unknown':
                // Per user request, these are now invisible, removing the dot.
                break;
        }
    }

    drawDot(x, y, label, color) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, ICON_SIZE / 2, 0, 2 * Math.PI);
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

    drawIcon(image, x, y) {
        if (image.complete) {
            this.ctx.drawImage(image, x - ICON_SIZE / 2, y - ICON_SIZE / 2, ICON_SIZE, ICON_SIZE);
        }
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
        // 序号 label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 11px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, x, y + r * 0.3);
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
                // If POI is already marked (not a dot), clear it back to dot
                if (this.poiStates[poi.id] !== 'dot') {
                    console.log(`Clearing POI ${poi.id} - was ${this.poiStates[poi.id]}`);
                    this.poiStates[poi.id] = 'dot';
                    this.userIsClearing = true; // Set flag before clearing
                } else {
                    // If it's a dot, mark as church
                    console.log(`Marking POI ${poi.id} as church`);
                    this.poiStates[poi.id] = 'church';
                }

                this.drawMap(this.images.maps[this.chosenMap]);
                this.updateSeedFiltering();

                // Reset the flag after processing
                this.userIsClearing = false;
                return;   // ← 关键：POI 命中后 return，不再查 spawn
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

            // 显示上下文菜单
            this.currentRightClickedPOI = lastTouchedPoi;

            // 获取触摸位置
            const touch = e.changedTouches ? e.changedTouches[0] : e.touches[0];

            // 计算菜单位置
            const menuX = Math.min(touch.clientX, window.innerWidth - 160);
            const menuY = Math.min(touch.clientY, window.innerHeight - 150);

            // 显示菜单
            this.showContextMenu(menuX, menuY);

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
                    console.log(`Short tap on POI ${lastTouchedPoi.id}`);

                    // If POI is already marked (not a dot), clear it back to dot
                    if (this.poiStates[lastTouchedPoi.id] !== 'dot') {
                        console.log(`Clearing POI ${lastTouchedPoi.id} - was ${this.poiStates[lastTouchedPoi.id]}`);
                        this.poiStates[lastTouchedPoi.id] = 'dot';
                        this.userIsClearing = true; // Set flag before clearing
                    } else {
                        // If it's a dot, mark as church
                        console.log(`Marking POI ${lastTouchedPoi.id} as church`);
                        this.poiStates[lastTouchedPoi.id] = 'church';
                    }

                    this.drawMap(this.images.maps[this.chosenMap]);
                    this.updateSeedFiltering();

                    // Reset the flag after processing
                    this.userIsClearing = false;
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

        // Right click - show context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.chosenMap) {
                console.log('Please select Map before marking POIs');
                return;
            }
            const pos = this.getMousePos(e);
            const poi = this.findClickedPOI(pos.x, pos.y);
            if (poi) {
                this.currentRightClickedPOI = poi;
                this.showContextMenu(e.clientX, e.clientY);
            }
        });

        // Middle click - mark as unknown
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
                    this.poiStates[poi.id] = 'unknown';
                    this.drawMap(this.images.maps[this.chosenMap]);
                    this.updateSeedFiltering();
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
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

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
    // A 菜单：候选 BOSS 名（boss 图标）；B 菜单：血/毒遗迹（ruin_blood/ruin_poison 图标）。
    showDisambigMenu() {
        if (!this.currentDisambigPair) return;
        const lang = this.languageManager.getCurrentLanguage();
        const t = (key) => (translations[lang] && translations[lang][key]) || key;
        const [s1, s2] = this.currentDisambigPair;
        const vals = [GH_DISAMBIG[s1], GH_DISAMBIG[s2]];

        // A 组候选（守教堂 BOSS 名，去重保序）
        const bossVals = [];
        vals.forEach(d => { if (d.bossA && !bossVals.includes(d.bossA)) bossVals.push(d.bossA); });
        // B 组候选（血/毒遗迹，去重保序）
        const ruinVals = [];
        vals.forEach(d => { if (d.ruinB && !ruinVals.includes(d.ruinB)) ruinVals.push(d.ruinB); });

        this.renderDisambigMenu(GH_DISAMBIG_POINTS.A, this.disambigMenus.A, 'A',
            bossVals.map(v => ({ value: v, icon: 'boss.png', label: v })), t);
        this.renderDisambigMenu(GH_DISAMBIG_POINTS.B, this.disambigMenus.B, 'B',
            ruinVals.map(v => ({
                value: v,
                icon: (v === '血') ? 'ruin_blood.png' : 'ruin_poison.png',
                label: t(v === '血' ? 'gh.disambig.blood' : 'gh.disambig.poison'),
            })), t);
    }

    // 渲染单个消歧菜单并依附到对应点位（常驻：选中后由 updateSeedFiltering 刷新高亮，不关闭）
    renderDisambigMenu(point, menuEl, key, items, t) {
        if (!menuEl) return;
        const iconImg = (src) => `<img src="assets/icons/${src}" style="width:16px;height:16px;margin-right:8px;vertical-align:middle;">`;
        const selStyle = (on) => on ? ' style="background:rgba(178,102,255,0.25);"' : '';
        let html = '';
        items.forEach(it => {
            html += `<div class="context-menu-item" data-value="${it.value}"${selStyle(it.value === this.disambigStates[key])}>${iconImg(it.icon)}<span style="white-space:nowrap;">${it.label}</span></div>`;
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

        let x = dotX + gap;
        let y = dotY - menuHeight / 2;
        // 右侧放不下 → 翻左侧
        if (x + menuWidth > window.innerWidth - 8) x = dotX - gap - menuWidth;
        // 仍放不下（屏幕过窄）→ 放点位正下方
        if (x < 8) {
            x = Math.max(8, Math.min(dotX - menuWidth / 2, window.innerWidth - menuWidth - 8));
            y = dotY + gap;
        }
        if (y < 8) y = 8;
        if (y + menuHeight > window.innerHeight - 8) y = window.innerHeight - menuHeight - 8;
        menuEl.style.left = `${x}px`;
        menuEl.style.top = `${y}px`;
    }

    // 设置某个消歧点的选择值（null=清除），然后重绘 + 过滤
    setDisambigState(point, value) {
        if (point.kind === 'boss') {
            this.disambigStates.A = value;
        } else {
            this.disambigStates.B = value;
        }
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
            seedDataMatrix
                .filter(row => row[1] === this.chosenNightlord && row[2] === this.chosenMap)
                .map(row => SEED_SPAWN[row[0]])
        );
        return candidates.filter(sp => possibleValues.has(sp.value));
    }

    resetMap() {
        // Clear only nightlord selection and POI states, keep map selection
        this.chosenNightlord = null;
        this.poiStates = this.initializePOIStates();
        this.resetDisambig();  // 清除大空洞碰撞消歧状态
        this.showingSeedImage = false;

        // Hide POI suggestions and nightlord info
        this.hidePOISuggestions();
        this.hideNightlordInfo();

        // Update UI for nightlord selection
        document.getElementById('chosen-nightlord').textContent = this.getText('nightlord.none');
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // If a map is selected, keep it and redraw with reset POIs
        if (this.chosenMap) {
            // Reinitialize POI states for current map
            this.currentPOIs = POIS_BY_MAP[this.chosenMap] || [];
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
            this.currentPOIs = POIS_BY_MAP['Default'] || [];
            this.poiStates = this.initializePOIStates();

            // Draw default map
            if (this.canvas && this.ctx) {
                this.drawDefaultMapWithImage();
            }

            this.updateSeedCount();
            this.showSelectionOverlay();
        }

        console.log('Reset completed - cleared nightlord selection and POI states, kept map selection');
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

    classifyPOI(poiString) {
        if (!poiString) return null;
        if (poiString.includes('Church')) return 'Church';
        if (poiString.includes('Sorcerer') || poiString.includes('Mage') || poiString.includes('Rise')) return 'Mage';
        if (poiString.includes('Village')) return 'Village';
        return 'Other'; // Return 'Other' for non-Church/Mage/Village POIs instead of null
    }

    updateSeedCount() {
        if (!this.chosenNightlord && !this.chosenMap) {
            document.getElementById('seed-count').textContent = seedDataMatrix.length;
            return;
        }

        // Use actual seed data to count seeds
        let count = 0;
        if (this.chosenNightlord && this.chosenMap) {
            // Both selected - count actual seeds with this combination
            count = seedDataMatrix.filter(row =>
                row[1] === this.chosenNightlord && row[2] === this.chosenMap
            ).length;
        } else if (this.chosenNightlord) {
            // Only nightlord selected - count all seeds for this nightlord
            count = seedDataMatrix.filter(row =>
                row[1] === this.chosenNightlord
            ).length;
        } else if (this.chosenMap) {
            // Only map selected - count all seeds for this map type
            count = seedDataMatrix.filter(row =>
                row[2] === this.chosenMap
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
        const possibleSeeds = seedDataMatrix.filter(row => {
            const allNightlords = !this.chosenNightlord || row[1] === this.chosenNightlord;
            const spawnOk = !this.selectedSpawn || SEED_SPAWN[row[0]] === this.selectedSpawn;
            return allNightlords && row[2] === this.chosenMap && spawnOk;
        });

        console.log(`Found ${possibleSeeds.length} seeds for ${this.chosenNightlord} + ${this.chosenMap}`);

        // Filter by POI states using coordinate-based matching
        let filteredSeeds = possibleSeeds.filter(row => {
            const seedNum = row[0];
            console.log(`\n🔍 Checking Seed ${seedNum}:`);

            for (const poi of this.currentPOIs) {
                const userState = this.poiStates[poi.id];

                // If user hasn't marked this POI yet, skip it
                if (userState === 'dot') {
                    console.log(`  POI ${poi.id} at (${poi.x}, ${poi.y}): User hasn't marked - SKIPPING`);
                    continue;
                }

                console.log(`  POI ${poi.id} at (${poi.x}, ${poi.y}): User marked as ${userState.toUpperCase()}`);

                // Find what POI type exists at this coordinate in the real seed data
                const realPOIType = this.findRealPOITypeAtCoordinate(seedNum, poi.x, poi.y);
                console.log(`    Real data shows: ${realPOIType || 'NOTHING'} at this location`);

                // If user marked as unknown (?), reject if seed has Church/Mage/Village here
                if (userState === 'unknown') {
                    if (realPOIType === 'church' || realPOIType === 'mage' || realPOIType === 'village') {
                        console.log(`    ❌ REJECTED: User said unknown but real data has ${realPOIType}`);
                        return false;
                    }
                    console.log(`    ✅ OK: User said unknown and real data has ${realPOIType || 'nothing'}`);
                    continue;
                }

                // User has marked a concrete type - seed MUST match exactly
                if (userState === 'church') {
                    if (realPOIType !== 'church') {
                        console.log(`    ❌ REJECTED: User said church but real data has ${realPOIType || 'nothing'}`);
                        return false;
                    }
                    console.log(`    ✅ MATCH: User said church and real data has church`);
                } else if (userState === 'mage') {
                    if (realPOIType !== 'mage') {
                        console.log(`    ❌ REJECTED: User said mage but real data has ${realPOIType || 'nothing'}`);
                        return false;
                    }
                    console.log(`    ✅ MATCH: User said mage and real data has mage`);
                } else if (userState === 'village') {
                    if (realPOIType !== 'village') {
                        console.log(`    ❌ REJECTED: User said village but real data has ${realPOIType || 'nothing'}`);
                        return false;
                    }
                    console.log(`    ✅ MATCH: User said village and real data has village`);
                } else if (userState === 'carriage') {
                    if (realPOIType !== 'carriage') {
                        console.log(`    ❌ REJECTED: User said carriage but real data has ${realPOIType || 'nothing'}`);
                        return false;
                    }
                    console.log(`    ✅ MATCH: User said carriage and real data has carriage`);
                } else if (userState === 'empty') {
                    // 用户标记为"无建筑"：仅当真实数据也是 nothing（null）时通过
                    if (realPOIType !== null) {
                        console.log(`    ❌ REJECTED: User said empty but real data has ${realPOIType || 'nothing'}`);
                        return false;
                    }
                    console.log(`    ✅ MATCH: User said empty and real data has nothing`);
                }
            }
            console.log(`  ✅ Seed ${seedNum} PASSED all POI checks`);
            return true;
        });

        console.log(`After POI filtering: ${filteredSeeds.length} seeds remaining`);

        this.updateSeedCountDisplay(filteredSeeds.length);

        // Auto-fill determined POIs
        // IMPORTANT: Disable auto-fill when the user is trying to clear an existing POI, auto-fill may just put the cleared value back in automatically.
        if (filteredSeeds.length > 0 && !this.userIsClearing) {
            this.currentPOIs.forEach(poi => {
                // Only check POIs that the user hasn't marked yet
                if (this.poiStates[poi.id] === 'dot') {
                    const possibleTypes = new Set();

                    filteredSeeds.forEach(seedRow => {
                        const seedNum = seedRow[0];
                        const realType = this.findRealPOITypeAtCoordinate(seedNum, poi.x, poi.y);
                        possibleTypes.add(realType);
                    });

                    // If all remaining seeds agree on the type for this POI
                    if (possibleTypes.size === 1) {
                        const determinedType = possibleTypes.values().next().value;

                        if (determinedType === 'church' || determinedType === 'mage' || determinedType === 'village') {
                            console.log(`✅ Auto-setting POI ${poi.id} to ${determinedType}`);
                            this.poiStates[poi.id] = determinedType;
                        } else if (determinedType === 'carriage') {
                            console.log(`✅ Auto-setting POI ${poi.id} to carriage`);
                            this.poiStates[poi.id] = 'carriage';
                        } else if (!determinedType) {
                            // 所有剩余种子该坐标都无建筑（dataset 'nothing'→null）：标 unknown（渲染不可见），
                            // 避免用户去点一个"选任何类型都会被拒、必然 0 种子"的空位点。
                            console.log(`✅ Auto-hiding POI ${poi.id} (no building in any remaining seed)`);
                            this.poiStates[poi.id] = 'unknown';
                        }
                    }
                }
            });
        }

        // === 大空洞碰撞消歧 ===
        const wasActive = this.disambigActive;
        const prevPair = this.currentDisambigPair;

        // 1) POI 过滤后检测碰撞对；碰撞对变了（含退出碰撞）→ 清空旧 A/B 选择，
        //    避免旧值把新种子集合二次过滤错
        const candidatePair = this.detectDisambigPair(filteredSeeds);
        const pairChanged = !candidatePair || !prevPair ||
            prevPair[0] !== candidatePair[0] || prevPair[1] !== candidatePair[1];
        if (pairChanged) {
            this.disambigStates = { A: null, B: null };
        }

        // 2) 按用户已选的 A/B 值二次过滤
        if (this.disambigStates.A || this.disambigStates.B) {
            filteredSeeds = filteredSeeds.filter(row => {
                const d = GH_DISAMBIG[row[0]];
                if (!d) return true;
                if (this.disambigStates.A && d.bossA !== this.disambigStates.A) return false;
                if (this.disambigStates.B && d.ruinB !== this.disambigStates.B) return false;
                return true;
            });
        }

        // 3) 二次过滤后重新检测：仍在碰撞对 → 消歧继续；否则退出（含选够出唯一答案的情况）
        const pair = this.detectDisambigPair(filteredSeeds);
        this.disambigActive = (pair !== null);
        if (pair) {
            this.currentDisambigPair = pair;
        } else {
            this.currentDisambigPair = null;
            this.disambigStates = { A: null, B: null };
        }

        // 4) 消歧模式切换（进入/退出）→ 重绘以显示/隐藏 A/B 紫点
        if (wasActive !== this.disambigActive) {
            this.drawMap(this.images.maps[this.chosenMap]);
        }
        // 5) 消歧菜单：仍在消歧模式 → 自动显示并刷新；收敛到唯一答案 / 退出 → 隐藏
        if (this.disambigActive) {
            this.showDisambigMenu();
        } else if (wasActive) {
            this.hideDisambigMenu();
        }

        // Check if we should show POI suggestions
        const isMobile = window.innerWidth <= 768;
        
        // Desktop: show when ≤ 10 seeds remain, Mobile: show when ≤ 4 seeds remain
        const desktopThreshold = 10;
        const mobileThreshold = 4;
        
        // spawn 阶段（出生点未选定）不显示建筑类别建议：建议是叠在 canvas 上的 DOM，
        // 不受 drawMap 的 spawnPhase 守卫控制，会在出生点阶段同时冒出并遮挡出生点。
        // 选完出生点（spawnPhase=false）后由下方逻辑正常展示。
        const shouldShowSuggestions = !this.spawnPhase &&
                                    filteredSeeds.length > 0 &&
                                    filteredSeeds.length > 1 &&
                                    (isMobile ? filteredSeeds.length <= mobileThreshold :
                                               filteredSeeds.length <= desktopThreshold);
        
        if (shouldShowSuggestions) {
            this.showPOISuggestions(filteredSeeds, isMobile);
        } else {
            this.hidePOISuggestions();
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
        const mapSeed = seedRow[0];
        this.showingSeedImage = true;

        // Hide any POI suggestions since we found the final seed
        this.hidePOISuggestions();

        // Show seed image with nightlord info
        this.showSeedImage(seedRow);
    }

    showPOISuggestions(filteredSeeds, isMobile = false) {
        console.log(`Showing POI suggestions for ${filteredSeeds.length} remaining seeds${isMobile ? ' (mobile)' : ''}`);

        // Calculate possible POI types for each unmarked POI
        const suggestions = this.calculatePOISuggestions(filteredSeeds);

        // Remove any existing suggestions
        this.hidePOISuggestions();

        // Create suggestion UI for each POI that has possible values
        Object.entries(suggestions).forEach(([poiId, possibleTypes]) => {
            if (possibleTypes.length > 0) {
                this.createPOISuggestionUI(poiId, possibleTypes, isMobile);
            }
        });
    }

    calculatePOISuggestions(filteredSeeds) {
        const suggestions = {};

        // For each unmarked POI, find what types are possible across remaining seeds
        this.currentPOIs.forEach(poi => {
            if (this.poiStates[poi.id] === 'dot') {
                const possibleTypes = new Set();

                filteredSeeds.forEach(seedRow => {
                    const seedNum = seedRow[0];
                    const realType = this.findRealPOITypeAtCoordinate(seedNum, poi.x, poi.y);

                    // 汇总该 POI 在剩余种子中可能出现的建筑类型，供用户区分种子
                    if (realType === 'church') {
                        possibleTypes.add('church');
                    } else if (realType === 'mage') {
                        possibleTypes.add('mage');
                    } else if (realType === 'village') {
                        possibleTypes.add('village');
                    } else if (realType === 'carriage') {
                        possibleTypes.add('carriage');
                    } else if (!realType) {
                        // 真实数据为 nothing（无建筑）：作为"空白"选项出现，
                        // 让用户能主动区分"有建筑 vs 无建筑"的种子（如 POI4 马车 vs 空地）
                        possibleTypes.add('empty');
                    }
                });

                suggestions[poi.id] = Array.from(possibleTypes);
                console.log(`POI ${poi.id} can be: ${Array.from(possibleTypes).join(', ')}`);
            }
        });

        return suggestions;
    }

    createPOISuggestionUI(poiId, possibleTypes, isMobile = false) {
        const poiIdInt = parseInt(poiId, 10);
        const poi = this.currentPOIs.find(p => p.id === poiIdInt);
        if (!poi) return;

        // Create suggestion container
        const suggestionContainer = document.createElement('div');
        suggestionContainer.className = 'poi-suggestion-container';
        suggestionContainer.id = `suggestion-${poiId}`;
        
        // Add mobile class for styling
        if (isMobile) {
            suggestionContainer.classList.add('mobile-suggestion');
            
            // For mobile, we'll check the layout after buttons are added
            // to determine if it's single column
            setTimeout(() => {
                const buttons = suggestionContainer.querySelectorAll('.poi-suggestion-btn');
                if (buttons.length > 0) {
                    // Check if buttons are stacked vertically (single column)
                    const firstButton = buttons[0];
                    const secondButton = buttons[1];
                    
                    if (secondButton) {
                        const firstRect = firstButton.getBoundingClientRect();
                        const secondRect = secondButton.getBoundingClientRect();
                        
                        // If buttons are stacked vertically (second button is below first)
                        if (secondRect.top > firstRect.bottom) {
                            suggestionContainer.classList.add('single-column');
                        }
                    } else {
                        // Only one button, definitely single column
                        suggestionContainer.classList.add('single-column');
                    }
                }
            }, 50);
        }

        // Position it near the POI on the canvas
        const mapContainer = document.querySelector('.map-container');
        const canvas = document.getElementById('map-canvas');
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = mapContainer.getBoundingClientRect();

        const scaleX = canvasRect.width / canvas.width;
        const scaleY = canvasRect.height / canvas.height;

        // Calculate POI position relative to the map container
        const relativeX = (canvasRect.left - containerRect.left) + (poi.x * scaleX);
        const relativeY = (canvasRect.top - containerRect.top) + (poi.y * scaleY);

        // For mobile, use the same relative positioning as desktop but with adjusted offsets
        if (isMobile) {
            suggestionContainer.style.position = 'absolute';
            suggestionContainer.style.transform = 'translateX(-50%)';
            
            // Use the same positioning logic as desktop but with smaller offsets
            // to account for the smaller size (50% scale)
            if (poiIdInt === 2) {
                suggestionContainer.style.left = `${relativeX - 15}px`;
                suggestionContainer.style.top = `${relativeY + 10}px`;
            } else if (poiIdInt === 4) {
                suggestionContainer.style.left = `${relativeX + 10}px`;
                suggestionContainer.style.top = `${relativeY - 40}px`;
            } else if (poiIdInt === 5) {
                suggestionContainer.style.left = `${relativeX - 20}px`;
                suggestionContainer.style.top = `${relativeY - 50}px`;
            } else if (poiIdInt === 6) {
                suggestionContainer.style.left = `${relativeX}px`;
                suggestionContainer.style.top = `${relativeY + 10}px`;
            } else if (poiIdInt === 8) {
                suggestionContainer.style.left = `${relativeX + 10}px`;
                suggestionContainer.style.top = `${relativeY + 10}px`;
            } else if (poiIdInt === 9) {
                suggestionContainer.style.left = `${relativeX - 20}px`;
                suggestionContainer.style.top = `${relativeY + 10}px`;
            } else if (poiIdInt === 10) {
                suggestionContainer.style.left = `${relativeX + 20}px`;
                suggestionContainer.style.top = `${relativeY - 40}px`;
            } else {
                suggestionContainer.style.left = `${relativeX}px`;
                suggestionContainer.style.top = `${relativeY - 40}px`;
            }
        } else {
            // Desktop positioning (original logic)
            suggestionContainer.style.transform = 'translateX(-50%)';

            if (poiIdInt === 2) {
                suggestionContainer.style.left = `${relativeX - 30}px`;
                suggestionContainer.style.top = `${relativeY + 20}px`;
            } else if (poiIdInt === 4) {
                suggestionContainer.style.left = `${relativeX + 20}px`;
                suggestionContainer.style.top = `${relativeY - 80}px`;
            } else if (poiIdInt === 5) {
                suggestionContainer.style.left = `${relativeX - 40}px`;
                suggestionContainer.style.top = `${relativeY - 100}px`;
            } else if (poiIdInt === 6) {
                suggestionContainer.style.left = `${relativeX}px`;
                suggestionContainer.style.top = `${relativeY + 20}px`;
            } else if (poiIdInt === 8) {
                suggestionContainer.style.left = `${relativeX + 20}px`;
                suggestionContainer.style.top = `${relativeY + 20}px`;
            } else if (poiIdInt === 9) {
                suggestionContainer.style.left = `${relativeX - 40}px`;
                suggestionContainer.style.top = `${relativeY + 20}px`;
            } else if (poiIdInt === 10) {
                suggestionContainer.style.left = `${relativeX + 40}px`;
                suggestionContainer.style.top = `${relativeY - 80}px`;
            } else {
                suggestionContainer.style.left = `${relativeX}px`;
                suggestionContainer.style.top = `${relativeY - 80}px`;
            }
        }

        // Create suggestion buttons for each possible type
        possibleTypes.forEach(type => {
            const button = document.createElement('button');
            button.className = 'poi-suggestion-btn';
            button.dataset.type = type;
            button.dataset.poiId = poiId;

            // Add icon and label with data-i18n attribute for automatic translation
            if (type === 'church') {
                button.innerHTML = `<img src="assets/images/church.png" class="suggestion-icon" alt="${this.getText('poi.church')}"><span data-i18n="poi.church">${this.getText('poi.church')}</span>`;
            } else if (type === 'mage') {
                button.innerHTML = `<img src="assets/images/mage-tower.png" class="suggestion-icon" alt="${this.getText('poi.mage')}"><span data-i18n="poi.mage">${this.getText('poi.mage')}</span>`;
            } else if (type === 'village') {
                button.innerHTML = `<img src="assets/images/village.png" class="suggestion-icon" alt="${this.getText('poi.village')}"><span data-i18n="poi.village">${this.getText('poi.village')}</span>`;
            } else if (type === 'carriage') {
                button.innerHTML = `<img src="assets/images/carriage.png" class="suggestion-icon" alt="${this.getText('poi.carriage')}"><span data-i18n="poi.carriage">${this.getText('poi.carriage')}</span>`;
            } else if (type === 'empty') {
                button.innerHTML = `<img src="assets/images/empty.png" class="suggestion-icon" alt="${this.getText('poi.empty')}"><span data-i18n="poi.empty">${this.getText('poi.empty')}</span>`;
            }

            // Add click handler
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectSuggestedPOI(poiId, type);
            });

            // Add touch handler for mobile
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectSuggestedPOI(poiId, type);
            }, { passive: false });

            suggestionContainer.appendChild(button);
        });

        // Add to the map container
        mapContainer.appendChild(suggestionContainer);

        // Add scroll event listener for mobile to keep suggestions positioned correctly
        if (isMobile) {
        }

        // Add entrance animation
        setTimeout(() => {
            suggestionContainer.classList.add('visible');
        }, 50);
    }

    selectSuggestedPOI(poiId, type) {
        console.log(`Selecting suggested ${type} for POI ${poiId}`);

        // Update POI state
        this.poiStates[poiId] = type;

        // Redraw map
        this.drawMap(this.images.maps[this.chosenMap]);

        // Update seed filtering (this will recalculate suggestions)
        this.updateSeedFiltering();
    }

    ensureSuggestionInViewport(suggestionContainer, mapContainer) {
        // Ensure suggestion doesn't go outside viewport bounds
        const rect = suggestionContainer.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = parseFloat(suggestionContainer.style.left);
        let top = parseFloat(suggestionContainer.style.top);
        
        // Check right edge
        if (rect.right > viewportWidth) {
            left -= (rect.right - viewportWidth + 10);
        }
        
        // Check left edge
        if (rect.left < 10) {
            left = 10;
        }
        
        // Check bottom edge
        if (rect.bottom > viewportHeight) {
            top -= (rect.bottom - viewportHeight + 10);
        }
        
        // Check top edge
        if (rect.top < 10) {
            top = 10;
        }
        
        suggestionContainer.style.left = `${left}px`;
        suggestionContainer.style.top = `${top}px`;
    }

    ensureSuggestionInViewport(suggestionContainer, mapContainer) {
        // Ensure suggestion doesn't go outside viewport bounds
        const rect = suggestionContainer.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = parseFloat(suggestionContainer.style.left);
        let top = parseFloat(suggestionContainer.style.top);
        
        // Check right edge
        if (rect.right > viewportWidth) {
            left -= (rect.right - viewportWidth + 10);
        }
        
        // Check left edge
        if (rect.left < 10) {
            left = 10;
        }
        
        // Check bottom edge
        if (rect.bottom > viewportHeight) {
            top -= (rect.bottom - viewportHeight + 10);
        }
        
        // Check top edge
        if (rect.top < 10) {
            top = 10;
        }
        
        suggestionContainer.style.left = `${left}px`;
        suggestionContainer.style.top = `${top}px`;
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
        const mapSeed = seedRow[0];
        const nightlord = seedRow[1] || this.getText('nightlord.unknown');
        const mapType = seedRow[2] || this.getText('map.default');

        // Store the seed row for refresh purposes
        this.lastSeedRow = seedRow;

        // Get translated nightlord name
        const nightlordTranslated = this.getNightlordTranslatedName(nightlord);

        // 在种子计数器区域显示夜王信息
        this.updateNightlordInfo(nightlordTranslated);

        const canvas = document.getElementById('map-canvas');
        const seedImageContainer = document.getElementById('seed-image-container');

        canvas.style.display = 'none';
        seedImageContainer.style.display = 'block';

        const seedStr = mapSeed.toString().padStart(3, '0');
        const currentLang = this.languageManager.getCurrentLanguage();
        // DLC 种子(≥1000) 用 Fuwish 汉化版 pattern 图（assets/pattern/dlc/，语言无关，DLC 图仅中文版）
        const seedImageUrl = mapSeed >= 1000
            ? `assets/pattern/dlc/${seedStr}.jpg`
            : `assets/pattern/${currentLang}/${seedStr}.jpg`;

        // 检查是否为移动设备
        const isMobile = window.innerWidth <= 768;

        seedImageContainer.innerHTML = `
            <div class="seed-result-container">
                ${isMobile ? '<button class="close-fullscreen-btn">&times;</button>' : ''}
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

        // 为移动端关闭按钮添加事件监听
        if (isMobile) {
            const closeBtn = seedImageContainer.querySelector('.close-fullscreen-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    seedImageContainer.style.display = 'none';
                    canvas.style.display = 'block';
                    this.renderMap();
                });
            }
        }
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
        // Use CV classification data if available
        if (CV_CLASSIFICATION_DATA) {
            const seedKey = seedNum.toString().padStart(3, '0');
            const seedClassifications = CV_CLASSIFICATION_DATA[seedKey];

            if (seedClassifications) {
                // Find which clickable POI this coordinate matches
                const clickablePOI = this.currentPOIs.find(poi => {
                    const dx = clickX - poi.x;
                    const dy = clickY - poi.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    return distance <= 40; // Same tolerance as used elsewhere
                });

                if (clickablePOI) {
                    const poiKey = `POI${clickablePOI.id}`;
                    const cvClassification = seedClassifications[poiKey];

                    if (cvClassification) {
                        console.log(`    ✅ Classification: ${cvClassification.toUpperCase()} for POI ${clickablePOI.id}`);
                        return cvClassification === 'nothing' ? null : cvClassification;
                    }
                }
            }
        }

        // No classification data available - return null
        console.log(`    ❌ No classification found in dataset for seed ${seedNum}`);
        return null;
    }

}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NightreignMapRecogniser();
});