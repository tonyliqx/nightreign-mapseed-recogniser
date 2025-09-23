/**
 * POI Data - New Architecture
 * Loads and structures data from JSON for dynamic use
 */

// Global POI data structure
let POI_DATA = null;
let SEED_DATA = null;

// Load data from JSON
async function loadPOIData() {
    try {
        const response = await fetch('dataset/nightreignMapPatterns.json');
        const jsonData = await response.json();
        
        // Initialize POI_DATA
        POI_DATA = {
            mapTypes: {}
        };
        
        // Process POI lookup data (now flattened structure)
        if (jsonData.poiLookupByMapType) {
            Object.keys(jsonData.poiLookupByMapType).forEach(mapType => {
                const mapPOIs = jsonData.poiLookupByMapType[mapType];
                
                // Process the flattened POI list
                const allPOIs = mapPOIs.map(poi => ({
                    id: poi.id,
                    name: poi.location,
                    x: poi.coordinates.x * 0.5, // Scale from 1536x1536 to 768x768, preserve decimals
                    y: poi.coordinates.y * 0.5,
                    category: mapCategoryToInternal(poi.category)
                }));
                
                POI_DATA.mapTypes[mapType] = {
                    pois: allPOIs
                };
            });
        }
        
        // Process individual seeds for POI data
        SEED_DATA = jsonData.seeds || {};
        
        // Build layer mappings from JSON data
        POI_DATA.layerMappings = buildLayerMappings(SEED_DATA);
        
        // Build icon path mappings
        POI_DATA.iconPaths = buildIconPaths();
        
        console.log('✅ POI data loaded successfully');
        console.log('Map types:', Object.keys(POI_DATA.mapTypes));
        console.log('Sample map data:', POI_DATA.mapTypes['Default']);
        console.log('Layer mappings:', POI_DATA.layerMappings);
        
        return POI_DATA;
        
    } catch (error) {
        console.error('❌ Failed to load POI data:', error);
        throw error;
    }
}

// Build icon path mappings
function buildIconPaths() {
    return {
        // Major Base Icons
        'camp_blank': 'assets/icons/camp_blank.png',
        'camp_fire': 'assets/icons/camp_fire.png',
        'camp_madness': 'assets/icons/camp_madness.png',
        'camp_lightning': 'assets/icons/camp_lightning.png',
        'fort_blank': 'assets/icons/fort_blank.png',
        'fort_magic': 'assets/icons/fort_magic.png',
        'cathedral_blank': 'assets/icons/cathedral_blank.png',
        'cathedral_fire': 'assets/icons/cathedral_fire.png',
        'cathedral_holy': 'assets/icons/cathedral_holy.png',
        'ruin_blank': 'assets/icons/ruin_blank.png',
        'ruin_blood': 'assets/icons/ruin_blood.png',
        'ruin_death': 'assets/icons/ruin_death.png',
        'ruin_frost': 'assets/icons/ruin_frost.png',
        'ruin_holy': 'assets/icons/ruin_holy.png',
        'ruin_lightning': 'assets/icons/ruin_lightning.png',
        'ruin_magic': 'assets/icons/ruin_magic.png',
        'ruin_poison': 'assets/icons/ruin_poison.png',
        'ruin_sleep': 'assets/icons/ruin_sleep.png',
        
        // Minor Base Icons
        'church': 'assets/icons/church.png',
        'rise': 'assets/icons/rise.png',
        'ancient_rise': 'assets/icons/ancient_rise.png',
        'village': 'assets/icons/village.png',
        
        // Field Boss Icons
        'field_boss': 'assets/icons/field_boss.png',
        'elite': 'assets/icons/elite.png',
        'unknown_field_boss': 'assets/icons/unknown_field_boss.png',
        
        // Evergaol Icons
        'evergaol': 'assets/icons/evergaol.png',
        
        // Nightlord Icons
        'Adel': 'assets/icons/Adel.png',
        'Caligo': 'assets/icons/Caligo.png',
        'Fulghor': 'assets/icons/Fulghor.png',
        'Gladius': 'assets/icons/Gladius.png',
        'Gnoster': 'assets/icons/Gnoster.png',
        'Heolstor': 'assets/icons/Heolstor.png',
        'Libra': 'assets/icons/Libra.png',
        'Maris': 'assets/icons/Maris.png'
    };
}

// Build layer mappings from JSON data
function buildLayerMappings(seedData) {
    if (!seedData) {
        console.log('❌ No seed data available for building layer mappings');
        return {};
    }
    
    console.log('🔧 Building layer mappings from JSON data...');
    
    // Initialize mappings
    const layerMappings = {
        major_base: {},
        field_boss: {}
    };
    
    // Process all seeds to build mappings
    Object.values(seedData).forEach(seed => {
        if (!seed.pois) return;
        
        Object.values(seed.pois).forEach(poi => {
            const category = poi.category;
            
            if (category === 'majorBase') {
                if (poi.icon && poi.boss) {
                    if (!layerMappings.major_base[poi.icon]) {
                        layerMappings.major_base[poi.icon] = new Set();
                    }
                    layerMappings.major_base[poi.icon].add(poi.boss);
                }
            } else if (category === 'fieldBoss') {
                if (poi.icon && poi.boss) {
                    if (!layerMappings.field_boss[poi.icon]) {
                        layerMappings.field_boss[poi.icon] = new Set();
                    }
                    layerMappings.field_boss[poi.icon].add(poi.boss);
                }
            }
        });
    });
    
    // Convert Sets to Arrays for easier handling
    Object.keys(layerMappings).forEach(category => {
        Object.keys(layerMappings[category]).forEach(icon => {
            layerMappings[category][icon] = Array.from(layerMappings[category][icon]);
        });
    });
    
    console.log('✅ Layer mappings built:', layerMappings);
    return layerMappings;
}

// Map JSON category names to internal category names
function mapCategoryToInternal(jsonCategory) {
    const mapping = {
        'majorBase': 'major_base',
        'minorBase': 'minor_base',
        'fieldBoss': 'field_boss',
        'evergaol': 'evergaol',
        'rottedWoods': 'rotted_woods'
    };
    return mapping[jsonCategory] || 'minor_base';
}

// Get POI data from a specific seed
function getPOIDataFromSeed(seed, poiId) {
    if (!SEED_DATA || !seed || !seed.pois) return null;
    
    // Find the POI in the seed data by matching coordinates
    const targetPOI = findPOIInSeed(seed, poiId);
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

// Find POI in seed data by matching coordinates
function findPOIInSeed(seed, poiId) {
    if (!seed || !seed.pois) return null;
    
    // Get the POI data from our loaded POI data to find coordinates
    const poiData = window.poiData;
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

// Export for use in app
window.POI_DATA = POI_DATA;
window.SEED_DATA = SEED_DATA;
window.loadPOIData = loadPOIData;
window.getPOIDataFromSeed = getPOIDataFromSeed;
