// Translation data for Advanced Page - Nightreign Map Seed Recognizer
const translations_advanced = {
  'zh': {
    // App metadata
    'app.title': '黑夜君临：地图种子识别器',
    'app.description': '交互工具：通过兴趣点位置识别艾尔登法环 黑夜君临 地图种子',
    'app.keywords': '艾尔登法环, 黑夜君临, 地图, 种子, 识别器, 兴趣点, 工具',
    
    // Language toggle
    'lang.current': '中文',
    
    // Navigation
    'nav.basic': '切换到基础模式',
    
    // Selection
    'selection.optional': '(可选)',
    'selection.any': '任意',
    'selection.nightlord': '选择你的夜王',
    'selection.map': '选择你的地图 / 特殊地形',

    // Spawn Point Selection
    'spawn.title': '选择出生点',
    'spawn.description': '点击出生点位置进行选择，然后选择敌人类型。',
    'spawn.map': '地图:',
    'spawn.nightlord': '夜王:',
    'spawn.seeds': '匹配种子:',
    'spawn.back': '返回',
    'spawn.skip': '跳过出生点选择',
    'spawn.help': '帮助',

    // Nightlords
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
    
    // Maps
    'map.default': '默认',
    'map.mountaintop': '山顶',
    'map.crater': '火山',
    'map.rotted_woods': '腐败森林',
    'map.noklateo': '隐城',
    'map.great_hollow': '大空洞',

    // Actions
    'actions.start': '开始识别',
    'actions.start_disabled': '选择地图类型以继续',
    'actions.back': '返回',
    'actions.clear_all': '清除所有POI',
    'actions.help': '帮助',
    'actions.new_search': '新搜索',
    'actions.back_to_recognition': '返回识别',
    'actions.open_new_tab': '在新标签页中打开',
    
    // UI Labels
    'ui.select_parameters': '选择参数',
    'ui.loading_map_data': '正在加载地图数据...',
    'ui.map': '地图:',
    'ui.nightlord': '夜王:',
    'ui.matching_seeds': '匹配种子:',
    'ui.seed_found': '找到种子！',
    'ui.seed_number': '种子编号:',
    'ui.map_type': '地图类型:',
    'ui.map_pattern': '地图模式',
    'ui.no_options_available': '没有可用选项',
    'ui.loading': '加载中...',
    
    // Context menu
    'context.clear_selection': '清除选择',
    'context.select_enemy': '选择敌人',
    'context.i_dont_know': '我不知道',
    'context.select_icon': '选择图标',
    'context.empty': '空',

    // POI category names（上下文菜单标题）
    'category.landmark': '共享点位',
    'category.stronghold': '野外据点',
    'category.fieldBoss': '野外BOSS',
    'category.scaleMerchant': '山羊事件商人',
    'category.merchant': '商人',

    // Help section translations
    'help.title': '帮助',
    'help.overview.title': '概述',
    'help.overview.description': '这个高级地图种子识别器通过标记兴趣点（POI）和生成点来帮助您识别确切的地图模式。该过程包括三个主要步骤：生成点选择、POI标记和结果识别。',
    'help.step1.title': '步骤1：选择夜王和地图类型',
    'help.step1.description': '选择您的夜王角色和您正在探索的地图类型。这个初始选择有助于缩小可能的种子模式范围。',
    'help.step2.title': '步骤2：标记出生点',
    'help.step2.description': '点击地图上的出生点圆点，然后从菜单中选择敌人类型。如果您不确定敌人类型，选择"我不知道"以仅使用坐标信息继续。',
    'help.step2.tip1': '出生点有助于显著缩小可能的种子范围',
    'help.step2.tip2': '如果只有一种敌人类型可能，将自动选择',
    'help.step2.tip3': '如果出生点选择后只剩一个种子，将直接跳转到结果',
    'help.step3.title': '步骤3：标记POI（兴趣点）',
    'help.step3.description': '左键点击POI圆点打开菜单，选择正确的结构类型和敌人。右键点击可清除当前POI。系统将根据您的选择自动过滤种子。',
    'help.step3.tip1': '双层POI：先选择结构类型，再选择敌人类型',
    'help.step3.tip2': '单层POI：直接选择敌人类型',
    'help.step3.tip3': '如果第2层只剩一个选项，将自动选择',
    'help.step3.tip4': '使用"清除选择"重置POI（如果出错）',
    'help.step4.title': '步骤4：查看结果',
    'help.step4.description': '一旦标记了足够的POI来识别唯一种子，结果屏幕将显示确切的地图模式，包括种子编号、夜王和地图类型详情。',
    'help.tips.title': '技巧和窍门',
    'help.tips.tip1': '从生成点选择开始以获得最大的种子过滤效果',
    'help.tips.tip2': '标记您地图上最独特或最特殊的POI',
    'help.tips.tip3': '如需要，使用"清除所有POI"按钮重新开始',
    'help.tips.tip4': '"返回"按钮将您带回选择屏幕',
    'help.tips.tip5': '使用语言按钮在英文和中文之间切换',
    'help.controls.title': '控制说明',
    'help.controls.click': '点击：从菜单中选择选项',
    'help.controls.right_click': '右键点击：清除当前POI',
    'help.controls.clear': '清除所有POI：重置所有POI选择',
    'help.controls.back': '返回：回到夜王/地图选择',
    
    // Enemy names (commonly used ones)
    'enemy.caravans_and_nobles': '商队和贵族',
    'enemy.caravans': '商队',
    'enemy.demi_humans': '亚人',
    'enemy.dogs_and_soldiers': '狗和士兵',
    'enemy.dogs': '狗',
    'enemy.foot_soldiers': '士兵',
    'enemy.guilty': '罪人',
    'enemy.misbegotten': '混种',
    'enemy.nobles_and_soldiers': '贵族和士兵',
    'enemy.rats_and_demi_humans': '老鼠和亚人',
    'enemy.rats': '老鼠',
    'enemy.shack': '小屋',
    'enemy.soldiers': '士兵',
    'enemy.wandering_nobles': '流浪贵族',
    
    // Structure names
    'structure.empty': '空白',
    'structure.camp': '营地',
    'structure.church': '教堂',
    'structure.difficult_sorcerers_rise': '古老魔法师塔',
    'structure.fort': '要塞',
    'structure.great_church': '大教堂',
    'structure.map_event': '地图事件',
    'structure.ruins': '废墟',
    'structure.small_camp': '小营地',
    'structure.sorcerers_rise': '魔法师塔',
    'structure.township': '城镇',
    
    // Boss names
    'boss.empty': '空白',
    'boss.tree_sentinel': '大树守卫',
    'boss.erdtree_avatar': '黄金树的化身',
    'boss.crucible_knight_with_sword': '熔炉骑士（剑）',
    'boss.crucible_knight_with_spear': '熔炉骑士（矛）',
    'boss.leonine_misbegotten': '狮子混种',
    'boss.grafted_scion': '“接肢”贵族后裔',
    'boss.red_wolf': '王夫的红狼',
    'boss.abductor_virgin': '掳人少女人偶（摆荡镰刀）',
    'boss.albinauric_archers': '白金之子射手',
    'boss.albinaurics': '白金之子',
    'boss.ancestor_spirit': '祖灵',
    'boss.ancient_dragon': '古龙',
    'boss.ancient_hero_of_zamor': '萨米尔的古英雄',
    'boss.ancient_heroes_of_zamor': '萨米尔的古英雄们',
    'boss.banished_knights': '失乡骑士们',
    'boss.battlefield_commander': '战场老将',
    'boss.battlemages': '战斗法师',
    'boss.beastly_brigade': '混种集团',
    'boss.beastmen_of_farum_azula': '法姆·亚兹拉的兽人们',
    'boss.bell_bearing_hunter': '铃珠猎人',
    'boss.black_blade_kindred': '黑剑眷属',
    'boss.black_knife_assassin': '黑刀刺客',
    'boss.bloodhound_knight': '猎犬骑士',
    'boss.centipede_demon': '百足恶魔',
    'boss.crucible_knight_and_golden_hippopotamus': '熔炉骑士与黄金河马',
    'boss.crystalians': '结晶人们',
    'boss.dancer_of_the_boreal_valley': '冷冽谷的舞娘',
    'boss.death_rite_bird': '死亡仪式鸟',
    'boss.demi_human_queen': '亚人女王',
    'boss.demi_human_queen_and_swordmaster': '亚人女王和剑圣',
    'boss.depraved_perfumer': '堕落调香师',
    'boss.draconic_tree_sentinel': '龙装大树守卫',
    'boss.draconic_tree_sentinel_and_royal_cavalrymen': '龙装大树守卫与王城骑兵',
    'boss.dragonkin_soldier': '龙人士兵',
    'boss.elder_lion': '老狮子',
    'boss.erdtree_burial_watchdogs': '归树看门犬',
    'boss.fallingstar_beast': '坠星兽物',
    'boss.fire_monk': '火焰习武修士',
    'boss.flame_chariots': '火焰战车队',
    'boss.flying_dragon': '丘陵飞龙',
    'boss.frenzied_flame_troll': '癫火山妖',
    'boss.gaping_dragon': '贪食魔龙',
    'boss.godskin_apostle': '神皮使徒',
    'boss.godskin_duo': '双神皮',
    'boss.godskin_noble': '神皮贵族',
    'boss.golden_hippopotamus': '黄金河马',
    'boss.grafted_monarch': '“接肢”君王',
    'boss.grave_warden_duelist': '守墓斗士',
    'boss.great_wyrm': '大土龙',
    'boss.guardian_golem': '魔像守卫',
    'boss.lordsworn_captain': '骑士兵长',
    'boss.magma_wyrm': '熔岩土龙',
    'boss.mausoleum_knight': '灵庙骑士',
    'boss.miranda_blossom': '米兰达之花',
    'boss.morgott': '恶兆蒙葛特',
    'boss.nameless_king': '无名王者',
    'boss.night_s_cavalry': '黑夜骑兵',
    'boss.night_s_cavalry_duo': '双黑夜骑兵',
    'boss.nox_warriors': '诺克斯战士们',
    'boss.omen': '恶兆之子',
    'boss.oracle_envoys': '神谕众使者',
    'boss.outland_commander': '偏地老将',
    'boss.perfumer': '调香师',
    'boss.redmane_knights': '红狮子骑士们',
    'boss.royal_army_knights': '王城军骑士们',
    'boss.royal_carian_knight': '卡利亚禁卫骑士',
    'boss.royal_revenant': '王室幽魂',
    'boss.runebear': '卢恩熊',
    'boss.sanguine_noble': '鲜血贵族',
    'boss.smelter_demon': '熔铁恶魔',
    'boss.stoneskin_lords': '石肤众王',
    'boss.the_dukes_dear_freja': '公爵的夫雷迪亚',
    'boss.tibia_mariner': '提比亚的唤声船',
    'boss.tree_sentinel_and_royal_cavalrymen': '大树守卫与王城骑兵',
    'boss.ulcerated_tree_spirit': '腐败树灵',
    'boss.valiant_gargoyle': '英雄石像鬼',
    'boss.wormface': '蚯蚓脸'
  },
  
  'en': {
    // App metadata
    'app.title': 'Nightreign: Map Seed Recognizer',
    'app.description': 'Interactive tool: Identify Elden Ring Nightreign map seeds through POI locations',
    'app.keywords': 'Elden Ring, Nightreign, map, seed, recognizer, POI, tool',
    
    // Language toggle
    'lang.current': 'English',
    
    // Navigation
    'nav.basic': 'Switch to Basic Mode',
    
    // Selection
    'selection.optional': '(Optional)',
    'selection.any': 'Any',
    'selection.nightlord': 'Select your Nightlord',
    'selection.map': 'Select your Map / Special Terrain',

    // Spawn Point Selection
    'spawn.title': 'Select Spawn Point',
    'spawn.description': 'Click on a spawn point location to select it, then choose the enemy type.',
    'spawn.map': 'Map:',
    'spawn.nightlord': 'Nightlord:',
    'spawn.seeds': 'Matching Seeds:',
    'spawn.back': 'Back',
    'spawn.skip': 'Skip Spawn Selection',
    'spawn.help': 'Help',

    // Nightlords
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
    
    // Maps
    'map.default': 'Default',
    'map.mountaintop': 'Mountaintop',
    'map.crater': 'Crater',
    'map.rotted_woods': 'Rotted Woods',
    'map.noklateo': 'Noklateo',
    'map.great_hollow': 'Great Hollow',

    // Actions
    'actions.start': 'Start Recognition',
    'actions.start_disabled': 'Select Map Type to Continue',
    'actions.back': 'Back',
    'actions.clear_all': 'Clear All POIs',
    'actions.help': 'Help',
    'actions.new_search': 'New Search',
    'actions.back_to_recognition': 'Back to Recognition',
    'actions.open_new_tab': 'Open in New Tab',
    
    // UI Labels
    'ui.select_parameters': 'Select Parameters',
    'ui.loading_map_data': 'Loading map data...',
    'ui.map': 'Map:',
    'ui.nightlord': 'Nightlord:',
    'ui.matching_seeds': 'Matching Seeds:',
    'ui.seed_found': 'Seed Found!',
    'ui.seed_number': 'Seed Number:',
    'ui.map_type': 'Map Type:',
    'ui.map_pattern': 'Map Pattern',
    'ui.no_options_available': 'No options available',
    'ui.loading': 'Loading...',
    
    // Context menu
    'context.clear_selection': 'Clear Selection',
    'context.select_enemy': 'Select Enemy',
    'context.i_dont_know': 'I don\'t know',
    'context.select_icon': 'Select Icon',
    'context.empty': 'Empty',

    // POI category names (context menu headers)
    'category.landmark': 'Landmark',
    'category.stronghold': 'Outpost',
    'category.fieldBoss': 'Field Boss',
    'category.scaleMerchant': 'Scale-Bearing Merchant',
    'category.merchant': 'Merchant',
    
    // Help section translations
    'help.title': 'Help',
    'help.overview.title': 'Overview',
    'help.overview.description': 'This advanced map seed recognizer helps you identify the exact map pattern by marking Points of Interest (POIs) and spawn points. The process involves three main steps: spawn point selection, POI marking, and result identification.',
    'help.step1.title': 'Step 1: Select Nightlord & Map Type',
    'help.step1.description': 'Choose your nightlord character and the map type you\'re exploring. This initial selection helps narrow down the possible seed patterns.',
    'help.step2.title': 'Step 2: Mark Spawn Point',
    'help.step2.description': 'Click on the spawn point dot on the map, then select the enemy type from the context menu. If you\'re unsure about the enemy, select "I don\'t know" to proceed with just the coordinate information.',
    'help.step2.tip1': 'The spawn point helps significantly narrow down possible seeds',
    'help.step2.tip2': 'If only one enemy type is possible, it will be auto-selected',
    'help.step2.tip3': 'If only one seed remains after spawn selection, you\'ll go directly to results',
    'help.step3.title': 'Step 3: Mark POIs (Points of Interest)',
    'help.step3.description': 'Left-click on POI dots to open context menus and select the correct structure type and enemy. Right-click to clear the current POI. The system will automatically filter seeds based on your selections.',
    'help.step3.tip1': 'Two-layer POIs: Select structure type first, then enemy type',
    'help.step3.tip2': 'Single-layer POIs: Select enemy type directly',
    'help.step3.tip3': 'If only one option remains in layer 2, it will be auto-selected',
    'help.step3.tip4': 'Use "Clear Selection" to reset a POI if you made a mistake',
    'help.step4.title': 'Step 4: View Results',
    'help.step4.description': 'Once enough POIs are marked to identify a unique seed, the result screen will show the exact map pattern with seed number, nightlord, and map type details.',
    'help.tips.title': 'Tips & Tricks',
    'help.tips.tip1': 'Start with spawn point selection for maximum seed filtering',
    'help.tips.tip2': 'Mark POIs that are most distinctive or unique to your map',
    'help.tips.tip3': 'Use the "Clear All POIs" button to start over if needed',
    'help.tips.tip4': 'The "Back" button returns you to the selection screen',
    'help.tips.tip5': 'Toggle between English and Chinese using the language button',
    'help.controls.title': 'Controls',
    'help.controls.click': 'Click: Select options from context menus',
    'help.controls.right_click': 'Right-click: Clear current POI',
    'help.controls.clear': 'Clear All POIs: Reset all POI selections',
    'help.controls.back': 'Back: Return to nightlord/map selection',
    
    // Enemy names (commonly used ones)
    'enemy.caravans_and_nobles': 'Caravans and Nobles',
    'enemy.caravans': 'Caravans',
    'enemy.demi_humans': 'Demi-Humans',
    'enemy.dogs_and_soldiers': 'Dogs and Soldiers',
    'enemy.dogs': 'Dogs',
    'enemy.foot_soldiers': 'Foot Soldiers',
    'enemy.guilty': 'Guilty',
    'enemy.misbegotten': 'Misbegotten',
    'enemy.nobles_and_soldiers': 'Nobles and Soldiers',
    'enemy.rats_and_demi_humans': 'Rats and Demi-Humans',
    'enemy.rats': 'Rats',
    'enemy.shack': 'Shack',
    'enemy.soldiers': 'Soldiers',
    'enemy.wandering_nobles': 'Wandering Nobles',
    
    // Structure names
    'structure.empty': 'Empty',
    'structure.camp': 'Camp',
    'structure.church': 'Church',
    'structure.difficult_sorcerers_rise': 'Difficult Sorcerer\'s Rise',
    'structure.fort': 'Fort',
    'structure.great_church': 'Great Church',
    'structure.map_event': 'Map Event',
    'structure.ruins': 'Ruins',
    'structure.small_camp': 'Small Camp',
    'structure.sorcerers_rise': 'Sorcerer\'s Rise',
    'structure.township': 'Township',
    
    // Boss names (commonly used ones)
    'boss.empty': 'Empty',
    'boss.tree_sentinel': 'Tree Sentinel',
    'boss.erdtree_avatar': 'Erdtree Avatar',
    'boss.crucible_knight_with_sword': 'Crucible Knight with Sword',
    'boss.crucible_knight_with_spear': 'Crucible Knight with Spear',
    'boss.leonine_misbegotten': 'Leonine Misbegotten',
    'boss.grafted_scion': 'Grafted Scion',
    'boss.red_wolf': 'Red Wolf',
    'boss.abductor_virgin': 'Abductor Virgin',
    'boss.albinauric_archers': 'Albinauric Archers',
    'boss.albinaurics': 'Albinaurics',
    'boss.ancestor_spirit': 'Ancestor Spirit',
    'boss.ancient_dragon': 'Ancient Dragon',
    'boss.ancient_hero_of_zamor': 'Ancient Hero of Zamor',
    'boss.ancient_heroes_of_zamor': 'Ancient Heroes of Zamor',
    'boss.banished_knights': 'Banished Knights',
    'boss.battlefield_commander': 'Battlefield Commander',
    'boss.battlemages': 'Battlemages',
    'boss.beastly_brigade': 'Beastly Brigade',
    'boss.beastmen_of_farum_azula': 'Beastmen of Farum Azula',
    'boss.bell_bearing_hunter': 'Bell Bearing Hunter',
    'boss.black_blade_kindred': 'Black Blade Kindred',
    'boss.black_knife_assassin': 'Black Knife Assassin',
    'boss.bloodhound_knight': 'Bloodhound Knight',
    'boss.centipede_demon': 'Centipede Demon',
    'boss.crucible_knight_and_golden_hippopotamus': 'Crucible Knight and Golden Hippopotamus',
    'boss.crystalians': 'Crystalians',
    'boss.dancer_of_the_boreal_valley': 'Dancer of the Boreal Valley',
    'boss.death_rite_bird': 'Death Rite Bird',
    'boss.demi_human_queen': 'Demi-Human Queen',
    'boss.demi_human_queen_and_swordmaster': 'Demi-Human Queen and Swordmaster',
    'boss.depraved_perfumer': 'Depraved Perfumer',
    'boss.draconic_tree_sentinel': 'Draconic Tree Sentinel',
    'boss.draconic_tree_sentinel_and_royal_cavalrymen': 'Draconic Tree Sentinel and Royal Cavalrymen',
    'boss.dragonkin_soldier': 'Dragonkin Soldier',
    'boss.elder_lion': 'Elder Lion',
    'boss.erdtree_burial_watchdogs': 'Erdtree Burial Watchdogs',
    'boss.fallingstar_beast': 'Fallingstar Beast',
    'boss.fire_monk': 'Fire Monk',
    'boss.flame_chariots': 'Flame Chariots',
    'boss.flying_dragon': 'Flying Dragon',
    'boss.frenzied_flame_troll': 'Frenzied Flame Troll',
    'boss.gaping_dragon': 'Gaping Dragon',
    'boss.godskin_apostle': 'Godskin Apostle',
    'boss.godskin_duo': 'Godskin Duo',
    'boss.godskin_noble': 'Godskin Noble',
    'boss.golden_hippopotamus': 'Golden Hippopotamus',
    'boss.grafted_monarch': 'Grafted Monarch',
    'boss.grave_warden_duelist': 'Grave Warden Duelist',
    'boss.great_wyrm': 'Great Wyrm',
    'boss.guardian_golem': 'Guardian Golem',
    'boss.lordsworn_captain': 'Lordsworn Captain',
    'boss.magma_wyrm': 'Magma Wyrm',
    'boss.mausoleum_knight': 'Mausoleum Knight',
    'boss.miranda_blossom': 'Miranda Blossom',
    'boss.morgott': 'Morgott',
    'boss.nameless_king': 'Nameless King',
    'boss.night_s_cavalry': 'Night\'s Cavalry',
    'boss.night_s_cavalry_duo': 'Night\'s Cavalry Duo',
    'boss.nox_warriors': 'Nox Warriors',
    'boss.omen': 'Omen',
    'boss.oracle_envoys': 'Oracle Envoys',
    'boss.outland_commander': 'Outland Commander',
    'boss.perfumer': 'Perfumer',
    'boss.redmane_knights': 'Redmane Knights',
    'boss.royal_army_knights': 'Royal Army Knights',
    'boss.royal_carian_knight': 'Royal Carian Knight',
    'boss.royal_revenant': 'Royal Revenant',
    'boss.runebear': 'Runebear',
    'boss.sanguine_noble': 'Sanguine Noble',
    'boss.smelter_demon': 'Smelter Demon',
    'boss.stoneskin_lords': 'Stoneskin Lords',
    'boss.the_dukes_dear_freja': 'The Duke\'s Dear Freja',
    'boss.tibia_mariner': 'Tibia Mariner',
    'boss.tree_sentinel_and_royal_cavalrymen': 'Tree Sentinel and Royal Cavalrymen',
    'boss.ulcerated_tree_spirit': 'Ulcerated Tree Spirit',
    'boss.valiant_gargoyle': 'Valiant Gargoyle',
    'boss.wormface': 'Wormface'
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
  '神皮使徒': "Godskin Apostle",  // stronghold
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
  '魔像守卫': "Guardian Golem",  // stronghold
  '鲜血贵族': "Sanguine Nobles",  // stronghold
  '黄金树化身': "Erdtree Avatar",  // fieldBoss
  '黑刀刺客': "Black Knife Assassin",  // fieldBoss
  '黑剑眷属': "Black Blade Kindred",  // fieldBoss
  '黑夜骑兵': "Night's Cavalry Duo",  // fieldBoss
  '龙装': "Draconic Tree Sentinel",  // fieldBoss
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = translations_advanced;
}
