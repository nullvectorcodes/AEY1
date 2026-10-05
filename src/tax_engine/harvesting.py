"""
Tax-Loss and Tax-Gain Harvesting Engine for Indian Retail Equity Portfolios.
Calculates optimal loss booking, cost basis step-up, friction costs, and exact share quantities.
"""

from dataclasses import dataclass
from datetime import date
from typing import List, Dict, Any, Optional
from .parser import OpenPosition
from .engine import TaxCalculationResult
from .tax_rules import STCG_RATE, LTCG_RATE, format_indian_currency

# Standard Indian Retail Brokerage Friction Parameters
BROKERAGE_RATE = 0.0003      # 0.03% or ₹20 per executed order (approx delivery brokerage)
STT_DELIVERY_RATE = 0.0010   # 0.1% STT on sell and buy delivery trades
STAMP_DUTY_RATE = 0.00015    # 0.015% Stamp duty on buy
GST_ON_BROKERAGE = 0.18      # 18% GST on brokerage & exchange charges
EXCHANGE_CHARGES = 0.000035  # 0.0035% NSE/BSE transaction charges

def estimate_round_trip_friction(buy_val: float, sell_val: float) -> float:
    """
    Estimates total round-trip friction cost (brokerage, STT, GST, exchange charges, stamp duty)
    for selling and repurchasing a portfolio holding.
    """
    stt_sell = sell_val * STT_DELIVERY_RATE
    stt_buy = buy_val * STT_DELIVERY_RATE
    
    brokerage_sell = min(20.0, sell_val * BROKERAGE_RATE)
    brokerage_buy = min(20.0, buy_val * BROKERAGE_RATE)
    
    exch_sell = sell_val * EXCHANGE_CHARGES
    exch_buy = buy_val * EXCHANGE_CHARGES
    
    stamp_duty = buy_val * STAMP_DUTY_RATE
    gst = (brokerage_sell + brokerage_buy + exch_sell + exch_buy) * GST_ON_BROKERAGE
    
    total_friction = stt_sell + stt_buy + brokerage_sell + brokerage_buy + exch_sell + exch_buy + stamp_duty + gst
    return round(total_friction, 2)

@dataclass
class LossHarvestingRecommendation:
    stock_name: str
    isin: str
    holding_category: str  # STCG or LTCG
    buy_date: str
    total_open_qty: int
    recommended_qty_to_sell: int
    unrealised_pnl_per_share: float
    total_unrealised_loss_booked: float
    tax_saved: float
    tax_saved_per_rupee_loss: float
    estimated_round_trip_friction: float
    net_benefit: float
    reentry_advice: str

    def format_card(self) -> str:
        return f"SELL {self.recommended_qty_to_sell} x {self.stock_name}"

@dataclass
class GainHarvestingRecommendation:
    stock_name: str
    isin: str
    buy_date: str
    total_open_qty: int
    recommended_qty_to_sell: int
    unrealised_gain_per_share: float
    total_unrealised_gain_booked: float
    future_tax_saved: float
    estimated_round_trip_friction: float
    net_benefit: float
    reentry_advice: str

