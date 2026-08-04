# tests/test_etl.py
import pandas as pd
from nightreign_etl import SPECIAL_TO_MAP, NIGHTLORD_TO_KEY, load_source

def test_special_and_nightlord_maps():
    assert SPECIAL_TO_MAP[0] == "Default"
    assert SPECIAL_TO_MAP[4] == "Great Hollow"
    assert SPECIAL_TO_MAP[5] == "Noklateo"
    assert NIGHTLORD_TO_KEY[0] == "Gladius"
    assert NIGHTLORD_TO_KEY[9] == "Straghess"
    assert len(NIGHTLORD_TO_KEY) == 10

def test_load_source_reads_named_columns(tmp_path):
    # 合成最小 CSV（带表头）
    (tmp_path / "MAP_PATTERN.csv").write_text(
        "ID,NightLord,Special,Start_190,Treasure_800,Event_30*0,EventFlag,EvPat_30**,EvPatFlag,RotRew_500,Day1Boss,Day1Loc,Day2Boss,Day2Loc,extra1,extra2\n"
        "0,0,0,705,8005,3030,7724,3600,1150,0,4929,1001,4860,1011,-1,-1\n", encoding="utf-8")
    (tmp_path / "坐标.csv").write_text(
        "ID,Name,areaNo,gridXNo,gridZNo,posX,posZ,picX,picY\n705,,60,1,2,3,4,500.0,600.0\n", encoding="utf-8")
    (tmp_path / "CONSTRUCT.csv").write_text(
        "ID,MAP,type,is_display,,coord_index,,,,,,\n0,0,38100,1,126,705,0,0,0,0,0,0\n", encoding="utf-8")
    (tmp_path / "NAME.csv").write_text("38100,村庄,\n", encoding="utf-8")
    b = load_source(str(tmp_path))
    assert len(b.patterns) == 1
    assert b.coords[705] == (500.0, 600.0)
    assert b.names[38100] == "村庄"
    assert int(b.construct.iloc[0]["MAP"]) == 0
    assert int(b.construct.iloc[0]["coord_index"]) == 705

from nightreign_etl import (apply_void_offset, to768, category_of, basic_class_of,
                            EVERGAOL_COORDS, VOID_UNDERGROUND_COORDS)

TYPE_MAP = {
    "38100": {"advCategory":"minorBase","basicClass":"village","icon":"village","name":"村庄"},
    "41000": {"advCategory":"minorBase","basicClass":"church","icon":"church","name":"教堂"},
    "4770":  {"advCategory":"fieldBoss","basicClass":"other","icon":"fieldBoss","name":"唤声船"},
}
NAMES = {38100:"村庄", 41000:"教堂", 4770:"唤声船"}

def test_to768_halves():
    assert to768((500.0, 600.0)) == (250.0, 300.0)

def test_void_offset_only_underground():
    base = (400.0, 400.0)
    assert apply_void_offset(999, base) == base  # 非地下不动
    x,y = apply_void_offset(1160, base)          # 地下加偏移
    assert abs(x - (400.0 + 862*1536/4775)) < 1e-6
    assert abs(y - (400.0 + 355*1536/4775)) < 1e-6

def test_category_evergaol_by_coord():
    assert category_of(9999, 601, TYPE_MAP, NAMES) == "evergaol"
    assert category_of(9999, 2607, TYPE_MAP, NAMES) == "evergaol"

def test_category_from_typemap():
    assert category_of(4770, 100, TYPE_MAP, NAMES) == "fieldBoss"
    assert category_of(38100, 100, TYPE_MAP, NAMES) == "minorBase"

def test_basic_class():
    assert basic_class_of(38100, TYPE_MAP, NAMES) == "village"
    assert basic_class_of(41000, TYPE_MAP, NAMES) == "church"
    assert basic_class_of(4770, TYPE_MAP, NAMES) == "other"
