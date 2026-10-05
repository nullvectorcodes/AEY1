"""
Production-Ready Comprehensive Statutory & Algorithmic Test Suite for AEY Tax Engine.
Complies with Finance (No. 2) Act 2024 (Post-23 July 2024 Rates, Rules, and Set-offs).

Covers:
1. Holding period classification (STCG <= 365d, LTCG > 365d, leap years, intraday)
2. Section 112A Grandfathering (All 5 statutory cases under Finance Act 2018 & 2024)
3. Sections 70 and 71 Statutory Loss Set-Off Hierarchies (STCL vs STCG/LTCG, LTCL vs LTCG only)
4. Section 112A ₹1,25,000 Annual Exemption Boundary & Overflow Tests
5. Surcharge tiers (0%, 10%, 15% statutory cap for 111A/112A) & 4% Health & Education Cess
6. Section 73 Intraday Speculative Segregation (Isolated business income)
7. Friction-adjusted Tax-Loss & Tax-Gain Harvesting Engine
8. Robust Multi-Format Date Parser & Header Hunter
9. Indian Rupee Lakh/Crore Currency Formatter
"""

import pytest
import math
from datetime import date, datetime, timedelta
import pandas as pd

from src.tax_engine.parser import TradeRecord, OpenPosition, _find_header_row, _parse_date
from src.tax_engine.engine import compute_capital_gains_tax, AuditRecord
from src.tax_engine.harvesting import (
    HarvestingEngine, estimate_round_trip_friction, LossHarvestingRecommendation, GainHarvestingRecommendation
)
from src.tax_engine.tax_rules import (
    STCG_RATE, LTCG_RATE, LTCG_EXEMPTION_LIMIT, HEALTH_EDUCATION_CESS,
    GRANDFATHERING_DATE, compute_surcharge_rate, format_indian_currency
)


# =============================================================================
# 1. HOLDING PERIOD & TRADE CLASSIFICATION TESTS
# =============================================================================

class TestHoldingPeriodClassification:
    def test_stcg_exact_365_days(self):
        """Holding period <= 365 days is STCG."""
        t = TradeRecord(
            stock_name="INFY", isin="INE009A01021", quantity=10,
            buy_date=date(2024, 1, 1), buy_price=1500, buy_value=15000,
            sell_date=date(2024, 12, 31), sell_price=1800, sell_value=18000,
            realised_pnl=3000
        )
        assert t.holding_days == 365
        assert not t.is_ltcg
        assert not t.is_intraday

    def test_ltcg_exact_366_days(self):
        """Holding period > 365 days is LTCG."""
        t = TradeRecord(
            stock_name="TCS", isin="INE467B01029", quantity=10,
            buy_date=date(2023, 1, 1), buy_price=3000, buy_value=30000,
            sell_date=date(2024, 1, 2), sell_price=3500, sell_value=35000,
            realised_pnl=5000
        )
        assert t.holding_days == 366
        assert t.is_ltcg
        assert not t.is_intraday

    def test_single_day_delivery_trade(self):
        """Delivery trade bought and sold over 1 day is STCG."""
        t = TradeRecord(
            stock_name="RELIANCE", isin="INE002A01018", quantity=5,
            buy_date=date(2024, 8, 1), buy_price=2900, buy_value=14500,
            sell_date=date(2024, 8, 2), sell_price=2950, sell_value=14750,
            realised_pnl=250
        )
        assert t.holding_days == 1
        assert not t.is_ltcg
        assert not t.is_intraday

    def test_intraday_speculative_segregation(self):
        """Intraday trades must be segregated under Section 73 into speculative income."""
        trades = [
            TradeRecord(
                stock_name="SBIN", isin="INE062A01020", quantity=100,
                buy_date=date(2024, 6, 10), buy_price=800, buy_value=80000,
                sell_date=date(2024, 6, 10), sell_price=815, sell_value=81500,
                realised_pnl=1500, remark="Intraday MIS trade"
            ),
            TradeRecord(
                stock_name="AXISBANK", isin="INE238A01034", quantity=50,
                buy_date=date(2024, 6, 10), buy_price=1200, buy_value=60000,
                sell_date=date(2024, 6, 10), sell_price=1180, sell_value=59000,
                realised_pnl=-1000, remark="Intraday square-off"
            )
        ]
        res = compute_capital_gains_tax(trades)
        assert res.gross_speculative_gains == 1500.0
        assert res.gross_speculative_losses == 1000.0
        assert res.net_speculative_before_setoff == 500.0
        assert res.speculative_income_taxable == 500.0
        # Capital gains must remain untouched
        assert res.gross_stcg_gains == 0.0
        assert res.gross_ltcg_gains == 0.0
        assert res.taxable_stcg == 0.0
        assert res.taxable_ltcg == 0.0

    def test_speculative_loss_carried_forward_isolated(self):
        """Net speculative losses cannot offset capital gains and must be carried forward (Sec 73)."""
        trades = [
            TradeRecord(
                stock_name="INTRADAY_LOSS", isin="INE001", quantity=100,
                buy_date=date(2024, 5, 5), buy_price=500, buy_value=50000,
                sell_date=date(2024, 5, 5), sell_price=450, sell_value=45000,
                realised_pnl=-5000, remark="Intraday"
            ),
            TradeRecord(
                stock_name="STCG_GAIN", isin="INE002", quantity=10,
                buy_date=date(2024, 1, 1), buy_price=1000, buy_value=10000,
                sell_date=date(2024, 6, 1), sell_price=2000, sell_value=20000,
                realised_pnl=10000
            )
        ]
        res = compute_capital_gains_tax(trades)
        assert res.speculative_loss_carried_forward == 5000.0
        assert res.speculative_income_taxable == 0.0
        # STCG must NOT be reduced by speculative loss
        assert res.net_stcg_after_setoff == 10000.0
        assert res.taxable_stcg == 10000.0


