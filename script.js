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
        this.chosenNightlord = null;
        this.chosenMap = null;
        this.currentPOIs = [];
        this.poiStates = {};
        this.images = {
            maps: {},
            church: new Image(),
            mage: new Image(),
            village: new Image(),
            favicon: new Image()
        };
        this.showingSeedImage = false;
        this.canvas = null;
        this.ctx = null;
        this.contextMenu = null;
        this.currentRightClickedPOI = null;
        this.canvasEventListenersSetup = false; // 新增标志
        
        this.init();
    }

    async init() {
        this.setupImages();
        this.setupEventListeners();
        await this.loadInitialData();
        this.showSelectionSection();
    }


    setupImages() {
        // Load icon images (data URIs don't need crossOrigin)
        this.images.church.src = ICON_ASSETS.church;
        this.images.mage.src = ICON_ASSETS.mage;
        this.images.village.src = ICON_ASSETS.village;
        this.images.favicon.src = 'assets/images/church.png';

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
                    statusElement.innerHTML = `<span style="color: #28a745;">✅ Loaded ${seedCount} seeds (${classCount} classified)</span>`;
                } else {
                    statusElement.innerHTML = `<span style="color: #28a745;">✅ Loaded ${seedCount} seeds</span>`;
                }
            }
            
            this.hideLoadingSection();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load data. Please refresh the page.');
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
        this.showInstructionsSection();
        
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
        this.ctx.fillText('Click orange dots to mark POI locations', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Inter, sans-serif';
        this.ctx.fillText('Select Nightlord and Map above for accurate seed detection', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);

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
            document.getElementById('chosen-nightlord').textContent = 'None';
            
            // Clear all button states
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            console.log('Cleared nightlord selection');
        } else {
            // Select the new nightlord
            this.chosenNightlord = nightlord;
            
            // Update UI
            document.getElementById('chosen-nightlord').textContent = nightlord;
            
            // Update button states
            document.querySelectorAll('.nightlord-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.nightlord === nightlord);
            });
            
            console.log(`Selected nightlord: ${nightlord}`);
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
            document.getElementById('chosen-map').textContent = 'None';
            
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
            
            console.log(`Selected map: ${map}, POIs: ${this.currentPOIs.length}`);
            
            // Update UI
            document.getElementById('chosen-map').textContent = map;
            
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

    updateGameState() {
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
        if (this.contextMenu) {
            console.log(`Showing context menu at (${x}, ${y})`);
            
            // 确保菜单在视口内
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const menuWidth = 240; // 更新的菜单宽度
            const menuHeight = 180; // 更新的菜单高度
            
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
                this.ctx.fillText('Click on orange dots to mark POIs', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 30);
            }
        }

        // Always draw POIs (they should be visible even without background image)
        this.currentPOIs.forEach(poi => {
            const state = this.poiStates[poi.id];
            this.drawPOI(poi, state);
        });
        
        console.log(`Drew map with ${this.currentPOIs.length} POIs for ${this.chosenMap}`);
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
            case 'other':
                this.drawDot(x, y, '', '#808080');
                break;
            case 'unknown':
                this.drawDot(x, y, '?', '#808080');
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
        
        // Left click - place church
        this.canvas.addEventListener('click', (e) => {
            if (!this.chosenMap) {
                console.log('Please select Map before marking POIs');
                return;
            }
            const pos = this.getMousePos(e);
            const poi = this.findClickedPOI(pos.x, pos.y);
            if (poi) {
                // If POI is already marked (not a dot), clear it back to dot
                if (this.poiStates[poi.id] !== 'dot') {
                    console.log(`Clearing POI ${poi.id} - was ${this.poiStates[poi.id]}`);
                    this.poiStates[poi.id] = 'dot';
                } else {
                    // If it's a dot, mark as church
                    console.log(`Marking POI ${poi.id} as church`);
                    this.poiStates[poi.id] = 'church';
                }
                
                this.drawMap(this.images.maps[this.chosenMap]);
                this.updateSeedFiltering();
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
            
            // 查找是否触摸了POI
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
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            // 隐藏长按指示器
            this.hideLongPressIndicator();
            
            // 如果是短暂点击（不是长按）
            const touchDuration = Date.now() - touchStartTime;
            console.log(`Touch duration: ${touchDuration}ms, moved: ${touchMoved}`);
            
            if (touchDuration < 500 && !touchMoved && lastTouchedPoi) {
                console.log(`Short tap on POI ${lastTouchedPoi.id}`);
                
                // If POI is already marked (not a dot), clear it back to dot
                if (this.poiStates[lastTouchedPoi.id] !== 'dot') {
                    console.log(`Clearing POI ${lastTouchedPoi.id} - was ${this.poiStates[lastTouchedPoi.id]}`);
                    this.poiStates[lastTouchedPoi.id] = 'dot';
                } else {
                    // If it's a dot, mark as church
                    console.log(`Marking POI ${lastTouchedPoi.id} as church`);
                    this.poiStates[lastTouchedPoi.id] = 'church';
                }
                
                this.drawMap(this.images.maps[this.chosenMap]);
                this.updateSeedFiltering();
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

    resetMap() {
        // Clear only nightlord selection and POI states, keep map selection
        this.chosenNightlord = null;
        this.poiStates = this.initializePOIStates();
        this.showingSeedImage = false;
        
        // Hide nightlord info
        this.hideNightlordInfo();
        
        // Update UI for nightlord selection
        document.getElementById('chosen-nightlord').textContent = 'None';
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // If a map is selected, keep it and redraw with reset POIs
        if (this.chosenMap) {
            // Reinitialize POI states for current map
            this.currentPOIs = POIS_BY_MAP[this.chosenMap] || [];
            this.poiStates = this.initializePOIStates();
            
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
    
    hideNightlordInfo() {
        const nightlordInfo = document.getElementById('nightlord-info');
        if (nightlordInfo) {
            nightlordInfo.style.display = 'none';
        }
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
            document.getElementById('seed-count').textContent = '320';
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
            //return row[1] === this.chosenNightlord && row[2] === this.chosenMap;
            const allNightlords = !this.chosenNightlord || row[1] === this.chosenNightlord;
            return allNightlords && row[2] === this.chosenMap;
        });

        console.log(`Found ${possibleSeeds.length} seeds for ${this.chosenNightlord} + ${this.chosenMap}`);

        // Filter by POI states using coordinate-based matching
        const filteredSeeds = possibleSeeds.filter(row => {
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

                // User has marked as church, mage, or other - seed MUST match exactly
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
                } else if (userState === 'other') {
                    if (realPOIType === 'church' || realPOIType === 'mage' || realPOIType === 'village' || !realPOIType) {
                        console.log(`    ❌ REJECTED: User said other POI but real data has ${realPOIType || 'nothing'}`);
                        return false;
                    }
                    console.log(`    ✅ MATCH: User said other POI and real data has ${realPOIType}`);
                }
            }
            console.log(`  ✅ Seed ${seedNum} PASSED all POI checks`);
            return true;
        });

        console.log(`After POI filtering: ${filteredSeeds.length} seeds remaining`);


        this.updateSeedCountDisplay(filteredSeeds.length);

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
        seedCountElement.innerHTML = '<span style="color: #e74c3c; font-weight: 600;">NO SEED FOUND<br>RESET THE MAP!</span>';
    }

    showSingleSeed(seedRow) {
        const mapSeed = seedRow[0];
        this.showingSeedImage = true;
        
        // Show seed image with nightlord info
        this.showSeedImage(seedRow);
    }

    showSeedImage(seedRow) {
        const mapSeed = seedRow[0];
        const nightlord = seedRow[1] || '未知夜王';
        const mapType = seedRow[2] || '默认地图';
        
        // 将英文夜王名称转换为中文
        const nightlordChinese = this.getNightlordChineseName(nightlord);
        
        // 在种子计数器区域显示夜王信息
        this.updateNightlordInfo(nightlordChinese);
        
        const canvas = document.getElementById('map-canvas');
        const seedImageContainer = document.getElementById('seed-image-container');
        
        canvas.style.display = 'none';
        seedImageContainer.style.display = 'block';
        
        const seedStr = mapSeed.toString().padStart(3, '0');
        const seedImageUrl = "assets/pattern/" + seedStr + ".jpg";
        
        // 检查是否为移动设备
        const isMobile = window.innerWidth <= 768;
        
        seedImageContainer.innerHTML = `
            <div class="seed-result-container">
                ${isMobile ? '<button class="close-fullscreen-btn">&times;</button>' : ''}
                <a href="${seedImageUrl}" target="_blank" class="seed-image-link">
                    <img src="${seedImageUrl}" alt="Seed ${mapSeed}" class="seed-image">
                </a>
                <div class="seed-info">
                    <span class="seed-number">地图种子: ${mapSeed}</span>
                    <small class="seed-hint">${isMobile ? '点击图片查看大图' : '点击图片在新标签页中查看'}</small>
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

    getNightlordChineseName(englishName) {
        const nightlordMap = {
            'Gladius': '三狼',
            'Adel': '大嘴',
            'Gnoster': '慧心虫',
            'Maris': '水皮蛋',
            'Libra': '山羊',
            'Fulghor': '人马',
            'Caligo': '冰龙',
            'Heolstor': '黑夜王',
            '未知夜王': '未知夜王'
        };
        return nightlordMap[englishName] || englishName;
    }



    showError(message) {
        const loadingSection = document.getElementById('loading-section');
        loadingSection.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                <p style="color: #e74c3c;">${message}</p>
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
