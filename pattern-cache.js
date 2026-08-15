// 种子结果图（assets/pattern/）按需下载 + IndexedDB 本地缓存。
// 安卓 App 内不打包 pattern 图片（zh/en 共 1040 张约 641M），首次识别到种子时
// 从线上源下载对应图片并持久化，之后离线可秒出；Web 版走同源相对路径，同样入缓存。
// 线上主源无 CORS 头，App（Capacitor）环境改用 CapacitorHttp 原生请求绕开跨域限制。
const PatternCache = (() => {
    const DB_NAME = 'nightreign-patterns';
    const DB_VERSION = 1;
    const STORE = 'images';   // key: `${lang}/${seedStr}.jpg`，value: Blob

    // App 环境的远程源：NAS 稳定站国内快（主源），GitHub Pages 兜底（备源，国内可能不稳）
    const REMOTE_BASES = [
        'https://dsm.lixiangzj.xyz:7443/assets/pattern',
        'https://tonyliqx.github.io/nightreign-mapseed-recogniser/assets/pattern',
    ];

    let dbPromise = null;
    let currentBlobUrl = null;       // 页面同一时刻只显示一张种子图，保留最新一个 blob URL
    const pendingDownloads = {};     // 去重并发请求：key -> Promise<Blob>

    function isNative() {
        return typeof window !== 'undefined'
            && !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE)) {
                    req.result.createObjectStore(STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    function txGet(key) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
            r.onsuccess = () => resolve(r.result || null);
            r.onerror = () => reject(r.error);
        }));
    }

    function txPut(key, blob) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, key);
            r.onsuccess = () => resolve();
            r.onerror = () => reject(r.error);
        }));
    }

    // CapacitorHttp 经 JS bridge 传输二进制，不同版本可能返回 Blob / base64 字符串 /
    // {base64Data} / ArrayBuffer，统一归一化为 Blob。
    function normalizeBlob(data, type) {
        if (data instanceof Blob) return data;
        if (data instanceof ArrayBuffer) return new Blob([data], { type: type || 'image/jpeg' });
        if (data && typeof data === 'object' && data.base64Data) data = data.base64Data;
        if (typeof data === 'string') {
            const bin = atob(data);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new Blob([bytes], { type: type || 'image/jpeg' });
        }
        return new Blob([data], { type: type || 'image/jpeg' });
    }

    function downloadOnce(lang, seedStr) {
        const key = `${lang}/${seedStr}.jpg`;
        if (pendingDownloads[key]) return pendingDownloads[key];
        pendingDownloads[key] = (async () => {
            try {
                if (isNative()) {
                    let lastErr = null;
                    for (const base of REMOTE_BASES) {
                        try {
                            const res = await window.CapacitorHttp.get({
                                url: `${base}/${lang}/${seedStr}.jpg`,
                                responseType: 'blob',
                            });
                            if (res && res.data) return normalizeBlob(res.data);
                            lastErr = new Error('empty response');
                        } catch (e) {
                            lastErr = e;  // 换下一个源重试
                        }
                    }
                    throw lastErr || new Error('all sources failed');
                }
                // 浏览器：站点与 pattern 图同源，直接 fetch 相对路径
                const res = await fetch(`assets/pattern/${lang}/${seedStr}.jpg`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return await res.blob();
            } finally {
                delete pendingDownloads[key];
            }
        })();
        return pendingDownloads[key];
    }

    // 取种子图展示地址：命中缓存或下载成功返回 blob URL；均失败抛错（调用方走直载兜底）
    async function getUrl(lang, seedStr) {
        const key = `${lang}/${seedStr}.jpg`;
        let blob = await txGet(key).catch(() => null);
        if (!blob) {
            blob = await downloadOnce(lang, seedStr);
            txPut(key, blob).catch(() => {});   // 入库失败不影响本次展示
        }
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = URL.createObjectURL(blob);
        return currentBlobUrl;
    }

    // 兜底直载地址：缓存与下载均失败时给 <img src> 用（img 标签加载不受 CORS 限制）
    function getFallbackUrl(lang, seedStr) {
        if (isNative()) return `${REMOTE_BASES[0]}/${lang}/${seedStr}.jpg`;
        return `assets/pattern/${lang}/${seedStr}.jpg`;
    }

    // 缓存统计：{ count, bytes }
    async function stats() {
        return openDB().then(db => new Promise((resolve, reject) => {
            const r = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
            let count = 0, bytes = 0;
            r.onsuccess = () => {
                const cursor = r.result;
                if (cursor) {
                    count++;
                    bytes += (cursor.value && cursor.value.size) || 0;
                    cursor.continue();
                } else {
                    resolve({ count, bytes });
                }
            };
            r.onerror = () => reject(r.error);
        })).catch(() => ({ count: 0, bytes: 0 }));
    }

    async function clear() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const r = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
            r.onsuccess = () => resolve();
            r.onerror = () => reject(r.error);
        });
    }

    return { getUrl, getFallbackUrl, stats, clear, isNative };
})();
