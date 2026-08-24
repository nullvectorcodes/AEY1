"""
Unit tests for Indian Equity Capital Gains Tax Engine.
Covers STCG/LTCG classification, pre-2018 grandfathering, intraday segregation,
Sections 70/71 set-off rules, ₹1.25L LTCG exemption, harvesting computations,
and robust header row hunting over broker preambles.
"""

import pytest
from datetime import date
from src.tax_engine.parser import TradeRecord, OpenPosition, _find_header_row
from src.tax_engine.engine import compute_capital_gains_tax
from src.tax_engine.harvesting import HarvestingEngine, estimate_round_trip_friction
from src.tax_engine.tax_rules import LTCG_EXEMPTION_LIMIT, STCG_RATE, LTCG_RATE

def test_holding_period_classification():
    # STCG trade (365 days)
    t_stcg = TradeRecord(
        stock_name="STOCK_A", isin="IN0000000001", quantity=10,
        buy_date=date(2024, 1, 1), buy_price=100, buy_value=1000,
        sell_date=date(2024, 12, 31), sell_price=150, sell_value=1500,
        realised_pnl=500
    )
    assert not t_stcg.is_ltcg
    assert not t_stcg.is_intraday

    # LTCG trade (366 days)
    t_ltcg = TradeRecord(
        stock_name="STOCK_B", isin="IN0000000002", quantity=10,
        buy_date=date(2023, 1, 1), buy_price=100, buy_value=1000,
        sell_date=date(2024, 1, 2), sell_price=150, sell_value=1500,
        realised_pnl=500
    )
    assert t_ltcg.is_ltcg
    assert not t_ltcg.is_intraday

def test_intraday_speculative_segregation():
    trades = [
        TradeRecord(
            stock_name="INTRADAY_CO", isin="IN0000000003", quantity=100,
            buy_date=date(2024, 5, 10), buy_price=500, buy_value=50000,
            sell_date=date(2024, 5, 10), sell_price=510, sell_value=51000,
            realised_pnl=1000, remark="Intraday trade"
        )
    ]
    res = compute_capital_gains_tax(trades)
    assert res.gross_speculative_gains == 1000.0
    assert res.gross_stcg_gains == 0.0
    assert res.gross_ltcg_gains == 0.0
    assert res.speculative_income_taxable == 1000.0

def test_pre_2018_grandfathering():
    t_gf = TradeRecord(
        stock_name="OLD_CO", isin="IN0000000004", quantity=10,
        buy_date=date(2017, 6, 15), buy_price=100, buy_value=1000,
        sell_date=date(2024, 8, 20), sell_price=250, sell_value=2500,
        realised_pnl=1500, fmv_2018=180
    )
    res = compute_capital_gains_tax([t_gf], enable_grandfathering=True)
    assert res.gross_ltcg_gains == 700.0
    assert res.audit_trail[0].grandfathered_cost == 180.0

def test_setoff_ordering_rules():
    trades = [
        TradeRecord("S1", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 50100, 50100, 50000),
        TradeRecord("S2", "IN2", 1, date(2024, 1, 1), 70000, 70000, date(2024, 6, 1), 0, 0, -70000),
        TradeRecord("L1", "IN3", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 150100, 150100, 150000),
        TradeRecord("L2", "IN4", 1, date(2022, 1, 1), 20000, 20000, date(2024, 6, 1), 0, 0, -20000)
    ]
    res = compute_capital_gains_tax(trades)
    
    assert res.stcl_setoff_against_stcg == 50000.0
    assert res.ltcl_setoff_against_ltcg == 20000.0
    assert res.stcl_setoff_against_ltcg == 20000.0
    assert res.net_stcg_after_setoff == 0.0
    assert res.net_ltcg_after_setoff == 110000.0
    
    assert res.ltcg_exemption_applied == 110000.0
    assert res.taxable_ltcg == 0.0
    assert res.basic_tax == 0.0

def test_ltcg_1_25L_exemption_overflow():
    trades = [
        TradeRecord("L1", "IN1", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 225100, 225100, 225000)
    ]
    res = compute_capital_gains_tax(trades)
    assert res.net_ltcg_after_setoff == 225000.0
    assert res.ltcg_exemption_applied == 125000.0
    assert res.taxable_ltcg == 100000.0
    assert res.ltcg_tax_base == 12500.0

def test_tax_harvesting_engine():
    trades = [
        TradeRecord("S1", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 40100, 40100, 40000)
    ]
    tax_res = compute_capital_gains_tax(trades)
    assert tax_res.taxable_stcg == 40000.0

    open_pos = [
        OpenPosition("STCG_LOSS_CO", "IN001", 100, date(2026, 5, 1), 1000, 700)
    ]

    engine = HarvestingEngine(tax_res)
    recs = engine.generate_loss_harvesting_recommendations(open_pos)

    assert len(recs) == 1
    rec = recs[0]
    assert rec.stock_name == "STCG_LOSS_CO"
    assert rec.recommended_qty_to_sell == 100
    assert rec.tax_saved == 30000 * STCG_RATE
    assert rec.net_benefit > 0

def test_zerodha_preamble_header_hunter():
    """
    Regression test verifying that preamble title rows containing the word 'stocks'
    or client information rows are NOT misidentified as column headers.
    """
    raw_sheet_rows = [
        ["Name", "Mohammad Saalim"],
        ["Unique Client Code", "6919136831"],
        [None, None],
        ["P&L Statement for stocks from 01-04-2025 TO 31-03-2026"],  # Row 3 (Title)
        [None],
        ["Summary"],
        ["Realised P&L", 975.21],
        ["Charges block", "STT", "Brokerage"],
        ["Realised trades"],  # Section label
        [None],
        ["Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Buy value", "Sell date", "Sell price", "Sell value", "Realised P&L", "Remark"] # Row 10 (Real Header)
    ]

    header_idx, headers = _find_header_row(raw_sheet_rows, "Trade Level")
    assert header_idx == 10
    assert "stock name" in headers
    assert "quantity" in headers
    assert "buy date" in headers