# =============================================================================
# 2. PRE-2018 SECTION 112A GRANDFATHERING FORMULA TESTS
# Formula: Cost = max(Actual Buy Price, min(FMV as of 31-Jan-2018, Sell Price))
# =============================================================================

class TestSection112AGrandfathering:
    def test_case_1_buy_below_fmv_below_sell(self):
        """Case 1: Buy (100) < FMV (200) < Sell (300) -> Cost = 200, Taxable Gain = 100."""
        t = TradeRecord(
            stock_name="L&T", isin="INE018A01030", quantity=10,
            buy_date=date(2016, 5, 10), buy_price=100, buy_value=1000,
            sell_date=date(2024, 8, 1), sell_price=300, sell_value=3000,
            realised_pnl=2000, fmv_2018=200
        )
        res = compute_capital_gains_tax([t], enable_grandfathering=True)
        # Expected adjusted cost = max(100, min(200, 300)) = 200
        # Expected LTCG = (300 - 200) * 10 = 1000
        assert res.gross_ltcg_gains == 1000.0
        assert res.audit_trail[0].grandfathered_cost == 200.0

    def test_case_2_buy_below_sell_below_fmv(self):
        """Case 2: Buy (100) < Sell (150) < FMV (200) -> Cost = 150, Gain = 0 (No artificial loss)."""
        t = TradeRecord(
            stock_name="ITC", isin="INE154A01025", quantity=10,
            buy_date=date(2017, 1, 10), buy_price=100, buy_value=1000,
            sell_date=date(2024, 8, 1), sell_price=150, sell_value=1500,
            realised_pnl=500, fmv_2018=200
        )
        res = compute_capital_gains_tax([t], enable_grandfathering=True)
        # Cost = max(100, min(200, 150)) = 150
        # P&L = (150 - 150) * 10 = 0
        assert res.gross_ltcg_gains == 0.0
        assert res.gross_ltcl_losses == 0.0
        assert res.audit_trail[0].adjusted_pnl == 0.0
        assert res.audit_trail[0].grandfathered_cost == 150.0

    def test_case_3_fmv_below_buy_below_sell(self):
        """Case 3: FMV (80) < Buy (100) < Sell (250) -> Cost = 100, Gain = 150."""
        t = TradeRecord(
            stock_name="HINDUNILVR", isin="INE030A01027", quantity=10,
            buy_date=date(2015, 3, 1), buy_price=100, buy_value=1000,
            sell_date=date(2024, 9, 1), sell_price=250, sell_value=2500,
            realised_pnl=1500, fmv_2018=80
        )
        res = compute_capital_gains_tax([t], enable_grandfathering=True)
        # Cost = max(100, min(80, 250)) = 100
        # P&L = (250 - 100) * 10 = 1500
        assert res.gross_ltcg_gains == 1500.0
        assert res.audit_trail[0].grandfathered_cost == 100.0

    def test_case_4_sell_below_buy_below_fmv(self):
        """Case 4: Sell (70) < Buy (100) < FMV (150) -> Cost = 100, Loss = -30 (Loss allowed based on actual buy)."""
        t = TradeRecord(
            stock_name="TATASTEEL", isin="INE081A01020", quantity=10,
            buy_date=date(2017, 8, 1), buy_price=100, buy_value=1000,
            sell_date=date(2024, 9, 1), sell_price=70, sell_value=700,
            realised_pnl=-300, fmv_2018=150
        )
        res = compute_capital_gains_tax([t], enable_grandfathering=True)
        # Cost = max(100, min(150, 70)) = max(100, 70) = 100
        # Loss = (70 - 100) * 10 = -300
        assert res.gross_ltcl_losses == 300.0
        assert res.audit_trail[0].grandfathered_cost == 100.0

    def test_case_5_sell_below_fmv_below_buy(self):
        """Case 5: Sell (50) < FMV (80) < Buy (100) -> Cost = 100, Loss = -50."""
        t = TradeRecord(
            stock_name="COALINDIA", isin="INE522F01014", quantity=10,
            buy_date=date(2014, 4, 1), buy_price=100, buy_value=1000,
            sell_date=date(2024, 9, 1), sell_price=50, sell_value=500,
            realised_pnl=-500, fmv_2018=80
        )
        res = compute_capital_gains_tax([t], enable_grandfathering=True)
        # Cost = max(100, min(80, 50)) = 100
        # Loss = -500
        assert res.gross_ltcl_losses == 500.0
        assert res.audit_trail[0].grandfathered_cost == 100.0

    def test_post_2018_trade_ignores_fmv(self):
        """Stocks bought AFTER 31-Jan-2018 must NOT receive grandfathering even if FMV is supplied."""
        t = TradeRecord(
            stock_name="POST_2018_CO", isin="INE999", quantity=10,
            buy_date=date(2018, 2, 1), buy_price=100, buy_value=1000,
            sell_date=date(2024, 9, 1), sell_price=300, sell_value=3000,
            realised_pnl=2000, fmv_2018=250
        )
        res = compute_capital_gains_tax([t], enable_grandfathering=True)
        # Must use actual cost of 100, gain = 2000
        assert res.gross_ltcg_gains == 2000.0
        assert res.audit_trail[0].grandfathered_cost is None

    def test_grandfathering_disabled_switch(self):
        """When enable_grandfathering=False, raw actual buy prices must be used."""
        t = TradeRecord(
            stock_name="OLD_CO", isin="INE004", quantity=10,
            buy_date=date(2017, 6, 15), buy_price=100, buy_value=1000,
            sell_date=date(2024, 8, 20), sell_price=250, sell_value=2500,
            realised_pnl=1500, fmv_2018=180
        )
        res_disabled = compute_capital_gains_tax([t], enable_grandfathering=False)
        assert res_disabled.gross_ltcg_gains == 1500.0
        assert res_disabled.audit_trail[0].grandfathered_cost is None


