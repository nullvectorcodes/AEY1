"""
Core Tax Computation Engine for Indian Equity Capital Gains (Finance No. 2 Act 2024).
Handles STCG (20%), LTCG (12.5% above ₹1.25L), Intraday speculative separation,
Grandfathering (Pre-2018), Set-off ordering rules, Surcharge & Cess, and Line-item Audit Trail.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Dict, Any, Optional
from .parser import TradeRecord
from .tax_rules import (
    STCG_RATE, LTCG_RATE, LTCG_EXEMPTION_LIMIT, HEALTH_EDUCATION_CESS,
    GRANDFATHERING_DATE, compute_surcharge_rate, format_indian_currency
)

@dataclass
class AuditRecord:
    trade_id: int
    stock_name: str
    isin: str
    quantity: int
    buy_date: str
    sell_date: str
    holding_days: int
    raw_pnl: float
    classified_type: str
    grandfathered_cost: Optional[float]
    adjusted_pnl: float
    notes: str

@dataclass
class TaxCalculationResult:
    # Gross figures
    gross_stcg_gains: float = 0.0
    gross_stcl_losses: float = 0.0
    gross_ltcg_gains: float = 0.0
    gross_ltcl_losses: float = 0.0
    gross_speculative_gains: float = 0.0
    gross_speculative_losses: float = 0.0

    # Net figures before set-off
    net_stcg_before_setoff: float = 0.0
    net_ltcg_before_setoff: float = 0.0
    net_speculative_before_setoff: float = 0.0

    # Set-off adjustments
    stcl_setoff_against_stcg: float = 0.0
    stcl_setoff_against_ltcg: float = 0.0
    ltcl_setoff_against_ltcg: float = 0.0
    
    # Net taxable figures after set-off
    net_stcg_after_setoff: float = 0.0
    net_ltcg_after_setoff: float = 0.0
    net_speculative_after_setoff: float = 0.0

    # Carried forward losses
    stcl_carried_forward: float = 0.0
    ltcl_carried_forward: float = 0.0
    speculative_loss_carried_forward: float = 0.0

    # Exemption & Taxable Amounts
    ltcg_exemption_applied: float = 0.0
    ltcg_exemption_headroom_remaining: float = LTCG_EXEMPTION_LIMIT
    taxable_stcg: float = 0.0
    taxable_ltcg: float = 0.0

    # Tax computation
    stcg_tax_base: float = 0.0
    ltcg_tax_base: float = 0.0
    basic_tax: float = 0.0
    surcharge_rate: float = 0.0
    surcharge_amount: float = 0.0
    cess_amount: float = 0.0
    total_tax_payable: float = 0.0
    effective_tax_rate: float = 0.0

    # Intraday speculative tax (taxed at slab rate, displayed separately)
    speculative_income_taxable: float = 0.0

    # Audit Trail
    audit_trail: List[AuditRecord] = field(default_factory=list)

    def summary_dict(self) -> Dict[str, Any]:
        return {
            "gross_stcg_gains": format_indian_currency(self.gross_stcg_gains),
            "gross_stcl_losses": format_indian_currency(self.gross_stcl_losses),
            "gross_ltcg_gains": format_indian_currency(self.gross_ltcg_gains),
            "gross_ltcl_losses": format_indian_currency(self.gross_ltcl_losses),
            "gross_speculative_pnl": format_indian_currency(self.net_speculative_before_setoff),
            "net_stcg_after_setoff": format_indian_currency(self.net_stcg_after_setoff),
            "net_ltcg_after_setoff": format_indian_currency(self.net_ltcg_after_setoff),
            "ltcg_exemption_applied": format_indian_currency(self.ltcg_exemption_applied),
            "ltcg_exemption_headroom": format_indian_currency(self.ltcg_exemption_headroom_remaining),
            "taxable_stcg": format_indian_currency(self.taxable_stcg),
            "taxable_ltcg": format_indian_currency(self.taxable_ltcg),
            "stcg_tax_20_pct": format_indian_currency(self.stcg_tax_base),
            "ltcg_tax_12_5_pct": format_indian_currency(self.ltcg_tax_base),
            "basic_tax": format_indian_currency(self.basic_tax),
            "surcharge": format_indian_currency(self.surcharge_amount),
            "cess_4_pct": format_indian_currency(self.cess_amount),
            "total_tax_payable": format_indian_currency(self.total_tax_payable),
            "effective_tax_rate": f"{self.effective_tax_rate:.2f}%",
            "stcl_carried_forward": format_indian_currency(self.stcl_carried_forward),
            "ltcl_carried_forward": format_indian_currency(self.ltcl_carried_forward),
            "speculative_loss_carried_forward": format_indian_currency(self.speculative_loss_carried_forward)
        }

def compute_capital_gains_tax(
    trades: List[TradeRecord],
    total_other_income: float = 0.0,
    enable_grandfathering: bool = True
) -> TaxCalculationResult:
    """
    Executes the complete capital gains computation algorithm adhering to Indian Income Tax rules.
    """
    res = TaxCalculationResult()
    audit_trail: List[AuditRecord] = []

    # Step 1: Classify & Grandfather each trade
    for i, t in enumerate(trades, 1):
        raw_pnl = t.realised_pnl
        adj_pnl = raw_pnl
        notes = []
        gf_cost = None

        if t.is_intraday:
            cat = "Speculative (Intraday)"
            notes.append("Routed to speculative business income")
            if raw_pnl >= 0:
                res.gross_speculative_gains += raw_pnl
            else:
                res.gross_speculative_losses += abs(raw_pnl)
        elif t.is_ltcg:
            cat = "LTCG"
            # Grandfathering check (bought before 01-Feb-2018)
            if enable_grandfathering and t.buy_date <= GRANDFATHERING_DATE and t.fmv_2018 is not None:
                cost_of_acquisition = max(t.buy_price, min(t.fmv_2018, t.sell_price))
                gf_cost = cost_of_acquisition
                adj_pnl = (t.sell_price - cost_of_acquisition) * t.quantity
                notes.append(f"Grandfathering applied: FMV ₹{t.fmv_2018:.2f}, adj cost ₹{cost_of_acquisition:.2f}")
            else:
                notes.append("Holding > 365 days")

            if adj_pnl >= 0:
                res.gross_ltcg_gains += adj_pnl
            else:
                res.gross_ltcl_losses += abs(adj_pnl)
        else:
            cat = "STCG"
            notes.append("Holding <= 365 days")
            if adj_pnl >= 0:
                res.gross_stcg_gains += adj_pnl
            else:
                res.gross_stcl_losses += abs(adj_pnl)

        audit_trail.append(AuditRecord(
            trade_id=i, stock_name=t.stock_name, isin=t.isin, quantity=t.quantity,
            buy_date=t.buy_date.strftime("%Y-%m-%d"), sell_date=t.sell_date.strftime("%Y-%m-%d"),
            holding_days=t.holding_days, raw_pnl=raw_pnl, classified_type=cat,
            grandfathered_cost=gf_cost, adjusted_pnl=adj_pnl, notes="; ".join(notes)
        ))

    res.audit_trail = audit_trail

    # Step 2: Net before set-off
    res.net_stcg_before_setoff = res.gross_stcg_gains - res.gross_stcl_losses
    res.net_ltcg_before_setoff = res.gross_ltcg_gains - res.gross_ltcl_losses
    res.net_speculative_before_setoff = res.gross_speculative_gains - res.gross_speculative_losses

    # Step 3: Income Tax Set-Off Rules (Sections 70 & 71)
    
    # 3a. Speculative Intraday set-off (isolated)
    if res.net_speculative_before_setoff < 0:
        res.speculative_loss_carried_forward = abs(res.net_speculative_before_setoff)
        res.speculative_income_taxable = 0.0
    else:
        res.speculative_income_taxable = res.net_speculative_before_setoff

    # 3b. STCL Set-Off (STCL can offset STCG first, then LTCG)
    remaining_stcl = res.gross_stcl_losses
    current_stcg_gain = res.gross_stcg_gains

    if remaining_stcl > 0:
        # Offset against STCG
        setoff_stcg = min(remaining_stcl, current_stcg_gain)
        res.stcl_setoff_against_stcg = setoff_stcg
        remaining_stcl -= setoff_stcg
        current_stcg_gain -= setoff_stcg

    res.net_stcg_after_setoff = current_stcg_gain

    # 3c. LTCL Set-Off (LTCL can offset ONLY LTCG)
    remaining_ltcl = res.gross_ltcl_losses
    current_ltcg_gain = res.gross_ltcg_gains

    if remaining_ltcl > 0:
        setoff_ltcg_by_ltcl = min(remaining_ltcl, current_ltcg_gain)
        res.ltcl_setoff_against_ltcg = setoff_ltcg_by_ltcl
        remaining_ltcl -= setoff_ltcg_by_ltcl
        current_ltcg_gain -= setoff_ltcg_by_ltcl

    res.ltcl_carried_forward = remaining_ltcl

    # 3d. STCL set-off against remaining LTCG gain (if any)
    if remaining_stcl > 0 and current_ltcg_gain > 0:
        setoff_ltcg_by_stcl = min(remaining_stcl, current_ltcg_gain)
        res.stcl_setoff_against_ltcg = setoff_ltcg_by_stcl
        remaining_stcl -= setoff_ltcg_by_stcl
        current_ltcg_gain -= setoff_ltcg_by_stcl

    res.net_ltcg_after_setoff = current_ltcg_gain
    res.stcl_carried_forward = remaining_stcl

    # Step 4: Apply ₹1.25L LTCG Exemption (Section 112A)
    if res.net_ltcg_after_setoff > 0:
        if res.net_ltcg_after_setoff <= LTCG_EXEMPTION_LIMIT:
            res.ltcg_exemption_applied = res.net_ltcg_after_setoff
            res.ltcg_exemption_headroom_remaining = LTCG_EXEMPTION_LIMIT - res.net_ltcg_after_setoff
            res.taxable_ltcg = 0.0
        else:
            res.ltcg_exemption_applied = LTCG_EXEMPTION_LIMIT
            res.ltcg_exemption_headroom_remaining = 0.0
            res.taxable_ltcg = res.net_ltcg_after_setoff - LTCG_EXEMPTION_LIMIT
    else:
        res.ltcg_exemption_applied = 0.0
        res.ltcg_exemption_headroom_remaining = LTCG_EXEMPTION_LIMIT
        res.taxable_ltcg = 0.0

    res.taxable_stcg = res.net_stcg_after_setoff

    # Step 5: Compute Tax Payable
    res.stcg_tax_base = res.taxable_stcg * STCG_RATE
    res.ltcg_tax_base = res.taxable_ltcg * LTCG_RATE
    res.basic_tax = res.stcg_tax_base + res.ltcg_tax_base

    # Compute Surcharge & Cess
    total_taxable = res.taxable_stcg + res.taxable_ltcg + total_other_income
    res.surcharge_rate = compute_surcharge_rate(total_taxable)
    res.surcharge_amount = res.basic_tax * res.surcharge_rate
    res.cess_amount = (res.basic_tax + res.surcharge_amount) * HEALTH_EDUCATION_CESS
    res.total_tax_payable = res.basic_tax + res.surcharge_amount + res.cess_amount

    total_net_realised_gains = max(0.0, res.net_stcg_before_setoff) + max(0.0, res.net_ltcg_before_setoff)
    if total_net_realised_gains > 0:
        res.effective_tax_rate = (res.total_tax_payable / total_net_realised_gains) * 100.0
    else:
        res.effective_tax_rate = 0.0

    return res
