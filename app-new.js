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
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Nightreign App...');
        
        // Load data
        await this.loadData();
        
        // Load map images
        await this.loadMapImages();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Show selection screen
        this.showScreen('selection');
        
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
                this.selectNightlord(e.target.dataset.nightlord);
            });
        });

        // Map selection
        document.querySelectorAll('.map-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectMap(e.target.dataset.map);
            });
        });

        // Start recognition
        document.getElementById('start-recognition').addEventListener('click', () => {
            this.startRecognition();
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.showScreen('selection');
        });

        // Clear All button
        document.getElementById('clear-all-btn').addEventListener('click', () => {
            this.clearAllPOIs();
        });

        // Help button
        document.getElementById('help-btn').addEventListener('click', () => {
            this.showHelp();
        });

        // Close help modal
        document.getElementById('close-help').addEventListener('click', () => {
            this.hideHelp();
        });

        // Language toggle
        document.getElementById('language-toggle').addEventListener('click', () => {
            this.toggleLanguage();
        });

        // Result screen buttons will be added when result screen is first shown
    }

    selectNightlord(nightlord) {
        this.selectedNightlord = nightlord;
        
        // Update UI
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`[data-nightlord="${nightlord}"]`).classList.add('selected');
        
        this.updateStartButton();
    }

    selectMap(mapType) {
        this.selectedMap = mapType;
        
        // Update UI
        document.querySelectorAll('.map-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`[data-map="${mapType}"]`).classList.add('selected');
        
        this.updateStartButton();
    }

    updateStartButton() {
        const startBtn = document.getElementById('start-recognition');
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

        // Update display
        document.getElementById('current-map').textContent = this.selectedMap;
        document.getElementById('current-nightlord').textContent = this.selectedNightlord || 'Any';

        // Set current map image
        this.currentMapImage = this.mapImages[this.selectedMap];

        // Load POIs for selected map
        this.loadPOIsForMap(this.selectedMap);

        // Filter seeds
        this.filterSeeds();

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

    filterSeeds() {
        if (!this.seedData) return;

        console.log(`🔍 Starting seed filtering...`);
        console.log(`   Selected nightlord: ${this.selectedNightlord || 'Any'}`);
        console.log(`   Selected map: ${this.selectedMap}`);
        console.log(`   Current POI states:`, Object.keys(this.poiStates).length, 'POIs with selections');

        const allSeeds = Object.values(this.seedData);
        console.log(`   Total seeds to check: ${allSeeds.length}`);

        this.filteredSeeds = allSeeds.filter(seed => {
            const nightlordMatch = !this.selectedNightlord || seed.nightlord === this.selectedNightlord;
            const mapMatch = seed.mapType === this.selectedMap;
            
            // Check POI selections
            const poiMatch = this.checkPOIMatches(seed);
            
            const matches = nightlordMatch && mapMatch && poiMatch;
            if (matches) {
                console.log(`✅ Seed ${seed.seedNumber} matches all criteria`);
            }
            
            return matches;
        });

        document.getElementById('seed-count').textContent = this.filteredSeeds.length;
        console.log(`🔍 Filtered to ${this.filteredSeeds.length} seeds`);

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
            // Single-layer system: Structure
            if (selectionState.layer1 && poiData.structure !== selectionState.layer1) {
                console.log(`   ❌ Structure mismatch: expected ${selectionState.layer1}, got ${poiData.structure}`);
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
        // Left click - show context menu or open fullscreen
        canvas.addEventListener('click', (e) => {
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
            }
        });

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


    getPossibleValuesForPOI(poi) {
        // Get possible values from filtered seeds
        const possibleValues = new Set();
        
        this.filteredSeeds.forEach(seed => {
            const poiData = this.getPOIDataFromSeed(seed, poi.id);
            if (poiData) {
                possibleValues.add(poiData.value);
            }
        });
        
        // Fallback to all possible values for category
        if (possibleValues.size === 0) {
            const categoryData = this.poiData.categories[poi.category];
            if (categoryData) {
                return categoryData.possibleValues;
            }
        }
        
        return Array.from(possibleValues);
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
    }

    generateHierarchicalMenu(container, poi) {
        const category = poi.category;
        
        if (category === 'major_base' || category === 'field_boss') {
            // Two-layer system: Icon → Boss
            this.generateTwoLayerMenu(container, poi);
        } else {
            // Single-layer system: Structure or Boss
            this.generateSingleLayerMenu(container, poi);
        }
    }

    generateTwoLayerMenu(container, poi) {
        const category = poi.category;
        const layer1Options = this.getAvailableOptions(poi, 1);
        const layer2Options = this.getAvailableOptions(poi, 2);
        
        // Layer 1: Icons
        const layer1Section = document.createElement('div');
        layer1Section.className = 'context-menu-section';
        layer1Section.innerHTML = `<div class="context-menu-header">${category === 'major_base' ? 'Structure Type' : 'Boss Type'}</div>`;
        
        layer1Options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            if (poi.selectionState.layer1 === option) {
                item.classList.add('selected');
            }
            item.textContent = this.formatOptionName(option);
            item.addEventListener('click', () => {
                this.selectLayer1(poi, option);
                this.hideContextMenu();
            });
            layer1Section.appendChild(item);
        });
        
        container.appendChild(layer1Section);
        
        // Layer 2: Bosses (if layer1 is selected or if we want to show all)
        if (layer2Options.length > 0) {
            const layer2Section = document.createElement('div');
            layer2Section.className = 'context-menu-section';
            layer2Section.innerHTML = '<div class="context-menu-header">Specific Boss</div>';
            
            layer2Options.forEach(option => {
                const item = document.createElement('div');
                item.className = 'context-menu-item';
                if (poi.selectionState.layer2 === option) {
                    item.classList.add('selected');
                }
                item.textContent = option;
                item.addEventListener('click', () => {
                    this.selectLayer2(poi, option);
                    this.hideContextMenu();
                });
                layer2Section.appendChild(item);
            });
            
            container.appendChild(layer2Section);
        }
        
        // Clear selection option
        if (poi.selectionState.layer1 || poi.selectionState.layer2) {
            const clearItem = document.createElement('div');
            clearItem.className = 'context-menu-item clear-option';
            clearItem.textContent = 'Clear Selection';
            clearItem.addEventListener('click', () => {
                this.clearPOISelection(poi);
                this.hideContextMenu();
            });
            container.appendChild(clearItem);
        }
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
        
        const headerText = category === 'minor_base' ? 'Structure' : 'Boss';
        section.innerHTML = `<div class="context-menu-header">${headerText}</div>`;
        
        options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            if (poi.selectionState.layer1 === option) {
                item.classList.add('selected');
            }
            item.textContent = option;
            item.addEventListener('click', () => {
                this.selectLayer1(poi, option);
                this.hideContextMenu();
            });
            section.appendChild(item);
        });
        
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
    }

    hideContextMenu() {
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
        this.filterSeeds();
        
        console.log(`📍 Selected ${poi.category} layer1: ${value} for ${poi.name}`);
        console.log(`🔍 Current POI states:`, this.poiStates);
    }

    selectLayer2(poi, value) {
        console.log(`🎯 Selecting layer2: ${value} for POI ${poi.name} (${poi.category})`);
        
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
        this.filterSeeds();
        
        console.log(`📍 Selected ${poi.category} layer2: ${value} for ${poi.name}`);
        console.log(`🔍 Current POI states:`, this.poiStates);
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
        this.filterSeeds();
        
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
        // Convert icon names to readable format
        return option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
        // Hide all screens
        document.querySelectorAll('[id$="-screen"]').forEach(screen => {
            screen.style.display = 'none';
        });
        
        // Show selected screen
        let targetScreen = document.getElementById(`${screenName}-screen`);
        
        // Special case for result screen - it's already named result-screen
        if (!targetScreen && screenName === 'result') {
            targetScreen = document.getElementById('result-screen');
        }
        
        if (targetScreen) {
            targetScreen.style.display = 'block';
            this.currentScreen = screenName;
        } else {
            console.error(`Screen not found: ${screenName}-screen`);
        }
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
        
        // Redraw the canvas
        this.setupCanvas();
        
        // Re-filter seeds based on current selections
        this.filterSeeds();
        
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
        
        // Get all seeds that have this POI at these coordinates
        const seedsWithLocation = Object.values(this.seedData).filter(seed => {
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
                    // Layer 1: Structure
                    if (matchingPOI.structure) {
                        uniqueValues.add(matchingPOI.structure);
                        console.log(`➕ Added structure: ${matchingPOI.structure}`);
                    }
                }
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
        
        // Store the found seed for reference
        this.foundSeed = seed;
        
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
        
        // Add a "New Search" button to the controls
        this.addNewSearchButton();
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
        
        const imagePath = `assets/pattern/en/${seed.seedNumber.toString().padStart(3, '0')}.jpg`;
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

    addNewSearchButton() {
        // Check if button already exists
        if (document.getElementById('new-search-btn')) return;
        
        const newSearchBtn = document.createElement('button');
        newSearchBtn.id = 'new-search-btn';
        newSearchBtn.className = 'control-btn primary';
        newSearchBtn.innerHTML = '<i class="fas fa-search"></i> New Search';
        
        newSearchBtn.addEventListener('click', () => {
            this.resetToSelection();
        });
        
        // Add to the recognition controls
        const controlsContainer = document.querySelector('.recognition-controls');
        if (controlsContainer) {
            controlsContainer.appendChild(newSearchBtn);
        }
    }

    updateResultDetails(seed, retryCount = 0) {
        console.log(`🔍 Updating result details (attempt ${retryCount + 1})`);
        
        // Check if result screen is actually visible
        const resultScreen = document.getElementById('result-screen');
        if (!resultScreen || resultScreen.style.display === 'none') {
            console.log('⚠️ Result screen not visible, retrying...');
            if (retryCount < 3) {
                setTimeout(() => this.updateResultDetails(seed, retryCount + 1), 50);
            } else {
                console.error('❌ Result screen not visible after 3 attempts');
            }
            return;
        }
        
        // Update result details with null checks
        const seedNumberEl = document.getElementById('result-seed-number');
        console.log('🔍 Looking for result-seed-number element:', seedNumberEl);
        if (seedNumberEl) {
            seedNumberEl.textContent = seed.seedNumber;
        } else {
            console.error('❌ result-seed-number element not found');
            if (retryCount < 3) {
                setTimeout(() => this.updateResultDetails(seed, retryCount + 1), 50);
                return;
            }
        }
        
        const nightlordEl = document.getElementById('result-nightlord');
        console.log('🔍 Looking for result-nightlord element:', nightlordEl);
        if (nightlordEl) {
            nightlordEl.textContent = seed.nightlord || 'Any';
        } else {
            console.error('❌ result-nightlord element not found');
            if (retryCount < 3) {
                setTimeout(() => this.updateResultDetails(seed, retryCount + 1), 50);
                return;
            }
        }
        
        const mapTypeEl = document.getElementById('result-map-type');
        console.log('🔍 Looking for result-map-type element:', mapTypeEl);
        if (mapTypeEl) {
            mapTypeEl.textContent = seed.mapType;
        } else {
            console.error('❌ result-map-type element not found');
            if (retryCount < 3) {
                setTimeout(() => this.updateResultDetails(seed, retryCount + 1), 50);
                return;
            }
        }
        
        // Load and display the pattern image
        const patternImage = document.getElementById('result-pattern-image');
        console.log('🔍 Looking for result-pattern-image element:', patternImage);
        if (patternImage) {
            const imagePath = `assets/pattern/en/${seed.seedNumber.toString().padStart(3, '0')}.jpg`;
            patternImage.src = imagePath;
            patternImage.alt = `Map Pattern for Seed ${seed.seedNumber}`;
            console.log(`📸 Loaded pattern image: ${imagePath}`);
        } else {
            console.error('❌ Result pattern image element not found');
            if (retryCount < 3) {
                setTimeout(() => this.updateResultDetails(seed, retryCount + 1), 50);
                return;
            }
        }
        
        console.log('✅ Result details updated successfully');
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
        
        const imagePath = `assets/pattern/en/${seed.seedNumber.toString().padStart(3, '0')}.jpg`;
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
        
        // Reset UI
        document.querySelectorAll('.nightlord-btn, .map-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Remove the new search button if it exists
        const newSearchBtn = document.getElementById('new-search-btn');
        if (newSearchBtn) {
            newSearchBtn.remove();
        }
        
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