class HarvestingEngine:
    def __init__(self, current_tax_result: TaxCalculationResult):
        self.tax_res = current_tax_result

    def generate_loss_harvesting_recommendations(
        self, open_positions: List[OpenPosition]
    ) -> List[LossHarvestingRecommendation]:
        """
        Scans open positions for unrealised losses and generates optimal loss booking recommendations.
        Ranks candidates by tax-saved-per-rupee-of-loss.
        Recommends EXACT quantity needed to offset taxable gains.
        """
        remaining_taxable_stcg = self.tax_res.taxable_stcg
        remaining_taxable_ltcg = self.tax_res.taxable_ltcg

        # Separate positions into STCG losses and LTCG losses
        stcg_loss_positions = [p for p in open_positions if not p.is_ltcg and p.unrealised_pnl < 0]
        ltcg_loss_positions = [p for p in open_positions if p.is_ltcg and p.unrealised_pnl < 0]

        recommendations: List[LossHarvestingRecommendation] = []

        # 1. Process STCG losses (can offset STCG @ 20% or LTCG @ 12.5%)
        for pos in stcg_loss_positions:
            per_share_loss = abs(pos.unrealised_pnl / pos.quantity)
            
            # Determine effective tax rate benefit
            if remaining_taxable_stcg > 0:
                effective_rate = STCG_RATE  # 20%
                max_target_loss = remaining_taxable_stcg
            elif remaining_taxable_ltcg > 0:
                effective_rate = LTCG_RATE  # 12.5%
                max_target_loss = remaining_taxable_ltcg
            else:
                effective_rate = 0.0  # No taxable gains to offset currently
                max_target_loss = 0.0

            if max_target_loss <= 0 or per_share_loss <= 0:
                continue

            # Calculate exact quantity to sell
            needed_qty = int(max_target_loss / per_share_loss) + 1
            sell_qty = min(pos.quantity, needed_qty)
            loss_to_book = sell_qty * per_share_loss
            tax_saved = loss_to_book * effective_rate

            friction = estimate_round_trip_friction(sell_qty * pos.buy_price, sell_qty * pos.current_price)
            net_benefit = tax_saved - friction

            if net_benefit > 0:
                recommendations.append(LossHarvestingRecommendation(
                    stock_name=pos.stock_name, isin=pos.isin, holding_category="STCG",
                    buy_date=pos.buy_date.strftime("%Y-%m-%d"), total_open_qty=pos.quantity,
                    recommended_qty_to_sell=sell_qty, unrealised_pnl_per_share=-per_share_loss,
                    total_unrealised_loss_booked=loss_to_book, tax_saved=tax_saved,
                    tax_saved_per_rupee_loss=effective_rate, estimated_round_trip_friction=friction,
                    net_benefit=net_benefit,
                    reentry_advice="Sell by 31-March, repurchase after T+1 or T+2 to avoid intraday reclassification"
                ))
                # Decrement remaining taxable gains so subsequent positions don't over-harvest
                if remaining_taxable_stcg > 0:
                    stcg_offset = min(loss_to_book, remaining_taxable_stcg)
                    remaining_taxable_stcg -= stcg_offset
                    leftover = loss_to_book - stcg_offset
                    if leftover > 0 and remaining_taxable_ltcg > 0:
                        remaining_taxable_ltcg -= min(leftover, remaining_taxable_ltcg)
                elif remaining_taxable_ltcg > 0:
                    remaining_taxable_ltcg -= min(loss_to_book, remaining_taxable_ltcg)

        # 2. Process LTCG losses (can offset LTCG @ 12.5% only)
        for pos in ltcg_loss_positions:
            per_share_loss = abs(pos.unrealised_pnl / pos.quantity)
            
            if remaining_taxable_ltcg > 0 and per_share_loss > 0:
                effective_rate = LTCG_RATE  # 12.5%
                max_target_loss = remaining_taxable_ltcg
                
                needed_qty = int(max_target_loss / per_share_loss) + 1
                sell_qty = min(pos.quantity, needed_qty)
                loss_to_book = sell_qty * per_share_loss
                tax_saved = loss_to_book * effective_rate

                friction = estimate_round_trip_friction(sell_qty * pos.buy_price, sell_qty * pos.current_price)
                net_benefit = tax_saved - friction

                if net_benefit > 0:
                    recommendations.append(LossHarvestingRecommendation(
                        stock_name=pos.stock_name, isin=pos.isin, holding_category="LTCG",
                        buy_date=pos.buy_date.strftime("%Y-%m-%d"), total_open_qty=pos.quantity,
                        recommended_qty_to_sell=sell_qty, unrealised_pnl_per_share=-per_share_loss,
                        total_unrealised_loss_booked=loss_to_book, tax_saved=tax_saved,
                        tax_saved_per_rupee_loss=effective_rate, estimated_round_trip_friction=friction,
                        net_benefit=net_benefit,
                        reentry_advice="Sell by 31-March, repurchase after T+1 or T+2 to avoid intraday reclassification"
                    ))
                    remaining_taxable_ltcg -= min(loss_to_book, remaining_taxable_ltcg)

        # Sort recommendations by net_benefit descending
        recommendations.sort(key=lambda r: r.net_benefit, reverse=True)
        return recommendations

    def generate_gain_harvesting_recommendations(
        self, open_positions: List[OpenPosition]
    ) -> List[GainHarvestingRecommendation]:
        """
        Scans open long-term positions with unrealised gains.
        If LTCG exemption headroom is remaining (< ₹1,25,000), recommends selling to step up cost basis at 0 tax.
        """
        headroom = self.tax_res.ltcg_exemption_headroom_remaining
        if headroom <= 0:
            return []

        ltcg_gain_positions = [p for p in open_positions if p.is_ltcg and p.unrealised_pnl > 0]
        recommendations: List[GainHarvestingRecommendation] = []
        remaining_headroom = headroom

        for pos in ltcg_gain_positions:
            if remaining_headroom <= 0:
                break

            per_share_gain = pos.unrealised_pnl / pos.quantity
            needed_qty = int(remaining_headroom / per_share_gain)
            if needed_qty <= 0:
                continue

            sell_qty = min(pos.quantity, needed_qty)
            gain_to_book = sell_qty * per_share_gain
            
            # Future LTCG tax saved by stepping up cost basis = 12.5% of gain booked
            future_tax_saved = gain_to_book * LTCG_RATE
            friction = estimate_round_trip_friction(sell_qty * pos.buy_price, sell_qty * pos.current_price)
            net_benefit = future_tax_saved - friction

            if net_benefit > 0:
                recommendations.append(GainHarvestingRecommendation(
                    stock_name=pos.stock_name, isin=pos.isin,
                    buy_date=pos.buy_date.strftime("%Y-%m-%d"), total_open_qty=pos.quantity,
                    recommended_qty_to_sell=sell_qty, unrealised_gain_per_share=per_share_gain,
                    total_unrealised_gain_booked=gain_to_book, future_tax_saved=future_tax_saved,
                    estimated_round_trip_friction=friction, net_benefit=net_benefit,
                    reentry_advice="Repurchase immediately (same day or next day) to step up cost basis tax-free"
                ))
                remaining_headroom -= gain_to_book

        recommendations.sort(key=lambda r: r.net_benefit, reverse=True)
        return recommendations
