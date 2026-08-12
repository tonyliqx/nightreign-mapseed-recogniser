// Translation data for Nightreign Map Seed Recognizer
const translations = {
  'zh': {
    // App metadata
    'app.title': '黑夜君临-地图种子识别器',
    'app.version': '版本 2.0.0',
    'app.subtitle': '黑夜君临 版本 1.01.3（汉化）',
    'app.description': '交互工具：通过兴趣点位置识别艾尔登法环 黑夜君临 地图种子',
    'app.keywords': '艾尔登法环, 黑夜君临, 地图, 种子, 识别器, 兴趣点, 工具',
    
    // Language toggle
    'lang.current': 'English',  // 按钮显示「切换目标语言」母语名：中文界面→English，点击切英文
    'lang.switch': '切换语言',
    
    // Navigation
    'nav.advanced': '地图缺失模式',
    
    // Loading
    'loading.init': '正在初始化地图数据，请稍候...',
    'loading.seeds': '已加载 {count} 个种子',
    'loading.classified': '已加载 {count} 个种子（320 本体+200DLC）',
    
    // Seed display
    'seed.alt_text': '种子 {seed}',
    'seed.number': '种子 {seed}',
    'seed.nightlord': '夜王 {nightlord}',
    
    // Nightlords
    'nightlord.none': '无',
    'nightlord.gladius': '三狼',
    'nightlord.adel': '大嘴',
    'nightlord.gnoster': '慧心虫',
    'nightlord.maris': '征兆',
    'nightlord.libra': '山羊',
    'nightlord.fulghor': '人马',
    'nightlord.caligo': '冰龙',
    'nightlord.heolstor': '黑夜王',
    'nightlord.harmonia': '七仙女',
    'nightlord.straghess': '垃圾王',
    'nightlord.unknown': '未知夜王',
    
    // Maps
    'map.none': '无',
    'map.default': '默认',
    'map.mountaintop': '山顶',
    'map.crater': '火山',
    'map.rotted_woods': '腐败森林',
    'map.noklateo': '隐城',
    'map.great_hollow': '大空洞',
    
    // Selection
    'selection.nightlord': '选择你的夜王',
    'selection.map': '选择地形',
    'selection.current': '当前选择：',
    
    // Actions
    'action.reset': '重置所有标记',
    'action.help': '帮助与提示',
    'action.skip_spawn': '跳过出生点',
    'action.close': '关闭',
    
    // Results
    'results.matched': '已匹配地图: ',
    'results.matched_short': '已匹配：',
    'results.nightlord': '夜王: ',
    'results.seed_number': '种子编号: ',
    'results.seed': '地图种子: ',
    'results.no_seeds': '未找到种子<br>请重置地图',
    
    // Map interaction
    'map.select_terrain': '请选择特殊地形',
    'map.select_terrain_hint': '选择参数后开始识别地图种子',
    'map.click_dots': '点击橙色圆点标记兴趣点位置',
    'map.spawn_hint': '请先选择你的出生点（蓝色三角），再标记地标',
    'map.select_parameters': '选择夜王和地图上方进行准确的种子检测',
    
    // POI types
    'poi.church': '教堂',
    'poi.mage': '法师塔',
    'poi.village': '村庄',
    'poi.empty': '空白',
    'poi.carriage': '马车',
    'gh.disambig.hint': '已锁定到 2 个种子，标记下方紫色 A/B 两点可进一步区分',
    'gh.disambig.aLabel': '守教堂BOSS',
    'gh.disambig.bLabel': 'POI2左下遗迹',
    'gh.disambig.blood': '血遗迹',
    'gh.disambig.poison': '毒遗迹',
    'gh.disambig.clear': '清除',

    // Help modal
    'help.title': '帮助与提示',
    'help.steps': '使用步骤',
    'help.step1': '选择<strong>夜王</strong>（可选）',
    'help.step2': '选择<strong>地形</strong>',
    'help.step3': '选择<strong>出生点</strong>（可跳过）',
    'help.step4': '点选地图上的 POI：',
    'help.step4_pc': '<strong>PC</strong>：左键标记教堂，右键选择其他选项',
    'help.step4_mobile': '<strong>移动端</strong>：单击标记教堂，长按选择其他选项',
    'help.step4_clear': '再次点击已标记的点可<strong>取消标记</strong>',
    'help.step5': '标记越多，种子筛选越快；仅剩一个时显示完整种子详情与地图图像',
    'help.poi_meaning': 'POI 图标意义',
    'help.poi_church': '教堂',
    'help.poi_tower': '法师塔',
    'help.poi_merchant': '大商人（特殊商人）',
    'help.poi_carriage': '马车（石剑钥匙）',
    'help.poi_hut': '破败小屋（祷告屋）',
    'help.poi_empty': '空（该位置无建筑）',
    
    // Seed display
    'seed.click_large': '点击图片在新标签页中查看',
    'seed.click_mobile': '点击图片查看大图',
    
    // Footer
    'footer.opensource': '开源项目',
    'footer.github': '在 GitHub 查看源代码',
    'footer.gitee': '在 Gitee 查看源代码',
    'footer.credits': '特别鸣谢：',
    'footer.credit1': '提供地图数据',
    'footer.credit2': '提供识别器基础代码',
    'footer.credit3': '提供汉化版地图种子',

    // Boss reverse (夜王反推入口卡片)
    'bossreverse.card_title': '夜王反推',
    'bossreverse.card_desc': '根据第一夜BOSS，反推可能的夜王',
    'bossreverse.card_enter': '进入反推 →',
    
    // Errors
    'error.load_failed': '数据加载失败，请刷新页面。',
    'error.select_map': '请先选择地图再标记兴趣点',

    // Category display names（高级模式 POI 分类）
    'category.landmark': '共享点位',
    'category.stronghold': '野外据点',
    'category.fieldBoss': '野外BOSS',
    'category.scaleMerchant': '山羊事件商人',
    'category.merchant': '商人',
  },

  'en': {
    // App metadata
    'app.title': 'Nightreign - Map Seed Recognizer',
    'app.version': 'Version 2.0.0',
    'app.subtitle': 'Nightreign Version 1.01.3 (Localized)',
    'app.description': 'Interactive tool to identify Nightreign map seeds based on point-of-interest locations',
    'app.keywords': 'Elden Ring, Nightreign, map, seed, recognizer, POI, tool',
    
    // Language toggle
    'lang.current': '中文',  // 按钮显示「切换目标语言」母语名：英文界面→中文，点击切中文
    'lang.switch': 'Switch Language',
    
    // Navigation
    'nav.advanced': 'Map Missing MODE',
    
    // Loading
    'loading.init': 'Initializing map data, please wait...',
    'loading.seeds': 'Loaded {count} seeds',
    'loading.classified': 'Loaded {count} seeds (320 base + 200 DLC)',
    
    // Seed display
    'seed.alt_text': 'Seed {seed}',
    'seed.number': 'Seed {seed}',
    'seed.nightlord': 'Nightlord {nightlord}',
    
    // Nightlords
    'nightlord.none': 'None',
    'nightlord.gladius': 'Gladius',
    'nightlord.adel': 'Adel',
    'nightlord.gnoster': 'Gnoster',
    'nightlord.maris': 'Maris',
    'nightlord.libra': 'Libra',
    'nightlord.fulghor': 'Fulghor',
    'nightlord.caligo': 'Caligo',
    'nightlord.heolstor': 'Heolstor',
    'nightlord.harmonia': 'Harmonia',
    'nightlord.straghess': 'Straghess',
    'nightlord.unknown': 'Unknown Nightlord',
    
    // Maps
    'map.none': 'None',
    'map.default': 'Default',
    'map.mountaintop': 'Mountaintop',
    'map.crater': 'Crater',
    'map.rotted_woods': 'Rotted Woods',
    'map.noklateo': 'Noklateo',
    'map.great_hollow': 'Great Hollow',
    'selection.nightlord': 'Select Your Nightlord',
    'selection.map': 'Terrain',
    'selection.current': 'Current Selection: ',
    
    // Actions
    'action.reset': 'Reset All Markers',
    'action.help': 'Help & Tips',
    'action.skip_spawn': 'Skip Spawn Point',
    'action.close': 'Close',
    
    // Results
    'results.matched': 'Matched Maps: ',
    'results.matched_short': 'Matched: ',
    'results.nightlord': 'Nightlord: ',
    'results.seed_number': 'Seed No.: ',
    'results.seed': 'Map Seed: ',
    'results.no_seeds': 'No seeds found<br>Please reset the map',
    
    // Map interaction
    'map.select_terrain': 'Please select special terrain',
    'map.select_terrain_hint': 'Select parameters to start seed detection',
    'map.click_dots': 'Click orange dots to mark POI locations',
    'map.spawn_hint': 'Select your spawn point (blue triangle) first, then mark landmarks',
    'map.select_parameters': 'Select Nightlord and Map above for accurate seed detection',
    
    // POI types
    'poi.church': 'Church',
    'poi.mage': 'Mage Tower',
    'poi.village': 'Village',
    'poi.empty': 'Empty',
    'poi.carriage': 'Carriage',
    'gh.disambig.hint': 'Narrowed to 2 seeds — mark the purple A/B points below to distinguish',
    'gh.disambig.aLabel': 'Church-guarding Boss',
    'gh.disambig.bLabel': 'Ruin SW of POI2',
    'gh.disambig.blood': 'Blood Ruin',
    'gh.disambig.poison': 'Poison Ruin',
    'gh.disambig.clear': 'Clear',
    
    // Help modal
    'help.title': 'Help & Tips',
    'help.steps': 'Usage Steps',
    'help.step1': 'Select a <strong>Nightlord</strong> (optional)',
    'help.step2': 'Select <strong>Terrain</strong>',
    'help.step3': 'Select a <strong>Spawn Point</strong> (skippable)',
    'help.step4': 'Click POIs on the map:',
    'help.step4_pc': '<strong>PC</strong>: left-click to mark Church, right-click for other options',
    'help.step4_mobile': '<strong>Mobile</strong>: tap to mark Church, long-press for other options',
    'help.step4_clear': 'Click a marked point again to <strong>clear</strong> it',
    'help.step5': 'More marks narrow down seeds faster; when only one remains, full seed details and map image are shown',
    'help.poi_meaning': 'POI Icon Meaning',
    'help.poi_church': 'Church',
    'help.poi_tower': 'Mage Tower',
    'help.poi_merchant': 'Merchant (Special Merchant)',
    'help.poi_carriage': 'Carriage (With Stonesword Key)',
    'help.poi_hut': 'Shack (With Seals)',
    'help.poi_empty': 'Empty (no building here)',
    
    // Seed display
    'seed.click_large': 'Click image to view in new tab',
    'seed.click_mobile': 'Tap image to view large',
    
    // Footer
    'footer.opensource': 'Open Source Project',
    'footer.github': 'View Source on GitHub',
    'footer.gitee': 'View Source on Gitee',
    'footer.credits': 'Special Thanks:',
    'footer.credit1': 'for providing map data',
    'footer.credit2': 'for providing recognizer base code',
    'footer.credit3': 'for providing localized map seeds',

    // Boss reverse entry card
    'bossreverse.card_title': 'Nightlord Reverse',
    'bossreverse.card_desc': 'Based on Night 1 Boss, deduce the Nightlord',
    'bossreverse.card_enter': 'Open →',
    
    // Errors
    'error.load_failed': 'Failed to load data. Please refresh the page.',
    'error.select_map': 'Please select a map before marking POIs',

    // Category display names (Advanced mode POI categories)
    'category.landmark': 'Landmark',
    'category.stronghold': 'Stronghold',
    'category.fieldBoss': 'Field Boss',
    'category.scaleMerchant': 'Scale Merchant',
    'category.merchant': 'Merchant',
  }
};

