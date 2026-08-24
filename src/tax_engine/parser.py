"""
Resilient Excel Parser for Broker P&L statements (Zerodha/Groww/Upstox style).
Parses Trade Level, Scrip Level, and optional Open Holdings sheets.
"""

import pandas as pd
import openpyxl
from datetime import datetime, date
from typing import List, Dict, Any, Tuple, Optional

class TradeRecord:
    def __init__(self, stock_name: str, isin: str, quantity: int,
                 buy_date: date, buy_price: float, buy_value: float,
                 sell_date: date, sell_price: float, sell_value: float,
                 realised_pnl: float, remark: str = "", fmv_2018: Optional[float] = None,
                 broker: str = "Broker", file_name: str = ""):
        self.broker = broker
        self.file_name = file_name
        self.stock_name = stock_name
        self.isin = isin
        self.quantity = quantity
        self.buy_date = buy_date
        self.buy_price = buy_price
        self.buy_value = buy_value
        self.sell_date = sell_date
        self.sell_price = sell_price
        self.sell_value = sell_value
        self.realised_pnl = realised_pnl
        self.remark = remark or ""
        self.fmv_2018 = fmv_2018
        
        # Derived fields
        self.holding_days = max(0, (sell_date - buy_date).days)
        self.is_intraday = "intraday" in self.remark.lower() or (buy_date == sell_date and "intraday" in self.remark.lower())
        self.is_ltcg = self.holding_days > 365 and not self.is_intraday

    def to_dict(self) -> Dict[str, Any]:
        return {
            "broker": self.broker,
            "file_name": self.file_name,
            "stock_name": self.stock_name,
            "isin": self.isin,
            "quantity": self.quantity,
            "buy_date": self.buy_date.strftime("%Y-%m-%d"),
            "buy_price": self.buy_price,
            "buy_value": self.buy_value,
            "sell_date": self.sell_date.strftime("%Y-%m-%d"),
            "sell_price": self.sell_price,
            "sell_value": self.sell_value,
            "realised_pnl": self.realised_pnl,
            "holding_days": self.holding_days,
            "category": "Speculative (Intraday)" if self.is_intraday else ("LTCG" if self.is_ltcg else "STCG"),
            "remark": self.remark
        }

class OpenPosition:
    def __init__(self, stock_name: str, isin: str, quantity: int,
                 buy_date: date, buy_price: float, current_price: float, fmv_2018: Optional[float] = None,
                 broker: str = "Broker", file_name: str = ""):
        self.broker = broker
        self.file_name = file_name
        self.stock_name = stock_name
        self.isin = isin
        self.quantity = quantity
        self.buy_date = buy_date
        self.buy_price = buy_price
        self.current_price = current_price
        self.fmv_2018 = fmv_2018
        
        self.investment_value = quantity * buy_price
        self.current_value = quantity * current_price
        self.unrealised_pnl = self.current_value - self.investment_value
        
        today = date.today()
        self.holding_days = max(0, (today - buy_date).days)
        self.is_ltcg = self.holding_days > 365

    def to_dict(self) -> Dict[str, Any]:
        return {
            "broker": self.broker,
            "file_name": self.file_name,
            "stock_name": self.stock_name,
            "isin": self.isin,
            "quantity": self.quantity,
            "buy_date": self.buy_date.strftime("%Y-%m-%d"),
            "buy_price": self.buy_price,
            "current_price": self.current_price,
            "unrealised_pnl": self.unrealised_pnl,
            "holding_days": self.holding_days,
            "category": "LTCG" if self.is_ltcg else "STCG"
        }

