import unittest
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from integrate_dlc import read_source_data

SRC = "/Users/lixiang/Documents/AI_code/Nightreign-maps-including-dlc-v0.3.3-main"

class TestReadSourceData(unittest.TestCase):
    def test_reads_520_patterns(self):
        d = read_source_data(SRC)
        self.assertEqual(len(d["patterns"]), 520)

    def test_dlc_seed_1005_is_great_hollow(self):
        d = read_source_data(SRC)
        self.assertEqual(d["patterns"]["1005"]["special"], 4)  # Great Hollow

    def test_constructs_keyed_by_seed(self):
        d = read_source_data(SRC)
        self.assertIn("1005", d["constructs"])
        # 种子1005 有几十个建筑
        self.assertGreater(len(d["constructs"]["1005"]), 10)

    def test_coords_resolvable(self):
        d = read_source_data(SRC)
        # coord_index 1107 在坐标.csv 有效
        self.assertIn("1107", d["coords"])
        px, py = d["coords"]["1107"]
        self.assertGreater(px, 0)
        self.assertGreater(py, 0)

    def test_name_for_boss(self):
        d = read_source_data(SRC)
        # 4770 = 唤声船（boss 有中文名）
        self.assertEqual(d["names"].get("4770"), "唤声船")


from integrate_dlc import (transform_coord_basic, transform_coord_great_hollow,
                           load_great_hollow_calib, SCALE_1536, SCALE_768)

class TestTransformCoord(unittest.TestCase):
    def test_basic_1536(self):
        # 源 picXY 4775 → 1536 纯缩放
        x, y = transform_coord_basic(4775, 4775, 1536)
        self.assertAlmostEqual(x, 1536, places=1)
        self.assertAlmostEqual(y, 1536, places=1)

    def test_basic_768(self):
        x, y = transform_coord_basic(0, 0, 768)
        self.assertEqual((x, y), (0.0, 0.0))

    def test_great_hollow_uses_calib_scale(self):
        calib = {"scale_x": 0.32168, "scale_y": 0.32168,
                 "offset_x": 0.0, "offset_y": 0.0,
                 "underground_offset": [0.0, 0.0], "underground_coord_ids": []}
        # target_space=1536，calib.scale 已是到 1536 的系数
        x, y = transform_coord_great_hollow(1000.0, 1000.0, "1107", calib, 1536)
        self.assertAlmostEqual(x, 321.68, places=1)

    def test_great_hollow_underground_offset(self):
        calib = {"scale_x": 0.32, "scale_y": 0.32, "offset_x": 0, "offset_y": 0,
                 "underground_offset": [10.0, 20.0], "underground_coord_ids": ["9999"]}
        # target_space=1536 → half=1.0（见 Step 3 实现）
        # x = 100 * 0.32 * 1.0 + 0 * 1.0 = 32.0；地底再 +10.0*1.0 = 42.0
        # y = 100 * 0.32 * 1.0 + 0 * 1.0 = 32.0；地底再 +20.0*1.0 = 52.0
        x, y = transform_coord_great_hollow(100.0, 100.0, "9999", calib, 1536)
        self.assertAlmostEqual(x, 42.0, places=2)
        self.assertAlmostEqual(y, 52.0, places=2)

    def test_calib_loads_or_fallback(self):
        calib = load_great_hollow_calib()
        self.assertIn("scale_x", calib)

if __name__ == "__main__":
    unittest.main()
