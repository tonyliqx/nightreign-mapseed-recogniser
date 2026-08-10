/**
 * Nightreign Map Seed Recognizer - New Architecture
 * A completely dynamic, data-driven map recognition system
 */

class NightreignApp {
    constructor() {
        this.currentScreen = 'loading';
        this.selectedNightlord = null;
        this.selectedMap = null;
        this.poiStates = {};
        this.currentPOIs = [];
        this.filteredSeeds = [];
        this.contextMenu = null;
        this.currentRightClickedPOI = null;
        
        // Data will be loaded from poi-data.js
        this.poiData = null;
        this.seedData = null;
        
        // Map images
        this.mapImages = {};
        this.currentMapImage = null;
        
        // Result screen setup flag
        this.resultScreenListenersSetup = false;
        
        // Layer mappings will be loaded from poi-data-new.js
        this.layerMappings = null;
        
        // Spawn point selection state
        this.selectedSpawnPoint = null;
        this.selectedSpawnEnemy = null;
        this.availableSpawnPoints = [];
        this.spawnContextMenu = null;
        this.currentRightClickedSpawn = null;
        
        // Layered filtering system
        this.baseFilteredSeeds = []; // Seeds after nightlord/map filtering
        this.spawnFilteredSeeds = []; // Seeds after spawn point filtering
        this.poiFilteredSeeds = []; // Seeds after POI filtering
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Nightreign App...');
        
        // Setup event listeners IMMEDIATELY - don't wait for data loading
        console.log('🔗 Setting up event listeners...');
        this.setupEventListeners();
        console.log('✅ Event listeners set up successfully');
        
        // Show selection screen immediately
        console.log('🖥️ Showing selection screen...');
        this.showScreen('selection');
        
        // Load data in the background
        console.log('📊 Loading data...');
        await this.loadData();
        console.log('✅ Data loaded successfully');
        
        // 底图改为按需懒加载：用户在 startRecognition() 选定地形后才加载对应底图（见 loadMapImage）
        
        // Initialize language manager with advanced translations
        try {
            // Override the global translations before creating the language manager
            const originalTranslations = window.translations;
            window.translations = translations_advanced;
            
            this.languageManager = new LanguageManager();
            
            // Listen for language changes using the same approach as basic page
            window.addEventListener('languageChanged', (e) => {
                this.refreshOnLanguageChange();
            });
            
            // Handle window resize to reposition context menus
            window.addEventListener('resize', () => {
                this.repositionContextMenu();
                this.repositionSpawnContextMenu();
            });
            
            // Restore original translations for other pages
            window.translations = originalTranslations;
            
            console.log('✅ Language manager initialized successfully');
        } catch (error) {
            console.warn('⚠️ Language manager initialization failed:', error);
            // Continue without language manager
            this.languageManager = null;
        }
        
        console.log('✅ App initialized successfully');
    }

    async loadData() {
        try {
            // Load POI data using the new loader
            this.poiData = await loadPOIData();
            this.seedData = SEED_DATA;
            
            // Make POI data globally available for coordinate matching
            window.poiData = this.poiData;
            window.seedData = this.seedData;
            
            // Load layer mappings from POI data
            this.layerMappings = this.poiData.layerMappings;
            
            console.log('✅ Data loaded successfully');
            console.log('POI Data structure:', this.poiData);
            console.log('Seed Data structure:', this.seedData);
            
        } catch (error) {
            console.error('❌ Failed to load data:', error);
            this.showError('Failed to load map data. Please refresh the page.');
        }
    }

