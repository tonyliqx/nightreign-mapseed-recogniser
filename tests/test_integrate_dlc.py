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


from integrate_dlc import build_maptype_fix, SPECIAL_TO_MAP

class TestMapTypeFix(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_seed_1005_is_great_hollow(self):
        fix = build_maptype_fix(self.source)
        # 源 Special=4 → Great Hollow（目标当前标 Default，应在纠正表里）
        self.assertEqual(fix.get("1005"), "Great Hollow")

    def test_seed_1000_not_in_fix_if_default(self):
        fix = build_maptype_fix(self.source)
        # 种子1000 源 Special=0(Default)，目标也是 Default → 不在纠正表
        # （仅当目标当前值与源一致才排除；此处目标1000=Default，故排除）
        self.assertNotIn("1000", fix)

    def test_all_fix_values_valid(self):
        fix = build_maptype_fix(self.source)
        for sid, mt in fix.items():
            self.assertTrue(1000 <= int(sid) <= 1199)
            self.assertIn(mt, SPECIAL_TO_MAP.values())


from integrate_dlc import build_base_type_category

class TestRosetta(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_returns_nonempty_mapping(self):
        cat = build_base_type_category(self.source)
        self.assertGreater(len(cat), 20)  # 基础结构 type 至少几十种

    def test_boss_type_fieldboss(self):
        cat = build_base_type_category(self.source)
        # 任一 4xxxx boss 应归 fieldBoss
        boss_types = [t for t in cat if t.startswith("4") and len(t) == 5]
        self.assertTrue(all(cat[t]["adv"] == "fieldBoss" for t in boss_types[:5]))

    def test_each_entry_has_required_keys(self):
        cat = build_base_type_category(self.source)
        for t, v in cat.items():
            self.assertIn("adv", v)
            self.assertIn("basic", v)
            self.assertIn("count", v)


from integrate_dlc import cluster_great_hollow_pois

class TestCluster(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()
        self.calib = load_great_hollow_calib()

    def test_returns_clustered_pois(self):
        pois = cluster_great_hollow_pois(self.source, self.calib, 768)
        self.assertGreater(len(pois), 10)   # Great Hollow 至少十几个候选点
        self.assertLess(len(pois), 100)      # 不应爆炸
        # id 连续从 1 开始
        self.assertEqual(pois[0]["id"], 1)
        self.assertEqual([p["id"] for p in pois], list(range(1, len(pois) + 1)))

    def test_all_coords_in_canvas(self):
        pois = cluster_great_hollow_pois(self.source, self.calib, 768)
        for p in pois:
            self.assertTrue(0 <= p["x"] <= 768)
            self.assertTrue(0 <= p["y"] <= 768)

from integrate_dlc import build_advanced_csv_rows, load_type_category_icon

class TestAdvancedRows(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()
        self.icon = load_type_category_icon()

    def test_dlc_seed_count(self):
        rows = build_advanced_csv_rows(self.source, self.icon)
        self.assertEqual(len(rows), 200)

    def test_great_hollow_seed_has_pois(self):
        rows = build_advanced_csv_rows(self.source, self.icon)
        gh = [r for r in rows.values() if r["mapType"] == "Great Hollow"]
        self.assertGreater(len(gh), 0)
        # Great Hollow 种子应有非空 POI
        total = sum(len(r["major_base"]) + len(r["minor_base"]) +
                    len(r["evergaol"]) + len(r["field_boss"]) for r in gh)
        self.assertGreater(total, 0)

    def test_maptype_corrected(self):
        rows = build_advanced_csv_rows(self.source, self.icon)
        self.assertEqual(rows["1005"]["mapType"], "Great Hollow")

    def test_basic_map_seeds_have_no_pois(self):
        """基础地图 DLC 种子不填 POI（用户决策：建筑布局不对齐现有候选点，
        实测严格公差 0% 命中）。POI 字典保持空，避免 convert 崩溃与坐标缺失。"""
        rows = build_advanced_csv_rows(self.source, self.icon)
        basic = [r for r in rows.values() if r["mapType"] != "Great Hollow"]
        self.assertGreater(len(basic), 0, "应存在基础地图 DLC 种子")
        for r in basic:
            total = sum(len(r[c]) for c in
                        ["major_base", "minor_base", "evergaol", "field_boss"])
            self.assertEqual(total, 0,
                             f"基础地图种子 {r['mapType']} 应无 POI，但有 {total} 个")


from integrate_dlc import build_basic_classifications

class TestBasicClassifications(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_200_dlc_seeds(self):
        cls = build_basic_classifications(self.source)
        self.assertEqual(len(cls), 200)
        for sid in cls:
            self.assertTrue(1000 <= int(sid) <= 1199)

    def test_great_hollow_has_pois(self):
        cls = build_basic_classifications(self.source)
        # 种子1005(Great Hollow) 应有候选点分类
        self.assertGreater(len(cls["1005"]), 0)

    def test_values_in_taxonomy(self):
        cls = build_basic_classifications(self.source)
        valid = {"church", "mage", "village", "other", "nothing"}
        for sid, pois in cls.items():
            for v in pois.values():
                self.assertIn(v, valid)


from integrate_dlc import build_basic_datajs_snippets

class TestDataJsSnippets(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_pois_by_map_gh_nonempty(self):
        snip = build_basic_datajs_snippets(self.source)
        self.assertIn("pois_by_map_gh", snip)
        self.assertIn("{ id: 1", snip["pois_by_map_gh"])

    def test_seed_matrix_fixes_great_hollow(self):
        snip = build_basic_datajs_snippets(self.source)
        self.assertEqual(snip["seed_matrix_fixes"].get("1005"), "Great Hollow")


if __name__ == "__main__":
    unittest.main()
