"""convert-csv-to-json.py 的 get_poi_icon 单元测试。

聚焦 Batch C Fix 的两项保证：
1. field_boss 未知 boss（如 DLC 中文 boss 名）退回通用 "field_boss" 图标（兜底）。
2. 已知 boss 的精确映射不退化（.get 优先返回精确值）。
3. DLC 数字 5xxxx structure 走数字分支返回 type→icon 映射。

注意：convert-csv-to-json.py 文件名含连字符，无法直接 import，
用 importlib.util 从绝对路径加载。模块顶层有 `if __name__ == "__main__":`
守卫，exec_module 不会触发文件写入。
"""
import unittest
import os
import importlib.util

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(_HERE)
_CONVERT_PATH = os.path.join(_REPO, "convert-csv-to-json.py")


def _load_convert_module():
    """用 importlib 加载 convert-csv-to-json.py（文件名含连字符）。"""
    spec = importlib.util.spec_from_file_location("cc", _CONVERT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestGetPoiIcon(unittest.TestCase):
    def setUp(self):
        self.mod = _load_convert_module()
        # 真实 mappings（含 DLC 5xxxx 数字 type 映射，由 _load_dlc_type_icons 注入）
        self.real_mappings = self.mod.get_poi_icon_mappings()

    def test_field_boss_unknown_boss_returns_default(self):
        """DLC 中文 boss 名（无英文映射）应退回通用 field_boss 图标。

        回归对象：Great Hollow 的 "罗蕾塔/接肢/树灵" 等 1289 个 icon=None。
        """
        icon = self.mod.get_poi_icon("field_boss", None, "罗蕾塔", self.real_mappings)
        self.assertEqual(icon, "field_boss")

    def test_field_boss_known_boss_returns_exact(self):
        """已知 boss 的精确映射优先于兜底（构造能区分两者的 mappings）。

        真实 mappings 里 field_boss 的值统一是 "field_boss"，无法区分精确值
        与兜底，故此处构造一个精确值 "boss_icon_special" 来验证 .get 优先。
        """
        mappings = {"field_boss": {"Leonine Misbegotten": "boss_icon_special"}}
        icon = self.mod.get_poi_icon("field_boss", "x", "Leonine Misbegotten", mappings)
        self.assertEqual(icon, "boss_icon_special")

    def test_dlc_numeric_structure_uses_type_mapping(self):
        """DLC 数字 5xxxx structure 走数字分支，返回 type→icon 映射。

        回归对象：51000（major_base 数字 type）→ cathedral_blank。
        （原回归对象 52420 已被用户权威修正为 fieldBoss「黄金化身」，归 field_boss 表。）
        """
        icon = self.mod.get_poi_icon("major_base", "51000", None, self.real_mappings)
        self.assertEqual(icon, "cathedral_blank")


if __name__ == "__main__":
    unittest.main()
