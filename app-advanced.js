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
        
        // Load map images in the background
        console.log('🖼️ Loading map images...');
        await this.loadMapImages();
        console.log('✅ Map images loaded successfully');
        
        // Initialize language manager with advanced translations
        try {
            // Override the global translations before creating the language manager
            const originalTranslations = window.translations;
            window.translations = translations_advanced;
            
            this.languageManager = new LanguageManager();
            
            // Listen for language changes using the same approach as basic page
            window.addEventListener('languageChanged', (e) => {
                this.refreshContextMenus();
                this.refreshResultImage();
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

    async loadMapImages() {
        try {
            const mapTypes = ['Default', 'Crater', 'Mountaintop', 'Noklateo', 'Rotted Woods'];
            const imagePromises = mapTypes.map(mapType => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        this.mapImages[mapType] = img;
                        resolve();
                    };
                    img.onerror = () => {
                        console.warn(`⚠️ Failed to load map image for ${mapType}`);
                        resolve(); // Continue even if one image fails
                    };
                    
                    // Map type names to file names
                    const fileName = this.getMapFileName(mapType);
                    img.src = `assets/map/${fileName}`;
                });
            });
            
            await Promise.all(imagePromises);
            console.log('✅ Map images loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load map images:', error);
        }
    }

    getMapFileName(mapType) {
        const fileNameMap = {
            'Default': 'default.png',
            'Crater': 'crater.png',
            'Mountaintop': 'mountaintop.png',
            'Noklateo': 'noklateo.png',
            'Rotted Woods': 'rotted_wood.png'
        };
        return fileNameMap[mapType] || 'default.png';
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
        this.selectedNightlord = nightlord;
        
        // Update UI
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        const selectedNightlordBtn = document.querySelector(`[data-nightlord="${nightlord}"]`);
        if (selectedNightlordBtn) {
            selectedNightlordBtn.classList.add('selected');
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
            startBtn.innerHTML = '<i class="fas fa-play"></i> Select Map Type to Continue';
        } else {
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Recognition';
        }
    }

    startRecognition() {
        if (!this.selectedMap) return;
        
        // Check if data is loaded
        if (!this.seedData || !this.poiData) {
            console.log('⏳ Data still loading, please wait...');
            // Show a loading message or disable the button
            const startBtn = document.getElementById('start-recognition');
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                // Re-enable after a short delay
                setTimeout(() => {
                    startBtn.disabled = false;
                    startBtn.innerHTML = '<i class="fas fa-play"></i> Start Recognition';
                }, 1000);
            }
            return;
        }

        // Update display for spawn screen
        document.getElementById('spawn-current-map').textContent = this.selectedMap;
        document.getElementById('spawn-current-nightlord').textContent = this.selectedNightlord || 'Any';

        // Set current map image
        this.currentMapImage = this.mapImages[this.selectedMap];

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
        document.getElementById('current-map').textContent = this.selectedMap;
        document.getElementById('current-nightlord').textContent = this.selectedNightlord || 'Any';

        // Update seed count with current filtered seeds
        document.getElementById('seed-count').textContent = this.filteredSeeds.length;
        
        console.log(`🎯 Starting POI recognition with ${this.filteredSeeds.length} pre-filtered seeds`);

        // Load POIs for selected map
        this.loadPOIsForMap(this.selectedMap);

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
                layer1: null, // Icon for major base/field boss, structure for minor base, boss for evergaol/rotted woods
                layer2: null  // Boss for major base/field boss (null for others)
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
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const clickedSpawn = this.findClickedSpawnPoint(x, y);
            if (clickedSpawn) {
                this.showSpawnContextMenu(clickedSpawn, x, y);
            } else {
                this.hideSpawnContextMenu();
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
        
        // Position and show context menu
        const contextMenu = document.getElementById('spawn-context-menu');
        contextMenu.style.left = `${x + 10}px`;
        contextMenu.style.top = `${y - 10}px`;
        contextMenu.style.display = 'block';
        
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
        if (!this.selectedSpawnPoint || !this.selectedSpawnEnemy) return;
        
        console.log(`🔍 Filtering seeds by spawn point...`);
        console.log(`   Spawn location: ${this.selectedSpawnPoint.location}`);
        console.log(`   Spawn enemy: ${this.selectedSpawnEnemy}`);
        
        // Filter from base seeds
        this.spawnFilteredSeeds = this.baseFilteredSeeds.filter(seed => {
            const spawnPoint = seed.spawnPoint;
            if (!spawnPoint || spawnPoint.location !== this.selectedSpawnPoint.location) {
                return false;
            }
            
            // If enemy is "I don't know", only filter by location
            if (this.selectedSpawnEnemy === "I don't know") {
                return true;
            }
            
            // Otherwise filter by both location and enemy
            return spawnPoint.enemy === this.selectedSpawnEnemy;
        });
        
        // Set current filtered seeds to spawn filtered
        this.filteredSeeds = [...this.spawnFilteredSeeds];
        
        // Reset POI filtering
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
            
            // Find the matching POI in the seed
            const matchingPOI = this.findPOIInSeed(seed, poi.id);
            if (!matchingPOI) {
                console.log(`❌ POI ${poi.name} not found in seed ${seed.seedNumber}`);
                return false; // POI not found in seed
            }
            
            // Check if the POI matches the selection
            if (!this.poiMatchesSelection(matchingPOI, selectionState)) {
                console.log(`❌ POI ${poi.name} doesn't match selection in seed ${seed.seedNumber}`);
                console.log(`   Expected: layer1=${selectionState.layer1}, layer2=${selectionState.layer2}`);
                console.log(`   Found: icon=${matchingPOI.icon}, structure=${matchingPOI.structure}, boss=${matchingPOI.boss}`);
                return false;
            }
        }
        
        console.log(`✅ All POI matches successful for seed ${seed.seedNumber}`);
        return true;
    }

    poiMatchesSelection(poiData, selectionState) {
        const category = poiData.category;
        
        console.log(`🔍 Checking POI match for category: ${category}`);
        console.log(`   Selection state: layer1=${selectionState.layer1}, layer2=${selectionState.layer2}`);
        console.log(`   POI data: icon=${poiData.icon}, structure=${poiData.structure}, boss=${poiData.boss}`);
        
        // Map JSON category names to internal category names
        const mappedCategory = this.mapCategoryToInternal(category);
        console.log(`   Mapped category: ${category} → ${mappedCategory}`);
        
        if (mappedCategory === 'major_base' || mappedCategory === 'field_boss') {
            // Two-layer system: Icon → Boss
            if (selectionState.layer1 && poiData.icon !== selectionState.layer1) {
                console.log(`   ❌ Icon mismatch: expected ${selectionState.layer1}, got ${poiData.icon}`);
                return false;
            }
            if (selectionState.layer2 && poiData.boss !== selectionState.layer2) {
                console.log(`   ❌ Boss mismatch: expected ${selectionState.layer2}, got ${poiData.boss}`);
                return false;
            }
            console.log(`   ✅ Major base/field boss match successful`);
        } else if (mappedCategory === 'minor_base') {
            // Single-layer system: Icon only
            if (selectionState.layer1 && poiData.icon !== selectionState.layer1) {
                console.log(`   ❌ Icon mismatch: expected ${selectionState.layer1}, got ${poiData.icon}`);
                return false;
            }
            console.log(`   ✅ Minor base match successful`);
        } else if (mappedCategory === 'evergaol' || mappedCategory === 'rotted_woods') {
            // Single-layer system: Boss
            if (selectionState.layer1 && poiData.boss !== selectionState.layer1) {
                console.log(`   ❌ Boss mismatch: expected ${selectionState.layer1}, got ${poiData.boss}`);
                return false;
            }
            console.log(`   ✅ Evergaol/rotted woods match successful`);
        }
        
        console.log(`   ✅ POI match successful overall`);
        return true;
    }

    mapCategoryToInternal(jsonCategory) {
        const mapping = {
            'majorBase': 'major_base',
            'minorBase': 'minor_base',
            'fieldBoss': 'field_boss',
            'evergaol': 'evergaol',
            'rottedWoods': 'rotted_woods'
        };
        return mapping[jsonCategory] || 'minor_base';
    }

    setupCanvas() {
        const canvas = document.getElementById('map-canvas');
        const ctx = canvas.getContext('2d');
        
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
        const x = poi.x;
        const y = poi.y;
        
        if (poi.currentState === 'dot') {
            // Draw dot with outline for visibility
            ctx.fillStyle = '#ffd700';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        } else if (poi.currentState === 'icon') {
            // Draw icon state (layer1 selected)
            ctx.fillStyle = '#4CAF50';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            
            // Draw small indicator
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        } else if (poi.currentState === 'specific') {
            // Draw specific state (both layers or single layer selected)
            ctx.fillStyle = '#2196F3';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            
            // Draw checkmark
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - 2, y);
            ctx.lineTo(x, y + 2);
            ctx.lineTo(x + 3, y - 1);
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
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const clickedPOI = this.findClickedPOI(x, y);
            if (clickedPOI) {
                this.showContextMenu(clickedPOI, x, y);
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
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
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
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
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
            const dx = x - poi.x;
            const dy = y - poi.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= tolerance;
        });
    }

    getPOIDataFromSeed(seed, poiId) {
        if (!seed || !seed.pois) return null;
        
        // Find the POI in the seed data by matching coordinates
        const targetPOI = this.findPOIInSeed(seed, poiId);
        if (!targetPOI) return null;
        
        // Extract value based on category
        const category = targetPOI.category || 'minor_base';
        let value = null;
        
        switch (category) {
            case 'major_base':
                value = targetPOI.structure && targetPOI.boss ? 
                    `${targetPOI.structure.toLowerCase()}_${targetPOI.boss.toLowerCase().replace(/\s+/g, '_')}` :
                    targetPOI.structure?.toLowerCase();
                break;
            case 'minor_base':
                value = targetPOI.structure?.toLowerCase() || 'church';
                break;
            case 'field_boss':
            case 'evergaol':
            case 'rotted_woods':
                value = targetPOI.boss?.toLowerCase().replace(/\s+/g, '_') || category;
                break;
            default:
                value = 'unknown';
        }
        
        return {
            value: value,
            structure: targetPOI.structure,
            boss: targetPOI.boss,
            icon: targetPOI.icon
        };
    }

    findPOIInSeed(seed, poiId) {
        if (!seed || !seed.pois) return null;
        
        // Get the POI data from our loaded POI data to find coordinates
        const poiData = this.poiData;
        if (!poiData) return null;
        
        // Find the POI in our data by ID
        let targetPOI = null;
        for (const mapType in poiData.mapTypes) {
            const mapPOIs = poiData.mapTypes[mapType].pois;
            const found = mapPOIs.find(poi => poi.id === poiId);
            if (found) {
                targetPOI = found;
                break;
            }
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
        
        // Position and show
        const canvas = document.getElementById('map-canvas');
        const rect = canvas.getBoundingClientRect();
        const menu = document.getElementById('context-menu');
        
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
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
        const category = poi.category;
        
        if (category === 'major_base' || category === 'field_boss') {
            // Two-layer system: Icon → Boss
            this.generateTwoLayerMenu(container, poi);
        } else {
            // Single-layer system: Icon (minor_base) or Boss (evergaol/rotted_woods)
            this.generateSingleLayerMenu(container, poi);
        }
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
            
            // Create icon element
            const iconImg = document.createElement('img');
            iconImg.src = this.getIconPath(option);
            iconImg.alt = this.formatOptionName(option);
            iconImg.className = 'context-menu-icon';
            iconImg.style.width = '32px';
            iconImg.style.height = '32px';
            
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
        const category = poi.category;
        const options = this.getAvailableOptions(poi, 1);
        
        if (options.length === 0) {
            container.innerHTML = '<div class="context-menu-item">No options available</div>';
            return;
        }
        
        const section = document.createElement('div');
        section.className = 'context-menu-section';
        
        const headerText = category === 'minor_base' ? 'Select Icon' : 'Boss';
        const i18nKey = category === 'minor_base' ? 'context.select_icon' : 'context.select_enemy';
        section.innerHTML = `<div class="context-menu-header" data-i18n="${i18nKey}">${headerText}</div>`;
        
        const optionsContainer = document.createElement('div');
        // Use icon grid for minor_base (has icons), text grid for others
        const gridClass = category === 'minor_base' ? 'icon-grid' : 'text-grid';
        optionsContainer.className = `context-menu-options ${gridClass}`;
        
        options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            if (poi.selectionState.layer1 === option) {
                item.classList.add('selected');
            }
            
            // For minor base, show icon + text; for others, just text
            if (category === 'minor_base') {
                // Create icon element
                const iconImg = document.createElement('img');
                iconImg.src = this.getIconPath(option);
                iconImg.alt = this.formatOptionName(option);
                iconImg.className = 'context-menu-icon';
                iconImg.style.width = '32px';
                iconImg.style.height = '32px';
                
                // Add icon only (no text to save space)
                item.classList.add('icon-only');
                item.appendChild(iconImg);
            } else {
                // For evergaol/rotted_woods, just show text
                item.classList.add('text-only');
                // Use translated boss name
            const displayName = this.getBossDisplayName(option);
            item.textContent = displayName;
            }
            
            item.addEventListener('click', () => {
                this.selectLayer1(poi, option);
                this.hideContextMenu();
            });
            optionsContainer.appendChild(item);
        });
        
        section.appendChild(optionsContainer);
        container.appendChild(section);
        
        // Clear selection option
        if (poi.selectionState.layer1) {
            const clearItem = document.createElement('div');
            clearItem.className = 'context-menu-item clear-option';
            clearItem.textContent = 'Clear Selection';
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
        console.log('hideContextMenu called - stack trace:', new Error().stack);
        const menu = document.getElementById('context-menu');
        menu.style.display = 'none';
        this.currentRightClickedPOI = null;
    }

    selectLayer1(poi, value) {
        console.log(`🎯 Selecting layer1: ${value} for POI ${poi.name} (${poi.category})`);
        
        // Update POI selection state
        poi.selectionState.layer1 = value;
        poi.selectionState.layer2 = null; // Reset layer2 when layer1 changes
        
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
        
        // Check if there's only one layer 2 option available after layer 1 selection
        const availableLayer2Options = this.getAvailableOptions(poi, 2);
        if (availableLayer2Options.length === 1) {
            console.log(`🎯 Auto-selecting layer2: ${availableLayer2Options[0]} (only option available)`);
            this.selectLayer2(poi, availableLayer2Options[0]);
            this.hideContextMenu(); // Close the context menu since we auto-selected
            return true; // Return true to indicate auto-skip happened
        }
        
        console.log(`📍 Selected ${poi.category} layer1: ${value} for ${poi.name}`);
        console.log(`🔍 Current POI states:`, this.poiStates);
        return false; // Return false to indicate no auto-skip
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
        // Map internal category names to mapping keys
        const mappingKey = this.mapCategoryToMappingKey(category);
        if (!this.layerMappings[mappingKey]) return null;
        
        // Find which layer1 options can produce this layer2 value
        for (const [layer1Option, possibleLayer2Values] of Object.entries(this.layerMappings[mappingKey])) {
            if (possibleLayer2Values.includes(layer2Value)) {
                return layer1Option;
            }
        }
        return null;
    }
    
    mapCategoryToMappingKey(category) {
        const mapping = {
            'major_base': 'major_base',
            'field_boss': 'field_boss',
        };
        return mapping[category] || category;
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
        
        console.log(`📍 Cleared selection for ${poi.name}`);
        console.log(`🔍 Current POI states:`, this.poiStates);
    }

    updatePOIDisplayState(poi) {
        const category = poi.category;
        
        if (category === 'major_base' || category === 'field_boss') {
            if (poi.selectionState.layer2) {
                // Both layers selected - show specific boss
                poi.currentState = 'specific';
            } else if (poi.selectionState.layer1) {
                // Only layer1 selected - show icon
                poi.currentState = 'icon';
            } else {
                // Nothing selected - show dot
                poi.currentState = 'dot';
            }
        } else {
            if (poi.selectionState.layer1) {
                // Single layer selected
                poi.currentState = 'specific';
            } else {
                // Nothing selected - show dot
                poi.currentState = 'dot';
            }
        }
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
        // Get icon path from POI data, fallback to default path
        if (this.poiData && this.poiData.iconPaths && this.poiData.iconPaths[iconName]) {
            return this.poiData.iconPaths[iconName];
        }
        // Fallback to default path
        return `assets/icons/${iconName}.png`;
    }

    getCategoryDisplayName(category) {
        const names = {
            'major_base': 'Major Base',
            'minor_base': 'Minor Base',
            'field_boss': 'Field Boss',
            'evergaol': 'Evergaol',
            'rotted_woods': 'Rotted Woods'
        };
        return names[category] || category;
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

    refreshContextMenus() {
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
    }

    refreshResultImage() {
        // Check if we have a found seed and the result screen exists
        if (this.foundSeed) {
            // Use the same approach as basic page - completely regenerate the result screen
            this.updateRecognitionScreenForResult(this.foundSeed);
        }
    }

    getEnemyI18nKey(enemyName) {
        // Convert enemy name to i18n key format
        return `enemy.${enemyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
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
        
        console.log('🧹 Cleared all POI selections');
        console.log(`🔍 Current POI states:`, this.poiStates);
    }

    getAvailableOptions(poi, layer) {
        if (!this.seedData) {
            console.log('❌ No seed data available');
            return [];
        }

        const category = poi.category;
        console.log(`🔍 Getting options for ${poi.name} (${category}) at (${poi.x}, ${poi.y})`);
        
        // Use filtered seeds instead of all seeds
        const seedsToCheck = this.filteredSeeds && this.filteredSeeds.length > 0 ? this.filteredSeeds : Object.values(this.seedData);
        console.log(`🔍 Using ${seedsToCheck.length} seeds for filtering (${this.filteredSeeds ? 'filtered' : 'all'})`);
        
        // Get seeds that have this POI at these coordinates AND match current filters
        const seedsWithLocation = seedsToCheck.filter(seed => {
            if (!seed.pois) return false;
            
            // Find POI in seed by coordinate matching (now flattened structure)
            const targetX = poi.x * 2; // Scale back to original coordinates
            const targetY = poi.y * 2;
            
            const hasMatchingPOI = Object.values(seed.pois).some(poiData => {
                const poiX = poiData.coordinates.x;
                const poiY = poiData.coordinates.y;
                const matches = Math.abs(poiX - targetX) <= 2 && Math.abs(poiY - targetY) <= 2;
                if (matches) {
                    console.log(`✅ Found matching POI: ${poiData.location} at (${poiX}, ${poiY}) for target (${targetX}, ${targetY})`);
                }
                return matches;
            });
            
            return hasMatchingPOI;
        });

        console.log(`📍 Found ${seedsWithLocation.length} seeds with matching POI`);

        if (seedsWithLocation.length === 0) {
            console.log('❌ No seeds found with matching POI coordinates');
            return [];
        }

        // Collect unique values based on category and layer
        const uniqueValues = new Set();
        
        seedsWithLocation.forEach(seed => {
            // Find the matching POI by coordinates (now flattened structure)
            const targetX = poi.x * 2;
            const targetY = poi.y * 2;
            
            const matchingPOI = Object.values(seed.pois).find(poiData => {
                const poiX = poiData.coordinates.x;
                const poiY = poiData.coordinates.y;
                return Math.abs(poiX - targetX) <= 2 && Math.abs(poiY - targetY) <= 2;
            });
            
            if (!matchingPOI) return;

            console.log(`📊 Processing POI: ${matchingPOI.location}, structure: ${matchingPOI.structure}, boss: ${matchingPOI.boss}, icon: ${matchingPOI.icon}`);

            if (category === 'major_base' || category === 'field_boss') {
                if (layer === 1) {
                    // Layer 1: Icon
                    if (matchingPOI.icon) {
                        uniqueValues.add(matchingPOI.icon);
                        console.log(`➕ Added icon: ${matchingPOI.icon}`);
                    }
                } else if (layer === 2) {
                    // Layer 2: Boss (filtered by current layer1 selection)
                    if (matchingPOI.boss && (!poi.selectionState.layer1 || matchingPOI.icon === poi.selectionState.layer1)) {
                        uniqueValues.add(matchingPOI.boss);
                        console.log(`➕ Added boss: ${matchingPOI.boss}`);
                    }
                }
            } else if (category === 'minor_base') {
                if (layer === 1) {
                    // Layer 1: Icon only (single-layer system)
                    if (matchingPOI.icon) {
                        uniqueValues.add(matchingPOI.icon);
                        console.log(`➕ Added icon: ${matchingPOI.icon}`);
                    }
                }
                // No layer 2 for minor base - single layer only
            } else if (category === 'evergaol' || category === 'rotted_woods') {
                if (layer === 1) {
                    // Layer 1: Boss
                    if (matchingPOI.boss) {
                        uniqueValues.add(matchingPOI.boss);
                        console.log(`➕ Added boss: ${matchingPOI.boss}`);
                    }
                }
            }
        });

        const result = Array.from(uniqueValues).sort();
        console.log(`🎯 Final options for layer ${layer}:`, result);
        return result;
    }

    toggleLanguage() {
        // Placeholder for language toggle
        console.log('Language toggle clicked');
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
            seedCountEl.innerHTML = `<i class="fas fa-check-circle" style="color: #4CAF50;"></i> Seed Found!`;
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
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set cursor to pointer to indicate clickability
        canvas.style.cursor = 'pointer';
        
        // Load and draw the pattern image
        const patternImage = new Image();
        patternImage.onload = () => {
            // Draw the pattern image scaled to fit the canvas
            ctx.drawImage(patternImage, 0, 0, 768, 768);
            console.log(`📸 Drew pattern image for seed ${seed.seedNumber}`);
            
            // Add a subtle overlay to indicate it's clickable
            this.addClickableOverlay();
        };
        patternImage.onerror = () => {
            console.error(`❌ Failed to load pattern image for seed ${seed.seedNumber}`);
            // Fallback: draw a message
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Pattern for Seed ${seed.seedNumber}`, 384, 384);
        };
        
        const currentLang = (this.languageManager && this.languageManager.currentLang) ? this.languageManager.currentLang : 'en';
        const imagePath = `assets/pattern/${currentLang}/${seed.seedNumber.toString().padStart(3, '0')}.jpg`;
        console.log(`🖼️ Loading pattern image: ${imagePath} for seed ${seed.seedNumber}`);
        patternImage.src = imagePath;
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
        ctx.fillText('Click to open full image', 15, 28);
    }

    updateInfoPanel(seed) {
        // Update the current map display
        const currentMapEl = document.getElementById('current-map');
        if (currentMapEl) {
            currentMapEl.innerHTML = `Seed ${seed.seedNumber} - ${seed.mapType}`;
        }
        
        // Update the current nightlord display
        const currentNightlordEl = document.getElementById('current-nightlord');
        if (currentNightlordEl) {
            currentNightlordEl.textContent = seed.nightlord || 'Any';
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

    openFullscreen() {
        const seed = this.foundSeed || this.filteredSeeds[0];
        if (!seed) return;
        
        const currentLang = (this.languageManager && this.languageManager.currentLang) ? this.languageManager.currentLang : 'en';
        const imagePath = `assets/pattern/${currentLang}/${seed.seedNumber.toString().padStart(3, '0')}.jpg`;
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