# =============================================================================
# 3. STATUTORY SET-OFF RULES TESTS (SECTIONS 70 & 71)
# =============================================================================

class TestStatutoryLossSetOff:
    def test_stcl_offsets_stcg_fully(self):
        """STCL <= STCG: STCL fully offsets STCG."""
        trades = [
            TradeRecord("S1", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 60100, 60100, 60000),
            TradeRecord("S2", "IN2", 1, date(2024, 1, 1), 20000, 20000, date(2024, 6, 1), 0, 0, -20000)
        ]
        res = compute_capital_gains_tax(trades)
        assert res.stcl_setoff_against_stcg == 20000.0
        assert res.net_stcg_after_setoff == 40000.0
        assert res.stcl_carried_forward == 0.0

    def test_stcl_exceeds_stcg_no_ltcg_carried_forward(self):
        """STCL > STCG without LTCG: Remaining STCL carried forward."""
        trades = [
            TradeRecord("S1", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 30100, 30100, 30000),
            TradeRecord("S2", "IN2", 1, date(2024, 1, 1), 50000, 50000, date(2024, 6, 1), 0, 0, -50000)
        ]
        res = compute_capital_gains_tax(trades)
        assert res.stcl_setoff_against_stcg == 30000.0
        assert res.net_stcg_after_setoff == 0.0
        assert res.stcl_carried_forward == 20000.0

    def test_stcl_offsets_stcg_first_then_ltcg(self):
        """STCL offsets STCG first, then remaining STCL offsets LTCG."""
        trades = [
            TradeRecord("STCG_GAIN", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 40100, 40100, 40000),
            TradeRecord("STCL_LOSS", "IN2", 1, date(2024, 1, 1), 70000, 70000, date(2024, 6, 1), 0, 0, -70000),
            TradeRecord("LTCG_GAIN", "IN3", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 80100, 80100, 80000)
        ]
        res = compute_capital_gains_tax(trades)
        # STCL (70k) offsets 40k STCG -> STCG becomes 0
        assert res.stcl_setoff_against_stcg == 40000.0
        assert res.net_stcg_after_setoff == 0.0
        # Remaining 30k STCL offsets LTCG (80k) -> LTCG becomes 50k
        assert res.stcl_setoff_against_ltcg == 30000.0
        assert res.net_ltcg_after_setoff == 50000.0
        assert res.stcl_carried_forward == 0.0

    def test_ltcl_never_offsets_stcg_statutory_ban(self):
        """CRITICAL: Section 70 strictly prohibits LTCL from offsetting STCG."""
        trades = [
            TradeRecord("STCG_GAIN", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 50100, 50100, 50000),
            TradeRecord("LTCL_LOSS", "IN2", 1, date(2022, 1, 1), 40000, 40000, date(2024, 6, 1), 0, 0, -40000)
        ]
        res = compute_capital_gains_tax(trades)
        # LTCL cannot touch STCG!
        assert res.net_stcg_after_setoff == 50000.0
        assert res.taxable_stcg == 50000.0
        assert res.ltcl_carried_forward == 40000.0
        assert res.basic_tax == 50000.0 * STCG_RATE

    def test_comprehensive_multi_loss_setoff_hierarchy(self):
        """Full priority hierarchy: LTCL offsets LTCG, then STCL offsets STCG, then remaining STCL offsets LTCG."""
        trades = [
            TradeRecord("S_GAIN", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 100100, 100100, 100000),
            TradeRecord("S_LOSS", "IN2", 1, date(2024, 1, 1), 150000, 150000, date(2024, 6, 1), 0, 0, -150000),
            TradeRecord("L_GAIN", "IN3", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 300100, 300100, 300000),
            TradeRecord("L_LOSS", "IN4", 1, date(2022, 1, 1), 100000, 100000, date(2024, 6, 1), 0, 0, -100000)
        ]
        res = compute_capital_gains_tax(trades)
        # 1. LTCL (100k) offsets LTCG (300k) -> LTCG remaining = 200k
        assert res.ltcl_setoff_against_ltcg == 100000.0
        assert res.ltcl_carried_forward == 0.0
        # 2. STCL (150k) offsets STCG (100k) -> STCG remaining = 0, STCL remaining = 50k
        assert res.stcl_setoff_against_stcg == 100000.0
        assert res.net_stcg_after_setoff == 0.0
        # 3. Remaining STCL (50k) offsets remaining LTCG (200k) -> LTCG remaining = 150k
        assert res.stcl_setoff_against_ltcg == 50000.0
        assert res.net_ltcg_after_setoff == 150000.0
        assert res.stcl_carried_forward == 0.0
        # 4. ₹1.25L exemption applied on 150k -> Taxable LTCG = 25k
        assert res.ltcg_exemption_applied == 125000.0
        assert res.taxable_ltcg == 25000.0


