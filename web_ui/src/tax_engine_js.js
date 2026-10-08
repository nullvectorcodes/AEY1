/**
 * JavaScript implementation of Multi-Broker Indian Equity Capital Gains Tax Engine & Harvesting logic.
 * Supports format detection and consolidation for Zerodha, Groww, Upstox, Angel One, ICICI Direct, and Generic exports.
 */

import * as XLSX from 'xlsx';

export const STCG_RATE = 0.20;
export const LTCG_RATE = 0.125;
export const LTCG_EXEMPTION_LIMIT = 125000.0;
export const HEALTH_EDUCATION_CESS = 0.04;
export const GRANDFATHERING_DATE = new Date("2018-01-31");
export const VDA_CRYPTO_RATE = 0.30;
export const VDA_TDS_RATE = 0.01;

export function formatRupee(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0.00";
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  
  const parts = absVal.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  let formattedInt = "";
  if (integerPart.length <= 3) {
    formattedInt = integerPart;
  } else {
    const lastThree = integerPart.slice(-3);
    let remaining = integerPart.slice(0, -3);
    const groups = [];
    while (remaining.length > 2) {
      groups.unshift(remaining.slice(-2));
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      groups.unshift(remaining);
    }
    formattedInt = groups.join(',') + ',' + lastThree;
  }
  return (isNegative ? "-₹" : "₹") + formattedInt + "." + decimalPart;
}

export function parseDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const str = String(val).trim();
  const d1 = new Date(str);
  if (!isNaN(d1.getTime())) return d1;
  
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return new Date();
}

/**
 * Broker Format Detector based on sheet names and table headers.
 */
export function detectBrokerFormat(fileName, sheetNames, headersStr) {
  const fLower = fileName.toLowerCase();
  const sLower = sheetNames.map(s => s.toLowerCase()).join(" ");
  const hLower = headersStr.toLowerCase();

  if (fLower.includes("coindcx") || hLower.includes("coindcx") || hLower.includes("token") || hLower.includes("vda") || hLower.includes("crypto") || fLower.includes("wazirx") || fLower.includes("binance") || fLower.includes("mudrex")) {
    return "CoinDCX (Crypto)";
  }
  if (sLower.includes("trade level") || sLower.includes("scrip level") || fLower.includes("zerodha")) {
    return "Zerodha";
  }
  if (fLower.includes("groww") || hLower.includes("groww") || (hLower.includes("stock name") && hLower.includes("profit/loss"))) {
    return "Groww";
  }
  if (fLower.includes("upstox") || sLower.includes("upstox") || hLower.includes("net pnl")) {
    return "Upstox";
  }
  if (fLower.includes("angel") || hLower.includes("buy rate") || hLower.includes("sell rate")) {
    return "Angel One";
  }
  if (fLower.includes("icici") || hLower.includes("company name")) {
    return "ICICI Direct";
  }
  return "Generic Broker";
}

/**
 * Robust Header Hunter: Scans down raw sheet rows to find the true table header row.
 * Requires at least 3 matching column signatures (e.g. Stock Name + Quantity + Buy/Sell Price/Date or Current Price).
 */
export function findTrueHeaderRow(rawRows, sheetName = "") {
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row) continue;
    
    const rowStrCells = row.map(c => c !== null && c !== undefined ? String(c).trim().toLowerCase() : "");
    const joinedStr = rowStrCells.join(" ");

    const hasStock = ["stock name", "stock", "symbol", "scrip name", "scrip", "company name", "company", "token", "pair", "coin", "asset"].some(k => joinedStr.includes(k));
    const hasQty = ["quantity", "qty"].some(k => joinedStr.includes(k));
    const hasBuy = ["buy date", "buy price", "b_date", "b_price", "avg buy", "purchase"].some(k => joinedStr.includes(k));
    const hasSellOrCurrent = ["sell date", "sell price", "s_date", "s_price", "avg sell", "realised p&l", "pnl", "realized p&l", "profit/loss", "net pnl", "current price", "cmp", "ltp", "unrealised"].some(k => joinedStr.includes(k));

    const matches = [hasStock, hasQty, hasBuy, hasSellOrCurrent].filter(Boolean).length;
    if (matches >= 3) {
      return { headerIdx: i, headers: rowStrCells, headersStr: joinedStr };
    }
  }

  throw new Error(`Could not locate valid table headers in sheet '${sheetName}'.`);
}

/**
 * Parses a single statement ArrayBuffer and extracts trades & open positions tagged with broker name.
 * Robustly supports:
 * - Trade P&L statements (with Sell Price & Realized P&L)
 * - Open Holdings / Portfolio statements (with Current Price / CMP / LTP)
 * - Combined Master statements with both trades and open holdings
 */
