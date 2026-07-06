#!/usr/bin/env python3
"""一次性：用源 background_4.png 生成 Great Hollow 真实地图 (1536×1536 JPEG)。
替换原占位图（"DLC - Data Coming Soon"）。
坐标空间与源一致，故 picXY→1536 变换 = 源 汉化地图导出.py:51 transform_coord 复合 ×(1536/4775)。
幂等：首次运行备份原占位图。"""
import os
import shutil
from PIL import Image

SRC = "/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"
PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(PROJ, "assets", "map", "great_hollow.jpg")
BACKUP = os.path.join(PROJ, "assets", "map", "great_hollow_placeholder.jpg.bak")


def main():
    bg = Image.open(os.path.join(SRC, "素材", "background_4.png")).convert("RGB")
    if not os.path.exists(BACKUP) and os.path.exists(OUT):
        shutil.copy2(OUT, BACKUP)
        print(f"已备份原占位图 → {BACKUP}")
    img = bg.resize((1536, 1536), Image.LANCZOS)
    img.save(OUT, "JPEG", quality=90)
    print(f"✅ 生成 {OUT} size={img.size} bytes={os.path.getsize(OUT)}")


if __name__ == "__main__":
    main()
