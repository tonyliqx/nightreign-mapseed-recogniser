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
        
        // 缩放和平移相关属性
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.minScale = 0.5;
        this.maxScale = 3;
        
        this.init();
    }

    async init() {
        this.setupImages();
        this.setupEventListeners();
        await this.loadInitialData();
        this.showSelectionSection();
        // 不要在初始化时自动显示默认地图
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
                // 如果已经选择了这个夜王，则取消选择
                if (this.chosenNightlord === nightlord) {
                    this.selectNightlord(null);
                } else {
                    this.selectNightlord(nightlord);
                }
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
        
        // 缩放控制按钮
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        const zoomResetBtn = document.getElementById('zoom-reset-btn');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.zoomIn();
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.zoomOut();
            });
        }
        
        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => {
                this.resetZoom();
            });
        }
        
        // 添加鼠标滚轮缩放
        if (this.canvas) {
            this.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // 确定缩放方向
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoom(delta, mouseX, mouseY);
            });
            
            // 添加拖动功能
            this.canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0 && e.ctrlKey) { // 左键 + Ctrl 键用于拖动
                    e.preventDefault();
                    this.startDrag(e.clientX, e.clientY);
                }
            });
            
            this.canvas.addEventListener('mousemove', (e) => {
                if (this.isDragging) {
                    e.preventDefault();
                    this.drag(e.clientX, e.clientY);
                }
            });
            
            this.canvas.addEventListener('mouseup', () => {
                this.stopDrag();
            });
            
            this.canvas.addEventListener('mouseleave', () => {
                this.stopDrag();
            });
            
            // 触摸事件用于平移
            let touchStartX = 0;
            let touchStartY = 0;
            let touchMoved = false;
            
            this.canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    // 双指触摸，用于缩放
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const distance = Math.hypot(
                        touch1.clientX - touch2.clientX,
                        touch1.clientY - touch2.clientY
                    );
                    this.initialPinchDistance = distance;
                    this.initialScale = this.scale;
                } else if (e.touches.length === 1) {
                    // 单指触摸，用于平移或点击
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                    touchMoved = false;
                }
            }, { passive: false });
            
            this.canvas.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    // 双指缩放
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const distance = Math.hypot(
                        touch1.clientX - touch2.clientX,
                        touch1.clientY - touch2.clientY
                    );
                    
                    if (this.initialPinchDistance) {
                        const deltaScale = (distance / this.initialPinchDistance) - 1;
                        const newScale = this.initialScale * (1 + deltaScale);
                        this.setScale(newScale);
                        this.redrawMap();
                    }
                } else if (e.touches.length === 1) {
                    // 单指平移
                    const deltaX = e.touches[0].clientX - touchStartX;
                    const deltaY = e.touches[0].clientY - touchStartY;
                    
                    // 如果移动距离超过阈值，标记为移动而非点击
                    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                        touchMoved = true;
                        this.offsetX += deltaX / this.scale;
                        this.offsetY += deltaY / this.scale;
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                        this.redrawMap();
                    }
                }
            }, { passive: false });
        }
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
        
        // 显示选择覆盖层，提示用户选择地图
        this.showSelectionOverlay();
        
        // 移除自动显示默认地图的调用
        // this.showDefaultMap();
    }

    showDefaultMap() {
        // Set up a default map for immediate interaction using the chosen map
        this.currentPOIs = POIS_BY_MAP[this.chosenMap] || [];
        this.poiStates = this.initializePOIStates();
        
        // Show interaction section
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
        this.chosenNightlord = nightlord;
        
        // Update UI
        document.getElementById('chosen-nightlord').textContent = nightlord || '无';
        
        // Update button states
        document.querySelectorAll('.nightlord-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.nightlord === nightlord);
        });

        this.updateGameState();
    }

    selectMap(map) {
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

        // 初始化地图显示
        this.showDefaultMap();
        
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
            // Keep using the original clickable coordinates for user interaction
            this.currentPOIs = POIS_BY_MAP[this.chosenMap] || [];
            this.poiStates = this.initializePOIStates();
            
            this.showInteractionSection();
            this.showResultsSection();
            this.renderMap();
            this.updateSeedFiltering();
            this.hideSelectionOverlay();
        } else {
            // Always update seed count when selections change
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
        
        // Handle context menu item clicks
        document.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                if (this.currentRightClickedPOI) {
                    this.poiStates[this.currentRightClickedPOI.id] = type;
                    this.redrawMap();
                    this.updateSeedFiltering();
                    this.hideContextMenu();
                    this.currentRightClickedPOI = null;
                }
            });
        });
    }

    showContextMenu(x, y) {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'block';
            this.contextMenu.style.left = `${x}px`;
            this.contextMenu.style.top = `${y}px`;
        }
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
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
        indicator.style.position = 'absolute';
        indicator.style.width = '60px';
        indicator.style.height = '60px';
        indicator.style.borderRadius = '50%';
        indicator.style.border = '3px solid #ffd700';
        indicator.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.7)';
        indicator.style.animation = 'longPressAnimation 0.5s linear forwards';
        indicator.style.pointerEvents = 'none';
        indicator.style.zIndex = '1000';
        
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
    }
    
    hideLongPressIndicator() {
        const indicator = document.getElementById('long-press-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // 缩放和平移方法
    zoomIn() {
        this.zoom(0.1);
    }
    
    zoomOut() {
        this.zoom(-0.1);
    }
    
    zoom(delta, centerX, centerY) {
        const oldScale = this.scale;
        this.scale = Math.min(Math.max(this.scale + delta, this.minScale), this.maxScale);
        
        // 如果提供了中心点，则围绕该点缩放
        if (centerX !== undefined && centerY !== undefined) {
            // 计算缩放前的世界坐标
            const worldX = (centerX / oldScale) - this.offsetX;
            const worldY = (centerY / oldScale) - this.offsetY;
            
            // 计算缩放后的偏移量，保持鼠标位置不变
            this.offsetX = -(worldX * this.scale - centerX);
            this.offsetY = -(worldY * this.scale - centerY);
        }
        
        this.redrawMap();
    }
    
    resetZoom() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.redrawMap();
    }
    
    startDrag(x, y) {
        this.isDragging = true;
        this.lastX = x;
        this.lastY = y;
    }
    
    drag(x, y) {
        if (!this.isDragging) return;
        
        const deltaX = x - this.lastX;
        const deltaY = y - this.lastY;
        
        this.offsetX += deltaX / this.scale;
        this.offsetY += deltaY / this.scale;
        
        this.lastX = x;
        this.lastY = y;
        
        this.redrawMap();
    }
    
    stopDrag() {
        this.isDragging = false;
    }
    
    setScale(newScale) {
        this.scale = Math.min(Math.max(newScale, this.minScale), this.maxScale);
    }
    
    redrawMap() {
        if (this.chosenMap) {
            this.drawMap(this.images.maps[this.chosenMap]);
        } else {
            this.drawDefaultMapWithImage();
        }
    }
    
    resetMap() {
        // 重置所有POI状态为默认点
        this.poiStates = this.initializePOIStates();
        
        // 重绘地图
        this.redrawMap();
        
        // 更新种子过滤
        this.updateSeedFiltering();
        
        console.log('地图已重置');
    }
    
    showHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    hideHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    showError(message) {
        console.error(message);
        
        // 创建错误提示元素
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        
        // 添加到页面
        document.body.appendChild(errorElement);
        
        // 3秒后自动消失
        setTimeout(() => {
            errorElement.remove();
        }, 3000);
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
        
        // 保存当前状态
        this.ctx.save();
        
        // 应用缩放和平移
        this.ctx.translate(this.offsetX * this.scale, this.offsetY * this.scale);
        this.ctx.scale(this.scale, this.scale);
        
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
        
        // 恢复状态
        this.ctx.restore();
        
        // 绘制缩放信息
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '12px Inter, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`缩放: ${Math.round(this.scale * 100)}%`, 10, 10);
        
        console.log(`Drew map with ${this.currentPOIs.length} POIs for ${this.chosenMap} at scale ${this.scale}`);
    }
    
    // 绘制POI点
    drawPOI(poi, state) {
        const x = poi.x;
        const y = poi.y;
        const radius = ICON_SIZE / 2;
        
        // 根据状态绘制不同的图标
        switch (state) {
            case 'church':
                if (this.images.church.complete) {
                    this.ctx.drawImage(this.images.church, x - radius, y - radius, ICON_SIZE, ICON_SIZE);
                } else {
                    // 备用绘制
                    this.ctx.fillStyle = '#ff9800';
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.strokeStyle = '#ffffff';
                    this.ctx.lineWidth = 2;
                    this.ctx.stroke();
                }
                break;
            case 'mage':
                if (this.images.mage.complete) {
                    this.ctx.drawImage(this.images.mage, x - radius, y - radius, ICON_SIZE, ICON_SIZE);
                } else {
                    // 备用绘制
                    this.ctx.fillStyle = '#2196f3';
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                break;
            case 'village':
                if (this.images.village.complete) {
                    this.ctx.drawImage(this.images.village, x - radius, y - radius, ICON_SIZE, ICON_SIZE);
                } else {
                    // 备用绘制
                    this.ctx.fillStyle = '#4caf50';
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                break;
            case 'dot':
            default:
                // 默认绘制为橙色点
                this.ctx.fillStyle = '#ff9800';
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
                this.ctx.fill();
                break;
        }
    }
    
    // 更新种子计数显示
    updateSeedCount() {
        // 根据当前选择过滤种子
        const filteredSeeds = this.getFilteredSeeds();
        const totalSeeds = seedDataMatrix.length;
        
        // 更新UI显示
        const seedCountElement = document.getElementById('seed-count');
        if (seedCountElement) {
            seedCountElement.textContent = `${filteredSeeds.length} / ${totalSeeds}`;
        }
    }
    
    // 获取符合当前选择条件的种子
    getFilteredSeeds() {
        return seedDataMatrix.filter(seed => {
            // 如果选择了夜王但不匹配，则过滤掉
            if (this.chosenNightlord && seed.nightlord !== this.chosenNightlord) {
                return false;
            }
            
            // 如果选择了地图但不匹配，则过滤掉
            if (this.chosenMap && seed.map !== this.chosenMap) {
                return false;
            }
            
            // 检查POI标记是否匹配
            for (const poiId in this.poiStates) {
                const state = this.poiStates[poiId];
                // 只检查已标记的POI（不是默认的dot状态）
                if (state !== 'dot') {
                    // 如果种子中没有这个POI或者类型不匹配，则过滤掉
                    if (!seed.pois[poiId] || seed.pois[poiId] !== state) {
                        return false;
                    }
                }
            }
            
            return true;
        });
    }
    
    // 更新种子过滤结果
    updateSeedFiltering() {
        // 更新种子计数
        this.updateSeedCount();
        
        // 获取符合条件的种子
        const filteredSeeds = this.getFilteredSeeds();
        
        // 更新UI显示
        const seedListElement = document.getElementById('seed-list');
        if (seedListElement) {
            // 清空现有列表
            seedListElement.innerHTML = '';
            
            // 添加新的种子项
            filteredSeeds.forEach(seed => {
                const seedItem = document.createElement('div');
                seedItem.className = 'seed-item';
                seedItem.textContent = `种子 #${seed.id}: ${seed.nightlord} - ${seed.map}`;
                seedListElement.appendChild(seedItem);
            });
            
            // 如果没有匹配的种子，显示提示
            if (filteredSeeds.length === 0) {
                const noSeedItem = document.createElement('div');
                noSeedItem.className = 'no-seed-item';
                noSeedItem.textContent = '没有匹配的种子';
                seedListElement.appendChild(noSeedItem);
            }
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new NightreignMapRecogniser();
});