def _parse_date(val: Any) -> date:
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.date()
    if isinstance(val, date):
        return val
    val_str = str(val).strip()
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%b-%Y"):
        try:
            return datetime.strptime(val_str, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Unable to parse date string: '{val}'")

def _find_header_row(raw_rows: List[List[Any]], sheet_name: str = "") -> Tuple[int, List[str]]:
    """
    Robust Header Hunter: Scans down raw sheet rows to find the true table header row.
    Requires at least 3 matching column signatures (e.g. Stock Name + Quantity + Buy/Sell Price/Date).
    Prevents misidentifying sheet titles, client metadata, or section labels as headers.
    """
    for idx, row in enumerate(raw_rows):
        if not row:
            continue
        row_str_cells = [str(c).strip().lower() for c in row if c is not None]
        row_str_joined = " ".join(row_str_cells)

        has_stock = any(k in row_str_joined for k in ["stock name", "symbol", "scrip name", "scrip", "company name", "company"])
        has_qty = any(k in row_str_joined for k in ["quantity", "qty"])
        has_buy = any(k in row_str_joined for k in ["buy date", "buy price", "b_date", "b_price", "avg buy", "purchase"])
        has_sell = any(k in row_str_joined for k in ["sell date", "sell price", "s_date", "s_price", "avg sell", "realised p&l", "pnl", "realized p&l", "profit/loss", "net pnl"])

        matches = sum([has_stock, has_qty, has_buy, has_sell])
        if matches >= 3:
            return idx, row_str_cells

    raise ValueError(f"Could not locate valid table headers in sheet '{sheet_name}'. Sheet preamble or structure is unrecognized.")

def parse_broker_pnl_excel(file_path: str) -> Tuple[List[TradeRecord], Dict[str, Any], List[OpenPosition], List[str]]:
    """
    Parses a broker Excel statement containing 'Trade Level' and 'Scrip Level' sheets.
    Returns:
      - trades: List of TradeRecord objects
      - summary_info: Metadata dictionary containing header, charges, scrip total sanity check
      - open_positions: List of OpenPosition objects (if present)
      - warnings: List of warning/validation messages
    """
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet_names = wb.sheetnames
    
    trades: List[TradeRecord] = []
    open_positions: List[OpenPosition] = []
    warnings: List[str] = []
    summary_info: Dict[str, Any] = {"client_info": {}, "charges": {}, "scrip_total_pnl": None}

    # 1. Parse Trade Level Sheet
    trade_sheet_name = next((s for s in sheet_names if "trade" in s.lower() or "realised" in s.lower()), sheet_names[0])
    ws_trade = wb[trade_sheet_name]
    
    raw_rows = []
    for row in ws_trade.iter_rows(values_only=True):
        if any(cell is not None and str(cell).strip() != "" for cell in row):
            raw_rows.append([cell for cell in row])

    header_idx, headers = _find_header_row(raw_rows, trade_sheet_name)
    
    def get_col_idx(names: List[str]) -> int:
        for name in names:
            for idx, h in enumerate(headers):
                if name in h:
                    return idx
        return -1

    idx_stock = get_col_idx(["stock name", "stock", "symbol", "scrip", "company"])
    idx_isin = get_col_idx(["isin"])
    idx_qty = get_col_idx(["quantity", "qty"])
    idx_bdate = get_col_idx(["buy date", "b_date", "purchase date"])
    idx_bprice = get_col_idx(["buy price", "b_price", "avg buy", "buy rate", "purchase price"])
    idx_bval = get_col_idx(["buy value", "b_val", "purchase value"])
    idx_sdate = get_col_idx(["sell date", "s_date", "sale date"])
    idx_sprice = get_col_idx(["sell price", "s_price", "avg sell", "sell rate", "sale price"])
    idx_sval = get_col_idx(["sell value", "s_val", "sale value"])
    idx_pnl = get_col_idx(["realised p&l", "pnl", "realized p&l", "profit/loss", "net pnl", "realized gain"])
    idx_remark = get_col_idx(["remark", "type", "trade type"])
    idx_fmv = get_col_idx(["fmv", "31-jan-2018", "grandfathering"])

    for r in raw_rows[header_idx + 1:]:
        if len(r) <= idx_stock or r[idx_stock] is None:
            continue
        stock_name = str(r[idx_stock]).strip()
        if stock_name.lower() in ["total", "summary", "grand total", "realised trades", "scrip level"]:
            continue
        
        try:
            isin = str(r[idx_isin]).strip() if idx_isin != -1 and r[idx_isin] is not None else "IN0000000000"
            qty = int(r[idx_qty]) if idx_qty != -1 and r[idx_qty] is not None else 0
            if qty <= 0:
                continue
            b_date = _parse_date(r[idx_bdate])
            b_price = float(r[idx_bprice])
            b_val = float(r[idx_bval]) if idx_bval != -1 and r[idx_bval] is not None else qty * b_price
            s_date = _parse_date(r[idx_sdate])
            s_price = float(r[idx_sprice])
            s_val = float(r[idx_sval]) if idx_sval != -1 and r[idx_sval] is not None else qty * s_price
            pnl = float(r[idx_pnl]) if idx_pnl != -1 and r[idx_pnl] is not None else s_val - b_val
            remark = str(r[idx_remark]).strip() if idx_remark != -1 and r[idx_remark] is not None else ""
            fmv_2018 = float(r[idx_fmv]) if idx_fmv != -1 and r[idx_fmv] is not None else None
            
            trade = TradeRecord(
                stock_name=stock_name, isin=isin, quantity=qty,
                buy_date=b_date, buy_price=b_price, buy_value=b_val,
                sell_date=s_date, sell_price=s_price, sell_value=s_val,
                realised_pnl=pnl, remark=remark, fmv_2018=fmv_2018,
                broker="Zerodha", file_name=file_path
            )
            trades.append(trade)
        except Exception as e:
            warnings.append(f"Row skipped due to parsing error: {r} (Error: {e})")

    # 2. Parse Scrip Level Sheet for cross-check independently
    scrip_sheet_name = next((s for s in sheet_names if "scrip" in s.lower()), None)
    scrip_total_pnl = None
    if scrip_sheet_name:
        ws_scrip = wb[scrip_sheet_name]
        scrip_rows = [r for r in ws_scrip.iter_rows(values_only=True) if any(c is not None for c in r)]
        for r in scrip_rows:
            r_str = [str(c).lower() for c in r if c is not None]
            if any("total" in cell for cell in r_str):
                for cell in r:
                    if isinstance(cell, (int, float)) and cell != 0:
                        scrip_total_pnl = float(cell)
                        break

    summary_info["scrip_total_pnl"] = scrip_total_pnl
    
    # Cross-check trade total vs scrip total
    trade_total_pnl = sum(t.realised_pnl for t in trades)
    if scrip_total_pnl is not None and abs(trade_total_pnl - scrip_total_pnl) > 1.0:
        warnings.append(
            f"SANITY CHECK MISMATCH: Trade Level Total P&L (₹{trade_total_pnl:,.2f}) does NOT match "
            f"Scrip Level Total P&L (₹{scrip_total_pnl:,.2f}). Mismatch = ₹{abs(trade_total_pnl - scrip_total_pnl):,.2f}"
        )

    # 3. Parse Open Holdings Sheet if present
    holdings_sheet_name = next((s for s in sheet_names if "holding" in s.lower() or "open" in s.lower() or "portfolio" in s.lower()), None)
    if holdings_sheet_name:
        ws_holdings = wb[holdings_sheet_name]
        h_rows = [r for r in ws_holdings.iter_rows(values_only=True) if any(c is not None for c in r)]
        if h_rows:
            try:
                h_header_idx, h_headers = _find_header_row(h_rows, holdings_sheet_name)
                idx_h_stock = next((i for i, h in enumerate(h_headers) if "stock" in h or "symbol" in h), 0)
                idx_h_isin = next((i for i, h in enumerate(h_headers) if "isin" in h), 1)
                idx_h_qty = next((i for i, h in enumerate(h_headers) if "quantity" in h or "qty" in h), 2)
                idx_h_bdate = next((i for i, h in enumerate(h_headers) if "buy date" in h or "b_date" in h), 3)
                idx_h_bprice = next((i for i, h in enumerate(h_headers) if "buy price" in h or "b_price" in h), 4)
                idx_h_cprice = next((i for i, h in enumerate(h_headers) if "current" in h or "cmp" in h or "ltp" in h or "last price" in h), 5)
                
                for r in h_rows[h_header_idx + 1:]:
                    if len(r) <= idx_h_stock or r[idx_h_stock] is None:
                        continue
                    try:
                        s_name = str(r[idx_h_stock]).strip()
                        isin = str(r[idx_h_isin]).strip() if idx_h_isin < len(r) and r[idx_h_isin] is not None else "IN0000000000"
                        qty = int(r[idx_h_qty])
                        b_date = _parse_date(r[idx_h_bdate])
                        b_price = float(r[idx_h_bprice])
                        c_price = float(r[idx_h_cprice])
                        
                        open_pos = OpenPosition(stock_name=s_name, isin=isin, quantity=qty, buy_date=b_date, buy_price=b_price, current_price=c_price, broker="Zerodha", file_name=file_path)
                        open_positions.append(open_pos)
                    except Exception:
                        pass
            except Exception:
                pass

    return trades, summary_info, open_positions, warnings
