/**
 * POI Data - New Architecture
 * Loads and structures data from JSON for dynamic use
 * 单层交互 + NAME 类别（弃用 5 类/双层 icon→boss），决策见 memory: category-name-taxonomy-decision
 */

// Global POI data structure
let POI_DATA = null;
let SEED_DATA = null;

// Load data from JSON
async function loadPOIData() {
    try {
        const response = await fetch('dataset/nightreignMapPatterns.json');
        const jsonData = await response.json();

        POI_DATA = { mapTypes: {} };

        // 槽位 POI：coordinates 1536→768（×0.5），category 用 NAME 类别 key 直接用
        if (jsonData.poiLookupByMapType) {
            Object.keys(jsonData.poiLookupByMapType).forEach(mapType => {
                const mapPOIs = jsonData.poiLookupByMapType[mapType];
                const allPOIs = mapPOIs.map(poi => ({
                    id: poi.id,
                    name: poi.name || poi.id,  // 新源槽位无地名，用 id 兜底
                    x: poi.coordinates.x * 0.5, // 1536→768
                    y: poi.coordinates.y * 0.5,
                    category: poi.category
                }));
                POI_DATA.mapTypes[mapType] = { pois: allPOIs };
            });
        }

        SEED_DATA = jsonData.seeds || {};
        POI_DATA.layerMappings = {};  // 单层交互，无 layer mappings
        POI_DATA.iconPaths = buildIconPaths();

        console.log('✅ POI data loaded. Map types:', Object.keys(POI_DATA.mapTypes));
        return POI_DATA;
    } catch (error) {
        console.error('❌ Failed to load POI data:', error);
        throw error;
    }
}

// icon 路径映射（单层用类别默认 icon）
function buildIconPaths() {
    return {
        'castle': 'assets/icons/castle.png',
        'camp_blank': 'assets/icons/camp_blank.png',
        'field_boss': 'assets/icons/field_boss.png',
        'evergaol': 'assets/icons/evergaol.png',
        'merchant': 'assets/icons/merchant.png',
        'church': 'assets/icons/church.png',
        'rise': 'assets/icons/rise.png',
        'ancient_rise': 'assets/icons/ancient_rise.png',
        'village': 'assets/icons/village.png',
        'blessing': 'assets/icons/blessing.png',
        'unknown': 'assets/icons/unknown.png',
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

// category 直接用 NAME 类别 key（弃用 5 类映射）
function mapCategoryToInternal(jsonCategory) {
    return jsonCategory;
}

// 取 seed 中某 POI 的单层选择值（type 中文名）
function getPOIDataFromSeed(seed, poiId) {
    const targetPOI = findPOIInSeed(seed, poiId);
    if (!targetPOI) return null;
    return {
        value: targetPOI.type || null,
        type: targetPOI.type,
        icon: targetPOI.icon,
        category: targetPOI.category
    };
}

// 按坐标匹配在 seed 中找 POI（槽位 poi.x 768 ×2 = seed coordinates 1536）
function findPOIInSeed(seed, poiId) {
    if (!seed || !seed.pois) return null;
    const poiData = window.poiData;
    if (!poiData) return null;

    // 用 seed 所在地形限定（各地形 slot id 从 "0" 重新编号，跨地形取首个会错位）
    let targetPOI = null;
    if (seed.mapType && poiData.mapTypes[seed.mapType]) {
        targetPOI = poiData.mapTypes[seed.mapType].pois.find(poi => poi.id === poiId) || null;
    }
    if (!targetPOI) return null;

    const targetX = targetPOI.x * 2;
    const targetY = targetPOI.y * 2;

    for (const poi of Object.values(seed.pois)) {
        if (Math.abs(poi.coordinates.x - targetX) <= 2 && Math.abs(poi.coordinates.y - targetY) <= 2) {
            return poi;
        }
    }
    return null;
}

window.POI_DATA = POI_DATA;
window.SEED_DATA = SEED_DATA;
window.loadPOIData = loadPOIData;
window.getPOIDataFromSeed = getPOIDataFromSeed;
