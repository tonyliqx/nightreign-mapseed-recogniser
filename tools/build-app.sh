#!/bin/bash
# 打包安卓 App 的 Web 资源：白名单同步到 app-dist/（Capacitor webDir）。
# 排除 assets/pattern（641M，运行时按需下载，见 pattern-cache.js）、
# vendor（397M 原始素材）、tools/tests/Python 脚本等非运行时文件。
set -euo pipefail
cd "$(dirname "$0")/.."

DIST=app-dist
rm -rf "$DIST"
mkdir -p "$DIST"

# 根文件：入口页 + 样式 + 脚本 + PWA 元数据
rsync -a \
    index.html boss-reverse.html favicon.ico manifest.json \
    styles.css script.js data.js pattern-cache.js \
    "$DIST/"

# i18n（boss-reverse.html 也引用 translations.js）
rsync -a i18n/ "$DIST/i18n/"

# 数据：运行时仅 fetch 这两个 JSON（script.js / boss-reverse.html）
mkdir -p "$DIST/dataset"
rsync -a dataset/nightreignMapPatterns.json dataset/boss_data.json "$DIST/dataset/"

# 图标与地图底图
rsync -a assets/icons/ "$DIST/assets/icons/"
rsync -a assets/map/ "$DIST/assets/map/"
mkdir -p "$DIST/assets/images"
# Default.png（8M）运行时无引用，排除
rsync -a --exclude='Default.png' assets/images/ "$DIST/assets/images/"

# Font Awesome：仅 CSS + 实际用到的 solid/brands woff2（far/v4compat 未使用）
mkdir -p "$DIST/assets/font-awesome/css" "$DIST/assets/font-awesome/webfonts"
rsync -a assets/font-awesome/css/all.min.css assets/font-awesome/css/fontawesome.min.css \
    "$DIST/assets/font-awesome/css/" 2>/dev/null || \
    rsync -a assets/font-awesome/css/*.css "$DIST/assets/font-awesome/css/"
rsync -a assets/font-awesome/webfonts/fa-solid-900.woff2 \
         assets/font-awesome/webfonts/fa-brands-400.woff2 \
    "$DIST/assets/font-awesome/webfonts/"

echo "== app-dist 构建完成 =="
du -sh "$DIST"
