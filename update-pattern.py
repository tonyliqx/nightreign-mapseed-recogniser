#!/usr/bin/env python3
"""
更新 pattern 种子结果图（assets/pattern/{zh,en}）。

重新生成地图后，把新源的 output/（中文）、output_en/（英文）拷贝进项目，
并把命名从源的 map_{ID}.jpg 改成项目所需的 {ID 补零3位}.jpg
（对应 script.js 的 mapSeed.toString().padStart(3,'0')）。只拷 .jpg，忽略同名 .png。

用法：
    python update-pattern.py [源根目录]
    # 源根目录默认 ~/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main
    # （地图源版本升级后，用参数传入新路径）
    # 源需含 output/ 和 output_en/ 两个子目录，里面是 map_{ID}.jpg

完整工作流（替换 → 提交 → 同步）：
    1. python update-pattern.py            # 本脚本：拷贝+重命名+校验
    2. git add assets/pattern/ && git commit -m 'chore(assets): 更新 pattern 种子图'
       # post-commit 钩子自动同步 NAS dev 镜像（见 .git/hooks/post-commit）
    3. 同步 prod（见脚本末尾输出的命令）

pattern 是 git 跟踪的大二进制（~1040 张），commit 只记 md5 变化的文件，
历史增量通常远小于工作区体积；不推 Gitee（超 500MB），靠 NAS 镜像。
"""
import os
import sys
import shutil
import subprocess

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SRC = os.path.expanduser(
    "~/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main")

# 源子目录 → 项目语言目录
LANG_MAP = {"output": "zh", "output_en": "en"}


def norm_id(raw):
    """'1' → '001'；'319' → '319'；'1000' → '1000'（补零到 3 位，已≥3位不变）。"""
    return f"{int(raw):03d}"


def copy_lang(src_root, src_sub, lang):
    """拷贝一个语言目录：map_{ID}.jpg → {补零ID}.jpg。"""
    src_dir = os.path.join(src_root, src_sub)
    dst_dir = os.path.join(PROJECT_ROOT, "assets", "pattern", lang)
    if not os.path.isdir(src_dir):
        print(f"  ⚠️ {lang}：缺少源 {src_dir}，跳过")
        return
    src = {}
    for name in os.listdir(src_dir):
        if not (name.startswith("map_") and name.endswith(".jpg")):
            continue  # 跳过 .png 及非 map_ 前缀
        raw = name[len("map_"):-len(".jpg")]
        if raw.isdigit():
            src[norm_id(raw)] = os.path.join(src_dir, name)
    if not src:
        print(f"  ⚠️ {lang}：{src_dir} 无 map_*.jpg，跳过")
        return
    # 检测目标里源已不存在的旧文件（种子被移除的情形）
    old = {n[:-4] for n in os.listdir(dst_dir)} if os.path.isdir(dst_dir) else set()
    gone = sorted(old - set(src))
    if gone:
        print(f"  ⚠️ {lang}：目标有 {len(gone)} 个源已无的旧文件残留：{gone[:8]}")
    for pid, sp in src.items():
        shutil.copy2(sp, os.path.join(dst_dir, f"{pid}.jpg"))
    print(f"  {lang}：拷贝 {len(src)} 张 → {dst_dir}")


def verify(lang):
    """校验编号落在本体(0-319)+DLC(1000-1199)，报告游离编号。"""
    dst_dir = os.path.join(PROJECT_ROOT, "assets", "pattern", lang)
    if not os.path.isdir(dst_dir):
        return
    ids = sorted(int(n[:-4]) for n in os.listdir(dst_dir) if n.endswith(".jpg"))
    body = sum(1 for i in ids if i <= 319)
    dlc = sum(1 for i in ids if i >= 1000)
    stray = [i for i in ids if 319 < i < 1000]
    print(f"  {lang}：共 {len(ids)} 张（本体 {body} / DLC {dlc}）"
          + (f"，游离 {stray}" if stray else ""))


def git_changes():
    """拷贝后统计 git 视角下 zh/en 的变更文件数（md5 变化的）。"""
    try:
        out = subprocess.check_output(
            ["git", "status", "--porcelain", "--", "assets/pattern/"],
            cwd=PROJECT_ROOT, text=True)
    except Exception:
        return None
    c = {"zh": 0, "en": 0}
    for line in out.splitlines():
        p = line[3:].strip()
        if "/zh/" in p:
            c["zh"] += 1
        elif "/en/" in p:
            c["en"] += 1
    return c


def main():
    src_root = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.isdir(src_root):
        sys.exit(f"❌ 源根目录不存在：{src_root}\n  用法：python update-pattern.py <源根目录>")

    print(f"源：{src_root}")
    print("拷贝（map_{ID}.jpg → {ID 补零3位}.jpg，只取 jpg）：")
    for sub, lang in LANG_MAP.items():
        copy_lang(src_root, sub, lang)

    print("\n校验：")
    for lang in ("zh", "en"):
        verify(lang)

    c = git_changes()
    if c:
        print(f"\n实际变更（md5 变化的文件）：中文 {c['zh']} / 英文 {c['en']}")

    print("\n后续同步：")
    print("  git add assets/pattern/ && git commit -m 'chore(assets): 更新 pattern 种子图'")
    print("  # 提交后 post-commit 钩子自动同步 NAS dev；prod 再执行：")
    print("  PROD=/volume1/work/cronjob/prod/nightreign-mapseed-recogniser-master")
    print('  ssh lixiang@192.168.8.8 "/usr/local/bin/git -C $PROD fetch origin master && /usr/local/bin/git -C $PROD reset --hard origin/master"')


if __name__ == "__main__":
    main()
