# 安卓 App（黑环识图器）打包与发布指南

本项目通过 [Capacitor](https://capacitorjs.com/) 将现有纯前端 Web 应用打包为安卓 APK，在
gitee Releases 分发。种子结果图（`assets/pattern/`，zh/en 共 1040 张约 641M）**不打包进 APK**，
首次识别到种子时按需从线上下载并缓存到 IndexedDB（见 `pattern-cache.js`）。

- appId：`com.lixiangzj.heihuan`（**发布后不可修改**，改了就无法覆盖安装升级）
- appName：黑环识图器
- 下载源：NAS 稳定站 `https://dsm.lixiangzj.xyz:7443/assets/pattern`（主）→
  GitHub Pages（备）。App 内用 CapacitorHttp 原生请求下载，**不受源站无 CORS 头影响**。

## 一、一次性环境搭建（已在本机完成，留档备用）

```bash
# JDK 17（Android Gradle Plugin 8.x 要求）
brew install --cask temurin@17        # pkg 安装器需要交互输密码

# Android 命令行工具（不需要 Android Studio）
brew install --cask android-commandlinetools
export ANDROID_HOME=/usr/local/share/android-commandlinetools
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

Gradle 无需单独安装（`android/gradlew` wrapper 自动下载）。

## 二、日常构建发布流程

```bash
# 1. 升级版本号（三处保持一致）：
#    - index.html 里 styles.css?v=X.Y.Z（页脚版本号自动跟随）
#    - android/app/build.gradle 里 versionName "X.Y.Z" 与 versionCode（每次 +1）
#    - package.json 的 version（可选，仅元数据）

# 2. 同步 Web 资源到 app-dist/ 并拷入安卓工程
npm run app:sync

# 3. 构建 release APK（签名读取 android-signing/keystore.properties）
cd android && ./gradlew assembleRelease

# 产物：android/app/build/outputs/apk/release/app-release.apk
```

一步到位：`npm run app:build`。

## 三、上传 gitee Release

1. 打开 <https://gitee.com/lixiangzj/nightreign-mapseed-recogniser-master/releases/new>
2. 标签：`android-v<版本号>`（如 `android-v2.4.18`），目标分支 master
3. 标题：`黑环识图器 v<版本号>`，正文注明更新内容
4. 附件上传 `app-release.apk`（约 30M，低于 gitee 100M 单文件上限）
5. 发布后把 Release 链接更新到 README 的下载章节

## 四、签名密钥（重要）

- keystore 位置：`android-signing/heihuan-release.keystore`（已 gitignore，**不进仓库**）
- 密码：`android-signing/keystore.properties`（同上，不进仓库）
- **⚠️ keystore 与密码一旦丢失，已发布 App 将无法覆盖升级，只能换包名重新发布。
  请立即把这两个文件备份到安全位置（密码管理器 / 私有网盘）。**

重新生成 keystore（仅在前者彻底丢失、决定换签名时使用）：

```bash
mkdir -p android-signing && cd android-signing
keytool -genkeypair -v -keystore heihuan-release.keystore -alias heihuan \
    -keyalg RSA -keysize 2048 -validity 36500 \
    -dname "CN=heihuan, OU=dev, O=lixiangzj, L=Hangzhou, ST=Zhejiang, C=CN"
# storepass/keypass 自己设，然后写入 keystore.properties（参考 build.gradle 读取的字段名）
```

## 五、真机调试

```bash
# 手机开启 USB 调试后：
adb install -r android/app/build/outputs/apk/release/app-release.apk
# 或开发期热调（连接 dev server）：
npx cap run android
```

验证要点（每次发版前）：
1. 选夜王/地形 → 标记 POI → 收敛到唯一种子 → 结果图正常下载显示（首次有加载骨架）
2. 杀进程 → 断网 → 重新识别同一颗种子 → 结果图秒出（IndexedDB 缓存命中）
3. 断网 + 清缓存后识别 → 出现"加载失败 + 重试"提示（点击图片放大 lightbox 正常关闭）
4. 帮助弹窗 → 图片缓存统计与清除
5. 夜王反推页（boss-reverse.html）正常

## 六、常见问题

| 问题 | 处理 |
| --- | --- |
| 构建报 `SDK location not found` | 确认 `android/local.properties` 里 `sdk.dir` 指向 commandlinetools 目录 |
| 结果图下载失败 | 检查 NAS 站点 `assets/pattern/<lang>/<seed>.jpg` 可访问；备源 GitHub Pages 国内可能不通 |
| 版本更新后页面没变 | WebView 缓存：`npx cap sync android` 后重新构建；或升级 index.html 里的 `?v=` 版本号 |
| 想改 App 名称/图标 | 名称：`capacitor.config.json` + `android/app/src/main/res/values/strings.xml`；图标：替换 `resources/icon.png` 后重跑 `npx @capacitor/assets generate --android --assetPath resources` |
