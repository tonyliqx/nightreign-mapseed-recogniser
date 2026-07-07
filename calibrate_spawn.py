"""一次性标定：从源目录 Start_*.png 提取出生点箭头坐标，转 768 空间，
写 dataset/dlc-params/spawn_calib.json。

dev 时工具（用 Pillow，非生产路径）。生产端 integrate_dlc.py 用
标准库 json.load 读取产物，无第三方依赖。

每张 PNG 是 4775×4775 透明底，蓝色箭头标记出生点。brief 原方案用 numpy 求
非透明像素质心；本机环境为 externally-managed 且禁止装 numpy，故改用
Pillow 的 Image.getbbox() 中心（brief Step 7 认可的备选方案）。getbbox() 是
Pillow C 实现，比纯 Python 遍历 22M 像素快几个数量级，且对箭头这种有明确
边界框的形状，bbox 中心比质心更稳定（质心受箭头杆长度这种装饰性偏置影响）。

运行：python calibrate_spawn.py
"""
import os, sys, json
from PIL import Image

PROJ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJ)
from integrate_dlc import (transform_coord_basic, transform_coord_great_hollow,
                           load_great_hollow_calib, SRC_DEFAULT)

SRC = os.path.join(SRC_DEFAULT, "素材")
OUT = os.path.join(PROJ, "dataset", "dlc-params", "spawn_calib.json")

BASIC_VALUES = [str(v) for v in range(700, 709)]   # 700-708，基础地图
GH_VALUES = ["13000", "13001", "13002"]            # 大空洞


def centroid_4775(png_path: str):
    """非透明区域 bbox 中心 (px, py)，4775 空间。

    用 Pillow getbbox()（C 实现）而非 numpy 质心——本机 externally-managed
    环境禁止装 numpy。对箭头形状 bbox 中心比质心更稳，且 brief Step 7 认可此备选。"""
    img = Image.open(png_path).convert("RGBA")
    bbox = img.getbbox()  # (left, upper, right, lower)，无非透明像素时返回 None
    if bbox is None:
        raise ValueError(f"{png_path} 无非透明像素")
    left, upper, right, lower = bbox
    return (left + right) / 2.0, (upper + lower) / 2.0


def main():
    calib = load_great_hollow_calib()
    out = {}
    for v in BASIC_VALUES:
        px, py = centroid_4775(os.path.join(SRC, f"Start_{v}.png"))
        bx, by = transform_coord_basic(px, py, 768)
        out[v] = [round(bx, 1), round(by, 1)]
    for v in GH_VALUES:
        px, py = centroid_4775(os.path.join(SRC, f"Start_{v}.png"))
        gx, gy = transform_coord_great_hollow(px, py, "", calib, 768)
        out[v] = [round(gx, 1), round(gy, 1)]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"✅ 标定写出 {OUT}（{len(out)} 个出生点）")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
