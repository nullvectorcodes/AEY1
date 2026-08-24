"""
Tax rules and legal parameters for Indian Equity Capital Gains (post-23 Jul 2024 budget rules).
"""

from dataclasses import dataclass
from datetime import datetime, date

# Finance (No. 2) Act 2024 Rates (effective transfers on/after 23-Jul-2024)
STCG_RATE = 0.20        # Section 111A
LTCG_RATE = 0.125       # Section 112A
LTCG_EXEMPTION_LIMIT = 125000.0  # ₹1.25 Lakh per financial year
HEALTH_EDUCATION_CESS = 0.04    # 4% Cess on tax + surcharge

# Holding period split for listed equities (in calendar days)
EQUITY_HOLDING_DAYS = 365

# Pre-2018 Grandfathering Cutoff Date (Section 112A grandfathering)
GRANDFATHERING_DATE = date(2018, 1, 31)

def compute_surcharge_rate(total_taxable_income: float) -> float:
    """
    Returns applicable surcharge rate under Section 111A / 112A special tax regime.
    Note: Surcharge on equity STCG (111A) and LTCG (112A) is capped at 15%.
    """
    if total_taxable_income > 20000000:     # > ₹2 Crore
        return 0.15
    elif total_taxable_income > 10000000:   # > ₹1 Crore
        return 0.15
    elif total_taxable_income > 5000000:    # > ₹50 Lakhs
        return 0.10
    return 0.0

def format_indian_currency(amount: float) -> str:
    """Formats a floating point amount into Indian Lakh/Crore rupee style: ₹1,25,000.00"""
    is_negative = amount < 0
    amount_abs = abs(amount)
    
    # Split into whole and fractional parts
    s = f"{amount_abs:.2f}"
    parts = s.split('.')
    integer_part = parts[0]
    decimal_part = parts[1]
    
    if len(integer_part) <= 3:
        formatted_int = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        
        # Group remaining digits in pairs from right to left
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        
        formatted_int = ",".join(groups) + "," + last_three
        
    prefix = "-₹" if is_negative else "₹"
    return f"{prefix}{formatted_int}.{decimal_part}"