// POI type 中文名→英文名映射（英文模式渲染时查表）
// 来源：NAME.xlsx（74）+ 手补法师塔/破败小屋/野外商人（3）。共 77 项
const POI_TYPE_EN = {
  '亚人女王': "Demi-Human Queen",  // fieldBoss
  '亚兹拉兽人': "Beastmen of Farum Azula",  // stronghold
  '仿生泪滴': "Mimic Tears",  // stronghold
  '冻霜螯虾': "Frost Crayfish",  // stronghold
  '卢恩熊': "Runebear",  // stronghold
  '厄兆之子': "Omen",  // fieldBoss
  '厄兆猎人': "Omenkiller",  // fieldBoss/stronghold
  '咒剑士': "Curseblade",  // fieldBoss
  '咒剑士+蜘蛛蝎': "Curseblade+Spider Scorpions",  // stronghold
  '唤灵蜗牛+灵火龙': "Spiritcaller Snail+Ghostflame Dragon",  // stronghold
  '土龙': "Magma Wyrm",  // fieldBoss
  '堕落调香师': "Depraved Perfumer",  // stronghold
  '大审判官': "Inquisitor+Elder Inquisitor",  // stronghold
  '大树守卫': "Tree Sentinel",  // fieldBoss
  '失乡': "Banished Knights",  // fieldBoss
  '失乡骑士': "Banished Knights",  // stronghold
  '守墓斗士': "Grave Warden Duelists",  // stronghold
  '尊腐骑士': "Cleanrot Knights",  // stronghold
  '巨蟹': "Giant Crabs",  // stronghold
  '巨鸦+血怪之首': "Bloodbane Giant Crows+Chief Bloodfiend",  // stronghold
  '归树看门犬': "Erdtree Burial Watchdogs",  // stronghold
  '恶兆之子': "Omen",  // stronghold
  '战斗法师': "Battlemages",  // stronghold
  '持秤商人': "Scale-Bearing Merchant",  // scaleMerchant
  '接肢贵族': "Grafted Scion",  // fieldBoss
  '教堂': "Church",  // landmark
  '杜鹃骑士': "Cuckoo Knights",  // stronghold
  '死骑士': "Death Knight",  // stronghold
  '死鸟': "Death Rite Bird",  // fieldBoss
  '河马': "Golden Hippopotamus",  // fieldBoss
  '法师塔': "Sorcerer's Rise",  // landmark（手补）
  '火焰修士': "Fire Monk",  // stronghold
  '火焰战车': "Flame Chariots",  // stronghold
  '灵庙骑士': "Mausoleum Knight",  // stronghold
  '特殊商人': "Township",  // landmark
  '狮子混种': "Leonine Misbegotten",  // fieldBoss/stronghold
  '猎犬骑士': "Bloodhound Knight",  // fieldBoss
  '王室幽魂': "Royal Revenant",  // fieldBoss
  '癫火山妖': "Frenzied Flame Troll",  // stronghold
  '癫火花': "Nomads",  // stronghold
  '白金之子': "Albinaurics",  // stronghold
  '白金射手': "Albinauric Archers",  // stronghold
  '破败小屋': "Shack",  // landmark（手补）
  '祖灵': "Ancestor Spirit",  // fieldBoss
  '祖灵之民': "Ancestral Follower Warriors",  // stronghold
  '神皮使徒': "Godskin Apostle",  // evergaol/nightBoss（stronghold 50113 已纠正为黑焰修士）
  '黑焰修士': "Blackflame Monk",  // stronghold（锻造村 50113，原误录为神皮使徒）
  '神谕使者': "Oracle Envoys",  // stronghold
  '神鸟战士': "Divine Bird Warrior",  // stronghold
  '米兰达花': "Miranda Blossom",  // fieldBoss
  '紫怪之首+双熔炉': "Chief Purple Fiend+Crucible Knights",  // stronghold
  '红狮子骑士': "Redmane Knights",  // stronghold
  '红狼': "Red Wolf",  // fieldBoss
  '红狼+先祖之灵': "Red Wolf+Ancestor Spirit",  // stronghold
  '结晶人': "Crystalians",  // stronghold
  '罗德尔骑士': "Royal Army Knights",  // stronghold
  '罗蕾塔': "Royal Carian Knight",  // fieldBoss
  '老狮子': "Elder Lion",  // fieldBoss/stronghold
  '腐败树灵': "Ulcerated Tree Spirit",  // fieldBoss
  '腐败眷属': "Kindred of Rot",  // stronghold
  '萨米尔': "Ancient Hero of Zamor",  // fieldBoss/stronghold
  '蚯蚓脸': "Wormface",  // stronghold
  '蜘蛛蝎': "Spider Scorpions",  // stronghold
  '血怪之首': "Chief Bloodfiend",  // stronghold
  '调香师': "Perfumer",  // stronghold
  '野外商人': "Township",  // merchant（手补）
  '铁处女': "Abductor Virgin",  // stronghold
  '铃珠猎人': "Bell Bearing Hunter",  // fieldBoss
  '飞龙': "Flying Dragon",  // fieldBoss
  '马车': "Abandoned Carriage",  // landmark
  '骑士兵长': "Lordsworn Captain",  // stronghold
  '魔像(弓)': "Golem (Greatbow)",  // stronghold（要塞 30300）
  '魔像(戟)': "Golem (Halberd)",  // stronghold（大教堂 38001）
  '鲜血贵族': "Sanguine Noble",  // stronghold（大型遗迹 34001）
  '鲜血贵族们': "Sanguine Nobles",  // stronghold（池沼 50060，DLC）
  '黄金树化身': "Erdtree Avatar",  // fieldBoss
  '黑刀刺客': "Black Knife Assassin",  // fieldBoss
  '黑剑眷属': "Black Blade Kindred",  // fieldBoss
  '黑夜骑兵': "Night's Cavalry Duo",  // fieldBoss
  '龙装': "Draconic Tree Sentinel",  // fieldBoss
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = translations;
}
