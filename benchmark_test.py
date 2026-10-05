"""
Comprehensive Benchmark Suite for AEY Indian Equity Tax & Harvesting Engine.
Evaluates tax liability and savings across 4 realistic investor personas:
1. Retail Swing Trader (Multi-broker STCG/STCL with unrealized loss harvesting)
2. HNI Legacy Investor (Pre-2018 Section 112A Grandfathering)
3. Disciplined Long-Term Investor (Tax-gain harvesting / ₹1.25L exemption step-up)
4. Active Hybrid Trader (Intraday speculative segregation + cross-broker loss set-off)
"""

from datetime import date
from src.tax_engine.parser import TradeRecord, OpenPosition
from src.tax_engine.engine import compute_capital_gains_tax
from src.tax_engine.harvesting import HarvestingEngine
from src.tax_engine.tax_rules import format_indian_currency, STCG_RATE, LTCG_RATE, HEALTH_EDUCATION_CESS

def run_benchmarks():
    scenarios = []
    tax_rate_stcg = STCG_RATE * (1 + HEALTH_EDUCATION_CESS) # 20.8%
    tax_rate_ltcg = LTCG_RATE * (1 + HEALTH_EDUCATION_CESS) # 13.0%

    # -------------------------------------------------------------------------
    # Scenario 1: Retail Multi-Broker Swing Trader
    # Broker 1 (Zerodha): STCG +₹1,40,000
    # Broker 2 (Groww): Realized STCL -₹60,000
    # Open Positions: Unrealized STCL -₹45,000 in Tata Motors & HDFC Bank
    # -------------------------------------------------------------------------
    trades_s1 = [
        TradeRecord(
            stock_name="RELIANCE", isin="INE002A01018", quantity=50,
            buy_date=date(2024, 5, 10), buy_price=2800.0, buy_value=140000.0,
            sell_date=date(2024, 9, 15), sell_price=3080.0, sell_value=154000.0,
            realised_pnl=14000.0, broker="Zerodha"
        ),
        TradeRecord(
            stock_name="INFY", isin="INE009A01021", quantity=100,
            buy_date=date(2024, 4, 1), buy_price=1400.0, buy_value=140000.0,
            sell_date=date(2024, 11, 20), sell_price=2660.0, sell_value=266000.0,
            realised_pnl=126000.0, broker="Zerodha"
        ),
        TradeRecord(
            stock_name="TCS", isin="INE467B01029", quantity=40,
            buy_date=date(2024, 6, 1), buy_price=4000.0, buy_value=160000.0,
            sell_date=date(2024, 10, 10), sell_price=2500.0, sell_value=100000.0,
            realised_pnl=-60000.0, broker="Groww"
        ),
    ]
    # Total STCG in Zerodha = +140,000. Total STCL in Groww = -60,000.
    # Open loss positions (bought recently -> STCG holding):
    from datetime import timedelta
    today = date.today()
    open_s1 = [
        OpenPosition(
            stock_name="TATA MOTORS", isin="INE155A01022", quantity=100,
            buy_date=today - timedelta(days=90), buy_price=1050.0, current_price=800.0,
            broker="Zerodha"
        ), # -25,000 STCG loss
        OpenPosition(
            stock_name="HDFC BANK", isin="INE040A01034", quantity=50,
            buy_date=today - timedelta(days=120), buy_price=1800.0, current_price=1400.0,
            broker="Groww"
        ), # -20,000 STCG loss
    ]

    # Baseline: Single-broker siloed reporting (Broker 1 pays tax on ₹1,40,000; Broker 2 carries forward -₹60,000 without cross set-off)
    baseline_tax_s1 = 140000.0 * tax_rate_stcg # ₹29,120

    # Traditional CA: Offsets -₹60k against ₹140k -> Net ₹80k taxed @ 20.8% = ₹16,640. No loss harvesting recommended. CA fee: ₹3,500
    ca_tax_s1 = 80000.0 * tax_rate_stcg
    ca_total_cost_s1 = ca_tax_s1 + 3500.0

    # AEY Engine: Consolidates cross-broker, applies Sec 70 set-off (Net ₹80,000).
    # Then harvests ₹45,000 unrealized losses.
    aey_res_s1 = compute_capital_gains_tax(trades_s1, total_other_income=1000000.0)
    harvest_s1 = HarvestingEngine(aey_res_s1)
    recs_s1 = harvest_s1.generate_loss_harvesting_recommendations(open_s1)
    harvested_tax_savings_s1 = sum(r.net_benefit for r in recs_s1)
    aey_final_tax_s1 = aey_res_s1.total_tax_payable - harvested_tax_savings_s1

    scenarios.append({
        "name": "Scenario 1: Retail Multi-Broker Swing Trader",
        "description": "2 Brokers (Zerodha + Groww), Cross-broker STCG/STCL + Tax-Loss Harvesting",
        "baseline_tax": baseline_tax_s1,
        "ca_tax_and_fee": ca_total_cost_s1,
        "aey_initial_tax": aey_res_s1.total_tax_payable,
        "harvest_benefit": harvested_tax_savings_s1,
        "aey_net_tax": aey_final_tax_s1,
        "savings_vs_baseline": baseline_tax_s1 - aey_final_tax_s1,
        "savings_vs_ca": ca_total_cost_s1 - aey_final_tax_s1,
        "pct_saved": ((baseline_tax_s1 - aey_final_tax_s1) / baseline_tax_s1) * 100
    })

    # -------------------------------------------------------------------------
    # Scenario 2: HNI Legacy Investor (Pre-2018 Section 112A Grandfathering)
    # Acquired L&T in 2016 @ ₹900. FMV on 31-Jan-2018 was ₹1,450. Sold in 2024 @ ₹3,600. Qty: 200.
    # Acquired Reliance in 2015 @ ₹500. FMV on 31-Jan-2018 was ₹950. Sold in 2024 @ ₹2,900. Qty: 150.
    # -------------------------------------------------------------------------
    trades_s2 = [
        TradeRecord(
            stock_name="LARSEN & TOUBRO", isin="INE018A01030", quantity=200,
            buy_date=date(2016, 3, 10), buy_price=900.0, buy_value=180000.0,
            sell_date=date(2024, 10, 15), sell_price=3600.0, sell_value=720000.0,
            realised_pnl=540000.0, fmv_2018=1450.0, broker="ICICI Direct"
        ),
        TradeRecord(
            stock_name="RELIANCE IND", isin="INE002A01018", quantity=150,
            buy_date=date(2015, 6, 20), buy_price=500.0, buy_value=75000.0,
            sell_date=date(2024, 11, 5), sell_price=2900.0, sell_value=435000.0,
            realised_pnl=360000.0, fmv_2018=950.0, broker="Zerodha"
        ),
    ]
    open_s2 = [
        OpenPosition(
            stock_name="ASIAN PAINTS", isin="INE021A01026", quantity=50,
            buy_date=date(2023, 1, 10), buy_price=3200.0, current_price=2600.0,
            broker="Zerodha"
        ), # -30,000 LTCG loss
    ]

    # Baseline: No grandfathering calculated.
    # Actual cost: (200*900) + (150*500) = 180,000 + 75,000 = ₹2,55,000
    # Sale value: (200*3600) + (150*2900) = 720,000 + 435,000 = ₹11,55,000
    # Un-grandfathered LTCG = ₹9,00,000. Exemption ₹1.25L. Taxable = ₹7,75,000.
    baseline_taxable_s2 = max(0.0, 900000.0 - 125000.0)
    baseline_tax_s2 = baseline_taxable_s2 * tax_rate_ltcg # ₹1,00,750

    # Traditional CA: Manually calculates grandfathering (₹7,22,500 - ₹1.25L = ₹5,97,500 taxable @ 13% = ₹77,675). CA Fee: ₹10,000.
    ca_tax_s2 = (722500.0 - 125000.0) * tax_rate_ltcg + 10000.0

    # AEY Engine: Grandfathering applied automatically.
    # LTCG = ₹7,22,500. Exemption ₹1.25L applied -> ₹5,97,500 taxable.
    # Loss harvesting generates ₹30,000 loss harvest -> net benefit ₹3,450.
    aey_res_s2 = compute_capital_gains_tax(trades_s2, total_other_income=2500000.0, enable_grandfathering=True)
    harvest_s2 = HarvestingEngine(aey_res_s2)
    recs_s2 = harvest_s2.generate_loss_harvesting_recommendations(open_s2)
    harvest_savings_s2 = sum(r.net_benefit for r in recs_s2)
    aey_final_tax_s2 = aey_res_s2.total_tax_payable - harvest_savings_s2

    scenarios.append({
        "name": "Scenario 2: HNI Legacy Investor (Pre-2018 Grandfathering)",
        "description": "3 Brokers, Sec 112A Grandfathering on Bluechips + Loss Harvesting",
        "baseline_tax": baseline_tax_s2,
        "ca_tax_and_fee": ca_tax_s2,
        "aey_initial_tax": aey_res_s2.total_tax_payable,
        "harvest_benefit": harvest_savings_s2,
        "aey_net_tax": aey_final_tax_s2,
        "savings_vs_baseline": baseline_tax_s2 - aey_final_tax_s2,
        "savings_vs_ca": ca_tax_s2 - aey_final_tax_s2,
        "pct_saved": ((baseline_tax_s2 - aey_final_tax_s2) / baseline_tax_s2) * 100
    })

    # -------------------------------------------------------------------------
    # Scenario 3: Disciplined Investor (Tax-Gain Harvesting / Exemption Step-Up)
    # Realized LTCG is only ₹35,000. Exemption limit is ₹1,25,000.
    # Headroom remaining = ₹90,000.
    # Open LTCG positions: ITC (unrealized gain ₹30,000), BEL (unrealized gain ₹40,000), NTPC (₹20,000).
    # -------------------------------------------------------------------------
    trades_s3 = [
        TradeRecord(
            stock_name="WIPRO", isin="INE075A01022", quantity=100,
            buy_date=date(2023, 4, 10), buy_price=400.0, buy_value=40000.0,
            sell_date=date(2024, 9, 1), sell_price=750.0, sell_value=75000.0,
            realised_pnl=35000.0, broker="Groww"
        ),
    ]
    open_s3 = [
        OpenPosition(
            stock_name="ITC LTD", isin="INE154A01025", quantity=150,
            buy_date=today - timedelta(days=450), buy_price=300.0, current_price=500.0,
            broker="Groww"
        ), # +30,000 gain (LTCG)
        OpenPosition(
            stock_name="BHARAT ELECTRONICS", isin="INE263A01024", quantity=200,
            buy_date=today - timedelta(days=400), buy_price=150.0, current_price=350.0,
            broker="Angel One"
        ), # +40,000 gain (LTCG)
        OpenPosition(
            stock_name="NTPC", isin="INE733E01010", quantity=100,
            buy_date=today - timedelta(days=500), buy_price=200.0, current_price=400.0,
            broker="Groww"
        ), # +20,000 gain (LTCG)
    ]
    aey_res_s3 = compute_capital_gains_tax(trades_s3, total_other_income=800000.0)
    harvest_s3 = HarvestingEngine(aey_res_s3)
    recs_s3 = harvest_s3.generate_gain_harvesting_recommendations(open_s3)
    net_benefit_s3 = sum(r.net_benefit for r in recs_s3)

    scenarios.append({
        "name": "Scenario 3: Disciplined Investor (LTCG Exemption Step-Up)",
        "description": "Utilizes ₹90,000 unused Sec 112A exemption via tax-gain harvesting before year-end",
        "baseline_tax": 11700.0, # Future tax paid due to lost exemption headroom (90k * 13%)
        "ca_tax_and_fee": 11700.0 + 3000.0, # CA does not suggest proactive cost step-up + ₹3k fee
        "aey_initial_tax": 0.0,
        "harvest_benefit": net_benefit_s3,
        "aey_net_tax": 11700.0 - net_benefit_s3, # Future tax liability avoided
        "savings_vs_baseline": net_benefit_s3,
        "savings_vs_ca": net_benefit_s3 + 3000.0,
        "pct_saved": (net_benefit_s3 / 11700.0) * 100
    })

    # -------------------------------------------------------------------------
    # Scenario 4: Active Hybrid Trader (Intraday + STCG + LTCG across 3 Brokers)
    # Trades commingled: Broker 1 STCG ₹2,20,000, Broker 2 STCL -₹80,000,
    # Broker 3 LTCG ₹3,10,000, Intraday P&L +₹32,000.
    # Open positions: Unrealized loss of ₹50,000 (STCG) + ₹40,000 (LTCG).
    # -------------------------------------------------------------------------
    trades_s4 = [
        TradeRecord(
            stock_name="ADANI PORTS", isin="INE742F01042", quantity=200,
            buy_date=date(2024, 4, 1), buy_price=1100.0, buy_value=220000.0,
            sell_date=date(2024, 8, 15), sell_price=2200.0, sell_value=440000.0,
            realised_pnl=220000.0, broker="Zerodha"
        ),
        TradeRecord(
            stock_name="BAJAJ AUTO", isin="INE917I01010", quantity=30,
            buy_date=date(2024, 5, 1), buy_price=9000.0, buy_value=270000.0,
            sell_date=date(2024, 9, 20), sell_price=6333.33, sell_value=190000.0,
            realised_pnl=-80000.0, broker="Groww"
        ),
        TradeRecord(
            stock_name="TITAN CO", isin="INE280A01028", quantity=80,
            buy_date=date(2023, 2, 10), buy_price=2500.0, buy_value=200000.0,
            sell_date=date(2024, 11, 1), sell_price=6375.0, sell_value=510000.0,
            realised_pnl=310000.0, broker="Upstox"
        ),
        TradeRecord(
            stock_name="STATE BANK", isin="INE062A01020", quantity=500,
            buy_date=date(2024, 10, 1), buy_price=780.0, buy_value=390000.0,
            sell_date=date(2024, 10, 1), sell_price=844.0, sell_value=422000.0,
            realised_pnl=32000.0, remark="Intraday", broker="Zerodha"
        ),
    ]
    open_s4 = [
        OpenPosition(
            stock_name="KOTAK MAHINDRA", isin="INE237A01028", quantity=50,
            buy_date=today - timedelta(days=60), buy_price=1800.0, current_price=1500.0,
            broker="Zerodha"
        ), # -15,000 STCG
        OpenPosition(
            stock_name="MARUTI SUZUKI", isin="INE585B01010", quantity=10,
            buy_date=today - timedelta(days=90), buy_price=12500.0, current_price=9000.0,
            broker="Groww"
        ), # -35,000 STCG
        OpenPosition(
            stock_name="TATA POWER", isin="INE245A01021", quantity=200,
            buy_date=today - timedelta(days=400), buy_price=400.0, current_price=200.0,
            broker="Upstox"
        ), # -40,000 LTCG
    ]

    baseline_tax_s4 = (220000.0 * tax_rate_stcg) + (max(0.0, 310000.0 - 125000.0) * tax_rate_ltcg) # ₹69,810
    ca_tax_s4 = (140000.0 * tax_rate_stcg) + (185000.0 * tax_rate_ltcg) + 6000.0

    aey_res_s4 = compute_capital_gains_tax(trades_s4, total_other_income=1500000.0)
    harvest_s4 = HarvestingEngine(aey_res_s4)
    recs_s4 = harvest_s4.generate_loss_harvesting_recommendations(open_s4)
    harvest_savings_s4 = sum(r.net_benefit for r in recs_s4)
    aey_final_tax_s4 = aey_res_s4.total_tax_payable - harvest_savings_s4

    scenarios.append({
        "name": "Scenario 4: Active Hybrid Trader (Intraday + Cross-Broker Set-Off)",
        "description": "3 Brokers, Speculative Segregation + Comprehensive Loss Harvesting",
        "baseline_tax": baseline_tax_s4,
        "ca_tax_and_fee": ca_tax_s4,
        "aey_initial_tax": aey_res_s4.total_tax_payable,
        "harvest_benefit": harvest_savings_s4,
        "aey_net_tax": aey_final_tax_s4,
        "savings_vs_baseline": baseline_tax_s4 - aey_final_tax_s4,
        "savings_vs_ca": ca_tax_s4 - aey_final_tax_s4,
        "pct_saved": ((baseline_tax_s4 - aey_final_tax_s4) / baseline_tax_s4) * 100
    })

    print("=" * 90)
    print(" 🏆 AEY TAX ENGINE COMPREHENSIVE BENCHMARK RESULTS")
    print("=" * 90)
    for s in scenarios:
        print(f"\n📌 {s['name']}")
        print(f"   {s['description']}")
        print(f"   • Baseline / Siloed Broker Tax   : {format_indian_currency(s['baseline_tax'])}")
        print(f"   • Traditional CA (Tax + Fees)    : {format_indian_currency(s['ca_tax_and_fee'])}")
        print(f"   • AEY Pre-Harvest Tax            : {format_indian_currency(s['aey_initial_tax'])}")
        print(f"   • AEY Harvesting Net Savings     : {format_indian_currency(s['harvest_benefit'])}")
        print(f"   • AEY Final Net Outflow          : {format_indian_currency(s['aey_net_tax'])}")
        print(f"   🔥 NET SAVED VS BASELINE         : {format_indian_currency(s['savings_vs_baseline'])} ({s['pct_saved']:.1f}% reduction)")
        print(f"   🔥 NET SAVED VS TRADITIONAL CA   : {format_indian_currency(s['savings_vs_ca'])}")

if __name__ == "__main__":
    run_benchmarks()
