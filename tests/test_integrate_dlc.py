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
                           load_great_hollow_calib)

class TestTransformCoord(unittest.TestCase):
    def test_basic_1536(self):
        # v0.3.3 源 picXY 已烘焙为 1536 原生值 → 恒等返回
        x, y = transform_coord_basic(1000.0, 800.0, 1536)
        self.assertEqual((x, y), (1000.0, 800.0))

    def test_basic_768(self):
        # 768 空间 = 1536 值减半（能力保留，现行调用方统一 1536）
        x, y = transform_coord_basic(1000.0, 800.0, 768)
        self.assertEqual((x, y), (500.0, 400.0))

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
        # 注入合成目标（1005 误标 Default），脱离 data.js 当前状态耦合：
        # 源 Special=4 → Great Hollow，与目标 Default 不一致 → 应在纠正表里。
        fix = build_maptype_fix(self.source, target_override={"1005": "Default"})
        self.assertEqual(fix.get("1005"), "Great Hollow")

    def test_seed_1000_not_in_fix_if_default(self):
        # 注入合成目标（1000 当前已正确 = Default），与源一致 → 不在纠正表。
        fix = build_maptype_fix(self.source, target_override={"1000": "Default"})
        self.assertNotIn("1000", fix)

    def test_all_fix_values_valid(self):
        fix = build_maptype_fix(self.source)
        for sid, mt in fix.items():
            self.assertTrue(1000 <= int(sid) <= 1199)
            self.assertIn(mt, SPECIAL_TO_MAP.values())


from integrate_dlc import NIGHTLORD_NAMES

class TestNightlordNames(unittest.TestCase):
    # 前端筛选按钮（index.html / index-advanced.html 的 data-nightlord）的权威代号集。
    # 与 data.js const NIGHTLORDS 数组一致——这是 nightlord 命名的单一事实来源。
    EXPECTED = {"Gladius", "Adel", "Gnoster", "Maris", "Libra",
                "Fulghor", "Caligo", "Heolstor", "Harmonia", "Straghess"}

    def test_values_match_frontend_codenames(self):
        """NIGHTLORD_NAMES 的值必须等于前端按钮代号集，否则筛选失效。"""
        self.assertEqual(set(NIGHTLORD_NAMES.values()), self.EXPECTED)

    def test_no_duplicate_values(self):
        """不同编号不得映射到同名（曾因 4/6 都映射 Caligo 导致 Caligo 筛选污染）。"""
        values = list(NIGHTLORD_NAMES.values())
        self.assertEqual(len(values), len(set(values)),
                         f"nightlord 名称有重复: {values}")


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
        pois = cluster_great_hollow_pois(self.source, self.calib, 1536)
        self.assertGreater(len(pois), 10)   # Great Hollow 至少十几个候选点
        self.assertLess(len(pois), 100)      # 不应爆炸
        # id 连续从 1 开始
        self.assertEqual(pois[0]["id"], 1)
        self.assertEqual([p["id"] for p in pois], list(range(1, len(pois) + 1)))

    def test_all_coords_in_canvas(self):
        pois = cluster_great_hollow_pois(self.source, self.calib, 1536)
        for p in pois:
            # 上限放宽 24px 余量：v0.3.3 (86,75) 平移下，地底展示区右缘质心可
            # 轻微越 1536 边（实测 max +8.3px），图标仍可见，非数据错误
            self.assertTrue(0 <= p["x"] <= 1560, f"x={p['x']}")
            self.assertTrue(0 <= p["y"] <= 1560, f"y={p['y']}")

    def test_exclude_bosses_reduces_points(self):
        """基础版排除 boss 后候选点应显著减少——boss 占源坐标 ~60%，混合聚类致
        17/25 候选点被 boss 主导，挤掉教堂/法师塔地标。排除后回归地标位置。"""
        with_bosses = cluster_great_hollow_pois(self.source, self.calib, 1536)
        without_bosses = cluster_great_hollow_pois(self.source, self.calib, 1536, exclude_bosses=True)
        self.assertLess(len(without_bosses), len(with_bosses),
                        "排除 boss 后候选点应更少")
        self.assertGreater(len(without_bosses), 0)
        # id 仍从 1 连续
        self.assertEqual([p["id"] for p in without_bosses],
                         list(range(1, len(without_bosses) + 1)))

    def test_exclude_bosses_has_no_field_boss(self):
        """exclude_bosses=True 的候选点 source_coords 不得含 4xxxx boss 或 field_boss 图标 type。"""
        from integrate_dlc import load_type_category_icon
        icon = load_type_category_icon()
        pois = cluster_great_hollow_pois(self.source, self.calib, 1536, exclude_bosses=True)
        self.assertGreater(len(pois), 0)
        for p in pois:
            for _px, _py, _ci, t in p["source_coords"]:
                ts = str(t).strip()
                self.assertFalse(ts.isdigit() and 40000 <= int(ts) < 50000,
                                 f"排除后仍含 4xxxx boss: {ts}")
                if ts in icon:
                    self.assertNotEqual(icon[ts].get("icon"), "field_boss",
                                        f"排除后仍含 field_boss 图标 type: {ts}")

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

    def test_field_boss_value_no_duplicate(self):
        """Great Hollow fieldBoss value 必须是纯 boss 名，不含 " - " 重复格式。

        回归对象：Batch C 出现 "罗蕾塔 - 罗蕾塔" 重复 value，导致 convert
        按组合查找 icon 失败。修复后 value = names[type] 纯名。
        """
        rows = build_advanced_csv_rows(self.source, self.icon)
        gh_rows = [r for r in rows.values() if r["mapType"] == "Great Hollow"]
        self.assertGreater(len(gh_rows), 0)
        checked = 0
        for r in gh_rows:
            for value in r["field_boss"].values():
                self.assertNotIn(" - ", value,
                                 f"field_boss value 含重复格式: {value!r}")
                checked += 1
        # 至少检查到 1 个 field_boss value（确保测试真正执行了断言）
        self.assertGreater(checked, 0, "未检查到任何 field_boss value")


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
        valid = {"church", "mage", "village", "carriage", "nothing"}
        for sid, pois in cls.items():
            for v in pois.values():
                self.assertIn(v, valid)


