import csv
import os
from datetime import date, timedelta

def create_mock_csvs():
    os.makedirs("mock_broker_statements", exist_ok=True)
    os.makedirs("web_ui/public/mock_data", exist_ok=True)

    today = date.today()
    d_100 = (today - timedelta(days=100)).strftime("%Y-%m-%d")
    d_60 = (today - timedelta(days=60)).strftime("%Y-%m-%d")
    d_500 = (today - timedelta(days=500)).strftime("%Y-%m-%d")
    d_450 = (today - timedelta(days=450)).strftime("%Y-%m-%d")

    # 1. Zerodha Trades CSV
    zerodha_headers = [
        "Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Buy value",
        "Sell date", "Sell price", "Sell value", "Realised P&L", "Remark", "FMV 31-Jan-2018"
    ]
    zerodha_trades = [
        ["RELIANCE INDUSTRIES", "INE002A01018", 100, "2024-05-15", 2400.0, 240000.0, "2024-10-20", 2900.0, 290000.0, 50000.0, "Delivery STCG", ""],
        ["INFOSYS LIMITED", "INE009A01021", 150, "2023-01-10", 1400.0, 210000.0, "2024-11-15", 1900.0, 285000.0, 75000.0, "Delivery LTCG", ""],
        ["LARSEN & TOUBRO", "INE018A01030", 100, "2016-08-15", 900.0, 90000.0, "2024-10-05", 3600.0, 360000.0, 270000.0, "Delivery LTCG Pre-2018", 1450.0],
    ]

    # 2. Groww Trades CSV
    groww_headers = [
        "Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Buy value",
        "Sell date", "Sell price", "Sell value", "Realised P&L", "Remark"
    ]
    groww_trades = [
        ["TATA MOTORS LTD", "INE155A01022", 200, "2024-06-10", 950.0, 190000.0, "2024-12-15", 820.0, 164000.0, -26000.0, "Delivery STCL"],
        ["ICICI BANK LTD", "INE090A01021", 200, "2022-02-05", 720.0, 144000.0, "2024-08-10", 1200.0, 240000.0, 96000.0, "Delivery LTCG"],
        ["WIPRO LIMITED", "INE075A01022", 300, "2021-04-12", 550.0, 165000.0, "2024-09-01", 470.0, 141000.0, -24000.0, "Delivery LTCL"],
        ["STATE BANK OF INDIA", "INE062A01020", 500, "2024-07-12", 840.0, 420000.0, "2024-07-12", 855.0, 427500.0, 7500.0, "Intraday trade"],
    ]

    # 3. Open Holdings for Tax Harvesting CSV
    holdings_headers = [
        "Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Current price (CMP)", "Broker", "Category"
    ]
    holdings = [
        ["HDFC BANK LTD", "INE040A01034", 150, d_100, 1680.0, 1420.0, "Groww", "STCG Loss Harvest (-Rs 39,000)"],
        ["BHARTI AIRTEL", "INE397D01024", 100, d_60, 1550.0, 1350.0, "Zerodha", "STCG Loss Harvest (-Rs 20,000)"],
        ["TITAN COMPANY LTD", "INE280A01028", 50, d_500, 2600.0, 3500.0, "Groww", "LTCG Gain Step-Up (+Rs 45,000)"],
        ["ASIAN PAINTS LTD", "INE021A01026", 40, d_450, 2700.0, 3150.0, "Zerodha", "LTCG Gain Step-Up (+Rs 18,000)"],
    ]

    # 4. Master Consolidated Panelist Demo CSV (Combined Trades + Holdings)
    master_headers = [
        "Broker", "Record Type", "Stock name", "ISIN", "Quantity", "Buy date", "Buy price", 
        "Sell date", "Sell price", "Realised P&L", "Current price (CMP)", "Remark", "FMV 31-Jan-2018"
    ]
    master_rows = [
        ["Zerodha", "Realized Trade", "RELIANCE INDUSTRIES", "INE002A01018", 100, "2024-05-15", 2400.0, "2024-10-20", 2900.0, 50000.0, "", "Delivery STCG", ""],
        ["Zerodha", "Realized Trade", "INFOSYS LIMITED", "INE009A01021", 150, "2023-01-10", 1400.0, "2024-11-15", 1900.0, 75000.0, "", "Delivery LTCG", ""],
        ["Zerodha", "Realized Trade", "LARSEN & TOUBRO", "INE018A01030", 100, "2016-08-15", 900.0, "2024-10-05", 3600.0, 270000.0, "", "Delivery LTCG Pre-2018", 1450.0],
        ["Groww", "Realized Trade", "TATA MOTORS LTD", "INE155A01022", 200, "2024-06-10", 950.0, "2024-12-15", 820.0, -26000.0, "", "Delivery STCL", ""],
        ["Groww", "Realized Trade", "ICICI BANK LTD", "INE090A01021", 200, "2022-02-05", 720.0, "2024-08-10", 1200.0, 96000.0, "", "Delivery LTCG", ""],
        ["Groww", "Realized Trade", "WIPRO LIMITED", "INE075A01022", 300, "2021-04-12", 550.0, "2024-09-01", 470.0, -24000.0, "", "Delivery LTCL", ""],
        ["Groww", "Realized Trade", "STATE BANK OF INDIA", "INE062A01020", 500, "2024-07-12", 840.0, "2024-07-12", 855.0, 7500.0, "", "Intraday trade", ""],
        ["Groww", "Open Holding", "HDFC BANK LTD", "INE040A01034", 150, d_100, 1680.0, "", "", "", 1420.0, "Unrealized STCL -39000", ""],
        ["Zerodha", "Open Holding", "BHARTI AIRTEL", "INE397D01024", 100, d_60, 1550.0, "", "", "", 1350.0, "Unrealized STCL -20000", ""],
        ["Groww", "Open Holding", "TITAN COMPANY LTD", "INE280A01028", 50, d_500, 2600.0, "", "", "", 3500.0, "Unrealized LTCG +45000", ""],
        ["Zerodha", "Open Holding", "ASIAN PAINTS LTD", "INE021A01026", 40, d_450, 2700.0, "", "", "", 3150.0, "Unrealized LTCG +18000", ""],
    ]

    # 5. Dedicated Crypto / VDA Statement (CoinDCX / WazirX style - Section 115BBH)
    crypto_headers = [
        "Broker", "Asset Class", "Token / Pair", "Quantity", "Buy Date", "Buy Price (INR)", "Buy Value (INR)",
        "Sell Date", "Sell Price (INR)", "Sell Value (INR)", "Realised P&L", "Section 194S TDS (1%)", "Remark"
    ]
    crypto_trades = [
        ["CoinDCX", "Crypto/VDA", "BITCOIN (BTC/INR)", 0.05, "2024-05-10", 5500000.0, 275000.0, "2024-11-15", 7200000.0, 360000.0, 85000.0, 3600.0, "VDA Transfer Sec 115BBH"],
        ["CoinDCX", "Crypto/VDA", "ETHEREUM (ETH/INR)", 1.0, "2024-07-20", 280000.0, 280000.0, "2024-08-25", 220000.0, 220000.0, -60000.0, 2200.0, "VDA Loss (Disallowed Sec 115BBH)"],
        ["CoinDCX", "Crypto/VDA", "SOLANA (SOL/INR)", 10.0, "2024-09-01", 11000.0, 110000.0, "2024-12-10", 18000.0, 180000.0, 70000.0, 1800.0, "VDA Transfer Sec 115BBH"],
    ]

    # 6. Mixed Equity & Crypto Master Statement (Zerodha + Groww + CoinDCX Commingled)
    mixed_headers = [
        "Broker", "Asset Class", "Stock name", "ISIN", "Quantity", "Buy date", "Buy price",
        "Sell date", "Sell price", "Realised P&L", "Current price (CMP)", "Remark", "FMV 31-Jan-2018"
    ]
    mixed_rows = [
        # Equity Delivery Trades (Zerodha)
        ["Zerodha", "Equity", "RELIANCE INDUSTRIES", "INE002A01018", 100, "2024-05-15", 2400.0, "2024-10-20", 2900.0, 50000.0, "", "Delivery STCG (Sec 111A)", ""],
        ["Zerodha", "Equity", "INFOSYS LIMITED", "INE009A01021", 150, "2023-01-10", 1400.0, "2024-11-15", 1900.0, 75000.0, "", "Delivery LTCG (Sec 112A)", ""],
        ["Zerodha", "Equity", "LARSEN & TOUBRO", "INE018A01030", 100, "2016-08-15", 900.0, "2024-10-05", 3600.0, 270000.0, "", "Grandfathered LTCG (Sec 112A)", 1450.0],
        
        # Equity Delivery & Intraday Trades (Groww)
        ["Groww", "Equity", "TATA MOTORS LTD", "INE155A01022", 200, "2024-06-10", 950.0, "2024-12-15", 820.0, -26000.0, "", "Delivery STCL (Sec 70 Offset)", ""],
        ["Groww", "Equity", "ICICI BANK LTD", "INE090A01021", 200, "2022-02-05", 720.0, "2024-08-10", 1200.0, 96000.0, "", "Delivery LTCG (Sec 112A)", ""],
        ["Groww", "Equity", "WIPRO LIMITED", "INE075A01022", 300, "2021-04-12", 550.0, "2024-09-01", 470.0, -24000.0, "", "Delivery LTCL (Sec 70 Offset)", ""],
        ["Groww", "Equity", "STATE BANK OF INDIA", "INE062A01020", 500, "2024-07-12", 840.0, "2024-07-12", 855.0, 7500.0, "", "Intraday trade (Sec 73)", ""],
        
        # Virtual Digital Assets / Crypto Trades (CoinDCX - Flat 30% under Section 115BBH)
        ["CoinDCX", "Crypto/VDA", "BITCOIN (BTC/INR)", "CRYPTO_BTC", 0.05, "2024-05-10", 5500000.0, "2024-11-15", 7200000.0, 85000.0, "", "Crypto VDA Gain (Sec 115BBH)", ""],
        ["CoinDCX", "Crypto/VDA", "ETHEREUM (ETH/INR)", "CRYPTO_ETH", 1.0, "2024-07-20", 280000.0, "2024-08-25", 220000.0, -60000.0, "", "Crypto VDA Loss (No Setoff Sec 115BBH)", ""],
        ["CoinDCX", "Crypto/VDA", "SOLANA (SOL/INR)", "CRYPTO_SOL", 10.0, "2024-09-01", 11000.0, "2024-12-10", 18000.0, 70000.0, "", "Crypto VDA Gain (Sec 115BBH)", ""],

        # Open Equity Holdings for Tax Harvesting
        ["Groww", "Equity", "HDFC BANK LTD", "INE040A01034", 150, d_100, 1680.0, "", "", "", 1420.0, "Holding: Unrealized STCL -39000", ""],
        ["Zerodha", "Equity", "BHARTI AIRTEL", "INE397D01024", 100, d_60, 1550.0, "", "", "", 1350.0, "Holding: Unrealized STCL -20000", ""],
        ["Groww", "Equity", "TITAN COMPANY LTD", "INE280A01028", 50, d_500, 2600.0, "", "", "", 3500.0, "Holding: Unrealized LTCG +45000", ""],
        ["Zerodha", "Equity", "ASIAN PAINTS LTD", "INE021A01026", 40, d_450, 2700.0, "", "", "", 3150.0, "Holding: Unrealized LTCG +18000", ""],
    ]

    paths = [
        ("mock_broker_statements/zerodha_trades_fy24.csv", zerodha_headers, zerodha_trades),
        ("mock_broker_statements/groww_trades_fy24.csv", groww_headers, groww_trades),
        ("mock_broker_statements/open_holdings_harvesting.csv", holdings_headers, holdings),
        ("mock_broker_statements/master_panelist_demo.csv", master_headers, master_rows),
        ("mock_broker_statements/coindcx_crypto_fy24.csv", crypto_headers, crypto_trades),
        ("mock_broker_statements/mixed_equity_crypto_portfolio.csv", mixed_headers, mixed_rows),
        ("web_ui/public/mock_data/zerodha_trades_fy24.csv", zerodha_headers, zerodha_trades),
        ("web_ui/public/mock_data/groww_trades_fy24.csv", groww_headers, groww_trades),
        ("web_ui/public/mock_data/open_holdings_harvesting.csv", holdings_headers, holdings),
        ("web_ui/public/mock_data/master_panelist_demo.csv", master_headers, master_rows),
        ("web_ui/public/mock_data/coindcx_crypto_fy24.csv", crypto_headers, crypto_trades),
        ("web_ui/public/mock_data/mixed_equity_crypto_portfolio.csv", mixed_headers, mixed_rows),
    ]

    for p, h, rows in paths:
        with open(p, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(h)
            writer.writerows(rows)
        print(f"Generated {p}")

if __name__ == "__main__":
    create_mock_csvs()