# =============================================================================
# 4. SECTION 112A ₹1,25,000 EXEMPTION LIMIT BOUNDARY TESTS
# =============================================================================

class TestLTCGExemptionBoundaries:
    def test_zero_ltcg(self):
        res = compute_capital_gains_tax([])
        assert res.ltcg_exemption_applied == 0.0
        assert res.ltcg_exemption_headroom_remaining == 125000.0
        assert res.taxable_ltcg == 0.0

    def test_ltcg_below_threshold(self):
        trades = [TradeRecord("L1", "IN1", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 50100, 50100, 50000)]
        res = compute_capital_gains_tax(trades)
        assert res.ltcg_exemption_applied == 50000.0
        assert res.ltcg_exemption_headroom_remaining == 75000.0
        assert res.taxable_ltcg == 0.0
        assert res.total_tax_payable == 0.0

    def test_ltcg_exact_threshold_125000(self):
        """Exact ₹1,25,000 limit -> Zero tax, Zero headroom remaining."""
        trades = [TradeRecord("L1", "IN1", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 125100, 125100, 125000)]
        res = compute_capital_gains_tax(trades)
        assert res.ltcg_exemption_applied == 125000.0
        assert res.ltcg_exemption_headroom_remaining == 0.0
        assert res.taxable_ltcg == 0.0
        assert res.total_tax_payable == 0.0

    def test_ltcg_one_rupee_overflow_125001(self):
        """₹1,25,001 LTCG -> Exactly ₹1.00 taxable @ 12.5%."""
        trades = [TradeRecord("L1", "IN1", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 125101, 125101, 125001)]
        res = compute_capital_gains_tax(trades)
        assert res.ltcg_exemption_applied == 125000.0
        assert res.taxable_ltcg == 1.0
        assert res.ltcg_tax_base == 0.125
        assert res.total_tax_payable == pytest.approx(0.125 * 1.04, abs=0.001)

    def test_ltcg_substantial_overflow(self):
        trades = [TradeRecord("L1", "IN1", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 525100, 525100, 525000)]
        res = compute_capital_gains_tax(trades)
        assert res.ltcg_exemption_applied == 125000.0
        assert res.taxable_ltcg == 400000.0
        assert res.ltcg_tax_base == 400000.0 * LTCG_RATE # 50,000