from integrate_dlc import (_filter_landmark_pois, cluster_great_hollow_pois,
                           load_great_hollow_calib, load_type_category_icon,
                           build_base_type_category, SPECIAL_TO_MAP)


class TestFilterLandmarkPois(unittest.TestCase):
    """大空洞候选点过滤：移除在所有大空洞种子都非地标的点（主城 boss 群/固定 evergaol）。

    回归锁定：必须传入 gh_seed_ids 限定大空洞种子范围——basic_cls 含全地图种子，
    非大空洞种子的 POI1/4/6 是基础地图的点（教堂等），不限定范围会全部误判为地标，
    导致一个候选点都过滤不掉。"""

    def setUp(self):
        self.source = read_source_data()
        calib = load_great_hollow_calib()
        icon = load_type_category_icon()
        base = build_base_type_category(self.source)
        self.gh_all = cluster_great_hollow_pois(self.source, calib, 1536, exclude_bosses=True)
        self.probe = build_basic_classifications(self.source, icon, base, self.gh_all, calib)
        self.gh_sids = {sid for sid, pat in self.source["patterns"].items()
                        if SPECIAL_TO_MAP.get(pat["special"]) == "Great Hollow"
                        and 1000 <= int(sid) <= 1199}

    def test_filters_to_four_landmark_pois(self):
        kept = _filter_landmark_pois(self.gh_all, self.probe, self.gh_sids)
        self.assertEqual(len(kept), 4)
        self.assertEqual([p["id"] for p in kept], [1, 2, 3, 4])
        for p in kept:
            # 上限余量同 test_all_coords_in_canvas（(86,75) 平移的边缘效应）
            self.assertTrue(0 <= p["x"] <= 1560 and 0 <= p["y"] <= 1560,
                            f"({p['x']}, {p['y']})")

    def test_kept_pois_match_landmark_coords(self):
        """保留的 4 个点坐标 == 旧候选点中至少一个大空洞种子为地标的点坐标。

        用坐标匹配避开 id 重映射：probe 键是旧 id，过滤后 id 已重编，直接比 id 会对错位。
        landmark 用 4 类（含 carriage），与 _filter_landmark_pois 的 landmark 集合一致。"""
        landmark = {"church", "mage", "village", "carriage"}
        calib = load_great_hollow_calib()
        gh_fresh = cluster_great_hollow_pois(self.source, calib, 1536, exclude_bosses=True)
        landmark_coords = {(round(p["x"], 1), round(p["y"], 1)) for p in gh_fresh
                           if any(self.probe.get(sid, {}).get(f"POI{p['id']}") in landmark
                                  for sid in self.gh_sids)}
        kept = _filter_landmark_pois([dict(p) for p in gh_fresh], self.probe, self.gh_sids)
        kept_coords = {(round(p["x"], 1), round(p["y"], 1)) for p in kept}
        self.assertEqual(kept_coords, landmark_coords)
        self.assertEqual(len(kept_coords), 4)

    def test_removes_three_non_landmark_pois(self):
        """7 个候选点中旧 POI1/4/6 被移除，其余 4 点保留。

        旧 POI4(164,406)/POI6(426,474) 在所有大空洞种子非地标（nothing），被移除。
        旧 POI1(229.3,236.7) 是上半部分主城固定结构（含主城大教堂 53590，每局固定刷新
        在主城位置）。用户决策 2026-07-08：主城信息不可定位，53590 basic 改为 other 后，
        主城点在所有种子非地标（other/nothing），被移除。最终保留 4 个可变地标。"""
        landmark = {"church", "mage", "village", "carriage"}
        calib = load_great_hollow_calib()
        gh_fresh = cluster_great_hollow_pois(self.source, calib, 1536, exclude_bosses=True)
        non_landmark = sorted(p["id"] for p in gh_fresh
                              if not any(self.probe.get(sid, {}).get(f"POI{p['id']}") in landmark
                                         for sid in self.gh_sids))
        self.assertEqual(non_landmark, [1, 4, 6])
        self.assertEqual(len(gh_fresh) - len(non_landmark), 4)


