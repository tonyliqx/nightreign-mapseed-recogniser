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