export function parseSingleBrokerStatement(arrayBuffer, fileName) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetNames = wb.SheetNames;
  
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error(`Workbook '${fileName}' contains no sheets.`);
  }

  const trades = [];
  const openPositions = [];
  const warnings = [];
  let scripTotalPnl = null;

  // Sheet 1: Trade Level or Main Sheet
  const tradeSheetName = sheetNames.find(s => s.toLowerCase().includes("trade") || s.toLowerCase().includes("realised") || s.toLowerCase().includes("pnl") || s.toLowerCase().includes("report")) || sheetNames[0];
  const wsTrade = wb.Sheets[tradeSheetName];
  if (!wsTrade) {
    throw new Error(`Could not read sheet '${tradeSheetName}' in file '${fileName}'.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(wsTrade, { header: 1, defval: null });
  if (!rawRows || rawRows.length === 0) {
    throw new Error(`Sheet '${tradeSheetName}' in file '${fileName}' is completely empty.`);
  }

  const { headerIdx, headers, headersStr } = findTrueHeaderRow(rawRows, tradeSheetName);
  const brokerDetected = detectBrokerFormat(fileName, sheetNames, headersStr);

  const getCol = (keys) => keys.map(k => headers.findIndex(h => h.includes(k))).find(idx => idx !== -1) ?? -1;

  const idxStock = getCol(["stock name", "stock", "symbol", "scrip", "company", "token", "pair", "coin"]);
  const idxIsin = getCol(["isin", "token"]);
  const idxQty = getCol(["quantity", "qty"]);
  const idxBdate = getCol(["buy date", "b_date", "purchase date"]);
  const idxBprice = getCol(["buy price", "b_price", "avg buy", "buy rate", "purchase price"]);
  const idxBval = getCol(["buy value", "b_val", "purchase value"]);
  const idxSdate = getCol(["sell date", "s_date", "sale date"]);
  const idxSprice = getCol(["sell price", "s_price", "avg sell", "sell rate", "sale price"]);
  const idxSval = getCol(["sell value", "s_val", "sale value"]);
  const idxPnl = getCol(["realised p&l", "pnl", "realized p&l", "profit/loss", "net pnl", "realized gain"]);
  const idxRemark = getCol(["remark", "type", "trade type", "category"]);
  const idxFmv = getCol(["fmv", "31-jan-2018"]);
  const idxCprice = getCol(["current price", "cmp", "ltp", "current"]);
  const idxBrokerCol = getCol(["broker"]);
  const idxRecordType = getCol(["record type"]);
  const idxAssetClass = getCol(["asset class", "asset_class", "asset"]);
  const idxTds = getCol(["tds", "194s", "sec 194s"]);

  if (idxStock === -1 || idxQty === -1 || idxBprice === -1) {
    throw new Error(`File '${fileName}' (${brokerDetected} format) is missing required columns. Found: [${headers.filter(Boolean).join(", ")}]. Expected at least Stock Name, Quantity, Buy Price.`);
  }

  if (idxSprice === -1 && idxCprice === -1) {
    throw new Error(`File '${fileName}' does not contain either Sell Price or Current Price (CMP) columns.`);
  }

  for (let r = headerIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !row[idxStock]) continue;
    const stockName = String(row[idxStock]).trim();
    if (["total", "summary", "grand total", "realised p&l", "realised trades", "scrip level"].includes(stockName.toLowerCase())) continue;

    try {
      const isin = idxIsin !== -1 && row[idxIsin] ? String(row[idxIsin]).trim() : "IN0000000000";
      const qty = idxQty !== -1 && row[idxQty] ? parseFloat(row[idxQty]) : 0;
      if (qty <= 0) continue;

      const rowBroker = (idxBrokerCol !== -1 && row[idxBrokerCol]) ? String(row[idxBrokerCol]).trim() : brokerDetected;
      const assetClassStr = idxAssetClass !== -1 && row[idxAssetClass] ? String(row[idxAssetClass]).toLowerCase() : "";
      const bDate = parseDate(row[idxBdate]);
      const bPrice = parseFloat(row[idxBprice]) || 0;
      const bVal = idxBval !== -1 && row[idxBval] ? parseFloat(row[idxBval]) : qty * bPrice;
      const remark = idxRemark !== -1 && row[idxRemark] ? String(row[idxRemark]).trim() : "";
      const fmv2018 = idxFmv !== -1 && row[idxFmv] ? parseFloat(row[idxFmv]) : null;

      const isCrypto = assetClassStr.includes("crypto") || 
                       assetClassStr.includes("vda") || 
                       rowBroker.toLowerCase().includes("crypto") || 
                       rowBroker.toLowerCase().includes("coindcx") || 
                       rowBroker.toLowerCase().includes("wazirx") || 
                       rowBroker.toLowerCase().includes("binance") || 
                       rowBroker.toLowerCase().includes("mudrex") || 
                       stockName.toUpperCase().includes("BTC") || 
                       stockName.toUpperCase().includes("ETH") || 
                       stockName.toUpperCase().includes("SOL") || 
                       stockName.toUpperCase().includes("USDT") || 
                       stockName.toUpperCase().includes("BITCOIN") || 
                       stockName.toUpperCase().includes("ETHEREUM") || 
                       stockName.toUpperCase().includes("SOLANA") || 
                       remark.toLowerCase().includes("vda") || 
                       remark.toLowerCase().includes("crypto") || 
                       remark.toLowerCase().includes("115bbh");

      const recordTypeStr = idxRecordType !== -1 && row[idxRecordType] ? String(row[idxRecordType]).toLowerCase() : "";
      const isExplicitHolding = recordTypeStr.includes("holding") || recordTypeStr.includes("open");
      const hasSellPrice = idxSprice !== -1 && row[idxSprice] !== null && row[idxSprice] !== undefined && String(row[idxSprice]).trim() !== "";
      const hasCprice = idxCprice !== -1 && row[idxCprice] !== null && row[idxCprice] !== undefined && String(row[idxCprice]).trim() !== "";

      // Decision: Is this an open holding or a realized trade?
      if (isExplicitHolding || (!hasSellPrice && hasCprice)) {
        const cPrice = parseFloat(row[idxCprice]) || 0;
        const unrealisedPnl = (cPrice - bPrice) * qty;
        const holdingDays = Math.max(0, Math.round((new Date() - bDate) / (1000 * 60 * 60 * 24)));
        const isLtcg = !isCrypto && holdingDays > 365;

        openPositions.push({
          broker: rowBroker,
          file_name: fileName,
          stock_name: stockName,
          isin,
          quantity: qty,
          buy_date: bDate,
          buy_price: bPrice,
          current_price: cPrice,
          unrealised_pnl: unrealisedPnl,
          holding_days: holdingDays,
          is_ltcg: isLtcg,
          is_crypto: isCrypto
        });
      } else if (hasSellPrice) {
        const sDate = parseDate(row[idxSdate]);
        const sPrice = parseFloat(row[idxSprice]) || 0;
        const sVal = idxSval !== -1 && row[idxSval] ? parseFloat(row[idxSval]) : qty * sPrice;
        const pnl = idxPnl !== -1 && row[idxPnl] !== null ? parseFloat(row[idxPnl]) : sVal - bVal;
        const tdsWithheld = idxTds !== -1 && row[idxTds] ? parseFloat(row[idxTds]) : (isCrypto ? (sVal * VDA_TDS_RATE) : 0);

        const holdingDays = Math.max(0, Math.round((sDate - bDate) / (1000 * 60 * 60 * 24)));
        const isIntraday = !isCrypto && (remark.toLowerCase().includes("intraday") || (bDate.getTime() === sDate.getTime() && remark.toLowerCase().includes("intraday")));
        const isLtcg = !isCrypto && holdingDays > 365 && !isIntraday;

        trades.push({
          id: trades.length + 1,
          broker: rowBroker,
          file_name: fileName,
          stock_name: stockName,
          isin,
          quantity: qty,
          buy_date: bDate,
          buy_price: bPrice,
          buy_value: bVal,
          sell_date: sDate,
          sell_price: sPrice,
          sell_value: sVal,
          realised_pnl: pnl,
          holding_days: holdingDays,
          is_intraday: isIntraday,
          is_ltcg: isLtcg,
          is_crypto: isCrypto,
          tds_194s: tdsWithheld,
          remark,
          fmv_2018: fmv2018
        });
      }
    } catch (e) {
      warnings.push(`Row ${r + 1} skipped in '${fileName}': ${e.message}`);
    }
  }

  // Parse Scrip Level Sheet for Cross-Check if available
  const scripSheetName = sheetNames.find(s => s.toLowerCase().includes("scrip"));
  if (scripSheetName) {
    const wsScrip = wb.Sheets[scripSheetName];
    const sRows = XLSX.utils.sheet_to_json(wsScrip, { header: 1, defval: null });
    for (let r of sRows) {
      if (!r) continue;
      const rStr = r.map(c => String(c).toLowerCase());
      if (rStr.some(cell => cell.includes("total"))) {
        for (let cell of r) {
          if (typeof cell === 'number' && cell !== 0) {
            scripTotalPnl = cell;
            break;
          }
        }
      }
    }
  }

  const tradeTotalPnl = trades.reduce((acc, t) => acc + t.realised_pnl, 0);
  let crossCheckStatus = { verified: true, tradeTotal: tradeTotalPnl, scripTotal: scripTotalPnl, mismatchDelta: 0 };
  if (scripTotalPnl !== null && Math.abs(tradeTotalPnl - scripTotalPnl) > 1.0) {
    crossCheckStatus.verified = false;
    crossCheckStatus.mismatchDelta = Math.abs(tradeTotalPnl - scripTotalPnl);
    warnings.push(`File '${fileName}': Trade total (${formatRupee(tradeTotalPnl)}) differs from Scrip total (${formatRupee(scripTotalPnl)}).`);
  }

  // Parse Open Holdings Sheet if present in workbook
  let hasOpenHoldingsSheet = openPositions.length > 0;
  const holdingsSheetName = sheetNames.find(s => s.toLowerCase().includes("holding") || s.toLowerCase().includes("open") || s.toLowerCase().includes("portfolio"));
  if (holdingsSheetName && holdingsSheetName !== tradeSheetName) {
    hasOpenHoldingsSheet = true;
    const wsH = wb.Sheets[holdingsSheetName];
    const hRows = XLSX.utils.sheet_to_json(wsH, { header: 1, defval: null });
    try {
      const { headerIdx: hHeaderIdx, headers: hHeaders } = findTrueHeaderRow(hRows, holdingsSheetName);
      const idxHStock = hHeaders.findIndex(h => h.includes("stock") || h.includes("symbol") || h.includes("company"));
      const idxHIsin = hHeaders.findIndex(h => h.includes("isin"));
      const idxHQty = hHeaders.findIndex(h => h.includes("quantity") || h.includes("qty"));
      const idxHBdate = hHeaders.findIndex(h => h.includes("buy date") || h.includes("b_date") || h.includes("purchase date"));
      const idxHBprice = hHeaders.findIndex(h => h.includes("buy price") || h.includes("b_price") || h.includes("avg buy"));
      const idxHCprice = hHeaders.findIndex(h => h.includes("current") || h.includes("cmp") || h.includes("ltp"));
      const idxHBroker = hHeaders.findIndex(h => h.includes("broker"));

      for (let r = hHeaderIdx + 1; r < hRows.length; r++) {
        const row = hRows[r];
        if (!row || idxHStock === -1 || !row[idxHStock]) continue;
        try {
          const sName = String(row[idxHStock]).trim();
          const isin = idxHIsin !== -1 && row[idxHIsin] ? String(row[idxHIsin]).trim() : "IN0000000000";
          const qty = parseFloat(row[idxHQty]) || 0;
          if (qty <= 0) continue;

          const rowBroker = (idxHBroker !== -1 && row[idxHBroker]) ? String(row[idxHBroker]).trim() : brokerDetected;
          const isCrypto = rowBroker.toLowerCase().includes("crypto") || 
                           rowBroker.toLowerCase().includes("coindcx") || 
                           sName.toUpperCase().includes("BTC") || 
                           sName.toUpperCase().includes("ETH") || 
                           sName.toUpperCase().includes("SOL");
          const bDate = parseDate(row[idxHBdate]);
          const bPrice = parseFloat(row[idxHBprice]) || 0;
          const cPrice = parseFloat(row[idxHCprice]) || 0;
          const unrealisedPnl = (cPrice - bPrice) * qty;
          const holdingDays = Math.max(0, Math.round((new Date() - bDate) / (1000 * 60 * 60 * 24)));
          const isLtcg = !isCrypto && holdingDays > 365;

          openPositions.push({
            broker: rowBroker,
            file_name: fileName,
            stock_name: sName,
            isin,
            quantity: qty,
            buy_date: bDate,
            buy_price: bPrice,
            current_price: cPrice,
            unrealised_pnl: unrealisedPnl,
            holding_days: holdingDays,
            is_ltcg: isLtcg,
            is_crypto: isCrypto
          });
        } catch {}
      }
    } catch {}
  }

  if (trades.length === 0 && openPositions.length === 0) {
    throw new Error(`No valid trades or open positions could be extracted from '${fileName}'.`);
  }

  let dateRange = "Active Portfolio";
  if (trades.length > 0) {
    const minDate = new Date(Math.min(...trades.map(t => t.buy_date.getTime())));
    const maxDate = new Date(Math.max(...trades.map(t => t.sell_date.getTime())));
    dateRange = `${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`;
  } else if (openPositions.length > 0) {
    dateRange = `Open Holdings (${openPositions.length} scrips)`;
  }

  return { 
    broker: brokerDetected,
    fileName,
    trades, 
    openPositions, 
    warnings, 
    hasOpenHoldingsSheet,
    crossCheckStatus,
    tradeCount: trades.length,
    openPositionsCount: openPositions.length,
    dateRange
  };
}

/**
 * Consolidates parsed files from multiple brokers and checks for duplicates.
 */
export function consolidateMultipleStatements(parsedFilesList) {
  let consolidatedTrades = [];
  let consolidatedPositions = [];
  let duplicateWarnings = [];
  let filesSummary = [];

  const seenTradeKeys = new Map();

  parsedFilesList.forEach(fileMeta => {
    filesSummary.push({
      fileName: fileMeta.fileName,
      broker: fileMeta.broker,
      tradeCount: fileMeta.tradeCount,
      openPositionsCount: fileMeta.openPositions.length,
      dateRange: fileMeta.dateRange,
      crossCheck: fileMeta.crossCheckStatus
    });

    fileMeta.trades.forEach(t => {
      // Deduplication Key: isin + buy_date + sell_date + qty + sell_price
      const key = `${t.isin}_${t.buy_date.toISOString().split('T')[0]}_${t.sell_date.toISOString().split('T')[0]}_${t.quantity}_${t.sell_price}`;
      if (seenTradeKeys.has(key)) {
        const existing = seenTradeKeys.get(key);
        duplicateWarnings.push(`Possible duplicate trade: ${t.quantity} × ${t.stock_name} sold on ${t.sell_date.toISOString().split('T')[0]} appears in both '${existing.file_name}' (${existing.broker}) and '${t.file_name}' (${t.broker}).`);
      } else {
        seenTradeKeys.set(key, t);
      }

      consolidatedTrades.push(t);
    });

    consolidatedPositions.push(...fileMeta.openPositions);
  });

  const distinctBrokers = Array.from(new Set(consolidatedTrades.map(t => t.broker)));

  return {
    consolidatedTrades,
    consolidatedPositions,
    duplicateWarnings,
    filesSummary,
    distinctBrokers
  };
}

export function computeTax(trades, totalOtherIncome = 0, enableGrandfathering = true) {
  let grossStcgGains = 0;
  let grossStclLosses = 0;
  let grossLtcgGains = 0;
  let grossLtclLosses = 0;
  let grossSpecGains = 0;
  let grossSpecLosses = 0;

  // Virtual Digital Assets (Crypto) - Section 115BBH & Section 194S
  let grossCryptoGains = 0;
  let grossCryptoLosses = 0;
  let cryptoTdsCredits = 0;
  let cryptoTradesCount = 0;

  const auditTrail = [];

  trades.forEach((t, i) => {
    let adjPnl = t.realised_pnl;
    let cat = "STCG";
    let notes = [];
    let gfCost = null;

    if (t.is_crypto) {
      cryptoTradesCount++;
      cat = "VDA / Crypto (Sec 115BBH)";
      const tds = t.tds_194s || ((t.sell_value || 0) * VDA_TDS_RATE);
      cryptoTdsCredits += tds;

      if (adjPnl >= 0) {
        grossCryptoGains += adjPnl;
        notes.push(`Section 115BBH flat 30% tax + 4% cess. Section 194S TDS ${formatRupee(tds)} credited.`);
      } else {
        grossCryptoLosses += Math.abs(adjPnl);
        notes.push(`Disallowed Set-off: Under Sec 115BBH(2)(b), VDA loss cannot offset any gains or carry forward.`);
      }
    } else if (t.is_intraday) {
      cat = "Speculative (Intraday)";
      notes.push("Routed to speculative business income (Sec 73)");
      if (adjPnl >= 0) grossSpecGains += adjPnl;
      else grossSpecLosses += Math.abs(adjPnl);
    } else if (t.is_ltcg) {
      cat = "LTCG";
      if (enableGrandfathering && t.buy_date <= GRANDFATHERING_DATE && t.fmv_2018) {
        const costOfAcquisition = Math.max(t.buy_price, Math.min(t.fmv_2018, t.sell_price));
        gfCost = costOfAcquisition;
        adjPnl = (t.sell_price - costOfAcquisition) * t.quantity;
        notes.push(`Grandfathering: FMV ₹${t.fmv_2018}, adj cost ₹${costOfAcquisition}`);
      } else {
        notes.push("Holding > 365 days (Sec 112A)");
      }

      if (adjPnl >= 0) grossLtcgGains += adjPnl;
      else grossLtclLosses += Math.abs(adjPnl);
    } else {
      cat = "STCG";
      notes.push("Holding <= 365 days (Sec 111A)");
      if (adjPnl >= 0) grossStcgGains += adjPnl;
      else grossStclLosses += Math.abs(adjPnl);
    }

    auditTrail.push({
      id: i + 1,
      broker: t.broker || "Broker",
      file_name: t.file_name || "",
      stock_name: t.stock_name,
      isin: t.isin,
      quantity: t.quantity,
      buy_date: t.buy_date.toISOString().split('T')[0],
      sell_date: t.sell_date.toISOString().split('T')[0],
      holding_days: t.holding_days,
      raw_pnl: t.realised_pnl,
      classified_type: cat,
      grandfathered_cost: gfCost,
      adjusted_pnl: adjPnl,
      is_crypto: t.is_crypto || false,
      tds_194s: t.tds_194s || 0,
      notes: notes.join("; ")
    });
  });

  const netStcgBeforeSetoff = grossStcgGains - grossStclLosses;
  const netLtcgBeforeSetoff = grossLtcgGains - grossLtclLosses;
  const netSpecBeforeSetoff = grossSpecGains - grossSpecLosses;

  // Set-off order (Sections 70 & 71)
  let remainingStcl = grossStclLosses;
  let currentStcgGain = grossStcgGains;

  let stclSetoffStcg = 0;
  if (remainingStcl > 0) {
    stclSetoffStcg = Math.min(remainingStcl, currentStcgGain);
    remainingStcl -= stclSetoffStcg;
    currentStcgGain -= stclSetoffStcg;
  }

  let remainingLtcl = grossLtclLosses;
  let currentLtcgGain = grossLtcgGains;
  let ltclSetoffLtcg = 0;

  if (remainingLtcl > 0) {
    ltclSetoffLtcg = Math.min(remainingLtcl, currentLtcgGain);
    remainingLtcl -= ltclSetoffLtcg;
    currentLtcgGain -= ltclSetoffLtcg;
  }

  let stclSetoffLtcg = 0;
  if (remainingStcl > 0 && currentLtcgGain > 0) {
    stclSetoffLtcg = Math.min(remainingStcl, currentLtcgGain);
    remainingStcl -= stclSetoffLtcg;
    currentLtcgGain -= stclSetoffLtcg;
  }

  const netStcgAfterSetoff = currentStcgGain;
  const netLtcgAfterSetoff = currentLtcgGain;

  // Exemption limit ₹1.25L
  let ltcgExemptionApplied = 0;
  let ltcgExemptionHeadroom = LTCG_EXEMPTION_LIMIT;
  let taxableLtcg = 0;

  if (netLtcgAfterSetoff > 0) {
    if (netLtcgAfterSetoff <= LTCG_EXEMPTION_LIMIT) {
      ltcgExemptionApplied = netLtcgAfterSetoff;
      ltcgExemptionHeadroom = LTCG_EXEMPTION_LIMIT - netLtcgAfterSetoff;
      taxableLtcg = 0;
    } else {
      ltcgExemptionApplied = LTCG_EXEMPTION_LIMIT;
      ltcgExemptionHeadroom = 0;
      taxableLtcg = netLtcgAfterSetoff - LTCG_EXEMPTION_LIMIT;
    }
  }

  const taxableStcg = netStcgAfterSetoff;

  const stcgTaxBase = taxableStcg * STCG_RATE;
  const ltcgTaxBase = taxableLtcg * LTCG_RATE;
  const basicTax = stcgTaxBase + ltcgTaxBase;

  const cessAmount = basicTax * HEALTH_EDUCATION_CESS;
  const equityTotalTax = basicTax + cessAmount;

  // Crypto VDA Section 115BBH & Section 194S Computation
  const taxableCryptoGains = grossCryptoGains;
  const cryptoTaxBase = taxableCryptoGains * VDA_CRYPTO_RATE;
  const cryptoCess = cryptoTaxBase * HEALTH_EDUCATION_CESS;
  const cryptoGrossTax = cryptoTaxBase + cryptoCess; // Flat 31.2%
  const cryptoNetPayable = Math.max(0, cryptoGrossTax - cryptoTdsCredits);
  const cryptoLossDisallowed = grossCryptoLosses;
  const cryptoIllegalSetoffAverted = grossCryptoLosses;
  const cryptoPenaltyRiskAverted = grossCryptoLosses > 0 ? (grossCryptoLosses * 0.312 * 2.0) : 0; // Section 270A 200% penalty

  const grandGrossTax = equityTotalTax + cryptoGrossTax;
  const totalTaxPayable = equityTotalTax + cryptoNetPayable; // Net payable to ITD after TDS credit

  const totalGains = Math.max(0, netStcgBeforeSetoff) + Math.max(0, netLtcgBeforeSetoff) + grossCryptoGains;
  const effectiveTaxRate = totalGains > 0 ? (grandGrossTax / totalGains) * 100 : 0;

  return {
    grossStcgGains,
    grossStclLosses,
    grossLtcgGains,
    grossLtclLosses,
    grossSpecGains,
    grossSpecLosses,

    // Crypto / VDA Section 115BBH fields
    grossCryptoGains,
    grossCryptoLosses,
    taxableCryptoGains,
    cryptoTaxBase,
    cryptoCess,
    cryptoGrossTax,
    cryptoTdsCredits,
    cryptoNetPayable,
    cryptoLossDisallowed,
    cryptoIllegalSetoffAverted,
    cryptoPenaltyRiskAverted,
    cryptoTradesCount,
    hasCrypto: cryptoTradesCount > 0,

    // Equity Set-Off & Breakdown
    netStcgBeforeSetoff,
    netLtcgBeforeSetoff,
    netSpecBeforeSetoff,
    stclSetoffStcg,
    stclSetoffLtcg,
    ltclSetoffLtcg,
    netStcgAfterSetoff,
    netLtcgAfterSetoff,
    stclCarriedForward: remainingStcl,
    ltclCarriedForward: remainingLtcl,
    ltcgExemptionApplied,
    ltcgExemptionHeadroom,
    taxableStcg,
    taxableLtcg,
    stcgTaxBase,
    ltcgTaxBase,
    equityBasicTax: basicTax,
    equityCessAmount: cessAmount,
    equityTotalTax,
    basicTax,
    cessAmount,

    // Grand Totals
    grandGrossTax,
    totalTaxPayable,
    effectiveTaxRate,
    auditTrail
  };
}

export function generateHarvestingRecommendations(taxRes, openPositions) {
  const lossRecs = [];
  const gainRecs = [];

  const remainingStcgTaxable = taxRes.taxableStcg;
  const remainingLtcgTaxable = taxRes.taxableLtcg;

  openPositions.forEach(pos => {
    if (pos.is_crypto) {
      // Under Section 115BBH(2)(b), VDA paper losses cannot be offset against any gains or carried forward.
      // Excluded to ensure 100% statutory safe harbor.
      return;
    }

    const daysToLtcg = Math.max(0, 365 - pos.holding_days);
    const holdingProgressPct = Math.min(100, (pos.holding_days / 365) * 100);

    if (pos.unrealised_pnl < 0) {
      // Loss harvesting candidate
      const perShareLoss = Math.abs(pos.unrealised_pnl / pos.quantity);
      let effectiveRate = 0;
      let targetTaxable = 0;

      if (!pos.is_ltcg) {
        // STCG loss position
        if (remainingStcgTaxable > 0) {
          effectiveRate = STCG_RATE;
          targetTaxable = remainingStcgTaxable;
        } else if (remainingLtcgTaxable > 0) {
          effectiveRate = LTCG_RATE;
          targetTaxable = remainingLtcgTaxable;
        }
      } else {
        // LTCG loss position
        if (remainingLtcgTaxable > 0) {
          effectiveRate = LTCG_RATE;
          targetTaxable = remainingLtcgTaxable;
        }
      }

      if (targetTaxable > 0 && perShareLoss > 0) {
        const neededQty = Math.min(pos.quantity, Math.ceil(targetTaxable / perShareLoss));
        const lossToBook = neededQty * perShareLoss;
        const taxSaved = lossToBook * effectiveRate;
        const friction = Math.round((pos.buy_price * neededQty + pos.current_price * neededQty) * 0.0015 + 40);
        const netBenefit = taxSaved - friction;

        if (netBenefit > 0) {
          lossRecs.push({
            broker: pos.broker || "Broker",
            stock_name: pos.stock_name,
            isin: pos.isin,
            category: pos.is_ltcg ? "LTCG" : "STCG",
            buy_date: pos.buy_date.toISOString().split('T')[0],
            open_qty: pos.quantity,
            recommended_qty: neededQty,
            per_share_loss: perShareLoss,
            loss_booked: lossToBook,
            tax_saved: taxSaved,
            effective_rate: effectiveRate,
            friction,
            net_benefit: netBenefit,
            holding_days: pos.holding_days,
            days_to_ltcg: daysToLtcg,
            holding_progress_pct: holdingProgressPct,
            advice: `Sell by 31-March on ${pos.broker || "your broker"} to offset consolidated gains`
          });
        }
      }
    } else if (pos.is_ltcg && pos.unrealised_pnl > 0) {
      // Gain harvesting candidate for ₹1.25L exemption headroom
      const headroom = taxRes.ltcgExemptionHeadroom;
      if (headroom > 0) {
        const perShareGain = pos.unrealised_pnl / pos.quantity;
        const neededQty = Math.min(pos.quantity, Math.floor(headroom / perShareGain));
        if (neededQty > 0) {
          const gainBooked = neededQty * perShareGain;
          const futureTaxSaved = gainBooked * LTCG_RATE;
          const friction = Math.round((pos.buy_price * neededQty + pos.current_price * neededQty) * 0.0015 + 40);
          const netBenefit = futureTaxSaved - friction;

          if (netBenefit > 0) {
            gainRecs.push({
              broker: pos.broker || "Broker",
              stock_name: pos.stock_name,
              isin: pos.isin,
              buy_date: pos.buy_date.toISOString().split('T')[0],
              open_qty: pos.quantity,
              recommended_qty: neededQty,
              per_share_gain: perShareGain,
              gain_booked: gainBooked,
              future_tax_saved: futureTaxSaved,
              friction,
              net_benefit: netBenefit,
              holding_days: pos.holding_days,
              days_to_ltcg: daysToLtcg,
              holding_progress_pct: holdingProgressPct,
              advice: `Repurchase immediately on ${pos.broker || "your broker"} to step up cost basis tax-free`
            });
          }
        }
      }
    }
  });

  lossRecs.sort((a, b) => b.net_benefit - a.net_benefit);
  gainRecs.sort((a, b) => b.net_benefit - a.net_benefit);

  return { lossRecs, gainRecs };
}

/**
 * Model Tax Savings & Comparative Benchmark Engine
 * Evaluates the 3 core approaches:
 * 1. Siloed Broker Default (Naive Baseline): No cross-broker loss set-offs, no pre-2018 grandfathering, 0 harvesting
 * 2. Traditional CA Audit: Manual set-off + ₹3,500 CA advisory fee, but 0 proactive pre-year-end harvesting
 * 3. AEY Engine (Our Model): Real-time statutory consolidation + pre-2018 grandfathering + friction-adjusted tax-loss & gain harvesting
 */
export function computeModelTaxSavings(trades = [], openPositions = [], harvestingRecs = null) {
  if (!trades || trades.length === 0) {
    return {
      withoutAeyTax: 0,
      caTaxAndFees: 0,
      aeyPreHarvestTax: 0,
      aeyHarvestingSavings: 0,
      aeyFinalNetOutflow: 0,
      netSavedVsBaseline: 0,
      netSavedVsCA: 0,
      pctSavedVsBaseline: 0,
      breakdown: {
        crossBrokerSetoff: 0,
        grandfathering: 0,
        lossHarvesting: 0,
        gainHarvesting: 0,
        caFeeAvoided: 3500
      },
      brokerBreakdown: []
    };
  }

  // 1. Group by broker for Siloed Baseline
  const distinctBrokers = Array.from(new Set(trades.map(t => t.broker || "Broker")));
  let siloedTaxSum = 0;
  const brokerBreakdown = [];

  distinctBrokers.forEach(b => {
    const bTrades = trades.filter(t => (t.broker || "Broker") === b);
    const bResNoGf = computeTax(bTrades, 0, false);
    siloedTaxSum += bResNoGf.totalTaxPayable;
    brokerBreakdown.push({
      broker: b,
      tradeCount: bTrades.length,
      stcgGains: bResNoGf.grossStcgGains,
      stclLosses: bResNoGf.grossStclLosses,
      ltcgGains: bResNoGf.grossLtcgGains,
      ltclLosses: bResNoGf.grossLtclLosses,
      taxPayable: bResNoGf.totalTaxPayable
    });
  });

  // Consolidated without grandfathering
  const consolidatedNoGf = computeTax(trades, 0, false);
  // Full AEY statutory consolidated computation (with grandfathering & Sec 70/71 set-offs)
  const aeyRes = computeTax(trades, 0, true);
  const aeyPreHarvestTax = aeyRes.totalTaxPayable;

  // Driver 1: Grandfathering savings
  const grandfatheringSavings = Math.max(0, consolidatedNoGf.totalTaxPayable - aeyPreHarvestTax);

  // Driver 2: Cross-broker set-off savings
  const crossBrokerSetoffSavings = Math.max(0, siloedTaxSum - consolidatedNoGf.totalTaxPayable);

  // Without AEY Baseline = siloed tax without grandfathering
  const withoutAeyTax = Math.max(siloedTaxSum, aeyPreHarvestTax + grandfatheringSavings + crossBrokerSetoffSavings);

  // Traditional CA Baseline: Consolidated tax with grandfathering + CA advisory fee
  const caFee = 3500.0;
  const caTaxAndFees = aeyPreHarvestTax + caFee;

  // Harvesting benefits
  const lossRecs = harvestingRecs?.lossRecs || [];
  const gainRecs = harvestingRecs?.gainRecs || [];

  const lossHarvestBenefit = lossRecs.reduce((sum, r) => sum + (r.net_benefit || 0), 0);
  const gainHarvestBenefit = gainRecs.reduce((sum, r) => sum + (r.net_benefit || 0), 0);
  const aeyHarvestingSavings = lossHarvestBenefit + gainHarvestBenefit;

  // Driver 3: Crypto Statutory Safe-Harbor & TDS Credit
  const cryptoPenaltyAverted = aeyRes.cryptoPenaltyRiskAverted || 0;
  const cryptoTdsClaimed = aeyRes.cryptoTdsCredits || 0;
  const cryptoLossDisallowed = aeyRes.cryptoLossDisallowed || 0;

  // AEY Final Net Outflow after loss harvesting
  const aeyFinalNetOutflow = Math.max(0, aeyPreHarvestTax - lossHarvestBenefit);

  // Net Savings
  const netSavedVsBaseline = Math.max(0, withoutAeyTax - aeyFinalNetOutflow + gainHarvestBenefit + cryptoPenaltyAverted + cryptoTdsClaimed);
  const netSavedVsCA = Math.max(0, caTaxAndFees - aeyFinalNetOutflow + gainHarvestBenefit + cryptoPenaltyAverted);
  const pctSavedVsBaseline = withoutAeyTax > 0 ? Math.min(100, (netSavedVsBaseline / (withoutAeyTax + cryptoPenaltyAverted + cryptoTdsClaimed)) * 100) : 0;

  return {
    withoutAeyTax,
    caTaxAndFees,
    aeyPreHarvestTax,
    aeyHarvestingSavings,
    aeyFinalNetOutflow,
    netSavedVsBaseline,
    netSavedVsCA,
    pctSavedVsBaseline,
    breakdown: {
      crossBrokerSetoff: crossBrokerSetoffSavings,
      grandfathering: grandfatheringSavings,
      lossHarvesting: lossHarvestBenefit,
      gainHarvesting: gainHarvestBenefit,
      caFeeAvoided: caFee,
      cryptoPenaltyAverted,
      cryptoTdsClaimed,
      cryptoLossDisallowed
    },
    brokerBreakdown
  };
}

export const BENCHMARK_PERSONAS = [
  {
    id: "persona_1",
    name: "Retail Swing Trader",
    tag: "Multi-Broker STCG/STCL",
    description: "Zerodha (STCG ₹1.4L) + Groww (STCL -₹60k) + Harvesting open positions in Tata Motors & HDFC Bank (-₹45k).",
    baselineTax: 29120.0,
    caTaxAndFees: 20140.0,
    aeyPreHarvestTax: 16640.0,
    harvestBenefit: 8517.10,
    aeyFinalOutflow: 8122.90,
    netSavedVsBaseline: 20997.10,
    netSavedVsCA: 12017.10,
    pctSaved: 72.1,
    keyTakeaway: "Section 70 cross-broker loss absorption wipes out ₹12,480 in taxes immediately. Strategic tax-loss harvesting saves an additional ₹8,517."
  },
  {
    id: "persona_2",
    name: "HNI Legacy Investor",
    tag: "Pre-2018 Grandfathering",
    description: "Bluechip shares (L&T and Reliance) acquired in 2015-2016. Automatic FMV stepped up as of 31-Jan-2018.",
    baselineTax: 100750.0,
    caTaxAndFees: 87675.0,
    aeyPreHarvestTax: 77675.0,
    harvestBenefit: 3376.82,
    aeyFinalOutflow: 74298.18,
    netSavedVsBaseline: 26451.82,
    netSavedVsCA: 13376.82,
    pctSaved: 26.3,
    keyTakeaway: "Section 112A FMV formula eliminates phantom taxes on pre-2018 gains. Prevents overpaying ₹23,075 in unearned capital gains tax."
  },
  {
    id: "persona_3",
    name: "Disciplined Long-Term Investor",
    tag: "LTCG Exemption Step-Up",
    description: "Realized LTCG is ₹35,000 against ₹1,25,000 exemption limit. Harvests remaining ₹90,000 headroom before 31-March.",
    baselineTax: 11700.0,
    caTaxAndFees: 14700.0,
    aeyPreHarvestTax: 0.0,
    harvestBenefit: 10849.19,
    aeyFinalOutflow: 850.81,
    netSavedVsBaseline: 10849.19,
    netSavedVsCA: 13849.19,
    pctSaved: 92.7,
    keyTakeaway: "Resets the cost basis of long-term winning shares to current market price at 0% tax, completely shielding ₹90,000 of future profits."
  },
  {
    id: "persona_4",
    name: "Active Hybrid Trader",
    tag: "Intraday + 3-Broker Consolidation",
    description: "3 Brokers commingled (Zerodha, Groww, Upstox). Intraday speculative trades segregated under Section 73.",
    baselineTax: 69810.0,
    caTaxAndFees: 59170.0,
    aeyPreHarvestTax: 53170.0,
    harvestBenefit: 14302.94,
    aeyFinalOutflow: 38867.06,
    netSavedVsBaseline: 30942.94,
    netSavedVsCA: 20302.94,
    pctSaved: 44.3,
    keyTakeaway: "Prevents illegal set-offs between business income and capital gains, avoiding statutory scrutiny while harvesting ₹90,000 in paper losses."
  },
  {
    id: "persona_5",
    name: "Web3 & Equity Mixed Trader",
    tag: "VDA Sec 115BBH + Multi-Broker",
    description: "Zerodha + Groww + CoinDCX. ₹1.55L crypto gains (BTC/SOL), -₹60k ETH loss, +₹1.25L equity gains. Strictly enforces Section 115BBH isolation & credits Section 194S TDS.",
    baselineTax: 124972.0,
    caTaxAndFees: 87662.0,
    aeyPreHarvestTax: 76562.0,
    harvestBenefit: 11800.0,
    aeyFinalOutflow: 64762.0,
    netSavedVsBaseline: 60210.0,
    netSavedVsCA: 22900.0,
    pctSaved: 48.2,
    keyTakeaway: "Enforces strict Section 115BBH isolation to avert ₹37,440 Section 270A penalty, credits ₹7,600 Section 194S TDS, and harvests ₹59,000 in equity losses."
  }
];

export const PANELIST_MOCK_DATA = [
  {
    fileName: "zerodha_trades_fy24.csv",
    broker: "Zerodha",
    tradeCount: 3,
    openPositionsCount: 0,
    dateRange: "2024-05-15 to 2024-11-15",
    crossCheckStatus: { verified: true, tradeTotal: 395000 },
    trades: [
      { id: 101, broker: "Zerodha", file_name: "zerodha_trades_fy24.csv", stock_name: "RELIANCE INDUSTRIES", isin: "INE002A01018", quantity: 100, buy_date: new Date("2024-05-15"), buy_price: 2400.0, buy_value: 240000.0, sell_date: new Date("2024-10-20"), sell_price: 2900.0, sell_value: 290000.0, realised_pnl: 50000.0, holding_days: 158, is_intraday: false, is_ltcg: false, is_crypto: false, tds_194s: 0, remark: "Delivery STCG", fmv_2018: null },
      { id: 102, broker: "Zerodha", file_name: "zerodha_trades_fy24.csv", stock_name: "INFOSYS LIMITED", isin: "INE009A01021", quantity: 150, buy_date: new Date("2023-01-10"), buy_price: 1400.0, buy_value: 210000.0, sell_date: new Date("2024-11-15"), sell_price: 1900.0, sell_value: 285000.0, realised_pnl: 75000.0, holding_days: 675, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Delivery LTCG", fmv_2018: null },
      { id: 103, broker: "Zerodha", file_name: "zerodha_trades_fy24.csv", stock_name: "LARSEN & TOUBRO", isin: "INE018A01030", quantity: 100, buy_date: new Date("2016-08-15"), buy_price: 900.0, buy_value: 90000.0, sell_date: new Date("2024-10-05"), sell_price: 3600.0, sell_value: 360000.0, realised_pnl: 270000.0, holding_days: 2973, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Delivery LTCG Pre-2018", fmv_2018: 1450.0 }
    ],
    openPositions: []
  },
  {
    fileName: "groww_trades_fy24.csv",
    broker: "Groww",
    tradeCount: 4,
    openPositionsCount: 0,
    dateRange: "2024-06-10 to 2024-12-15",
    crossCheckStatus: { verified: true, tradeTotal: 53500 },
    trades: [
      { id: 104, broker: "Groww", file_name: "groww_trades_fy24.csv", stock_name: "TATA MOTORS LTD", isin: "INE155A01022", quantity: 200, buy_date: new Date("2024-06-10"), buy_price: 950.0, buy_value: 190000.0, sell_date: new Date("2024-12-15"), sell_price: 820.0, sell_value: 164000.0, realised_pnl: -26000.0, holding_days: 188, is_intraday: false, is_ltcg: false, is_crypto: false, tds_194s: 0, remark: "Delivery STCL", fmv_2018: null },
      { id: 105, broker: "Groww", file_name: "groww_trades_fy24.csv", stock_name: "ICICI BANK LTD", isin: "INE090A01021", quantity: 200, buy_date: new Date("2022-02-05"), buy_price: 720.0, buy_value: 144000.0, sell_date: new Date("2024-08-10"), sell_price: 1200.0, sell_value: 240000.0, realised_pnl: 96000.0, holding_days: 917, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Delivery LTCG", fmv_2018: null },
      { id: 106, broker: "Groww", file_name: "groww_trades_fy24.csv", stock_name: "WIPRO LIMITED", isin: "INE075A01022", quantity: 300, buy_date: new Date("2021-04-12"), buy_price: 550.0, buy_value: 165000.0, sell_date: new Date("2024-09-01"), sell_price: 470.0, sell_value: 141000.0, realised_pnl: -24000.0, holding_days: 1238, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Delivery LTCL", fmv_2018: null },
      { id: 107, broker: "Groww", file_name: "groww_trades_fy24.csv", stock_name: "STATE BANK OF INDIA", isin: "INE062A01020", quantity: 500, buy_date: new Date("2024-07-12"), buy_price: 840.0, buy_value: 420000.0, sell_date: new Date("2024-07-12"), sell_price: 855.0, sell_value: 427500.0, realised_pnl: 7500.0, holding_days: 0, is_intraday: true, is_ltcg: false, is_crypto: false, tds_194s: 0, remark: "Intraday trade", fmv_2018: null }
    ],
    openPositions: []
  },
  {
    fileName: "open_holdings_harvesting.csv",
    broker: "Multi-Broker Portfolio",
    tradeCount: 0,
    openPositionsCount: 4,
    dateRange: "Active Portfolio (4 scrips)",
    crossCheckStatus: { verified: true, tradeTotal: 0 },
    trades: [],
    openPositions: [
      { broker: "Groww", file_name: "open_holdings_harvesting.csv", stock_name: "HDFC BANK LTD", isin: "INE040A01034", quantity: 150, buy_date: new Date(Date.now() - 100*86400000), buy_price: 1680.0, current_price: 1420.0, unrealised_pnl: -39000.0, holding_days: 100, is_ltcg: false, is_crypto: false },
      { broker: "Zerodha", file_name: "open_holdings_harvesting.csv", stock_name: "BHARTI AIRTEL", isin: "INE397D01024", quantity: 100, buy_date: new Date(Date.now() - 60*86400000), buy_price: 1550.0, current_price: 1350.0, unrealised_pnl: -20000.0, holding_days: 60, is_ltcg: false, is_crypto: false },
      { broker: "Groww", file_name: "open_holdings_harvesting.csv", stock_name: "TITAN COMPANY LTD", isin: "INE280A01028", quantity: 50, buy_date: new Date(Date.now() - 500*86400000), buy_price: 2600.0, current_price: 3500.0, unrealised_pnl: 45000.0, holding_days: 500, is_ltcg: true, is_crypto: false },
      { broker: "Zerodha", file_name: "open_holdings_harvesting.csv", stock_name: "ASIAN PAINTS LTD", isin: "INE021A01026", quantity: 40, buy_date: new Date(Date.now() - 450*86400000), buy_price: 2700.0, current_price: 3150.0, unrealised_pnl: 18000.0, holding_days: 450, is_ltcg: true, is_crypto: false }
    ]
  }
];

export const PANELIST_MIXED_CRYPTO_MOCK_DATA = [
  {
    fileName: "mixed_equity_crypto_portfolio.csv",
    broker: "Multi-Asset (Zerodha + Groww + CoinDCX)",
    tradeCount: 10,
    openPositionsCount: 4,
    dateRange: "2024-05-10 to 2024-12-15",
    crossCheckStatus: { verified: true, tradeTotal: 497500 },
    trades: [
      { id: 201, broker: "Zerodha", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "RELIANCE INDUSTRIES", isin: "INE002A01018", quantity: 100, buy_date: new Date("2024-05-15"), buy_price: 2400.0, buy_value: 240000.0, sell_date: new Date("2024-10-20"), sell_price: 2900.0, sell_value: 290000.0, realised_pnl: 50000.0, holding_days: 158, is_intraday: false, is_ltcg: false, is_crypto: false, tds_194s: 0, remark: "Delivery STCG (Sec 111A)", fmv_2018: null },
      { id: 202, broker: "Zerodha", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "INFOSYS LIMITED", isin: "INE009A01021", quantity: 150, buy_date: new Date("2023-01-10"), buy_price: 1400.0, buy_value: 210000.0, sell_date: new Date("2024-11-15"), sell_price: 1900.0, sell_value: 285000.0, realised_pnl: 75000.0, holding_days: 675, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Delivery LTCG (Sec 112A)", fmv_2018: null },
      { id: 203, broker: "Zerodha", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "LARSEN & TOUBRO", isin: "INE018A01030", quantity: 100, buy_date: new Date("2016-08-15"), buy_price: 900.0, buy_value: 90000.0, sell_date: new Date("2024-10-05"), sell_price: 3600.0, sell_value: 360000.0, realised_pnl: 270000.0, holding_days: 2973, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Grandfathered LTCG (Sec 112A)", fmv_2018: 1450.0 },
      { id: 204, broker: "Groww", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "TATA MOTORS LTD", isin: "INE155A01022", quantity: 200, buy_date: new Date("2024-06-10"), buy_price: 950.0, buy_value: 190000.0, sell_date: new Date("2024-12-15"), sell_price: 820.0, sell_value: 164000.0, realised_pnl: -26000.0, holding_days: 188, is_intraday: false, is_ltcg: false, is_crypto: false, tds_194s: 0, remark: "Delivery STCL (Sec 70 Offset)", fmv_2018: null },
      { id: 205, broker: "Groww", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "ICICI BANK LTD", isin: "INE090A01021", quantity: 200, buy_date: new Date("2022-02-05"), buy_price: 720.0, buy_value: 144000.0, sell_date: new Date("2024-08-10"), sell_price: 1200.0, sell_value: 240000.0, realised_pnl: 96000.0, holding_days: 917, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Delivery LTCG (Sec 112A)", fmv_2018: null },
      { id: 206, broker: "Groww", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "WIPRO LIMITED", isin: "INE075A01022", quantity: 300, buy_date: new Date("2021-04-12"), buy_price: 550.0, buy_value: 165000.0, sell_date: new Date("2024-09-01"), sell_price: 470.0, sell_value: 141000.0, realised_pnl: -24000.0, holding_days: 1238, is_intraday: false, is_ltcg: true, is_crypto: false, tds_194s: 0, remark: "Delivery LTCL (Sec 70 Offset)", fmv_2018: null },
      { id: 207, broker: "Groww", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "STATE BANK OF INDIA", isin: "INE062A01020", quantity: 500, buy_date: new Date("2024-07-12"), buy_price: 840.0, buy_value: 420000.0, sell_date: new Date("2024-07-12"), sell_price: 855.0, sell_value: 427500.0, realised_pnl: 7500.0, holding_days: 0, is_intraday: true, is_ltcg: false, is_crypto: false, tds_194s: 0, remark: "Intraday trade (Sec 73)", fmv_2018: null },
      { id: 208, broker: "CoinDCX", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "BITCOIN (BTC/INR)", isin: "CRYPTO_BTC", quantity: 0.05, buy_date: new Date("2024-05-10"), buy_price: 5500000.0, buy_value: 275000.0, sell_date: new Date("2024-11-15"), sell_price: 7200000.0, sell_value: 360000.0, realised_pnl: 85000.0, holding_days: 189, is_intraday: false, is_ltcg: false, is_crypto: true, tds_194s: 3600.0, remark: "Crypto VDA Gain (Sec 115BBH)", fmv_2018: null },
      { id: 209, broker: "CoinDCX", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "ETHEREUM (ETH/INR)", isin: "CRYPTO_ETH", quantity: 1.0, buy_date: new Date("2024-07-20"), buy_price: 280000.0, buy_value: 280000.0, sell_date: new Date("2024-08-25"), sell_price: 220000.0, sell_value: 220000.0, realised_pnl: -60000.0, holding_days: 36, is_intraday: false, is_ltcg: false, is_crypto: true, tds_194s: 2200.0, remark: "Crypto VDA Loss (No Setoff Sec 115BBH)", fmv_2018: null },
      { id: 210, broker: "CoinDCX", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "SOLANA (SOL/INR)", isin: "CRYPTO_SOL", quantity: 10.0, buy_date: new Date("2024-09-01"), buy_price: 11000.0, buy_value: 110000.0, sell_date: new Date("2024-12-10"), sell_price: 18000.0, sell_value: 180000.0, realised_pnl: 70000.0, holding_days: 100, is_intraday: false, is_ltcg: false, is_crypto: true, tds_194s: 1800.0, remark: "Crypto VDA Gain (Sec 115BBH)", fmv_2018: null }
    ],
    openPositions: [
      { broker: "Groww", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "HDFC BANK LTD", isin: "INE040A01034", quantity: 150, buy_date: new Date(Date.now() - 100*86400000), buy_price: 1680.0, current_price: 1420.0, unrealised_pnl: -39000.0, holding_days: 100, is_ltcg: false, is_crypto: false },
      { broker: "Zerodha", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "BHARTI AIRTEL", isin: "INE397D01024", quantity: 100, buy_date: new Date(Date.now() - 60*86400000), buy_price: 1550.0, current_price: 1350.0, unrealised_pnl: -20000.0, holding_days: 60, is_ltcg: false, is_crypto: false },
      { broker: "Groww", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "TITAN COMPANY LTD", isin: "INE280A01028", quantity: 50, buy_date: new Date(Date.now() - 500*86400000), buy_price: 2600.0, current_price: 3500.0, unrealised_pnl: 45000.0, holding_days: 500, is_ltcg: true, is_crypto: false },
      { broker: "Zerodha", file_name: "mixed_equity_crypto_portfolio.csv", stock_name: "ASIAN PAINTS LTD", isin: "INE021A01026", quantity: 40, buy_date: new Date(Date.now() - 450*86400000), buy_price: 2700.0, current_price: 3150.0, unrealised_pnl: 18000.0, holding_days: 450, is_ltcg: true, is_crypto: false }
    ]
  }
];

export const PANELIST_CRYPTO_ONLY_MOCK_DATA = [
  {
    fileName: "coindcx_crypto_fy24.csv",
    broker: "CoinDCX (Crypto)",
    tradeCount: 3,
    openPositionsCount: 0,
    dateRange: "2024-05-10 to 2024-12-10",
    crossCheckStatus: { verified: true, tradeTotal: 95000 },
    trades: [
      { id: 301, broker: "CoinDCX", file_name: "coindcx_crypto_fy24.csv", stock_name: "BITCOIN (BTC/INR)", isin: "CRYPTO_BTC", quantity: 0.05, buy_date: new Date("2024-05-10"), buy_price: 5500000.0, buy_value: 275000.0, sell_date: new Date("2024-11-15"), sell_price: 7200000.0, sell_value: 360000.0, realised_pnl: 85000.0, holding_days: 189, is_intraday: false, is_ltcg: false, is_crypto: true, tds_194s: 3600.0, remark: "VDA Transfer Sec 115BBH", fmv_2018: null },
      { id: 302, broker: "CoinDCX", file_name: "coindcx_crypto_fy24.csv", stock_name: "ETHEREUM (ETH/INR)", isin: "CRYPTO_ETH", quantity: 1.0, buy_date: new Date("2024-07-20"), buy_price: 280000.0, buy_value: 280000.0, sell_date: new Date("2024-08-25"), sell_price: 220000.0, sell_value: 220000.0, realised_pnl: -60000.0, holding_days: 36, is_intraday: false, is_ltcg: false, is_crypto: true, tds_194s: 2200.0, remark: "VDA Loss (Disallowed Sec 115BBH)", fmv_2018: null },
      { id: 303, broker: "CoinDCX", file_name: "coindcx_crypto_fy24.csv", stock_name: "SOLANA (SOL/INR)", isin: "CRYPTO_SOL", quantity: 10.0, buy_date: new Date("2024-09-01"), buy_price: 11000.0, buy_value: 110000.0, sell_date: new Date("2024-12-10"), sell_price: 18000.0, sell_value: 180000.0, realised_pnl: 70000.0, holding_days: 100, is_intraday: false, is_ltcg: false, is_crypto: true, tds_194s: 1800.0, remark: "VDA Transfer Sec 115BBH", fmv_2018: null }
    ],
    openPositions: []
  }
];