from integrate_dlc import build_basic_datajs_snippets

class TestDataJsSnippets(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_pois_by_map_gh_nonempty(self):
        snip = build_basic_datajs_snippets(self.source)
        self.assertIn("pois_by_map_gh", snip)
        self.assertIn("{ id: 1", snip["pois_by_map_gh"])

    def test_seed_matrix_fixes_great_hollow(self):
        # 注入合成目标（1005 误标 Default），验证片段纳入该纠正，脱离 data.js 当前状态。
        snip = build_basic_datajs_snippets(self.source, target_override={"1005": "Default"})
        self.assertEqual(snip["seed_matrix_fixes"].get("1005"), "Great Hollow")


from integrate_dlc import load_spawn_calib

class TestSpawnCalib(unittest.TestCase):
    def test_has_12_spawn_points(self):
        calib = load_spawn_calib()
        self.assertEqual(len(calib), 12)

    def test_values_are_expected_set(self):
        calib = load_spawn_calib()
        expected = {str(v) for v in range(700, 709)} | {"13000", "13001", "13002"}
        self.assertEqual(set(calib.keys()), expected)

    def test_coords_in_1536_canvas(self):
        calib = load_spawn_calib()
        for v, (x, y) in calib.items():
            self.assertTrue(0 <= x <= 1536, f"{v} x={x} 越界")
            self.assertTrue(0 <= y <= 1536, f"{v} y={y} 越界")


from integrate_dlc import build_basic_spawn_snippets, SPECIAL_TO_MAP
import re as _re

class TestSpawnSnippets(unittest.TestCase):
    def setUp(self):
        self.source = read_source_data()

    def test_seed_spawn_covers_520_seeds(self):
        snip = build_basic_spawn_snippets(self.source)
        self.assertEqual(snip["spawn_seed_count"], 520)

    def test_seed_spawn_values_valid(self):
        snip = build_basic_spawn_snippets(self.source)
        valid = {str(v) for v in range(700, 709)} | {"13000", "13001", "13002"}
        for m in _re.finditer(r'\d+: "([^"]+)"', snip["seed_spawn"]):
            self.assertIn(m.group(1), valid, f"非法出生点值 {m.group(1)}")

    def test_great_hollow_has_3_spawn_points(self):
        snip = build_basic_spawn_snippets(self.source)
        gh_section = snip["spawn_points_by_map"].split('"Great Hollow"')[1].split("]")[0]
        self.assertEqual(gh_section.count("label:"), 3)

    def test_spawn_points_coords_in_canvas(self):
        snip = build_basic_spawn_snippets(self.source)
        for m in _re.finditer(r'x: ([\d.]+), y: ([\d.]+)', snip["spawn_points_by_map"]):
            x, y = float(m.group(1)), float(m.group(2))
            self.assertTrue(0 <= x <= 1536 and 0 <= y <= 1536, f"({x},{y}) 越界")

    def test_spawn_points_subset_per_map(self):
        """每地图的出生点必须是该地图种子实际出现的 Start_190 子集（无死标记）。"""
        snip = build_basic_spawn_snippets(self.source)
        actual = {}
        for sid, pat in self.source["patterns"].items():
            mt = SPECIAL_TO_MAP.get(pat["special"], "Default")
            s = pat.get("start", "").strip()
            if s:
                actual.setdefault(mt, set()).add(s)
        for mt, vals in actual.items():
            if f'"{mt}"' not in snip["spawn_points_by_map"]:
                continue
            section = snip["spawn_points_by_map"].split(f'"{mt}"')[1].split("]")[0]
            in_snippet = set(_re.findall(r'value: "([^"]+)"', section))
            self.assertTrue(in_snippet <= vals, f"{mt} 含死标记 {in_snippet - vals}")


if __name__ == "__main__":
    unittest.main()
