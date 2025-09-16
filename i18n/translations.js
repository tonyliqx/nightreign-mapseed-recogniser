// Translation data for Nightreign Map Seed Recognizer
const translations = {
  'zh': {
    // App metadata
    'app.title': '艾尔登法环 黑夜君临：地图种子识别器',
    'app.version': '版本 1.1',
    'app.subtitle': '黑夜君临 版本 1.01.3（汉化）',
    'app.description': '交互工具：通过兴趣点位置识别艾尔登法环 黑夜君临 地图种子',
    'app.keywords': '艾尔登法环, 黑夜君临, 地图, 种子, 识别器, 兴趣点, 工具',
    
    // Language toggle
    'lang.current': '中文',
    'lang.switch': '切换语言',
    
    // Navigation
    'nav.advanced': '地图缺失模式',
    
    // Loading
    'loading.init': '正在初始化地图数据，请稍候...',
    'loading.seeds': '已加载 {count} 个种子',
    'loading.classified': '已加载 {count} 个种子（{classified} 个已分类）',
    
    // Seed display
    'seed.alt_text': '种子 {seed}',
    'seed.number': '种子 {seed}',
    'seed.nightlord': '夜王 {nightlord}',
    
    // Nightlords
    'nightlord.none': '无',
    'nightlord.gladius': '三狼',
    'nightlord.adel': '大嘴',
    'nightlord.gnoster': '慧心虫',
    'nightlord.maris': '水皮蛋',
    'nightlord.libra': '山羊',
    'nightlord.fulghor': '人马',
    'nightlord.caligo': '冰龙',
    'nightlord.heolstor': '黑夜王',
    'nightlord.unknown': '未知夜王',
    
    // Maps
    'map.none': '无',
    'map.default': '默认',
    'map.mountaintop': '山顶',
    'map.crater': '火山',
    'map.rotted_woods': '腐败森林',
    'map.noklateo': '隐城',
    
    // Selection
    'selection.nightlord': '选择你的夜王',
    'selection.map': '选择你的地图 / 特殊地形',
    'selection.current': '当前选择：',
    
    // Actions
    'action.reset': '重置所有标记',
    'action.help': '帮助与提示',
    'action.close': '关闭',
    
    // Results
    'results.matched': '已匹配地图: ',
    'results.nightlord': '夜王: ',
    'results.seed': '地图种子: ',
    'results.no_seeds': '未找到种子<br>请重置地图',
    
    // Map interaction
    'map.select_terrain': '请选择特殊地形',
    'map.select_terrain_hint': '选择参数后开始识别地图种子',
    'map.click_dots': '点击橙色圆点标记兴趣点位置',
    'map.select_parameters': '选择夜王和地图上方进行准确的种子检测',
    
    // POI types
    'poi.church': '教堂',
    'poi.mage': '法师塔',
    'poi.village': '村庄',
    'poi.empty': '空白',
    'poi.other': '其他',
    
    // Help modal
    'help.title': '帮助与提示',
    'help.usage': '使用方法',
    'help.usage_desc': '通过对比地图上的教堂和法师塔位置，识别器会帮助你识别 黑夜君临 地图种子。',
    'help.steps': '使用步骤',
    'help.step1': '从列表中选择<strong>夜王</strong>（非必选）',
    'help.step2': '选择<strong>地图/特殊地形</strong>类型',
    'help.step3': '查看地图上高亮的橙色圆点 —— 这些是可能标注的兴趣点位置',
    'help.step4': '点击橙色圆点，标记你在游戏中看到的内容：',
    'help.step4_left': '<strong>左键点击/屏幕轻触</strong> = 教堂',
    'help.step4_right': '<strong>右键点击/屏幕长按</strong> = 选择法师塔或其他兴趣点',
    'help.step4_clear': '<strong>再次点击</strong>已标记的标点，可以取消标记',
    'help.step5': '随着标记增加，可能的种子会被逐步筛选',
    'help.step6': '当仅剩一个结果时，会显示最终完整的种子详情和地图图像',
    'help.tips': '提示',
    'help.tip1': '尽量多标记你在游戏中能确认的兴趣点',
    'help.tip2': '使用右键菜单或者长按选择法师塔、村庄或其他兴趣点',
    'help.tip3': '如果没有结果，请重置，并重新标注兴趣点，请确保兴趣点标注准确',
    'help.tip4': '最终种子会显示详细布局，以便核对',
    'help.tip5': '在标记兴趣点前请选择夜王（非必选）和特殊地形',
    
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
    
    // Errors
    'error.load_failed': '数据加载失败，请刷新页面。',
    'error.select_map': '请先选择地图再标记兴趣点',
  },
  
  'en': {
    // App metadata
    'app.title': 'Elden Ring: Nightreign Map Seed Recognizer',
    'app.version': 'Version 1.1',
    'app.subtitle': 'Nightreign Version 1.01.3 (Localized)',
    'app.description': 'Interactive tool to identify Nightreign map seeds based on point-of-interest locations',
    'app.keywords': 'Elden Ring, Nightreign, map, seed, recognizer, POI, tool',
    
    // Language toggle
    'lang.current': 'English',
    'lang.switch': 'Switch Language',
    
    // Navigation
    'nav.advanced': 'Advanced Mode',
    
    // Loading
    'loading.init': 'Initializing map data, please wait...',
    'loading.seeds': 'Loaded {count} seeds',
    'loading.classified': 'Loaded {count} seeds ({classified} classified)',
    
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
    'nightlord.unknown': 'Unknown Nightlord',
    
    // Maps
    'map.none': 'None',
    'map.default': 'Default',
    'map.mountaintop': 'Mountaintop',
    'map.crater': 'Crater',
    'map.rotted_woods': 'Rotted Woods',
    'map.noklateo': 'Noklateo',
    
    // Selection
    'selection.nightlord': 'Select Your Nightlord',
    'selection.map': 'Select Your Map / Special Terrain',
    'selection.current': 'Current Selection: ',
    
    // Actions
    'action.reset': 'Reset All Markers',
    'action.help': 'Help & Tips',
    'action.close': 'Close',
    
    // Results
    'results.matched': 'Matched Maps: ',
    'results.nightlord': 'Nightlord: ',
    'results.seed': 'Map Seed: ',
    'results.no_seeds': 'No seeds found<br>Please reset the map',
    
    // Map interaction
    'map.select_terrain': 'Please select special terrain',
    'map.select_terrain_hint': 'Select parameters to start seed detection',
    'map.click_dots': 'Click orange dots to mark POI locations',
    'map.select_parameters': 'Select Nightlord and Map above for accurate seed detection',
    
    // POI types
    'poi.church': 'Church',
    'poi.mage': 'Mage Tower',
    'poi.village': 'Village',
    'poi.empty': 'Empty',
    'poi.other': 'Other',
    
    // Help modal
    'help.title': 'Help & Tips',
    'help.usage': 'How to Use',
    'help.usage_desc': 'By comparing church and mage tower positions on the map, the recognizer will help you identify Nightreign map seeds.',
    'help.steps': 'Usage Steps',
    'help.step1': 'Select a <strong>Nightlord</strong> from the list (optional)',
    'help.step2': 'Select <strong>Map/Special Terrain</strong> type',
    'help.step3': 'Look at the highlighted orange dots on the map — these are possible POI locations to mark',
    'help.step4': 'Click orange dots to mark what you see in the game:',
    'help.step4_left': '<strong>Left click/Tap</strong> = Church',
    'help.step4_right': '<strong>Right click/Long press</strong> = Select mage tower or other POI',
    'help.step4_clear': '<strong>Click again</strong> on marked points to clear them',
    'help.step5': 'As you mark more points, possible seeds will be filtered down',
    'help.step6': 'When only one result remains, the final complete seed details and map image will be shown',
    'help.tips': 'Tips',
    'help.tip1': 'Mark as many POIs as you can confirm in the game',
    'help.tip2': 'Use right-click menu or long press to select mage towers, villages, or other POIs',
    'help.tip3': 'If no results, please reset and re-mark POIs, ensuring accurate POI marking',
    'help.tip4': 'Final seeds will show detailed layouts for verification',
    'help.tip5': 'Please select Nightlord (optional) and special terrain before marking POIs',
    
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
    
    // Errors
    'error.load_failed': 'Failed to load data. Please refresh the page.',
    'error.select_map': 'Please select a map before marking POIs',
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = translations;
}