# =============================================================================
# 5. SURCHARGE AND HEALTH & EDUCATION CESS TESTS
# =============================================================================

class TestSurchargeAndCess:
    def test_surcharge_tiers(self):
        # <= 50L -> 0%
        assert compute_surcharge_rate(4500000) == 0.0
        assert compute_surcharge_rate(5000000) == 0.0
        # > 50L <= 1 Cr -> 10%
        assert compute_surcharge_rate(6000000) == 0.10
        assert compute_surcharge_rate(10000000) == 0.10
        # > 1 Cr <= 2 Cr -> 15%
        assert compute_surcharge_rate(15000000) == 0.15
        assert compute_surcharge_rate(20000000) == 0.15
        # > 2 Cr -> Capped at 15% for Section 111A / 112A
        assert compute_surcharge_rate(30000000) == 0.15
        assert compute_surcharge_rate(100000000) == 0.15

    def test_tax_computation_with_surcharge_and_cess(self):
        trades = [TradeRecord("STCG", "IN1", 1, date(2024, 1, 1), 100, 100, date(2024, 6, 1), 1000100, 1000100, 1000000)]
        # STCG = 10,00,000 -> Tax @ 20% = 2,00,000
        # Other income = 60,00,000 -> Total = 70,00,000 (> 50L -> 10% surcharge)
        res = compute_capital_gains_tax(trades, total_other_income=6000000.0)
        assert res.basic_tax == 200000.0
        assert res.surcharge_rate == 0.10
        assert res.surcharge_amount == 20000.0
        # Cess = 4% on (2,00,000 + 20,000) = 4% of 2,20,000 = 8,800
        assert res.cess_amount == 8800.0
        assert res.total_tax_payable == 228800.0


# =============================================================================
# 6. TAX HARVESTING ENGINE TESTS
# =============================================================================

class TestHarvestingEngine:
    def test_friction_calculation(self):
        """Verifies STT (0.1% buy + 0.1% sell), GST (18%), brokerage, and turnover friction."""
        friction = estimate_round_trip_friction(buy_val=100000.0, sell_val=100000.0)
        # STT = 100 + 100 = 200
        # Brokerage = 20 + 20 = 40
        # Exchange charges = 0.00345% * 200k = 6.90
        # Stamp duty = 0.015% on 100k = 15.0
        # GST = 18% on (40 + 6.90) = 8.44
        # Total expected ~ 270.34
        assert 250.0 < friction < 300.0

    def test_gain_harvesting_cost_step_up(self):
        """Gain harvesting utilizes unused ₹1.25L exemption to step up cost basis."""
        trades = [TradeRecord("L1", "IN1", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 25100, 25100, 25000)]
        tax_res = compute_capital_gains_tax(trades)
        assert tax_res.ltcg_exemption_headroom_remaining == 100000.0

        today = date.today()
        open_pos = [
            OpenPosition(
                stock_name="GAIN_STOCK", isin="IN001", quantity=100,
                buy_date=today - timedelta(days=400), buy_price=1000, current_price=1500
            ) # +50,000 LTCG gain
        ]
        engine = HarvestingEngine(tax_res)
        recs = engine.generate_gain_harvesting_recommendations(open_pos)

        assert len(recs) == 1
        rec = recs[0]
        assert rec.stock_name == "GAIN_STOCK"
        assert rec.recommended_qty_to_sell == 100
        assert rec.total_unrealised_gain_booked == 50000.0
        assert rec.future_tax_saved == 50000.0 * LTCG_RATE
        assert rec.net_benefit > 0

    def test_gain_harvesting_zero_headroom(self):
        """When LTCG exemption headroom is exhausted, gain harvesting returns empty."""
        trades = [TradeRecord("L1", "IN1", 1, date(2022, 1, 1), 100, 100, date(2024, 6, 1), 200100, 200100, 200000)]
        tax_res = compute_capital_gains_tax(trades)
        assert tax_res.ltcg_exemption_headroom_remaining == 0.0

        today = date.today()
        open_pos = [
            OpenPosition("GAIN_STOCK", "IN001", 100, today - timedelta(days=400), 1000, 1500)
        ]
        engine = HarvestingEngine(tax_res)
        recs = engine.generate_gain_harvesting_recommendations(open_pos)
        assert len(recs) == 0

    def test_loss_harvesting_no_frivolous_sells_without_gains(self):
        """If there are no taxable gains to offset, loss harvesting does not generate sells."""
        tax_res = compute_capital_gains_tax([])
        today = date.today()
        open_pos = [
            OpenPosition("LOSS_STOCK", "IN001", 100, today - timedelta(days=100), 1000, 800)
        ]
        engine = HarvestingEngine(tax_res)
        recs = engine.generate_loss_harvesting_recommendations(open_pos)
        assert len(recs) == 0