    async loadMapImage(mapType) {
        // 已加载则直接复用缓存（用户重复选同一地形时命中）
        if (this.mapImages[mapType]) return this.mapImages[mapType];

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.mapImages[mapType] = img;
                console.log(`🗺️ Loaded map image: ${mapType}`);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`⚠️ Failed to load map image for ${mapType}`);
                resolve(null); // 加载失败返回 null，drawMapBackground 会走深色 fallback
            };
            const fileName = this.getMapFileName(mapType);
            img.src = `assets/map/${fileName}`;
        });
    }

    getMapFileName(mapType) {
        const fileNameMap = {
             'Default': 'default.jpg',
             'Crater': 'crater.jpg',
             'Mountaintop': 'mountaintop.jpg',
             'Noklateo': 'noklateo.jpg',
             'Rotted Woods': 'rotted_wood.jpg',
             'Great Hollow': 'great_hollow.jpg'
        };
         return fileNameMap[mapType] || 'default.jpg';
    }

    setupEventListeners() {
        // Nightlord selection
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectNightlord(e.currentTarget.dataset.nightlord);
            });
        });

        // Map selection
        document.querySelectorAll('.map-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectMap(e.currentTarget.dataset.map);
            });
        });

        // Start recognition
        const startBtn = document.getElementById('start-recognition');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startRecognition();
            });
        }

        // Back button - reset everything and go to selection screen
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                // Hide any open context menu before resetting
                this.hideContextMenu();
                this.resetToSelection();
            });
        }

        // Clear All button
        const clearAllBtn = document.getElementById('clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllPOIs();
            });
        }

        // Help button
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.showHelp();
            });
        }

        // Close help modal
        const closeHelpBtn = document.getElementById('close-help');
        if (closeHelpBtn) {
            closeHelpBtn.addEventListener('click', () => {
                this.hideHelp();
            });
        }

        // Switch to basic mode
        const switchToBasicBtn = document.getElementById('switch-to-basic-btn');
        if (switchToBasicBtn) {
            switchToBasicBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // Click outside context menu to close it
        document.addEventListener('click', (e) => {
            const contextMenu = document.getElementById('context-menu');
            const canvas = document.getElementById('map-canvas');
            
            // Don't close if clicking on context menu
            if (contextMenu && contextMenu.contains(e.target)) {
                return;
            }
            
            // If clicking on canvas, check if it's on a POI or empty space
            if (canvas && canvas.contains(e.target)) {
                // Let the canvas handle its own clicks first
                // The canvas click handler will determine if it's on a POI or empty space
                // If it's on empty space, the context menu should close
                return;
            }
            
            // Close context menu for any other clicks (outside canvas and context menu)
            if (contextMenu && contextMenu.style.display !== 'none') {
                this.hideContextMenu();
            }
        });

        // Spawn screen buttons
        document.getElementById('spawn-back-btn').addEventListener('click', () => {
            this.hideSpawnContextMenu();
            this.showScreen('selection');
        });

        document.getElementById('spawn-skip-btn').addEventListener('click', () => {
            this.hideSpawnContextMenu();
            this.startPOIRecognition();
        });

        const spawnHelpBtn = document.getElementById('spawn-help-btn');
        if (spawnHelpBtn) {
            spawnHelpBtn.addEventListener('click', () => {
                this.showHelp();
            });
        }

        // Result screen buttons will be added when result screen is first shown
    }

    selectNightlord(nightlord) {
        // Toggle selection: if clicking the same nightlord, unselect it
        if (this.selectedNightlord === nightlord) {
            this.selectedNightlord = null;
            
            // Update UI - remove all selections
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
        } else {
            this.selectedNightlord = nightlord;
            
            // Update UI
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            const selectedNightlordBtn = document.querySelector(`[data-nightlord="${nightlord}"]`);
            if (selectedNightlordBtn) {
                selectedNightlordBtn.classList.add('selected');
            }
        }
        
        this.updateStartButton();
    }

    selectMap(mapType) {
        this.selectedMap = mapType;
        
        // Update UI
        document.querySelectorAll('.map-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        const selectedMapBtn = document.querySelector(`[data-map="${mapType}"]`);
        if (selectedMapBtn) {
            selectedMapBtn.classList.add('selected');
        }
        
        this.updateStartButton();
    }

    updateStartButton() {
        const startBtn = document.getElementById('start-recognition');
        if (!startBtn) return;
        
        startBtn.disabled = !this.selectedMap;
        
        // Update button text to show what's required
        if (!this.selectedMap) {
            startBtn.innerHTML = `<i class="fas fa-play"></i> ${this.languageManager.getText('actions.start_disabled')}`;
        } else {
            startBtn.innerHTML = `<i class="fas fa-play"></i> ${this.languageManager.getText('actions.start')}`;
        }
    }

    async startRecognition() {
        if (!this.selectedMap) return;
        
        // Check if data is loaded
        if (!this.seedData || !this.poiData) {
            console.log('⏳ Data still loading, please wait...');
            // Show a loading message or disable the button
            const startBtn = document.getElementById('start-recognition');
            if (startBtn) {
                startBtn.disabled = true;
                const loadingText = this.languageManager ? this.languageManager.getText('ui.loading') : 'Loading...';
                startBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
                // Re-enable after a short delay
                setTimeout(() => {
                    startBtn.disabled = false;
                    startBtn.innerHTML = `<i class="fas fa-play"></i> ${this.languageManager.getText('actions.start')}`;
                }, 1000);
            }
            return;
        }

        // Update display for spawn screen
        document.getElementById('spawn-current-map').textContent = this.getMapDisplayName(this.selectedMap);
        document.getElementById('spawn-current-nightlord').textContent = this.getNightlordDisplayName(this.selectedNightlord);

        // 按需加载选中地形的底图（首次加载后缓存复用）
        this.currentMapImage = await this.loadMapImage(this.selectedMap);

        // Filter seeds based on current selections
        this.filterSeeds();

        // Load available spawn points for this map/nightlord combination
        this.loadAvailableSpawnPoints();

        // Show spawn point selection screen
        this.showScreen('spawn');

        // Setup spawn canvas
        this.setupSpawnCanvas();
    }

    startPOIRecognition() {
        // Update display for recognition screen
        document.getElementById('current-map').textContent = this.getMapDisplayName(this.selectedMap);
        document.getElementById('current-nightlord').textContent = this.getNightlordDisplayName(this.selectedNightlord);

        // Update seed count with current filtered seeds
        document.getElementById('seed-count').textContent = this.filteredSeeds.length;
        
        console.log(`🎯 Starting POI recognition with ${this.filteredSeeds.length} pre-filtered seeds`);

        // Load POIs for selected map
        this.loadPOIsForMap(this.selectedMap);

        // Update POI states based on remaining seeds
        this.updatePOIStatesFromSeeds();

        // Show recognition screen
        this.showScreen('recognition');

        // Setup canvas
        this.setupCanvas();
    }

    loadPOIsForMap(mapType) {
        // Get POIs for this map type from the data
        const mapData = this.poiData.mapTypes[mapType];
        console.log(`🗺️ Map data for ${mapType}:`, mapData);
        
        const mapPOIs = mapData ? mapData.pois : [];
        console.log(`📍 POIs array for ${mapType}:`, mapPOIs);
        console.log(`📍 First few POIs:`, mapPOIs.slice(0, 3));
        
        this.currentPOIs = mapPOIs.map(poi => ({
            id: poi.id,
            name: poi.name,
            x: poi.x,
            y: poi.y,
            category: poi.category,
            currentState: this.poiStates[poi.id]?.state || 'dot',
            selectionState: this.poiStates[poi.id]?.selectionState || {
                layer1: null, // 单层：选中的 type 中文名
                layer2: null  // 弃用（保留兼容）
            }
        }));

        console.log(`📍 Loaded ${this.currentPOIs.length} POIs for ${mapType}`);
        console.log(`📍 Sample POI:`, this.currentPOIs[0]);
    }

    loadAvailableSpawnPoints() {
        // Get all unique spawn points from filtered seeds
        const spawnPoints = new Map();
        
        this.filteredSeeds.forEach(seed => {
            const spawnPoint = seed.spawnPoint;
            if (spawnPoint && spawnPoint.location) {
                const key = spawnPoint.location;
                if (!spawnPoints.has(key)) {
                    spawnPoints.set(key, {
                        location: spawnPoint.location,
                        coordinate: spawnPoint.coordinate,
                        enemies: new Set()
                    });
                }
                // Add enemy to the set for this spawn point
                if (spawnPoint.enemy) {
                    spawnPoints.get(key).enemies.add(spawnPoint.enemy);
                }
            }
        });
        
        // Convert to array and sort enemies
        this.availableSpawnPoints = Array.from(spawnPoints.values()).map(spawn => ({
            location: spawn.location,
            coordinate: spawn.coordinate,
            enemies: Array.from(spawn.enemies).sort()
        }));
        
        console.log(`📍 Available spawn points:`, this.availableSpawnPoints);
    }

    setupSpawnCanvas() {
        const canvas = document.getElementById('spawn-canvas');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw map background
        this.drawMapBackground(ctx);
        
        // Draw spawn points
        this.drawSpawnPoints(ctx);
        
        // Setup event listeners
        this.setupSpawnCanvasEvents(canvas);
    }

    drawSpawnPoints(ctx) {
        this.availableSpawnPoints.forEach(spawnPoint => {
            // Skip spawn points without coordinates (e.g., DLC Great Hollow seeds with placeholder data)
            if (!spawnPoint.coordinate || spawnPoint.coordinate.x === undefined || spawnPoint.coordinate.y === undefined) {
                return;
            }
            // Scale coordinates by 0.5 to match POI scaling
            const x = spawnPoint.coordinate.x * 0.5;
            const y = spawnPoint.coordinate.y * 0.5;
            
            // Draw spawn point dot
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    setupSpawnCanvasEvents(canvas) {
        // Click handler for spawn points
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            // Calculate canvas coordinates for hit detection
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;
            
            const clickedSpawn = this.findClickedSpawnPoint(canvasX, canvasY);
            if (clickedSpawn) {
                // 出生点一次点选：直接按 location 过滤并进入 POI（无 per-seed 敌人数据，不弹敌人菜单）
                this.selectSpawnPoint(clickedSpawn);
            }
        });

        // Right click - clear selection
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.hideSpawnContextMenu();
        });
    }

    findClickedSpawnPoint(x, y) {
        const tolerance = 20;

        return this.availableSpawnPoints.find(spawnPoint => {
            // Skip spawn points without valid coordinates
            if (!spawnPoint.coordinate || spawnPoint.coordinate.x === undefined) {
                return false;
            }
            // Scale coordinates by 0.5 to match drawing coordinates
            const scaledX = spawnPoint.coordinate.x * 0.5;
            const scaledY = spawnPoint.coordinate.y * 0.5;
            const dx = x - scaledX;
            const dy = y - scaledY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= tolerance;
        });
    }

    showSpawnContextMenu(spawnPoint, x, y) {
        this.currentRightClickedSpawn = spawnPoint;
        
        // Check if there's only 1 enemy option - auto-select it
        if (spawnPoint.enemies.length === 1) {
            console.log(`🎯 Only 1 enemy option for ${spawnPoint.location} - auto-selecting: ${spawnPoint.enemies[0]}`);
            this.selectSpawnEnemy(spawnPoint, spawnPoint.enemies[0]);
            return;
        }
        
        // Generate context menu content
        this.generateSpawnContextMenu(spawnPoint);
        
        const contextMenu = document.getElementById('spawn-context-menu');
        
        // Render off-screen to measure
        contextMenu.style.display = 'block';
        contextMenu.style.left = '-9999px';
        contextMenu.style.top = '-9999px';
        
        // Measure actual dimensions
        const menuRect = contextMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const margin = 10;
        let finalX = x + margin;
        let finalY = y + margin;
        
        // Adjust if going off right edge
        if (finalX + menuRect.width > viewportWidth - margin) {
            finalX = x - menuRect.width - margin;
        }
        finalX = Math.max(margin, Math.min(finalX, viewportWidth - menuRect.width - margin));
        
        // Adjust if going off bottom edge
        if (finalY + menuRect.height > viewportHeight - margin) {
            finalY = y - menuRect.height - margin;
        }
        finalY = Math.max(margin, Math.min(finalY, viewportHeight - menuRect.height - margin));
        
        // Apply final position
        contextMenu.style.left = `${finalX}px`;
        contextMenu.style.top = `${finalY}px`;
        
        this.spawnContextMenu = contextMenu;
    }

    generateSpawnContextMenu(spawnPoint) {
        const contextMenu = document.getElementById('spawn-context-menu');
        
        // Clear existing content
        contextMenu.innerHTML = '';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'context-menu-header';
        header.innerHTML = '<span data-i18n="context.select_enemy">Select Enemy</span>';
        contextMenu.appendChild(header);
        
        // Add enemy options
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'context-menu-options text-grid';
        
        spawnPoint.enemies.forEach(enemy => {
            const option = document.createElement('div');
            option.className = 'context-menu-item text-only';
            
            // Use translated enemy name
            const displayName = this.getEnemyDisplayName(enemy);
            option.textContent = displayName;
            
            // Store original enemy name as data attribute for selection
            option.setAttribute('data-enemy', enemy);
            
            option.addEventListener('click', () => {
                this.selectSpawnEnemy(spawnPoint, enemy);
                this.hideSpawnContextMenu();
            });
            optionsContainer.appendChild(option);
        });
        
        // Add "I don't know" option
        const unknownOption = document.createElement('div');
        unknownOption.className = 'context-menu-item text-only';
        unknownOption.innerHTML = '<span data-i18n="context.i_dont_know">I don\'t know</span>';
        unknownOption.addEventListener('click', () => {
            this.selectSpawnEnemy(spawnPoint, "I don't know");
            this.hideSpawnContextMenu();
        });
        optionsContainer.appendChild(unknownOption);
        
        contextMenu.appendChild(optionsContainer);
        
        // Translate the "I don't know" option immediately
        if (this.languageManager) {
            this.languageManager.updateUI();
        }
    }

    selectSpawnPoint(spawnPoint) {
        this.selectedSpawnPoint = spawnPoint;
        this.selectedSpawnEnemy = null;  // 无 per-seed 敌人数据（见 memory: spawn-enemy-source-and-fallback-fix）

        console.log(`📍 Selected spawn point: ${spawnPoint.location}`);

        // 按 location 过滤种子
        this.filterSeedsBySpawnPoint();

        // 仅剩 1 个种子 → 直接出结果
        if (this.filteredSeeds.length === 1) {
            console.log(`🎯 Only 1 seed remaining after spawn point selection - showing result directly`);
            this.startPOIRecognition();
            this.showResult(this.filteredSeeds[0]);
            return;
        }

        this.updateSpawnSeedCount();
        // 进入 POI 识别
        this.startPOIRecognition();
    }

    selectSpawnEnemy(spawnPoint, enemy) {
        this.selectedSpawnPoint = spawnPoint;
        this.selectedSpawnEnemy = enemy;
        
        console.log(`📍 Selected spawn point: ${spawnPoint.location} with enemy: ${enemy}`);
        
        // Filter seeds based on spawn point selection
        this.filterSeedsBySpawnPoint();
        
        // Check if we have exactly 1 seed - go directly to result
        if (this.filteredSeeds.length === 1) {
            console.log(`🎯 Only 1 seed remaining after spawn point selection - showing result directly`);
            // First transition to recognition screen, then show result
            this.startPOIRecognition();
            this.showResult(this.filteredSeeds[0]);
            return;
        }
        
        // Update seed count display
        this.updateSpawnSeedCount();
        
        // Transition to POI recognition
        this.startPOIRecognition();
    }

    filterSeedsBySpawnPoint() {
        if (!this.selectedSpawnPoint) return;

        console.log(`🔍 Filtering seeds by spawn point...`);
        console.log(`   Spawn location: ${this.selectedSpawnPoint.location}`);

        // 仅按 location 过滤（无 per-seed 敌人数据）
        this.spawnFilteredSeeds = this.baseFilteredSeeds.filter(seed => {
            const spawnPoint = seed.spawnPoint;
            return spawnPoint && spawnPoint.location === this.selectedSpawnPoint.location;
        });

        this.filteredSeeds = [...this.spawnFilteredSeeds];
        this.poiFilteredSeeds = [];
        this.updateSeedCounts();

        console.log(`🔍 Spawn filtered to ${this.filteredSeeds.length} seeds`);
    }

    updateSeedCounts() {
        // Update main seed count
        document.getElementById('seed-count').textContent = this.filteredSeeds.length;
        
        // Update spawn seed count if on spawn screen
        this.updateSpawnSeedCount();
    }

    updateSpawnSeedCount() {
        const countElement = document.getElementById('spawn-seed-count');
        if (countElement) {
            countElement.textContent = this.filteredSeeds.length;
        }
    }

    hideSpawnContextMenu() {
        const contextMenu = document.getElementById('spawn-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        this.spawnContextMenu = null;
        this.currentRightClickedSpawn = null;
    }

    filterSeeds() {
        if (!this.seedData) return;

        console.log(`🔍 Starting base seed filtering...`);
        console.log(`   Selected nightlord: ${this.selectedNightlord || 'Any'}`);
        console.log(`   Selected map: ${this.selectedMap}`);

        const allSeeds = Object.values(this.seedData);
        console.log(`   Total seeds to check: ${allSeeds.length}`);

        // Base filtering: nightlord and map only
        this.baseFilteredSeeds = allSeeds.filter(seed => {
            const nightlordMatch = !this.selectedNightlord || seed.nightlord === this.selectedNightlord;
            const mapMatch = seed.mapType === this.selectedMap;
            return nightlordMatch && mapMatch;
        });

        // Reset other filter layers
        this.spawnFilteredSeeds = [];
        this.poiFilteredSeeds = [];
        
        // Set current filtered seeds to base
        this.filteredSeeds = [...this.baseFilteredSeeds];

        this.updateSeedCounts();
        
        console.log(`🔍 Base filtered to ${this.filteredSeeds.length} seeds`);
    }

    filterSeedsByPOI() {
        if (!this.seedData) return;

        console.log(`🔍 Filtering seeds by POI selections...`);
        console.log(`   Current POI states:`, Object.keys(this.poiStates).length, 'POIs with selections');
        
        // Determine source seeds for POI filtering
        const sourceSeeds = this.spawnFilteredSeeds.length > 0 ? this.spawnFilteredSeeds : this.baseFilteredSeeds;
        console.log(`   Starting with ${sourceSeeds.length} seeds`);

        this.poiFilteredSeeds = sourceSeeds.filter(seed => {
            const poiMatch = this.checkPOIMatches(seed);
            if (poiMatch) {
                console.log(`✅ Seed ${seed.seedNumber} matches POI criteria`);
            }
            return poiMatch;
        });

        // Set current filtered seeds to POI filtered
        this.filteredSeeds = [...this.poiFilteredSeeds];

        // Update POI states based on remaining seeds
        this.updatePOIStatesFromSeeds();

        this.updateSeedCounts();
        
        console.log(`🔍 POI filtered to ${this.filteredSeeds.length} seeds`);

        // Check if we have exactly 1 seed - show result screen
        if (this.filteredSeeds.length === 1) {
            this.showResult(this.filteredSeeds[0]);
        }
    }

    checkPOIMatches(seed) {
        console.log(`🔍 Checking POI matches for seed ${seed.seedNumber}`);

        // Check if the seed matches all current POI selections
        for (const poi of this.currentPOIs) {
            const poiState = this.poiStates[poi.id];
            if (!poiState || !poiState.selectionState) continue;

            const selectionState = poiState.selectionState;
            if (!selectionState.layer1 && !selectionState.layer2) continue; // No selection made

            console.log(`🔍 Checking POI ${poi.name} (${poi.category}) in seed ${seed.seedNumber}`);

            // 无 POI 时 type 视为 null，对应"Empty"选择（不再因 findPOIInSeed 返回 null 直接淘汰）
            const matchingPOI = this.findPOIInSeed(seed, poi.id);
            const expectedType = selectionState.layer1 === 'Empty' ? null : selectionState.layer1;
            const actualType = matchingPOI ? (matchingPOI.type || null) : null;
            if (actualType !== expectedType) {
                console.log(`❌ POI ${poi.name} doesn't match in seed ${seed.seedNumber}: expected ${expectedType}, found ${actualType}`);
                return false;
            }
        }

        console.log(`✅ All POI matches successful for seed ${seed.seedNumber}`);
        return true;
    }

    poiMatchesSelection(poiData, selectionState) {
        // 单层交互：选择值 = type 中文名；匹配 seed poi.type == selectionState.layer1
        console.log(`🔍 Checking POI match: type=${poiData.type}, category=${poiData.category}`);
        console.log(`   Selection: layer1=${selectionState.layer1}`);

        if (selectionState.layer1) {
            const expected = selectionState.layer1 === 'Empty' ? null : selectionState.layer1;
            if ((poiData.type || null) !== expected) {
                console.log(`   ❌ Type mismatch: expected ${expected}, got ${poiData.type}`);
                return false;
            }
        }

        console.log(`   ✅ POI match successful`);
        return true;
    }

    mapCategoryToInternal(jsonCategory) {
        // NAME 类别 key（landmark/stronghold/fieldBoss/...）已是内部 key，直接用
        return jsonCategory;
    }

    setupCanvas() {
        const canvas = document.getElementById('map-canvas');
        const ctx = canvas.getContext('2d');

        // 隐藏结果页高清 pattern 图（回到识别页重画底图）
        const resultImg = document.getElementById('result-pattern-img');
        if (resultImg) resultImg.style.display = 'none';

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw map background
        this.drawMapBackground(ctx);
        
        // Draw POIs
        this.drawPOIs();
        
        // Setup event listeners
        this.setupCanvasEvents(canvas);
    }

    drawMapBackground(ctx) {
        if (this.currentMapImage) {
            // Draw the map image scaled to fit the canvas
            ctx.drawImage(this.currentMapImage, 0, 0, 768, 768);
            console.log(`🗺️ Drew map background: ${this.selectedMap}`);
        } else {
            // Fallback: draw a dark background
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, 768, 768);
            console.log('⚠️ No map image available, using fallback background');
        }
    }

    drawPOIs() {
        const canvas = document.getElementById('map-canvas');
        const ctx = canvas.getContext('2d');
        
        this.currentPOIs.forEach(poi => {
            this.drawPOI(poi, ctx);
        });
    }

    drawPOI(poi, ctx) {
        // 隐藏点位不绘制（剩余种子无解）
        if (poi.currentState === 'hidden') return;

        const x = poi.x;
        const y = poi.y;

        // 仅共享点位(landmark)放大 50% 且用橙色突出；其他类别保持原色原大小
        const isLandmark = poi.category === 'landmark';
        const r = isLandmark ? 1.5 : 1;

        if (poi.currentState === 'dot') {
            // Draw dot with outline for visibility
            ctx.fillStyle = isLandmark ? '#ff8c00' : '#ffd700';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 6 * r, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        } else if (poi.currentState === 'icon') {
            // Draw icon state (layer1 selected)
            ctx.fillStyle = isLandmark ? '#ff8c00' : '#4CAF50';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8 * r, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            // Draw small indicator
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 3 * r, 0, 2 * Math.PI);
            ctx.fill();
        } else if (poi.currentState === 'specific') {
            // Draw specific state (both layers or single layer selected)
            ctx.fillStyle = isLandmark ? '#ff8c00' : '#2196F3';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8 * r, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            // Draw checkmark
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 2 * r, y);
            ctx.lineTo(x, y + 2 * r);
            ctx.lineTo(x + 3 * r, y - r);
            ctx.stroke();
        }
    }

    setupCanvasEvents(canvas) {
        // Remove any existing click handlers to prevent duplicates
        canvas.removeEventListener('click', this.canvasClickHandler);
        
        // Create a new click handler
        this.canvasClickHandler = (e) => {
            // If we're showing a result (pattern image), open fullscreen
            if (this.foundSeed) {
                this.openFullscreen();
                return;
            }
            
            // Otherwise, handle POI selection
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            // Calculate canvas coordinates for hit detection
            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;
            
            const clickedPOI = this.findClickedPOI(canvasX, canvasY);
            if (clickedPOI) {
                // Use click position - menu uses position: fixed (viewport-relative)
                this.showContextMenu(clickedPOI, e.clientX, e.clientY);
            } else {
                // Clicked on empty space - close any open context menu
                this.hideContextMenu();
            }
        };
        
        // Add the click handler
        canvas.addEventListener('click', this.canvasClickHandler);


        // Right click - clear selection (back to dot)
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            // If we're showing a result, don't handle right click
            if (this.foundSeed) return;
            
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            const clickedPOI = this.findClickedPOI(x, y);
            if (clickedPOI) {
                this.clearPOISelection(clickedPOI);
            }
        });

        // Middle click - reset POI
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle click
                e.preventDefault();
                
                // If we're showing a result, don't handle middle click
                if (this.foundSeed) return;
                
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                
                const clickedPOI = this.findClickedPOI(x, y);
                if (clickedPOI) {
                    this.resetPOI(clickedPOI);
                }
            }
        });
    }

    findClickedPOI(x, y) {
        const tolerance = 20;
        
        return this.currentPOIs.find(poi => {
            if (poi.currentState === 'hidden') return false;  // 隐藏点位不可点
            const dx = x - poi.x;
            const dy = y - poi.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= tolerance;
        });
    }

    getPOIDataFromSeed(seed, poiId) {
        const targetPOI = this.findPOIInSeed(seed, poiId);
        if (!targetPOI) return null;
        // 单层：选择值 = type 中文名
        return {
            value: targetPOI.type || null,
            type: targetPOI.type,
            icon: targetPOI.icon,
            category: targetPOI.category
        };
    }

    findPOIInSeed(seed, poiId) {
        if (!seed || !seed.pois) return null;
        
        // Get the POI data from our loaded POI data to find coordinates
        const poiData = this.poiData;
        if (!poiData) return null;
        
        // 用 seed 所在地形限定槽位查找：各地形 slot id 都从 "0" 重新编号，
        // 遍历所有 mapTypes 取首个命中，会拿到别地形同 id 槽位的错位坐标
        // （如大空洞 slot12 会被首位 Default slot12 命中 → 坐标对不上 → 误判无 POI → 全部归零）。
        let targetPOI = null;
        const mapType = seed.mapType || this.selectedMap;
        if (mapType && poiData.mapTypes[mapType]) {
            targetPOI = poiData.mapTypes[mapType].pois.find(poi => poi.id === poiId) || null;
        }
        
        if (!targetPOI) return null;
        
        // Now find the matching POI in the seed data by coordinates
        // Scale back from 768x768 to 1536x1536
        const targetX = targetPOI.x * 2;
        const targetY = targetPOI.y * 2;
        
        // Search through all POIs in the seed (now flattened structure)
        for (const [poiKey, poi] of Object.entries(seed.pois)) {
            const poiX = poi.coordinates.x;
            const poiY = poi.coordinates.y;
            
            // Check if coordinates match (with tolerance)
            if (Math.abs(poiX - targetX) <= 2 && Math.abs(poiY - targetY) <= 2) {
                return { ...poi, category: poi.category };
            }
        }
        
        return null;
    }

    setPOIValue(poiId, value) {
        this.poiStates[poiId] = {
            state: value,
            value: value
        };
        
        // Update POI in current list
        const poi = this.currentPOIs.find(p => p.id === poiId);
        if (poi) {
            poi.currentState = value;
        }
        
        // Redraw
        this.setupCanvas();
        
        console.log(`Set POI ${poiId} to ${value}`);
    }

    resetPOI(poi) {
        delete this.poiStates[poi.id];
        poi.currentState = 'dot';
        this.setupCanvas();
        console.log(`Reset POI ${poi.id}`);
    }

    showContextMenu(poi, x, y) {
        this.currentRightClickedPOI = poi;
        
        // Generate context menu
        this.generateContextMenu(poi);
        
        const menu = document.getElementById('context-menu');
        
        // Render off-screen to measure
        menu.style.display = 'block';
        menu.style.left = '-9999px';
        menu.style.top = '-9999px';
        
        // Measure actual dimensions
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const margin = 10;
        let finalX = x + margin;
        let finalY = y + margin;
        
        // Adjust if going off right edge
        if (finalX + menuRect.width > viewportWidth - margin) {
            finalX = x - menuRect.width - margin;
        }
        finalX = Math.max(margin, Math.min(finalX, viewportWidth - menuRect.width - margin));
        
        // Adjust if going off bottom edge
        if (finalY + menuRect.height > viewportHeight - margin) {
            finalY = y - menuRect.height - margin;
        }
        finalY = Math.max(margin, Math.min(finalY, viewportHeight - menuRect.height - margin));
        
        // Apply final position
        menu.style.left = `${finalX}px`;
        menu.style.top = `${finalY}px`;
    }

    generateContextMenu(poi) {
        const menu = document.getElementById('context-menu');
        
        // Clear existing content
        menu.innerHTML = '';
        
        // Generate hierarchical menu based on POI category
        this.generateHierarchicalMenu(menu, poi);
        
        // Ensure the menu is visible (in case it was hidden)
        menu.style.display = 'block';
    }

    generateHierarchicalMenu(container, poi) {
        // 单层交互：所有 POI 统一走单层 type 菜单（弃用双层 icon→boss）
        this.generateSingleLayerMenu(container, poi);
    }

    generateTwoLayerMenu(container, poi) {
        const category = poi.category;
        const layer1Options = this.getAvailableOptions(poi, 1);
        const layer2Options = this.getAvailableOptions(poi, 2);
        
        // Layer 1: Icons (always show all options)
        const layer1Section = document.createElement('div');
        layer1Section.className = 'context-menu-section';
        layer1Section.innerHTML = `<div class="context-menu-header" data-i18n="context.select_icon">Select Icon</div>`;
        
        const layer1OptionsContainer = document.createElement('div');
        layer1OptionsContainer.className = 'context-menu-options icon-grid';
        
        layer1Options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            
            // Add selected class if this option is selected
            if (poi.selectionState.layer1 === option) {
                item.classList.add('selected');
            }
            
            // Create icon element for all options (including Empty)
            const iconImg = document.createElement('img');
            iconImg.src = this.getIconPath(option);
            iconImg.alt = this.formatOptionName(option);
            iconImg.className = 'context-menu-icon';
            
            // Add icon only (no text to save space)
            item.classList.add('icon-only');
            item.appendChild(iconImg);
            
            item.addEventListener('click', (e) => {
                console.log('Layer 1 item clicked:', option);
                e.stopPropagation(); // Prevent event bubbling
                const autoSkipped = this.selectLayer1(poi, option);
                // Only update the context menu if auto-skip didn't happen
                if (!autoSkipped) {
                    this.updateContextMenuImmediately(poi);
                }
            });
            layer1OptionsContainer.appendChild(item);
        });
        
        layer1Section.appendChild(layer1OptionsContainer);
        container.appendChild(layer1Section);
        
        // Add separation line
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        separator.innerHTML = '<hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.2); margin: 0.5rem 0;">';
        container.appendChild(separator);
        
        // Layer 2: Bosses (always show, but filter based on layer1 selection)
        const layer2Section = document.createElement('div');
        layer2Section.className = 'context-menu-section';
        layer2Section.innerHTML = `<div class="context-menu-header" data-i18n="context.select_enemy">Select Enemy</div>`;
        
        const layer2OptionsContainer = document.createElement('div');
        layer2OptionsContainer.className = 'context-menu-options text-grid';
        
        // Get filtered layer2 options based on current layer1 selection
        const filteredLayer2Options = this.getAvailableOptions(poi, 2);
        
        filteredLayer2Options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item text-only';
            
            // Add selected class if this option is selected
            if (poi.selectionState.layer2 === option) {
                item.classList.add('selected');
            }
            
            // Use translated boss name
            const displayName = this.getBossDisplayName(option);
            item.textContent = displayName;
            item.addEventListener('click', () => {
                // If layer1 is not selected, auto-select it based on the layer2 option
                if (!poi.selectionState.layer1) {
                    const autoLayer1 = this.findLayer1ForLayer2(category, option);
                    if (autoLayer1) {
                        poi.selectionState.layer1 = autoLayer1;
                    }
                }
                
                this.selectLayer2(poi, option);
                this.hideContextMenu(); // Close menu immediately when layer2 is selected
            });
            layer2OptionsContainer.appendChild(item);
        });
        
        layer2Section.appendChild(layer2OptionsContainer);
        container.appendChild(layer2Section);
        
        // Clear selection option
        if (poi.selectionState.layer1 || poi.selectionState.layer2) {
            const clearItem = document.createElement('div');
            clearItem.className = 'context-menu-item clear-option';
            clearItem.innerHTML = '<span data-i18n="context.clear_selection">Clear Selection</span>';
            clearItem.addEventListener('click', () => {
                this.clearPOISelection(poi);
                this.hideContextMenu();
            });
            container.appendChild(clearItem);
        }
        
        // Translate all newly created elements at the end
        if (this.languageManager) {
            this.languageManager.updateUI();
        }
    }
    
    
    updateContextMenuImmediately(poi) {
        const container = document.getElementById('context-menu');
        if (!container) {
            console.log('Context menu container not found');
            return;
        }
        
        // Store current position before regenerating
        const currentLeft = container.style.left;
        const currentTop = container.style.top;
        
        console.log('Updating context menu immediately, current position:', currentLeft, currentTop);
        
        // Regenerate the entire context menu to show immediate changes
        this.generateContextMenu(poi);
        
        // Restore the original position
        container.style.left = currentLeft;
        container.style.top = currentTop;
        
        console.log('Context menu updated, final position:', container.style.left, container.style.top);
    }

    updateContextMenuAfterLayer1Selection(poi) {
        const container = document.getElementById('context-menu');
        if (!container) return;
        
        // Update layer 1 selection highlights
        this.updateLayer1Highlights(poi);
        
        // Update layer 2 options based on new layer 1 selection
        this.updateLayer2Options(poi);
    }

    updateLayer1Highlights(poi) {
        const container = document.getElementById('context-menu');
        if (!container) return;
        
        // Update layer 1 item highlights
        const layer1Items = container.querySelectorAll('.context-menu-item');
        layer1Items.forEach(item => {
            item.classList.remove('selected');
            // Check if this item corresponds to the selected layer 1
            const img = item.querySelector('img');
            if (img) {
                const option = this.getOptionFromIconPath(img.src);
                if (option === poi.selectionState.layer1) {
                    item.classList.add('selected');
                }
            }
        });
    }

    updateLayer2Options(poi) {
        const container = document.getElementById('context-menu');
        if (!container) return;
        
        // Find the layer 2 section
        const layer2Section = container.querySelector('.context-menu-section:last-of-type');
        if (!layer2Section) return;
        
        // Get the layer 2 options container
        const layer2OptionsContainer = layer2Section.querySelector('.context-menu-options');
        if (!layer2OptionsContainer) return;
        
        // Ensure it has the text grid class
        layer2OptionsContainer.className = 'context-menu-options text-grid';
        
        // Clear existing layer 2 options
        layer2OptionsContainer.innerHTML = '';
        
        // Get filtered layer 2 options based on current layer 1 selection
        const filteredLayer2Options = this.getAvailableOptions(poi, 2);
        
        // Add new layer 2 options
        filteredLayer2Options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item text-only';
            
            // Add selected class if this option is selected
            if (poi.selectionState.layer2 === option) {
                item.classList.add('selected');
            }
            
            // Use translated boss name
            const displayName = this.getBossDisplayName(option);
            item.textContent = displayName;
            item.addEventListener('click', () => {
                // If layer1 is not selected, auto-select it based on the layer2 option
                if (!poi.selectionState.layer1) {
                    const autoLayer1 = this.findLayer1ForLayer2(poi.category, option);
                    if (autoLayer1) {
                        poi.selectionState.layer1 = autoLayer1;
                    }
                }
                
                this.selectLayer2(poi, option);
                this.hideContextMenu(); // Close menu immediately when layer2 is selected
            });
            layer2OptionsContainer.appendChild(item);
        });
        
        // Translate all newly created elements at the end
        if (this.languageManager) {
            this.languageManager.updateUI();
        }
    }

    getOptionFromIconPath(iconSrc) {
        // Extract option name from icon path
        const pathParts = iconSrc.split('/');
        const fileName = pathParts[pathParts.length - 1];
        return fileName.replace('.png', '');
    }

    generateSingleLayerMenu(container, poi) {
        const options = this.getAvailableOptions(poi, 1);

        if (options.length === 0) {
            const noOptionsText = this.languageManager ? this.languageManager.getText('ui.no_options_available') : 'No options available';
            container.innerHTML = `<div class="context-menu-item">${noOptionsText}</div>`;
            return;
        }

        const section = document.createElement('div');
        section.className = 'context-menu-section';

        // 标题用类别中文名（共享点位/野外据点/野外BOSS/…）
        const headerText = this.getCategoryDisplayName(poi.category);
        section.innerHTML = `<div class="context-menu-header">${headerText}</div>`;

        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'context-menu-options text-grid';

        options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item text-only';
            if (poi.selectionState.layer1 === option) {
                item.classList.add('selected');
            }
            // Empty 兜底翻译；英文模式查 POI_TYPE_EN 映射，缺映射回退中文
            item.textContent = this.getPoiTypeDisplay(option);
            item.addEventListener('click', () => {
                this.selectLayer1(poi, option);
                this.hideContextMenu();
            });
            optionsContainer.appendChild(item);
        });

        section.appendChild(optionsContainer);
        container.appendChild(section);

        // 清除选择
        if (poi.selectionState.layer1) {
            const clearItem = document.createElement('div');
            clearItem.className = 'context-menu-item clear-option';
            clearItem.textContent = this.languageManager.getText('context.clear_selection');
            clearItem.addEventListener('click', () => {
                this.clearPOISelection(poi);
                this.hideContextMenu();
            });
            container.appendChild(clearItem);
        }

        // Translate all newly created elements at the end
        if (this.languageManager) {
            this.languageManager.updateUI();
        }
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        menu.style.display = 'none';
        this.currentRightClickedPOI = null;
    }

    repositionContextMenu() {
        const menu = document.getElementById('context-menu');
        if (!menu || menu.style.display === 'none') {
            return; // No context menu visible
        }

        const canvas = document.getElementById('map-canvas');
        const rect = canvas.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        // Get current position
        let left = parseInt(menu.style.left) || 0;
        let top = parseInt(menu.style.top) || 0;
        
        // Check if menu goes off screen and adjust
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position
        if (left + menuRect.width > viewportWidth) {
            left = viewportWidth - menuRect.width - 10;
        }
        if (left < 10) {
            left = 10;
        }
        
        // Adjust vertical position
        if (top + menuRect.height > viewportHeight) {
            top = viewportHeight - menuRect.height - 10;
        }
        if (top < 10) {
            top = 10;
        }
        
        // Apply new position
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    repositionSpawnContextMenu() {
        const menu = document.getElementById('spawn-context-menu');
        if (!menu || menu.style.display === 'none') {
            return; // No spawn context menu visible
        }

        const canvas = document.getElementById('map-canvas');
        const rect = canvas.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        // Get current position
        let left = parseInt(menu.style.left) || 0;
        let top = parseInt(menu.style.top) || 0;
        
        // Check if menu goes off screen and adjust
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position
        if (left + menuRect.width > viewportWidth) {
            left = viewportWidth - menuRect.width - 10;
        }
        if (left < 10) {
            left = 10;
        }
        
        // Adjust vertical position
        if (top + menuRect.height > viewportHeight) {
            top = viewportHeight - menuRect.height - 10;
        }
        if (top < 10) {
            top = 10;
        }
        
        // Apply new position
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    selectLayer1(poi, value) {
        console.log(`🎯 Selecting type: ${value} for POI ${poi.name} (${poi.category})`);

        // 单层：只设 layer1（type 中文名），layer2 弃用
        poi.selectionState.layer1 = value;
        poi.selectionState.layer2 = null;

        this.updatePOIDisplayState(poi);

        this.poiStates[poi.id] = {
            state: poi.currentState,
            selectionState: poi.selectionState
        };

        console.log(`📍 Updated POI state:`, this.poiStates[poi.id]);

        this.setupCanvas();
        this.filterSeedsByPOI();

        console.log(`📍 Selected ${poi.category} type: ${value} for ${poi.name}`);
        return false; // 单层无 auto-skip
    }

    selectLayer2(poi, value) {
        console.log(`🎯 Selecting layer2: ${value} for POI ${poi.name} (${poi.category})`);
        
        // If layer1 is not set, try to auto-set it based on the layer2 value
        if (!poi.selectionState.layer1) {
            const autoLayer1 = this.findLayer1ForLayer2(poi.category, value);
            if (autoLayer1) {
                console.log(`🔄 Auto-setting layer1 to: ${autoLayer1} for layer2: ${value}`);
                poi.selectionState.layer1 = autoLayer1;
            }
        }
        
        // Special case: if "Empty" is selected as layer2, auto-select "Empty" as layer1
        if (value === 'Empty' && poi.selectionState.layer1 !== 'Empty') {
            console.log(`🎯 Auto-selecting layer1: Empty (Empty boss selected)`);
            poi.selectionState.layer1 = 'Empty';
        }
        
        // Update POI selection state
        poi.selectionState.layer2 = value;
        
        // Update POI state for display
        this.updatePOIDisplayState(poi);
        
        // Store in persistent state
        this.poiStates[poi.id] = {
            state: poi.currentState,
            selectionState: poi.selectionState
        };
        
        console.log(`📍 Updated POI state:`, this.poiStates[poi.id]);
        
        // Redraw canvas and filter seeds
        this.setupCanvas();
        this.filterSeedsByPOI();
        
        console.log(`📍 Selected ${poi.category} layer2: ${value} for ${poi.name}`);
        console.log(`🔍 Current POI states:`, this.poiStates);
    }
    
    findLayer1ForLayer2(category, layer2Value) {
        // Check if layer mappings exist for this category
        if (!this.layerMappings[category]) return null;
        
        // Find which layer1 options can produce this layer2 value
        for (const [layer1Option, possibleLayer2Values] of Object.entries(this.layerMappings[category])) {
            if (possibleLayer2Values.includes(layer2Value)) {
                return layer1Option;
            }
        }
        return null;
    }

    clearPOISelection(poi) {
        // Reset POI selection state
        poi.selectionState.layer1 = null;
        poi.selectionState.layer2 = null;
        poi.currentState = 'dot';
        
        // Remove from persistent state
        delete this.poiStates[poi.id];
        
        // Redraw canvas and filter seeds
        this.setupCanvas();
        this.filterSeedsByPOI();
        
        // Update POI states based on remaining seeds
        this.updatePOIStatesFromSeeds();
        
        console.log(`📍 Cleared selection for ${poi.name}`);
        console.log(`🔍 Current POI states:`, this.poiStates);
    }

    updatePOIStatesFromSeeds() {
        if (!this.currentPOIs || this.currentPOIs.length === 0) return;
        
        console.log(`🔍 Updating POI states based on remaining ${this.filteredSeeds.length} seeds`);
        
        this.currentPOIs.forEach(poi => {
            // Skip if POI already has a selection
            if (this.poiStates[poi.id] && this.poiStates[poi.id].selectionState) {
                const selectionState = this.poiStates[poi.id].selectionState;
                if (selectionState.layer1 || selectionState.layer2) {
                    console.log(`⏭️ Skipping ${poi.name} - already has selection`);
                    return;
                }
            }
            
            // Check if this POI has definite values in remaining seeds
            this.updatePOIStateFromSeeds(poi);
        });
        
        // Redraw canvas to show updated states
        this.setupCanvas();
    }

    updatePOIStateFromSeeds(poi) {
        // 单层：根据候选 seed 中该槽位的可选项收窄显示状态
        const typeOptions = this.getAvailableOptions(poi, 1);

        if (typeOptions.length === 1) {
            if (typeOptions[0] === 'Empty') {
                // 所有候选 seed 此坐标都无 POI → 隐藏点位
                poi.currentState = 'hidden';
                console.log(`⬛ ${poi.name} hidden (no POI in any remaining seed)`);
            } else {
                // 所有候选 seed 此坐标同 type → 自动选中
                console.log(`🎯 ${poi.name} has definite type: ${typeOptions[0]}`);
                this.autoSelectPOI(poi, typeOptions[0], null);
            }
        } else {
            // 多选项（含 Empty 或多种 type）→ 金圆可点
            poi.currentState = 'dot';
        }
    }

    autoSelectPOI(poi, layer1Value, layer2Value) {
        const category = poi.category;
        const mappedCategory = this.mapCategoryToInternal(category);
        
        // Set up selection state
        poi.selectionState = {
            layer1: layer1Value,
            layer2: layer2Value
        };
        
        // Update display state
        this.updatePOIDisplayState(poi);
        
        // Store in persistent state
        this.poiStates[poi.id] = {
            state: poi.currentState,
            selectionState: poi.selectionState
        };
        
        console.log(`✅ Auto-selected ${poi.name}: layer1=${layer1Value}, layer2=${layer2Value}, state=${poi.currentState}`);
    }

    updatePOIDisplayState(poi) {
        // 单层：layer1 有值=specific（蓝勾），否则=dot（金圆）
        poi.currentState = poi.selectionState.layer1 ? 'specific' : 'dot';
    }

    formatOptionName(option) {
        // Get translated structure name, fallback to formatted original
        const translatedName = this.getStructureDisplayName(option);
        if (translatedName !== option) {
            return translatedName;
        }
        // Convert icon names to readable format if no translation found
        return option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    getIconPath(iconName) {
        // Handle "Empty" option
        if (iconName === 'Empty') {
            return 'assets/icons/empty.png'; // Use empty icon for null values
        }
        
        // Get icon path from POI data, fallback to default path
        if (this.poiData && this.poiData.iconPaths && this.poiData.iconPaths[iconName]) {
            return this.poiData.iconPaths[iconName];
        }
        // Fallback to default path
        return `assets/icons/${iconName}.png`;
    }

    getCategoryDisplayName(category) {
        // NAME 类别 key → 显示名；英文走 i18n category.*，中文回退硬编码
        const fallback = {
            'landmark': '共享点位',
            'stronghold': '野外据点',
            'fieldBoss': '野外BOSS',
            'scaleMerchant': '山羊事件商人',
            'merchant': '商人'
        };
        if (this.languageManager) {
            const key = 'category.' + category;
            const t = this.languageManager.getText(key);
            if (t && t !== key) return t; // 命中翻译
        }
        return fallback[category] || category; // 中文或无翻译
    }

    getPoiTypeDisplay(option) {
        // Empty 走 i18n；英文模式查 POI_TYPE_EN 中文→英文映射，缺映射回退中文原值
        if (option === 'Empty') {
            return this.languageManager ? (this.languageManager.getText('context.empty') || '空') : '空';
        }
        if (this.languageManager && this.languageManager.isEnglish() &&
            typeof POI_TYPE_EN !== 'undefined' && POI_TYPE_EN[option]) {
            return POI_TYPE_EN[option];
        }
        return option; // 中文模式或无映射：原样中文
    }

    getDisplayNameForValue(value) {
        // Convert value to display name
        return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    showScreen(screenName) {
        // Hide all screens including loading screen
        document.querySelectorAll('[id$="-screen"]').forEach(screen => {
            screen.style.display = 'none';
        });
        
        // Also hide loading screen specifically
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // Show selected screen
        let targetScreen = document.getElementById(`${screenName}-screen`);
        
        // Special case for result screen - it's already named result-screen
        if (!targetScreen && screenName === 'result') {
            targetScreen = document.getElementById('result-screen');
        }
        
        if (targetScreen) {
            targetScreen.style.display = 'block';
            this.currentScreen = screenName;
            console.log(`📺 Switched to ${screenName} screen`);
        } else {
            console.error(`Screen not found: ${screenName}-screen`);
        }
    }

    refreshOnLanguageChange() {
        // Refresh POI context menu if it's open
        const poiContextMenu = document.getElementById('context-menu');
        if (poiContextMenu && poiContextMenu.style.display !== 'none' && this.currentRightClickedPOI) {
            this.generateContextMenu(this.currentRightClickedPOI);
        }
        
        // Refresh spawn context menu if it's open
        const spawnContextMenu = document.getElementById('spawn-context-menu');
        if (spawnContextMenu && spawnContextMenu.style.display !== 'none' && this.currentRightClickedSpawn) {
            this.generateSpawnContextMenu(this.currentRightClickedSpawn);
        }
        
        // Update the newly generated context menus with current language
        if (this.languageManager) {
            this.languageManager.updateUI();
        }
        
        // Check if we have a found seed and refresh result content
        if (this.foundSeed) {
            this.updateRecognitionScreenForResult(this.foundSeed);
        }
        
        // Always refresh the start button text
        this.updateStartButton();
        
        // Refresh dynamic content based on current screen
        if (this.currentScreen === 'spawn') {
            this.refreshSpawnScreenContent();
        } else if (this.currentScreen === 'recognition') {
            this.refreshRecognitionScreenContent();
        }
    }

    refreshSpawnScreenContent() {
        // Refresh spawn screen dynamic content
        if (this.selectedMap) {
            document.getElementById('spawn-current-map').textContent = this.getMapDisplayName(this.selectedMap);
        }
        if (this.selectedNightlord !== undefined) {
            document.getElementById('spawn-current-nightlord').textContent = this.getNightlordDisplayName(this.selectedNightlord);
        }
    }

    refreshRecognitionScreenContent() {
        // Refresh recognition screen dynamic content
        if (this.selectedMap) {
            document.getElementById('current-map').textContent = this.getMapDisplayName(this.selectedMap);
        }
        if (this.selectedNightlord !== undefined) {
            document.getElementById('current-nightlord').textContent = this.getNightlordDisplayName(this.selectedNightlord);
        }
        
        // Refresh seed count if we have filtered seeds
        if (this.filteredSeeds) {
            document.getElementById('seed-count').textContent = this.filteredSeeds.length;
        }
        
        // If we're showing a result, refresh the result content
        if (this.foundSeed) {
            this.updateRecognitionScreenForResult(this.foundSeed);
        }
    }

    getEnemyI18nKey(enemyName) {
        // Convert enemy name to i18n key format
        return `enemy.${enemyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    getMapDisplayName(mapType) {
        // Get translated map name
        const mapKey = `map.${mapType.toLowerCase().replace(/\s+/g, '_')}`;
        return this.languageManager ? this.languageManager.getText(mapKey) : mapType;
    }

    getNightlordDisplayName(nightlord) {
        if (!nightlord || nightlord === 'Any') {
            return this.languageManager ? this.languageManager.getText('selection.any') : 'Any';
        }
        const nightlordKey = `nightlord.${nightlord.toLowerCase()}`;
        return this.languageManager ? this.languageManager.getText(nightlordKey) : nightlord;
    }

    getEnemyDisplayName(enemyName) {
        // Get translated enemy name, fallback to original if translation not found
        if (this.languageManager && this.languageManager.translations) {
            const i18nKey = this.getEnemyI18nKey(enemyName);
            const translation = this.languageManager.translations[this.languageManager.currentLang]?.[i18nKey];
            return translation || enemyName;
        }
        return enemyName;
    }

    getStructureI18nKey(structureName) {
        // Convert structure name to i18n key format
        return `structure.${structureName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    getStructureDisplayName(structureName) {
        // Get translated structure name, fallback to original if translation not found
        if (this.languageManager && this.languageManager.translations) {
            const i18nKey = this.getStructureI18nKey(structureName);
            const translation = this.languageManager.translations[this.languageManager.currentLang]?.[i18nKey];
            return translation || structureName;
        }
        return structureName;
    }

    getBossI18nKey(bossName) {
        // Convert boss name to i18n key format
        return `boss.${bossName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    getBossDisplayName(bossName) {
        // Get translated boss name, fallback to original if translation not found
        if (this.languageManager && this.languageManager.translations) {
            const i18nKey = this.getBossI18nKey(bossName);
            const translation = this.languageManager.translations[this.languageManager.currentLang]?.[i18nKey];
            return translation || bossName;
        }
        return bossName;
    }

    showHelp() {
        document.getElementById('help-modal').style.display = 'flex';
    }

    hideHelp() {
        document.getElementById('help-modal').style.display = 'none';
    }


    clearAllPOIs() {
        // Reset all POI states to 'dot'
        this.currentPOIs.forEach(poi => {
            poi.currentState = 'dot';
            poi.selectionState = {
                layer1: null,
                layer2: null
            };
        });
        
        // Clear POI states object
        this.poiStates = {};
        
        // Clear found seed and reset canvas state
        this.foundSeed = null;
        
        // Hide any open context menu
        this.hideContextMenu();
        
        // Reset canvas cursor and redraw
        const canvas = document.getElementById('map-canvas');
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
        
        // Redraw the canvas
        this.setupCanvas();
        
        // Restore to spawn filtering (or base if no spawn selection)
        if (this.spawnFilteredSeeds.length > 0) {
            this.filteredSeeds = [...this.spawnFilteredSeeds];
        } else {
            this.filteredSeeds = [...this.baseFilteredSeeds];
        }
        this.poiFilteredSeeds = [];
        
        this.updateSeedCounts();
        
        // Re-run POI auto-fill logic after clearing
        this.updatePOIStatesFromSeeds();
        
        // Refresh the display to show current map and nightlord selections
        this.refreshSpawnScreenContent();
        this.refreshRecognitionScreenContent();
        
        console.log('🧹 Cleared all POI selections');
        console.log(`🔍 Current POI states:`, this.poiStates);
    }

    getAvailableOptions(poi, layer) {
        // 候选集必须与 filterSeedsByPOI 的 sourceSeeds 同源（spawn/base），
        // 绝不能在 filteredSeeds 为空时 fallback 到全部 seedData——那会跨地形/跨夜王
        // 显示全局选项（如别处才有的法师塔），而过滤却在 spawn/base 子集跑，导致
        // 用户选了菜单里显示的选项却归零（选项来源与过滤来源不一致）。
        // 链路：filteredSeeds(POI缩窄) → spawnFilteredSeeds(落地点) → baseFilteredSeeds(地图+夜王)
        let seedsToCheck;
        if (this.filteredSeeds && this.filteredSeeds.length > 0) {
            seedsToCheck = this.filteredSeeds;
        } else if (this.spawnFilteredSeeds && this.spawnFilteredSeeds.length > 0) {
            seedsToCheck = this.spawnFilteredSeeds;
        } else {
            seedsToCheck = this.baseFilteredSeeds || [];
        }
        console.log(`🔍 Using ${seedsToCheck.length} seeds for options (filtered/spawn/base, never all)`);

        const targetX = poi.x * 2; // Scale back to original coordinates
        const targetY = poi.y * 2;

        // 每个候选 seed 贡献一个选项：有 POI→type，无 POI→Empty。
        // 不能只统计"有 POI"的 seed，否则 ==1 判定会忽略无 POI 的 seed，
        // 导致 autoSelect 误判，进而 checkPOIMatches 淘汰无 POI 的种子（归零 bug）。
        const uniqueValues = new Set();
        seedsToCheck.forEach(seed => {
            if (!seed.pois) { uniqueValues.add('Empty'); return; }
            const matchingPOI = Object.values(seed.pois).find(poiData => {
                return Math.abs(poiData.coordinates.x - targetX) <= 2 &&
                       Math.abs(poiData.coordinates.y - targetY) <= 2;
            });
            if (matchingPOI) {
                uniqueValues.add(matchingPOI.type || 'Empty');
            } else {
                uniqueValues.add('Empty');  // 此坐标无 POI → 算空选项
            }
        });

        const result = Array.from(uniqueValues).sort((a, b) => {
            if (a === 'Empty') return 1;
            if (b === 'Empty') return -1;
            return a.localeCompare(b);
        });
        console.log(`🎯 Final options for layer ${layer}:`, result);
        return result;
    }

    showError(message) {
        // Simple error display
        alert(message);
    }

    showResult(seed) {
        console.log(`🎉 Showing result for seed ${seed.seedNumber}`);
        console.log(`🎉 Current screen: ${this.currentScreen}`);
        console.log(`🎉 Seed data:`, seed);
        
        // Store the found seed for reference
        this.foundSeed = seed;
        
        // Hide any open context menus
        console.log('🎉 Hiding all context menus...');
        this.hideContextMenu();
        this.hideSpawnContextMenu();
        
        // Update the recognition screen to show the result
        this.updateRecognitionScreenForResult(seed);
    }

    updateRecognitionScreenForResult(seed) {
        // Update the seed count display to show success
        const seedCountEl = document.getElementById('seed-count');
        if (seedCountEl) {
            const seedFoundText = this.languageManager ? this.languageManager.getText('ui.seed_found') : 'Seed Found!';
            seedCountEl.innerHTML = `<i class="fas fa-check-circle"></i> ${seedFoundText}`;
        }
        
        // Update the map canvas to show the pattern image
        this.showPatternImageOnCanvas(seed);
        
        // Update the info panel with seed details
        this.updateInfoPanel(seed);
        
        // No need to add a new search button - the back button handles this
    }

    showPatternImageOnCanvas(seed) {
        const canvas = document.getElementById('map-canvas');
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;  // .map-container

        // 清空 canvas（透明，由覆盖在上面的高清 <img> 显示 pattern）
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.cursor = 'pointer';

        // 用 <img> 显示高清 pattern 图：原图 1536，浏览器原生 retina 缩放清晰；
        // 画进 768 canvas 缓冲再被 retina 放大会模糊，故改用 img 覆盖 canvas
        let img = document.getElementById('result-pattern-img');
        if (!img) {
            img = document.createElement('img');
            img.id = 'result-pattern-img';
            img.style.cssText = 'position:absolute;cursor:pointer;border-radius:10px;display:none;z-index:1;';
            img.addEventListener('click', () => this.openFullscreen());
            container.appendChild(img);
        }
        // 精确覆盖 canvas（同位置同尺寸，响应式下也正确）
        img.style.left = canvas.offsetLeft + 'px';
        img.style.top = canvas.offsetTop + 'px';
        img.style.width = canvas.offsetWidth + 'px';
        img.style.height = canvas.offsetHeight + 'px';
        img.src = this.getPatternImagePath(seed);
        img.style.display = 'block';

        console.log(`🖼️ Showing hi-res pattern image for seed ${seed.seedNumber}`);
    }


    addClickableOverlay() {
        const canvas = document.getElementById('map-canvas');
        const ctx = canvas.getContext('2d');
        
        // Add a subtle "click to open" indicator
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, 10, 200, 30);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        const clickText = this.languageManager ? this.languageManager.getText('actions.open_new_tab') : 'Click to open full image';
        ctx.fillText(clickText, 15, 28);
    }

    updateInfoPanel(seed) {
        // Update the current map display
        const currentMapEl = document.getElementById('current-map');
        if (currentMapEl) {
            const seedNumberText = this.languageManager ? this.languageManager.getText('ui.seed_number') : 'Seed';
            const mapDisplayName = this.getMapDisplayName(seed.mapType);
            currentMapEl.innerHTML = `${seedNumberText} ${seed.seedNumber} - ${mapDisplayName}`;
        }
        
        // Update the current nightlord display
        const currentNightlordEl = document.getElementById('current-nightlord');
        if (currentNightlordEl) {
            currentNightlordEl.textContent = this.getNightlordDisplayName(seed.nightlord);
        }
        
        // Add seed details to the info panel
        this.addSeedDetailsToInfoPanel(seed);
    }

    addSeedDetailsToInfoPanel(seed) {
        // Find or create a details container
        let detailsContainer = document.getElementById('seed-details');
        if (!detailsContainer) {
            detailsContainer = document.createElement('div');
            detailsContainer.id = 'seed-details';
            detailsContainer.className = 'seed-details';
            
            // Insert after the current info
            const currentInfo = document.querySelector('.recognition-info');
            if (currentInfo) {
                currentInfo.appendChild(detailsContainer);
            }
        }
        
        // Clear and populate with seed details
        detailsContainer.innerHTML = `
            <div class="seed-detail-item">
                <span class="detail-label">Seed Number:</span>
                <span class="detail-value">${seed.seedNumber}</span>
            </div>
            <div class="seed-detail-item">
                <span class="detail-label">Map Type:</span>
                <span class="detail-value">${seed.mapType}</span>
            </div>
            <div class="seed-detail-item">
                <span class="detail-label">Nightlord:</span>
                <span class="detail-value">${seed.nightlord || 'Any'}</span>
            </div>
            <div class="seed-detail-item">
                <button id="open-fullscreen" class="fullscreen-btn">
                    <i class="fas fa-expand"></i>
                    Open Full Pattern
                </button>
            </div>
        `;
        
        // Add event listener for fullscreen button
        const fullscreenBtn = document.getElementById('open-fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.openFullscreen();
            });
        }
    }



    setupResultScreenEventListeners() {
        // Only setup once
        if (this.resultScreenListenersSetup) return;
        
        // Back to recognition button
        const backToRecognitionBtn = document.getElementById('back-to-recognition');
        if (backToRecognitionBtn && !backToRecognitionBtn.hasAttribute('data-listener-added')) {
            backToRecognitionBtn.addEventListener('click', () => {
                this.showScreen('recognition');
            });
            backToRecognitionBtn.setAttribute('data-listener-added', 'true');
        }

        // New search button
        const newSearchBtn = document.getElementById('new-search');
        if (newSearchBtn && !newSearchBtn.hasAttribute('data-listener-added')) {
            newSearchBtn.addEventListener('click', () => {
                // Hide any open context menu before resetting
                this.hideContextMenu();
                this.resetToSelection();
            });
            newSearchBtn.setAttribute('data-listener-added', 'true');
        }

        // Open fullscreen button
        const openFullscreenBtn = document.getElementById('open-fullscreen');
        if (openFullscreenBtn && !openFullscreenBtn.hasAttribute('data-listener-added')) {
            openFullscreenBtn.addEventListener('click', () => {
                this.openFullscreen();
            });
            openFullscreenBtn.setAttribute('data-listener-added', 'true');
        }

        // Click on result image to open fullscreen
        const resultPatternImage = document.getElementById('result-pattern-image');
        if (resultPatternImage && !resultPatternImage.hasAttribute('data-listener-added')) {
            resultPatternImage.addEventListener('click', () => {
                this.openFullscreen();
            });
            resultPatternImage.setAttribute('data-listener-added', 'true');
        }
        
        this.resultScreenListenersSetup = true;
    }

    getPatternImagePath(seed) {
        const currentLang = (this.languageManager && this.languageManager.currentLang) ? this.languageManager.currentLang : 'en';
        // 种子结果图：本体(0-319, 3位补零)与 DLC(1000-1199, 4位) 均按语言目录存放
        return `assets/pattern/${currentLang}/${seed.seedNumber.toString().padStart(3, '0')}.jpg`;
    }

    openFullscreen() {
        const seed = this.foundSeed || this.filteredSeeds[0];
        if (!seed) return;

        const imagePath = this.getPatternImagePath(seed);
        window.open(imagePath, '_blank');

        console.log(`🔗 Opened fullscreen image: ${imagePath}`);
    }

    resetToSelection() {
        // Reset all selections
        this.selectedNightlord = null;
        this.selectedMap = null;
        this.poiStates = {};
        this.filteredSeeds = [];
        this.foundSeed = null;
        
        // Hide any open context menu
        this.hideContextMenu();
        
        // Reset UI
        document.querySelectorAll('.nightlord-btn, .map-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        
        // Remove seed details if they exist
        const seedDetails = document.getElementById('seed-details');
        if (seedDetails) {
            seedDetails.remove();
        }
        
        // Reset canvas click handler and cursor
        const canvas = document.getElementById('map-canvas');
        if (canvas) {
            canvas.removeEventListener('click', this.canvasClickHandler);
            canvas.style.cursor = 'default';
        }
        
        this.updateStartButton();
        this.showScreen('selection');
        
        console.log('🔄 Reset to selection screen');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NightreignApp();
});


