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
        
        // Structure the data
        POI_DATA = {
            categories: {
                major_base: {
                    pois: [],
                    possibleValues: [
                        'camp_blank', 'camp_fire', 'camp_frenzy',
                        'fort_blank', 'fort_magic',
                        'cathedral_blank', 'cathedral_fire',
                        'ruin_blank', 'ruin_frost', 'ruin_poison'
                    ],
                    defaultState: 'dot'
                },
                minor_base: {
                    pois: [],
                    possibleValues: ['church', 'rise', 'ancient_rise'],
                    defaultState: 'dot'
                },
                field_boss: {
                    pois: [],
                    possibleValues: ['field_boss', 'elite'],
                    defaultState: 'dot'
                },
                evergaol: {
                    pois: [],
                    possibleValues: ['evergaol'],
                    defaultState: 'dot'
                },
                rotted_woods: {
                    pois: [],
                    possibleValues: ['rotted_woods'],
                    defaultState: 'dot'
                }
            },
            mapTypes: {
                'Default': { pois: [] },
                'Crater': { pois: [] },
                'Mountaintop': { pois: [] },
                'Noklateo': { pois: [] },
                'Rotted Woods': { pois: [] }
            }
        };
        
        // Process POI lookup data (now flattened structure)
        if (jsonData.poiLookupByMapType) {
            Object.keys(jsonData.poiLookupByMapType).forEach(mapType => {
                const mapPOIs = jsonData.poiLookupByMapType[mapType];
                
                // Process the flattened POI list
                const allPOIs = mapPOIs.map(poi => ({
                    id: poi.id,
                    name: poi.location,
                    x: Math.round(poi.coordinates.x * 0.5), // Scale from 1536x1536 to 768x768
                    y: Math.round(poi.coordinates.y * 0.5),
                    category: mapCategoryToInternal(poi.category)
                }));
                
                POI_DATA.mapTypes[mapType] = {
                    pois: allPOIs
                };
            });
        }
        
        // Process individual seeds for POI data
        SEED_DATA = jsonData.seeds || {};
        
        console.log('✅ POI data loaded successfully');
        console.log('Categories:', Object.keys(POI_DATA.categories));
        console.log('Map types:', Object.keys(POI_DATA.mapTypes));
        console.log('Sample map data:', POI_DATA.mapTypes['Default']);
        
        return POI_DATA;
        
    } catch (error) {
        console.error('❌ Failed to load POI data:', error);
        throw error;
    }
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

// Determine POI category from location name
function determineCategoryFromLocation(location) {
    const locationLower = location.toLowerCase();
    
    // Major base locations (cathedrals, camps, forts, ruins)
    if (locationLower.includes('cathedral') || 
        locationLower.includes('camp') || 
        locationLower.includes('fort') || 
        locationLower.includes('ruin')) {
        return 'major_base';
    }
    
    // Minor base locations (churches, rises)
    if (locationLower.includes('church') || 
        locationLower.includes('rise') || 
        locationLower.includes('mage') || 
        locationLower.includes('township')) {
        return 'minor_base';
    }
    
    // Field boss locations
    if (locationLower.includes('field') || 
        locationLower.includes('boss') || 
        locationLower.includes('elite')) {
        return 'field_boss';
    }
    
    // Evergaol locations
    if (locationLower.includes('evergaol') || 
        locationLower.includes('northwest') || 
        locationLower.includes('murkwater') || 
        locationLower.includes('stormhill') || 
        locationLower.includes('highroad') || 
        locationLower.includes('mistwood') || 
        locationLower.includes('northeast')) {
        return 'evergaol';
    }
    
    // Rotted woods locations
    if (locationLower.includes('rotted') || 
        locationLower.includes('woods') || 
        locationLower.includes('tree')) {
        return 'rotted_woods';
    }
    
    // Default to minor_base if unclear
    return 'minor_base';
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
