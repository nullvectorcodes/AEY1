"""
Synthetic Broker Statement Excel Generator for testing Zerodha/Groww/Upstox style P&L exports.
Creates realistic sample files containing Trade Level, Scrip Level, and Open Holdings sheets.
"""

import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from datetime import date
from typing import Optional

def generate_synthetic_broker_excel(file_path: str) -> None:
    wb = openpyxl.Workbook()
    
    # ---------------------------------------------------------
    # SHEET 1: Trade Level
    # ---------------------------------------------------------
    ws_trade = wb.active
    ws_trade.title = "Trade Level"
    ws_trade.views.sheetView[0].showGridLines = True
    
    # Header block
    ws_trade["A1"] = "TAX P&L STATEMENT (EQUITY DELIVERY & INTRADAY)"
    ws_trade["A1"].font = Font(name="Arial", size=14, bold=True, color="1E3A8A")
    
    ws_trade["A2"] = "Client Name: MOHAMMAD SAALIM"
    ws_trade["A3"] = "UCC / Client Code: ZER1D9842"
    ws_trade["A4"] = "Statement Period: 01-Apr-2024 to 31-Mar-2025 (FY 2024-25)"
    
    # Summary block
    ws_trade["A6"] = "P&L SUMMARY"
    ws_trade["A6"].font = Font(name="Arial", size=11, bold=True, color="1F2937")
    ws_trade["A7"] = "Realised P&L:"
    ws_trade["B7"] = 168450.00
    ws_trade["A8"] = "Unrealised P&L:"
    ws_trade["B8"] = -45200.00
    
    # Charges block
    ws_trade["D6"] = "CHARGES BREAKDOWN (Already netted in Realised P&L)"
    ws_trade["D6"].font = Font(name="Arial", size=11, bold=True, color="1F2937")
    ws_trade["D7"] = "STT / CTT Total:"; ws_trade["E7"] = 1850.50
    ws_trade["D8"] = "Brokerage Total:"; ws_trade["E8"] = 420.00
    ws_trade["D9"] = "GST Total:"; ws_trade["E9"] = 142.80
    ws_trade["D10"] = "Stamp Duty & Exchange Fees:"; ws_trade["E10"] = 185.20
    
    # Detail Table Headers at Row 12
    headers = [
        "Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Buy value",
        "Sell date", "Sell price", "Sell value", "Realised P&L", "Remark", "FMV 31-Jan-2018"
    ]
    
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    
    for col_num, h_text in enumerate(headers, 1):
        cell = ws_trade.cell(row=12, column=col_num, value=h_text)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        
    # Sample Trade Records (including STCG, LTCG, Grandfathered LTCG, Intraday, Losses)
    trades_data = [
        # STCG Trades (holding <= 365 days)
        ("RELIANCE INDUSTRIES", "INE002A01018", 100, "15-May-2024", 2400.00, 240000.00, "20-Oct-2024", 2900.00, 290000.00, 50000.00, "Delivery STCG", None),
        ("TATA MOTORS LTD", "INE155A01022", 200, "10-Jun-2024", 950.00, 190000.00, "15-Dec-2024", 820.00, 164000.00, -26000.00, "Delivery STCL", None),
        
        # LTCG Trades (holding > 365 days, post-2018)
        ("INFOSYS LIMITED", "INE009A01021", 150, "10-Jan-2023", 1400.00, 210000.00, "15-Nov-2024", 1900.00, 285000.00, 75000.00, "Delivery LTCG", None),
        ("ICICI BANK LTD", "INE090A01021", 200, "05-Feb-2022", 720.00, 144000.00, "10-Aug-2024", 1200.00, 240000.00, 96000.00, "Delivery LTCG", None),
        ("WIPRO LIMITED", "INE075A01022", 300, "12-Apr-2021", 550.00, 165000.00, "01-Sep-2024", 470.00, 141000.00, -24000.00, "Delivery LTCL", None),

        # Pre-2018 Grandfathered LTCG Trade (bought 2017)
        ("LARSEN & TOUBRO", "INE018A01030", 50, "15-Aug-2017", 1100.00, 55000.00, "05-Oct-2024", 3600.00, 180000.00, 125000.00, "Delivery LTCG Pre-2018", 1450.00),

        # Intraday Trades (Speculative Business Income)
        ("STATE BANK OF INDIA", "INE062A01020", 500, "12-Jul-2024", 840.00, 420000.00, "12-Jul-2024", 855.00, 427500.00, 7500.00, "Intraday trade", None),
        ("AXIS BANK LTD", "INE238A01034", 400, "18-Sep-2024", 1150.00, 460000.00, "18-Sep-2024", 1137.62, 455050.00, -4950.00, "Intraday trade", None)
    ]
    
    row_idx = 13
    for t in trades_data:
        ws_trade.cell(row=row_idx, column=1, value=t[0])
        ws_trade.cell(row=row_idx, column=2, value=t[1])
        ws_trade.cell(row=row_idx, column=3, value=t[2])
        ws_trade.cell(row=row_idx, column=4, value=t[3])
        ws_trade.cell(row=row_idx, column=5, value=t[4])
        ws_trade.cell(row=row_idx, column=6, value=t[5])
        ws_trade.cell(row=row_idx, column=7, value=t[6])
        ws_trade.cell(row=row_idx, column=8, value=t[7])
        ws_trade.cell(row=row_idx, column=9, value=t[8])
        ws_trade.cell(row=row_idx, column=10, value=t[9])
        ws_trade.cell(row=row_idx, column=11, value=t[10])
        if t[11] is not None:
            ws_trade.cell(row=row_idx, column=12, value=t[11])
        row_idx += 1

    # Total row
    ws_trade.cell(row=row_idx, column=1, value="Total").font = Font(bold=True)
    total_pnl = sum(t[9] for t in trades_data)
    ws_trade.cell(row=row_idx, column=10, value=total_pnl).font = Font(bold=True)

    # ---------------------------------------------------------
    # SHEET 2: Scrip Level
    # ---------------------------------------------------------
    ws_scrip = wb.create_sheet(title="Scrip Level")
    ws_scrip.views.sheetView[0].showGridLines = True
    
    scrip_headers = [
        "Stock name", "ISIN", "Quantity", "Avg Buy price", "Buy value",
        "Avg Sell price", "Sell value", "Realised P&L", "Realised P&L %"
    ]
    for c_idx, h_text in enumerate(scrip_headers, 1):
        cell = ws_scrip.cell(row=1, column=c_idx, value=h_text)
        cell.fill = header_fill
        cell.font = header_font

    scrip_rows = [
        ("RELIANCE INDUSTRIES", "INE002A01018", 100, 2400.00, 240000.00, 2900.00, 290000.00, 50000.00, "20.83%"),
        ("TATA MOTORS LTD", "INE155A01022", 200, 950.00, 190000.00, 820.00, 164000.00, -26000.00, "-13.68%"),
        ("INFOSYS LIMITED", "INE009A01021", 150, 1400.00, 210000.00, 1900.00, 285000.00, 75000.00, "35.71%"),
        ("ICICI BANK LTD", "INE090A01021", 200, 720.00, 144000.00, 1200.00, 240000.00, 96000.00, "66.67%"),
        ("WIPRO LIMITED", "INE075A01022", 300, 550.00, 165000.00, 470.00, 141000.00, -24000.00, "-14.55%"),
        ("LARSEN & TOUBRO", "INE018A01030", 50, 1100.00, 55000.00, 3600.00, 180000.00, 125000.00, "227.27%"),
        ("STATE BANK OF INDIA", "INE062A01020", 500, 840.00, 420000.00, 855.00, 427500.00, 7500.00, "1.79%"),
        ("AXIS BANK LTD", "INE238A01034", 400, 1150.00, 460000.00, 1137.62, 455050.00, -4950.00, "-1.08%"),
    ]

    s_row = 2
    for sr in scrip_rows:
        for col_i, val in enumerate(sr, 1):
            ws_scrip.cell(row=s_row, column=col_i, value=val)
        s_row += 1

    # Total row matching Trade level total (198,550.00)
    ws_scrip.cell(row=s_row, column=1, value="Total").font = Font(bold=True)
    ws_scrip.cell(row=s_row, column=8, value=total_pnl).font = Font(bold=True)

    # ---------------------------------------------------------
    # SHEET 3: Open Holdings
    # ---------------------------------------------------------
    ws_holdings = wb.create_sheet(title="Open Holdings")
    ws_holdings.views.sheetView[0].showGridLines = True
    
    h_headers = ["Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Current price (CMP)"]
    for c_idx, h_text in enumerate(h_headers, 1):
        cell = ws_holdings.cell(row=1, column=c_idx, value=h_text)
        cell.fill = header_fill
        cell.font = header_font

    holdings_data = [
        # STCG Position with Unrealised Loss (great Loss Harvesting candidate)
        ("HDFC BANK LTD", "INE040A01034", 150, "10-Aug-2024", 1680.00, 1420.00),  # Loss: ₹39,000 (STCG)
        ("BHARTI AIRTEL", "INE397D01024", 100, "20-Sep-2024", 1550.00, 1350.00),  # Loss: ₹20,000 (STCG)
        
        # LTCG Position with Unrealised Gain (great Gain Harvesting candidate for ₹1.25L exemption)
        ("TITAN COMPANY LTD", "INE280A01028", 50, "15-May-2023", 2600.00, 3500.00), # Gain: ₹45,000 (LTCG)
        ("ASIAN PAINTS LTD", "INE021A01026", 40, "10-Feb-2023", 2700.00, 3150.00)   # Gain: ₹18,000 (LTCG)
    ]

    h_row = 2
    for hd in holdings_data:
        for col_i, val in enumerate(hd, 1):
            ws_holdings.cell(row=h_row, column=col_i, value=val)
        h_row += 1

    wb.save(file_path)
