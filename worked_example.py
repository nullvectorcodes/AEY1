"""
Worked Example & CA Verification Script for Indian Equity Capital Gains Tax Engine.
Generates synthetic broker Excel data, computes tax liability under Finance (No. 2) Act 2024,
and outputs tax-loss/gain harvesting recommendations with full audit trail.
"""

import os
from src.tax_engine.synthetic_generator import generate_synthetic_broker_excel
from src.tax_engine.parser import parse_broker_pnl_excel
from src.tax_engine.engine import compute_capital_gains_tax
from src.tax_engine.harvesting import HarvestingEngine
from src.tax_engine.tax_rules import format_indian_currency

def main():
    excel_path = "synthetic_pnl_statement.xlsx"
    print("=" * 80)
    print(" 🇮🇳 INDIAN EQUITY CAPITAL GAINS TAX & HARVESTING ENGINE (FY 2024-25)")
    print("=" * 80)
    print(f"\n[1] Generating synthetic Zerodha/Groww P&L Excel file: {excel_path}...")
    generate_synthetic_broker_excel(excel_path)
    
    print("\n[2] Parsing broker Excel statement...")
    trades, summary_info, open_positions, warnings = parse_broker_pnl_excel(excel_path)
    
    print(f"    - Parsed Trades: {len(trades)} trades")
    print(f"    - Parsed Open Positions: {len(open_positions)} positions")
    if warnings:
        print("    - Parsing Warnings:")
        for w in warnings:
            print(f"      ⚠️  {w}")

    print("\n[3] Executing Core Tax Computation (Post-23 Jul 2024 Budget Rules)...")
    tax_result = compute_capital_gains_tax(trades, total_other_income=1200000.0, enable_grandfathering=True)
    summary = tax_result.summary_dict()

    print("\n" + "=" * 80)
    print(" 📊 TAX SUMMARY & BREAKDOWN FOR FINANCIAL YEAR 2024-25")
    print("=" * 80)
    print(f"  • Gross STCG Gains (Holding ≤ 365d) : {summary['gross_stcg_gains']}")
    print(f"  • Gross STCL Losses                 : {summary['gross_stcl_losses']}")
    print(f"  • Net STCG (Before set-off)         : {format_indian_currency(tax_result.net_stcg_before_setoff)}")
    print("  " + "-" * 55)
    print(f"  • Gross LTCG Gains (Holding > 365d) : {summary['gross_ltcg_gains']}")
    print(f"  • Gross LTCL Losses                 : {summary['gross_ltcl_losses']}")
    print(f"  • Net LTCG (Before set-off)         : {format_indian_currency(tax_result.net_ltcg_before_setoff)}")
    print("  " + "-" * 55)
    print(f"  • Speculative Intraday Income (Net) : {summary['gross_speculative_pnl']} (Taxed separately at slab rate)")
    print("=" * 80)

    print("\n ⚖️  SET-OFF RULES APPLIED (Sections 70 & 71)")
    print(f"  • STCL set-off against STCG         : {format_indian_currency(tax_result.stcl_setoff_against_stcg)}")
    print(f"  • STCL set-off against LTCG         : {format_indian_currency(tax_result.stcl_setoff_against_ltcg)}")
    print(f"  • LTCL set-off against LTCG         : {format_indian_currency(tax_result.ltcl_setoff_against_ltcg)}")
    print(f"  • STCL Carried Forward (8 AYs)      : {summary['stcl_carried_forward']}")
    print(f"  • LTCL Carried Forward (8 AYs)      : {summary['ltcl_carried_forward']}")

    print("\n 🏷️  EXEMPTION & TAXABLE CAPITAL GAINS")
    print(f"  • Net STCG Taxable (Sec 111A)       : {summary['net_stcg_after_setoff']}")
    print(f"  • Net LTCG Taxable (Sec 112A)       : {summary['net_ltcg_after_setoff']}")
    print(f"  • LTCG Exemption Applied (Sec 112A) : {summary['ltcg_exemption_applied']} (Exemption Limit: ₹1,25,000)")
    print(f"  • LTCG Exemption Headroom Remaining : {summary['ltcg_exemption_headroom']}")
    print(f"  • Taxable LTCG (Above ₹1.25L)       : {summary['taxable_ltcg']}")

    print("\n 💵 FINAL TAX PAYABLE COMPUTATION")
    print(f"  • STCG Tax @ 20% (Sec 111A)         : {summary['stcg_tax_20_pct']}")
    print(f"  • LTCG Tax @ 12.5% (Sec 112A)       : {summary['ltcg_tax_12_5_pct']}")
    print(f"  • Basic Tax Payable                 : {summary['basic_tax']}")
    print(f"  • Surcharge (Based on income slab)  : {summary['surcharge']}")
    print(f"  • Health & Education Cess @ 4%     : {summary['cess_4_pct']}")
    print(f"  -------------------------------------------------------------")
    print(f"  • TOTAL CAPITAL GAINS TAX PAYABLE  : {summary['total_tax_payable']}")
    print(f"  • Effective Tax Rate on Net Gains   : {summary['effective_tax_rate']}")
    print("=" * 80)

    print("\n 🌾 TAX HARVESTING ENGINE RECOMMENDATIONS")
    print("=" * 80)
    
    harvesting_engine = HarvestingEngine(tax_result)
    loss_recs = harvesting_engine.generate_loss_harvesting_recommendations(open_positions)
    gain_recs = harvesting_engine.generate_gain_harvesting_recommendations(open_positions)

    print(f"\n[A] TAX-LOSS HARVESTING ({len(loss_recs)} Actionable Opportunities):")
    if not loss_recs:
        print("  None found.")
    for idx, rec in enumerate(loss_recs, 1):
        print(f"\n  Recommendation #{idx}:")
        print(f"  SELL {rec.recommended_qty_to_sell} qty × {rec.stock_name} (holding since {rec.buy_date}, {rec.holding_category})")
        print(f"    • Total Unrealised Loss Booked    : {format_indian_currency(-rec.total_unrealised_loss_booked)}")
        print(f"    • Tax Saved (@ {rec.tax_saved_per_rupee_loss*100:.1f}%)        : {format_indian_currency(rec.tax_saved)}")
        print(f"    • Round-Trip Friction (STT/GST)   : {format_indian_currency(rec.estimated_round_trip_friction)}")
        print(f"    • NET TAX BENEFIT                 : {format_indian_currency(rec.net_benefit)}")
        print(f"    • Suggested Action                : {rec.reentry_advice}")

    print(f"\n[B] TAX-GAIN HARVESTING ({len(gain_recs)} Actionable Opportunities):")
    if not gain_recs:
        print("  None found.")
    for idx, rec in enumerate(gain_recs, 1):
        print(f"\n  Recommendation #{idx}:")
        print(f"  SELL {rec.recommended_qty_to_sell} qty × {rec.stock_name} (holding since {rec.buy_date}, LTCG)")
        print(f"    • Total Unrealised Gain Booked    : {format_indian_currency(rec.total_unrealised_gain_booked)}")
        print(f"    • Future Tax Saved (Cost Step-up) : {format_indian_currency(rec.future_tax_saved)}")
        print(f"    • Round-Trip Friction (STT/GST)   : {format_indian_currency(rec.estimated_round_trip_friction)}")
        print(f"    • NET BENEFIT                     : {format_indian_currency(rec.net_benefit)}")
        print(f"    • Suggested Action                : {rec.reentry_advice}")

    print("\n" + "=" * 80)
    print(" 📋 LINE-ITEM AUDIT TRAIL SUMMARY")
    print("=" * 80)
    for a in tax_result.audit_trail:
        print(f"  [Row #{a.trade_id:02d}] {a.stock_name:<20} | {a.classified_type:<20} | P&L: {format_indian_currency(a.adjusted_pnl):>12} | Note: {a.notes}")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    main()