# =============================================================================
# 7. PARSER & DATE PARSING RESILIENCE TESTS
# =============================================================================

class TestParserResilience:
    @pytest.mark.parametrize("date_input,expected_date", [
        ("01-04-2024", date(2024, 4, 1)),
        ("2024-04-01", date(2024, 4, 1)),
        ("01/04/2024", date(2024, 4, 1)),
        ("2024/04/01", date(2024, 4, 1)),
        ("01-Apr-2024", date(2024, 4, 1)),
        ("01.04.2024", date(2024, 4, 1)),
        ("2024-04-01 10:30:00", date(2024, 4, 1)),
        ("2024-04-01T15:45:00", date(2024, 4, 1)),
        (datetime(2024, 4, 1, 9, 15), date(2024, 4, 1)),
        (date(2024, 4, 1), date(2024, 4, 1)),
        (pd.Timestamp("2024-04-01"), date(2024, 4, 1)),
    ])
    def test_parse_date_formats(self, date_input, expected_date):
        assert _parse_date(date_input) == expected_date

    def test_parse_date_invalid(self):
        with pytest.raises(ValueError):
            _parse_date("not-a-date")
        with pytest.raises(ValueError):
            _parse_date(None)
        with pytest.raises(ValueError):
            _parse_date("")

    def test_zerodha_preamble_header_hunter(self):
        """Regression test verifying preamble title rows are not misidentified as table headers."""
        raw_sheet_rows = [
            ["Name", "Mohammad Saalim"],
            ["Unique Client Code", "6919136831"],
            [None, None],
            ["P&L Statement for stocks from 01-04-2025 TO 31-03-2026"],
            [None],
            ["Summary"],
            ["Realised P&L", 975.21],
            ["Charges block", "STT", "Brokerage"],
            ["Realised trades"],
            [None],
            ["Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Buy value", "Sell date", "Sell price", "Sell value", "Realised P&L", "Remark"]
        ]
        header_idx, headers = _find_header_row(raw_sheet_rows, "Trade Level")
        assert header_idx == 10
        assert "stock name" in headers
        assert "quantity" in headers
        assert "buy date" in headers

    def test_groww_and_upstox_header_hunter(self):
        groww_rows = [
            ["Client Report"],
            ["Symbol", "ISIN", "Qty", "Avg Buy Price", "Buy Date", "Avg Sell Price", "Sell Date", "Profit/Loss"]
        ]
        idx, headers = _find_header_row(groww_rows, "Groww")
        assert idx == 1
        assert "symbol" in headers
        assert "profit/loss" in headers


# =============================================================================
# 8. INDIAN CURRENCY FORMATTER TESTS
# =============================================================================

class TestIndianCurrencyFormatter:
    @pytest.mark.parametrize("amt,expected", [
        (0.0, "₹0.00"),
        (500.0, "₹500.00"),
        (125000.0, "₹1,25,000.00"),
        (1000000.0, "₹10,00,000.00"),
        (10000000.0, "₹1,00,00,000.00"),
        (-50000.0, "-₹50,000.00"),
        (1234567.89, "₹12,34,567.89"),
    ])
    def test_formatting(self, amt, expected):
        assert format_indian_currency(amt) == expected
