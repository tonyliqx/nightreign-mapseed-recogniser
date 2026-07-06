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

if __name__ == "__main__":
    unittest.main()
