import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, Info, 
  AlertCircle, XCircle, Clock, LayoutDashboard, Zap, FileText, 
  ArrowUpRight, ArrowDownRight, UploadCloud, Search,
  PanelLeftClose, PanelLeftOpen, Calculator, RotateCcw,
  Trash2, Plus, Layers, Filter, AlertTriangle, HelpCircle,
  Sparkles
} from 'lucide-react';
import { 
  formatRupee, parseSingleBrokerStatement, consolidateMultipleStatements, computeTax, 
  generateHarvestingRecommendations, LTCG_EXEMPTION_LIMIT 
} from './tax_engine_js';

// Plain-Language Tooltip Terms Definition
const TAX_EXPLANATIONS = {
  STCG: "Profit from shares or mutual funds held for 1 year or less before selling. Taxed at a flat 20% under Section 111A.",
  LTCG: "Profit from shares held for more than 1 year. The first ₹1.25 lakh in profit each financial year is 100% tax-free; profits above that are taxed at 12.5%.",
  TAX_PAYABLE: "The total final tax amount you owe to the Income Tax Department for this financial year, including the 4% Health & Education Cess.",
  EXEMPTION_HEADROOM: "How much more long-term profit (LTCG) you can book before 31-March at 0% tax before any tax liability kicks in.",
  SET_OFF: "Income Tax rules allowing you to subtract short-term losses from gains to reduce your overall taxable income.",
  INTRADAY: "Profits or losses from same-day buying and selling. Treated as speculative business income and taxed at your regular income tax slab rate.",
  HARVESTING: "Strategically selling specific shares before 31-March to lock in losses or utilize tax-free limits, reducing your tax bill."
};

const SAMPLE_TRADES_ZERODHA = [
  { id: 1, broker: "Zerodha", file_name: "Zerodha_PnL_FY24.xlsx", stock_name: "RELIANCE INDUSTRIES", isin: "INE002A01018", quantity: 100, buy_date: new Date("2024-05-15"), buy_price: 2400.0, buy_value: 240000.0, sell_date: new Date("2024-10-20"), sell_price: 2900.0, sell_value: 290000.0, realised_pnl: 50000.0, holding_days: 158, is_intraday: false, is_ltcg: false, remark: "Delivery STCG", fmv_2018: null },
  { id: 2, broker: "Zerodha", file_name: "Zerodha_PnL_FY24.xlsx", stock_name: "TATA MOTORS LTD", isin: "INE155A01022", quantity: 200, buy_date: new Date("2024-06-10"), buy_price: 950.0, buy_value: 190000.0, sell_date: new Date("2024-12-15"), sell_price: 820.0, sell_value: 164000.0, realised_pnl: -26000.0, holding_days: 188, is_intraday: false, is_ltcg: false, remark: "Delivery STCL", fmv_2018: null },
  { id: 3, broker: "Zerodha", file_name: "Zerodha_PnL_FY24.xlsx", stock_name: "INFOSYS LIMITED", isin: "INE009A01021", quantity: 150, buy_date: new Date("2023-01-10"), buy_price: 1400.0, buy_value: 210000.0, sell_date: new Date("2024-11-15"), sell_price: 1900.0, sell_value: 285000.0, realised_pnl: 75000.0, holding_days: 675, is_intraday: false, is_ltcg: true, remark: "Delivery LTCG", fmv_2018: null }
];

const SAMPLE_TRADES_GROWW = [
  { id: 4, broker: "Groww", file_name: "Groww_PnL_FY24.xlsx", stock_name: "ICICI BANK LTD", isin: "INE090A01021", quantity: 200, buy_date: new Date("2022-02-05"), buy_price: 720.0, buy_value: 144000.0, sell_date: new Date("2024-08-10"), sell_price: 1200.0, sell_value: 240000.0, realised_pnl: 96000.0, holding_days: 917, is_intraday: false, is_ltcg: true, remark: "Delivery LTCG", fmv_2018: null },
  { id: 5, broker: "Groww", file_name: "Groww_PnL_FY24.xlsx", stock_name: "WIPRO LIMITED", isin: "INE075A01022", quantity: 300, buy_date: new Date("2021-04-12"), buy_price: 550.0, buy_value: 165000.0, sell_date: new Date("2024-09-01"), sell_price: 470.0, sell_value: 141000.0, realised_pnl: -24000.0, holding_days: 1238, is_intraday: false, is_ltcg: true, remark: "Delivery LTCL", fmv_2018: null }
];

const SAMPLE_POSITIONS = [
  { broker: "Groww", file_name: "Groww_PnL_FY24.xlsx", stock_name: "HDFC BANK LTD", isin: "INE040A01034", quantity: 150, buy_date: new Date("2024-08-10"), buy_price: 1680.0, current_price: 1420.0, unrealised_pnl: -39000.0, holding_days: 100, is_ltcg: false },
  { broker: "Zerodha", file_name: "Zerodha_PnL_FY24.xlsx", stock_name: "BHARTI AIRTEL", isin: "INE397D01024", quantity: 100, buy_date: new Date("2024-09-20"), buy_price: 1550.0, current_price: 1350.0, unrealised_pnl: -20000.0, holding_days: 60, is_ltcg: false },
  { broker: "Groww", file_name: "Groww_PnL_FY24.xlsx", stock_name: "TITAN COMPANY LTD", isin: "INE280A01028", quantity: 50, buy_date: new Date("2023-05-15"), buy_price: 2600.0, current_price: 3500.0, unrealised_pnl: 45000.0, holding_days: 500, is_ltcg: true }
];

const DEMO_FILES = [
  {
    fileName: "Zerodha_PnL_FY24.xlsx",
    broker: "Zerodha",
    tradeCount: SAMPLE_TRADES_ZERODHA.length,
    trades: SAMPLE_TRADES_ZERODHA,
    openPositions: [SAMPLE_POSITIONS[1]],
    dateRange: "2024-05-15 to 2024-12-15",
    crossCheckStatus: { verified: true, tradeTotal: 99000 }
  },
  {
    fileName: "Groww_PnL_FY24.xlsx",
    broker: "Groww",
    tradeCount: SAMPLE_TRADES_GROWW.length,
    trades: SAMPLE_TRADES_GROWW,
    openPositions: [SAMPLE_POSITIONS[0], SAMPLE_POSITIONS[2]],
    dateRange: "2024-08-10 to 2024-09-01",
    crossCheckStatus: { verified: true, tradeTotal: 72000 }
  }
];

export default function App() {
  const [isDemoData, setIsDemoData] = useState(true);
  const [userFiles, setUserFiles] = useState([]);

  const [uploadError, setUploadError] = useState(null);
  const [brokerFilter, setBrokerFilter] = useState("ALL");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navSection, setNavSection] = useState("overview");
  const [harvestTab, setHarvestTab] = useState("loss_harvesting");
  const [filterType, setFilterType] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Numerical What-If State
  const [simStclInput, setSimStclInput] = useState("");
  const [simLtclInput, setSimLtclInput] = useState("");

  const simStclVal = parseFloat(simStclInput) || 0;
  const simLtclVal = parseFloat(simLtclInput) || 0;

  // Active files list: demo files IF demo active, else userFiles
  const activeFilesList = isDemoData ? DEMO_FILES : userFiles;

  // Consolidation Engine
  const consolidated = consolidateMultipleStatements(activeFilesList);
  
  // Filter trades & positions
  const activeTrades = brokerFilter === "ALL" 
    ? consolidated.consolidatedTrades 
    : consolidated.consolidatedTrades.filter(t => t.broker === brokerFilter);

  const activePositions = brokerFilter === "ALL" 
    ? consolidated.consolidatedPositions 
    : consolidated.consolidatedPositions.filter(p => p.broker === brokerFilter);

  // Core Tax & Harvesting Computations
  const taxResult = computeTax(activeTrades);
  const harvesting = generateHarvestingRecommendations(taxResult, activePositions);

  // Simulated Tax Calculation
  const simTrades = [
    ...activeTrades,
    ...(simStclVal > 0 ? [{ id: 9991, broker: "Simulated", stock_name: "Simulated STCL Booking", isin: "IN999", quantity: 1, buy_date: new Date(), buy_price: simStclVal, buy_value: simStclVal, sell_date: new Date(), sell_price: 0, sell_value: 0, realised_pnl: -simStclVal, holding_days: 10, is_intraday: false, is_ltcg: false, remark: "What-If STCL" }] : []),
    ...(simLtclVal > 0 ? [{ id: 9992, broker: "Simulated", stock_name: "Simulated LTCL Booking", isin: "IN999", quantity: 1, buy_date: new Date(), buy_price: simLtclVal, buy_value: simLtclVal, sell_date: new Date(), sell_price: 0, sell_value: 0, realised_pnl: -simLtclVal, holding_days: 400, is_intraday: false, is_ltcg: true, remark: "What-If LTCL" }] : [])
  ];
  const simTaxResult = computeTax(simTrades);
  const taxSavingsDelta = taxResult.totalTaxPayable - simTaxResult.totalTaxPayable;

  const sortedGainers = [...activeTrades].sort((a, b) => b.realised_pnl - a.realised_pnl).slice(0, 4);
  const sortedLosers = [...activeTrades].sort((a, b) => a.realised_pnl - b.realised_pnl).slice(0, 4);

  // Multi-File Upload Handler
  const handleMultipleFilesUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadError(null);
    let newFilesList = isDemoData ? [] : [...userFiles];
    let errors = [];
    let filesProcessedCount = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const fileMeta = parseSingleBrokerStatement(evt.target.result, file.name);
          newFilesList.push(fileMeta);
        } catch (err) {
          errors.push(`'${file.name}': ${err.message}`);
        }

        filesProcessedCount++;
        if (filesProcessedCount === files.length) {
          if (newFilesList.length > 0) {
            setUserFiles(newFilesList);
            setIsDemoData(false);
          }
          if (errors.length > 0) {
            setUploadError(errors.join(" | "));
          }
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const removeFile = (fileNameToRemove) => {
    if (isDemoData) {
      setIsDemoData(false);
      setUserFiles([]);
    } else {
      const updated = userFiles.filter(f => f.fileName !== fileNameToRemove);
      setUserFiles(updated);
    }
  };

  const clearAllData = () => {
    setIsDemoData(false);
    setUserFiles([]);
    setUploadError(null);
    setBrokerFilter("ALL");
    setSimStclInput("");
    setSimLtclInput("");
  };

  const loadSampleData = () => {
    setIsDemoData(true);
    setUserFiles([]);
    setUploadError(null);
    setBrokerFilter("ALL");
    setSimStclInput("");
    setSimLtclInput("");
  };

  const filteredAudit = taxResult.auditTrail.filter(item => {
    const matchesSearch = item.stock_name.toLowerCase().includes(searchTerm.toLowerCase()) || item.isin.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterType === "ALL") return matchesSearch;
    if (filterType === "STCG") return matchesSearch && item.classified_type === "STCG";
    if (filterType === "LTCG") return matchesSearch && item.classified_type === "LTCG";
    if (filterType === "INTRADAY") return matchesSearch && item.classified_type.includes("Speculative");
    return matchesSearch;
  });

  // Plain-English Narrative Tax Story Generator
  const generatePlainTaxStory = () => {
    if (activeTrades.length === 0) return "No trade statements currently loaded.";
    
    let storyParts = [];
    if (taxResult.grossStcgGains > 0 || taxResult.grossStclLosses > 0) {
      if (taxResult.grossStclLosses > 0) {
        storyParts.push(`You made ${formatRupee(taxResult.grossStcgGains)} in short-term profits and offset ${formatRupee(taxResult.grossStclLosses)} in short-term losses, leaving ${formatRupee(taxResult.taxableStcg)} taxable at 20%.`);
      } else {
        storyParts.push(`You made ${formatRupee(taxResult.grossStcgGains)} in short-term profits, taxed at 20% (${formatRupee(taxResult.stcgTaxBase)} tax).`);
      }
    }

    if (taxResult.netLtcgBeforeSetoff > 0) {
      if (taxResult.netLtcgBeforeSetoff <= LTCG_EXEMPTION_LIMIT) {
        storyParts.push(`Your long-term profits (${formatRupee(taxResult.netLtcgBeforeSetoff)}) are completely tax-free under your annual ₹1.25 lakh allowance.`);
      } else {
        storyParts.push(`Your long-term profits were ${formatRupee(taxResult.netLtcgBeforeSetoff)}. After subtracting your ₹1.25 lakh tax-free allowance, you are taxed on ${formatRupee(taxResult.taxableLtcg)} at 12.5%.`);
      }
    }

    if (taxResult.totalTaxPayable === 0) {
      storyParts.push("Altogether, your final capital gains tax payable is ₹0.00.");
    } else {
      storyParts.push(`Altogether, your final capital gains tax payable for FY 2024-25 is ${formatRupee(taxResult.totalTaxPayable)}.`);
    }

    return storyParts.join(" ");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans">
      
      {/* 1. FIXED SIDEBAR */}
      <aside 
        className={`fixed top-0 left-0 h-screen bg-white border-r border-slate-200/80 p-4 flex flex-col justify-between z-30 transition-all duration-300 ${
          sidebarCollapsed ? "w-16 items-center" : "w-64"
        }`}
      >
        <div className="w-full space-y-6">
          {/* Brand Header */}
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center flex-col gap-2" : "justify-between"} w-full`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-[#00A37D] flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-sm">
                AEY
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <h1 className="font-extrabold text-sm tracking-tight text-slate-900 truncate">AEY Engine</h1>
                  <span className="text-[10px] text-slate-400 font-semibold block -mt-0.5">Indian Equity Tax</span>
                </div>
              )}
            </div>

            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4 text-[#00A37D]" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 w-full">
            <button
              onClick={() => setNavSection("overview")}
              className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3.5"} py-2.5 rounded-xl text-xs font-bold transition ${
                navSection === "overview" 
                  ? "bg-[#E6F6F2] text-[#00A37D]" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Consolidated Overview</span>}
            </button>

            <button
              onClick={() => setNavSection("harvesting")}
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "justify-between px-3.5"} py-2.5 rounded-xl text-xs font-bold transition ${
                navSection === "harvesting" 
                  ? "bg-[#E6F6F2] text-[#00A37D]" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Zap className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Tax Harvesting</span>}
              </div>
              {!sidebarCollapsed && harvesting.lossRecs.length > 0 && (
                <span className="bg-[#00A37D] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                  {harvesting.lossRecs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setNavSection("simulator")}
              className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3.5"} py-2.5 rounded-xl text-xs font-bold transition ${
                navSection === "simulator" 
                  ? "bg-[#E6F6F2] text-[#00A37D]" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Calculator className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">What-If Simulator</span>}
            </button>

            <button
              onClick={() => setNavSection("audit")}
              className={`w-full flex items-center gap-3 ${sidebarCollapsed ? "justify-center px-0" : "px-3.5"} py-2.5 rounded-xl text-xs font-bold transition ${
                navSection === "audit" 
                  ? "bg-[#E6F6F2] text-[#00A37D]" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Trade Audit Trail</span>}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-100 space-y-3 w-full">
          {!sidebarCollapsed && (
            <div className="text-[11px] text-slate-400 space-y-1 font-medium">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00A37D]" /> Budget 2024 Verified
              </div>
              <p className="truncate">STCG 20% | LTCG 12.5% &gt; ₹1.25L</p>
            </div>
          )}

          <label className={`w-full btn-aey cursor-pointer py-2.5 ${sidebarCollapsed ? "px-0 justify-center" : "px-3 justify-center"} rounded-xl text-xs flex items-center gap-2 shadow-sm`}>
            <Plus className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Add Broker Files</span>}
            <input type="file" accept=".xlsx, .xls, .csv" multiple onChange={handleMultipleFilesUpload} className="hidden" />
          </label>
        </div>
      </aside>

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <main className={`flex-1 transition-all duration-300 p-6 md:p-10 max-w-6xl mx-auto space-y-8 ${
        sidebarCollapsed ? "ml-16" : "ml-64"
      }`}>

        {/* Header Bar */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">AEY — Income Tax Analysis & Harvesting</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Financial Year 2024-25 • Listed Indian Equities & Mutual Funds</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl transition text-xs flex items-center gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Add Files
              <input type="file" accept=".xlsx, .xls, .csv" multiple onChange={handleMultipleFilesUpload} className="hidden" />
            </label>
          </div>
        </header>

        {/* Demo Warning Banner */}
        {isDemoData && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <strong className="font-bold">Demo Mode Active</strong> — Displaying synthetic Zerodha & Groww statements. Upload your real statements to analyze live tax.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-xl font-bold transition text-xs">
                Upload Statements
                <input type="file" accept=".xlsx, .xls, .csv" multiple onChange={handleMultipleFilesUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* Blocking Upload Error State */}
        {uploadError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-xs text-rose-900 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-950 text-sm">Statement Format / Parsing Error</h4>
                <p className="mt-1 text-rose-800">{uploadError}</p>
              </div>
            </div>
            <button onClick={() => setUploadError(null)} className="text-rose-600 font-bold hover:underline">Dismiss</button>
          </div>
        )}

        {/* Duplicate Trades Warning Banner */}
        {consolidated.duplicateWarnings.length > 0 && (
          <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 text-xs text-rose-950 space-y-1 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-rose-700">
              <AlertTriangle className="w-4 h-4" /> {consolidated.duplicateWarnings.length} Possible Duplicate Trades Detected Across Uploads
            </div>
            {consolidated.duplicateWarnings.map((w, idx) => (
              <p key={idx} className="text-[11px] text-rose-800/90 pl-6">• {w}</p>
            ))}
          </div>
        )}

        {/* 3. UPLOADED-FILES TRAY */}
        <div className="apple-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00A37D]" /> Consolidated Statements ({activeFilesList.length} files active)
            </h3>
            {activeFilesList.length > 0 && (
              <button onClick={clearAllData} className="text-xs text-slate-400 hover:text-rose-600 transition font-medium">
                Clear All Files
              </button>
            )}
          </div>

          {activeFilesList.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 space-y-3">
              <UploadCloud className="w-8 h-8 text-slate-300 mx-auto" />
              <div>
                <p className="font-bold text-slate-700 text-sm">No Broker Statements Currently Loaded</p>
                <p className="text-slate-400 text-xs mt-0.5">Upload your Zerodha, Groww, Upstox or Angel One P&L statements to calculate tax liability.</p>
              </div>
              <div className="flex justify-center gap-3 pt-1">
                <label className="btn-aey px-4 py-2 rounded-xl cursor-pointer text-xs font-bold">
                  Upload Statements (.xlsx)
                  <input type="file" accept=".xlsx, .xls, .csv" multiple onChange={handleMultipleFilesUpload} className="hidden" />
                </label>
                <button onClick={loadSampleData} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold">
                  Load Sample Data
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeFilesList.map((f, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F6F2] text-[#00A37D] border border-[#A3E4D4] whitespace-nowrap">
                        {f.broker}
                      </span>
                      <strong className="font-bold text-slate-900 truncate max-w-[180px]">{f.fileName}</strong>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {f.tradeCount} Trades • {f.openPositionsCount} Open Holdings • {f.dateRange}
                    </div>
                  </div>

                  <button 
                    onClick={() => removeFile(f.fileName)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                    title="Remove this statement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NO DATA LOADED EMPTY STATE */}
        {activeFilesList.length === 0 ? null : (
          <>
            {/* PER-BROKER FILTER TOGGLE */}
            {consolidated.distinctBrokers.length > 1 && (
              <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/80 text-xs">
                <span className="font-bold text-slate-600 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#00A37D]" /> View Tax Metrics:
                </span>

                <div className="flex bg-slate-100 p-1 rounded-xl font-bold">
                  <button 
                    onClick={() => setBrokerFilter("ALL")}
                    className={`px-3 py-1 rounded-lg transition ${brokerFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    All Brokers Consolidated ({consolidated.consolidatedTrades.length})
                  </button>

                  {consolidated.distinctBrokers.map(b => (
                    <button 
                      key={b} onClick={() => setBrokerFilter(b)}
                      className={`px-3 py-1 rounded-lg transition ${brokerFilter === b ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      {b} Only
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 1: OVERVIEW & NARRATIVE SUMMARY */}
            {/* ------------------------------------------------------------- */}
            {navSection === "overview" && (
              <div className="space-y-8">
                
                {/* PLAIN-ENGLISH TAX STORY SUMMARY CARD */}
                <div className="apple-card p-6 border-l-4 border-l-[#00A37D] bg-gradient-to-r from-emerald-50/40 via-white to-white space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#00A37D] uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#00A37D]" /> Plain-Language Tax Breakdown
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400">FY 2024-25 Summary</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed">
                    {generatePlainTaxStory()}
                  </p>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  
                  {/* STCG Card */}
                  <div className="apple-card p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">STCG (Sec 111A)</span>
                          
                          {/* Sleek Non-Flickering Floating Popover */}
                          <div className="relative group inline-block">
                            <button className="text-slate-400 hover:text-[#00A37D] transition">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 text-white rounded-xl text-[11px] font-medium leading-snug shadow-xl z-30 text-center">
                              {TAX_EXPLANATIONS.STCG}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-[#00A37D] bg-[#E6F6F2] px-2.5 py-0.5 rounded-full border border-[#A3E4D4] whitespace-nowrap shrink-0">20%</span>
                      </div>
                      <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatRupee(taxResult.taxableStcg)}</div>
                      <span className="text-xs text-slate-500 font-medium mt-1 block">Net Taxable STCG</span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs flex justify-between text-slate-500 font-medium">
                      <span>Gross: <strong className="text-slate-800">{formatRupee(taxResult.grossStcgGains)}</strong></span>
                      <span>Losses: <strong className="text-rose-600">{formatRupee(taxResult.grossStclLosses)}</strong></span>
                    </div>
                  </div>

                  {/* LTCG Card */}
                  <div className="apple-card p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LTCG (Sec 112A)</span>
                          
                          {/* Sleek Non-Flickering Floating Popover */}
                          <div className="relative group inline-block">
                            <button className="text-slate-400 hover:text-[#00A37D] transition">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 text-white rounded-xl text-[11px] font-medium leading-snug shadow-xl z-30 text-center">
                              {TAX_EXPLANATIONS.LTCG}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-[#00A37D] bg-[#E6F6F2] px-2.5 py-0.5 rounded-full border border-[#A3E4D4] whitespace-nowrap shrink-0">12.5% &gt; ₹1.25L</span>
                      </div>
                      <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatRupee(taxResult.taxableLtcg)}</div>
                      <span className="text-xs text-slate-500 font-medium mt-1 block">Taxable LTCG</span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs flex justify-between text-slate-500 font-medium">
                      <span>Exemption: <strong className="text-[#00A37D]">{formatRupee(taxResult.ltcgExemptionApplied)}</strong></span>
                      <span>Net: <strong className="text-slate-800">{formatRupee(taxResult.netLtcgAfterSetoff)}</strong></span>
                    </div>
                  </div>

                  {/* Total Tax Payable Card */}
                  <div className="apple-card p-6 flex flex-col justify-between border-rose-200/80 bg-rose-50/20">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Tax Payable</span>
                          
                          {/* Sleek Non-Flickering Floating Popover */}
                          <div className="relative group inline-block">
                            <button className="text-rose-400 hover:text-rose-700 transition">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 text-white rounded-xl text-[11px] font-medium leading-snug shadow-xl z-30 text-center">
                              {TAX_EXPLANATIONS.TAX_PAYABLE}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-full border border-rose-200 whitespace-nowrap shrink-0">Incl. 4% Cess</span>
                      </div>
                      <div className="text-3xl font-extrabold text-rose-600 tracking-tight">{formatRupee(taxResult.totalTaxPayable)}</div>
                      <span className="text-xs text-rose-800/80 font-medium mt-1 block">Final Liability for FY</span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-rose-100 text-xs flex justify-between text-slate-500 font-medium">
                      <span>Effective Rate: <strong className="text-slate-800">{taxResult.effectiveTaxRate.toFixed(2)}%</strong></span>
                      <span>Basic Tax: <strong className="text-slate-800">{formatRupee(taxResult.basicTax)}</strong></span>
                    </div>
                  </div>

                  {/* LTCG Exemption Headroom Card */}
                  <div className="apple-card p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exemption Headroom</span>
                          
                          {/* Sleek Non-Flickering Floating Popover */}
                          <div className="relative group inline-block">
                            <button className="text-slate-400 hover:text-[#00A37D] transition">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                            <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 text-white rounded-xl text-[11px] font-medium leading-snug shadow-xl z-30 text-center">
                              {TAX_EXPLANATIONS.EXEMPTION_HEADROOM}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-[#00A37D] bg-[#E6F6F2] px-2.5 py-0.5 rounded-full border border-[#A3E4D4] whitespace-nowrap shrink-0">₹1.25L Tax-Free</span>
                      </div>
                      <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatRupee(taxResult.ltcgExemptionHeadroom)}</div>
                      <span className="text-xs text-slate-500 font-medium mt-1 block">Remaining Tax-Free LTCG</span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                          className="bg-[#00A37D] h-2 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (taxResult.ltcgExemptionHeadroom / LTCG_EXEMPTION_LIMIT) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Capital Gains Breakdown */}
                <div className="apple-card p-6 space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capital Gains Breakdown ({brokerFilter})</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <span className="text-xs font-medium text-slate-500 block">Short-Term Delivery Trades</span>
                      <div className="text-lg font-bold text-slate-900">{formatRupee(taxResult.netStcgBeforeSetoff)}</div>
                      <div className="text-xs text-slate-500 space-y-1 font-medium">
                        <div className="flex justify-between"><span>Gains (20%)</span><span className="text-slate-900 font-semibold">{formatRupee(taxResult.grossStcgGains)}</span></div>
                        <div className="flex justify-between"><span>Losses</span><span className="text-rose-600 font-semibold">{formatRupee(taxResult.grossStclLosses)}</span></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <span className="text-xs font-medium text-slate-500 block">Long-Term Delivery Trades</span>
                      <div className="text-lg font-bold text-[#00A37D]">{formatRupee(taxResult.netLtcgBeforeSetoff)}</div>
                      <div className="text-xs text-slate-500 space-y-1 font-medium">
                        <div className="flex justify-between"><span>Gains (12.5%)</span><span className="text-slate-900 font-semibold">{formatRupee(taxResult.grossLtcgGains)}</span></div>
                        <div className="flex justify-between"><span>Losses</span><span className="text-rose-600 font-semibold">{formatRupee(taxResult.grossLtclLosses)}</span></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <span className="text-xs font-medium text-slate-500 block">Intraday Speculative Income</span>
                      <div className="text-lg font-bold text-purple-700">{formatRupee(taxResult.netSpecBeforeSetoff)}</div>
                      <div className="text-xs text-slate-500 space-y-1 font-medium">
                        <div className="flex justify-between"><span>Intraday Gains</span><span className="text-slate-900 font-semibold">{formatRupee(taxResult.grossSpecGains)}</span></div>
                        <div className="flex justify-between"><span>Intraday Losses</span><span className="text-rose-600 font-semibold">{formatRupee(taxResult.grossSpecLosses)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TOP GAINERS & LOSERS SUMMARY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Top Gainers */}
                  <div className="apple-card p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-[#00A37D]" /> Top Realised Gainers
                      </h3>
                      <button onClick={() => setNavSection("audit")} className="text-xs text-[#00A37D] font-bold hover:underline flex items-center gap-0.5">
                        View All
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {sortedGainers.map((t, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{t.stock_name}</span>
                            <span className="text-slate-400 text-[11px] font-medium">{t.broker} • {t.is_ltcg ? "LTCG" : t.is_intraday ? "Intraday" : "STCG"} • Qty {t.quantity}</span>
                          </div>
                          <span className="font-extrabold text-[#00A37D] text-sm">{formatRupee(t.realised_pnl)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Losers */}
                  <div className="apple-card p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <ArrowDownRight className="w-4 h-4 text-rose-500" /> Top Realised Losses
                      </h3>
                      <button onClick={() => setNavSection("audit")} className="text-xs text-[#00A37D] font-bold hover:underline flex items-center gap-0.5">
                        View All
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {sortedLosers.map((t, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{t.stock_name}</span>
                            <span className="text-slate-400 text-[11px] font-medium">{t.broker} • {t.is_ltcg ? "LTCL" : t.is_intraday ? "Intraday" : "STCL"} • Qty {t.quantity}</span>
                          </div>
                          <span className="font-extrabold text-rose-600 text-sm">{formatRupee(t.realised_pnl)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 2: TAX HARVESTING ENGINE */}
            {/* ------------------------------------------------------------- */}
            {navSection === "harvesting" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">AEY Tax Harvesting Engine</h3>
                    <p className="text-xs text-slate-500 font-medium">Ranked by net tax benefit after round-trip brokerage & STT friction</p>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setHarvestTab("loss_harvesting")}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition ${harvestTab === "loss_harvesting" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      Loss Harvesting ({harvesting.lossRecs.length})
                    </button>
                    <button 
                      onClick={() => setHarvestTab("gain_harvesting")}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition ${harvestTab === "gain_harvesting" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      Gain Harvesting ({harvesting.gainRecs.length})
                    </button>
                  </div>
                </div>

                {/* Loss Harvesting Cards */}
                {harvestTab === "loss_harvesting" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {activePositions.length === 0 ? (
                      <div className="col-span-2 apple-card p-8 text-center text-slate-500 text-xs space-y-2">
                        <Info className="w-5 h-5 text-slate-400 mx-auto" />
                        <p className="font-semibold text-slate-800">No Open Positions Sheet Found in Statement</p>
                        <p className="max-w-md mx-auto">To view harvesting recommendations, upload a statement with an "Open Holdings" sheet or click "Load Sample Data" to test the engine.</p>
                      </div>
                    ) : harvesting.lossRecs.length === 0 ? (
                      <div className="col-span-2 apple-card p-8 text-center text-slate-500 text-xs">
                        No actionable tax-loss harvesting opportunities found in open positions.
                      </div>
                    ) : (
                      harvesting.lossRecs.map((rec, idx) => (
                        <div key={idx} className="apple-card p-6 space-y-4 border-l-4 border-l-[#00A37D]">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F6F2] text-[#00A37D] border border-[#A3E4D4]">
                                  {rec.broker}
                                </span>
                                <h4 className="font-bold text-base text-slate-900">
                                  SELL {rec.recommended_qty} × {rec.stock_name}
                                </h4>
                              </div>
                              <span className="text-xs text-slate-500 font-medium block mt-1">ISIN: {rec.isin} • Bought {rec.buy_date} ({rec.category})</span>
                            </div>
                            <span className="bg-[#E6F6F2] text-[#00A37D] text-xs font-extrabold px-3 py-1 rounded-full border border-[#A3E4D4] whitespace-nowrap shrink-0">
                              Save {formatRupee(rec.tax_saved)}
                            </span>
                          </div>

                          {/* Plain-Language Layman Reason */}
                          <div className="p-3 bg-[#E6F6F2]/60 rounded-xl text-xs text-[#007A5E] font-medium border border-[#A3E4D4]/60">
                            <strong>Why sell this position now?</strong> Selling {rec.recommended_qty} shares locks in a {formatRupee(-rec.loss_booked)} loss, directly cutting the tax you owe on other profits by {formatRupee(rec.tax_saved)}.
                          </div>

                          {/* Holding Period Progress Bar */}
                          <div>
                            <div className="flex justify-between text-[11px] text-slate-500 mb-1 font-medium">
                              <span className="flex items-center gap-1 font-semibold"><Clock className="w-3 h-3 text-slate-400" /> Holding: {rec.holding_days} days</span>
                              <span>{rec.days_to_ltcg > 0 ? `${rec.days_to_ltcg} days to LTCG` : "LTCG Eligible"}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className="bg-[#00A37D] h-1.5 rounded-full" style={{ width: `${rec.holding_progress_pct}%` }} />
                            </div>
                          </div>

                          <div className="bg-slate-50 rounded-xl p-3.5 grid grid-cols-2 gap-3 text-xs border border-slate-100 font-medium">
                            <div>
                              <span className="text-slate-500 block text-[11px]">Unrealised Loss Booked</span>
                              <span className="font-bold text-rose-600">{formatRupee(-rec.loss_booked)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Tax Saved (@ {(rec.effective_rate * 100).toFixed(1)}%)</span>
                              <span className="font-bold text-[#00A37D]">{formatRupee(rec.tax_saved)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Est. Friction (STT/GST)</span>
                              <span className="font-semibold text-slate-700">{formatRupee(rec.friction)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">NET TAX BENEFIT</span>
                              <span className="font-extrabold text-[#00A37D]">{formatRupee(rec.net_benefit)}</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 bg-slate-100/80 p-3 rounded-xl flex items-center gap-2 font-medium">
                            <Info className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{rec.advice}</span>
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Gain Harvesting Cards */}
                {harvestTab === "gain_harvesting" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {harvesting.gainRecs.length === 0 ? (
                      <div className="col-span-2 apple-card p-8 text-center text-slate-500 text-xs">
                        No tax-gain harvesting required (either ₹1.25L exemption is fully used or no open long-term gains available).
                      </div>
                    ) : (
                      harvesting.gainRecs.map((rec, idx) => (
                        <div key={idx} className="apple-card p-6 space-y-4 border-l-4 border-l-[#00A37D]">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F6F2] text-[#00A37D] border border-[#A3E4D4]">
                                  {rec.broker}
                                </span>
                                <h4 className="font-bold text-base text-slate-900">
                                  SELL {rec.recommended_qty} × {rec.stock_name}
                                </h4>
                              </div>
                              <span className="text-xs text-slate-500 font-medium block mt-1">ISIN: {rec.isin} • Bought {rec.buy_date} (LTCG Basis Step-Up)</span>
                            </div>
                            <span className="bg-[#E6F6F2] text-[#00A37D] text-xs font-extrabold px-3 py-1 rounded-full border border-[#A3E4D4] whitespace-nowrap shrink-0">
                              Step Up Basis Tax-Free
                            </span>
                          </div>

                          {/* Plain-Language Layman Reason */}
                          <div className="p-3 bg-[#E6F6F2]/60 rounded-xl text-xs text-[#007A5E] font-medium border border-[#A3E4D4]/60">
                            <strong>Why sell & repurchase this now?</strong> Books {formatRupee(rec.gain_booked)} profit completely tax-free under your ₹1.25L allowance, raising your buy price higher to protect future gains.
                          </div>

                          <div className="bg-slate-50 rounded-xl p-3.5 grid grid-cols-2 gap-3 text-xs border border-slate-100 font-medium">
                            <div>
                              <span className="text-slate-500 block text-[11px]">Unrealised LTCG Booked</span>
                              <span className="font-bold text-[#00A37D]">{formatRupee(rec.gain_booked)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Future Tax Saved</span>
                              <span className="font-bold text-[#00A37D]">{formatRupee(rec.future_tax_saved)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">Est. Friction</span>
                              <span className="font-semibold text-slate-700">{formatRupee(rec.friction)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[11px]">NET BENEFIT</span>
                              <span className="font-extrabold text-[#00A37D]">{formatRupee(rec.net_benefit)}</span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 bg-slate-100/80 p-3 rounded-xl flex items-center gap-2 font-medium">
                            <Info className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{rec.advice}</span>
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 3: NUMERICAL WHAT-IF SIMULATOR */}
            {/* ------------------------------------------------------------- */}
            {navSection === "simulator" && (
              <div className="apple-card p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <Calculator className="w-5 h-5 text-[#00A37D] shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">Interactive What-If Loss Simulator</h3>
                      <p className="text-xs text-slate-500 font-medium">Enter loss figures or tap quick presets to calculate instant tax savings</p>
                    </div>
                  </div>

                  {taxSavingsDelta > 0 && (
                    <div className="bg-[#E6F6F2] text-[#00A37D] font-extrabold text-xs px-4 py-2 rounded-full border border-[#A3E4D4] flex items-center gap-2 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-[#00A37D]" />
                      Instant Tax Saved: {formatRupee(taxSavingsDelta)}
                    </div>
                  )}
                </div>

                {/* Numerical Input System */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* STCL Input Block */}
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-4">
                    <div className="flex justify-between items-center gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Additional STCL (Short-Term Loss)</label>
                      <span className="text-[10px] font-bold text-[#00A37D] bg-[#E6F6F2] px-2.5 py-0.5 rounded-full border border-[#A3E4D4] whitespace-nowrap shrink-0">
                        Offsets STCG @ 20%
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-400 font-extrabold text-sm">₹</span>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={simStclInput}
                        onChange={(e) => setSimStclInput(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-900 text-lg focus:outline-none focus:border-[#00A37D]"
                      />
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[10000, 25000, 50000, taxResult.taxableStcg].map((amt, idx) => (
                        amt > 0 && (
                          <button 
                            key={idx}
                            onClick={() => setSimStclInput(amt.toString())}
                            className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-[#00A37D] hover:text-[#00A37D] transition"
                          >
                            +₹{(amt / 1000).toFixed(0)}k
                          </button>
                        )
                      ))}
                    </div>
                  </div>

                  {/* LTCL Input Block */}
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-4">
                    <div className="flex justify-between items-center gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Additional LTCL (Long-Term Loss)</label>
                      <span className="text-[10px] font-bold text-[#00A37D] bg-[#E6F6F2] px-2.5 py-0.5 rounded-full border border-[#A3E4D4] whitespace-nowrap shrink-0">
                        Offsets LTCG @ 12.5%
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-4 top-3 text-slate-400 font-extrabold text-sm">₹</span>
                      <input 
                        type="number" 
                        placeholder="0"
                        value={simLtclInput}
                        onChange={(e) => setSimLtclInput(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-900 text-lg focus:outline-none focus:border-[#00A37D]"
                      />
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[10000, 25000, 50000, taxResult.taxableLtcg].map((amt, idx) => (
                        amt > 0 && (
                          <button 
                            key={idx}
                            onClick={() => setSimLtclInput(amt.toString())}
                            className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-[#00A37D] hover:text-[#00A37D] transition"
                          >
                            +₹{(amt / 1000).toFixed(0)}k
                          </button>
                        )
                      ))}
                    </div>
                  </div>

                </div>

                {/* Simulation Comparison Bar */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-8">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Current Tax Liability</span>
                      <strong className="text-slate-900 text-lg font-extrabold">{formatRupee(taxResult.totalTaxPayable)}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Simulated Tax Liability</span>
                      <strong className="text-[#00A37D] text-lg font-extrabold">{formatRupee(simTaxResult.totalTaxPayable)}</strong>
                    </div>
                  </div>

                  {(simStclVal > 0 || simLtclVal > 0) && (
                    <button 
                      onClick={() => { setSimStclInput(""); setSimLtclInput(""); }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 border border-slate-200 px-3.5 py-2 rounded-xl hover:bg-slate-50 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Clear Inputs
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* TAB 4: TRADE LEVEL AUDIT TRAIL */}
            {/* ------------------------------------------------------------- */}
            {navSection === "audit" && (
              <div className="apple-card p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Trade Level Audit Trail</h3>
                    <p className="text-xs text-slate-500 font-medium">Every trade line-item traceable to raw broker statements & Income Tax rules</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input 
                        type="text" placeholder="Search stock or ISIN..." 
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-900 focus:outline-none focus:border-[#00A37D]"
                      />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                      {["ALL", "STCG", "LTCG", "INTRADAY"].map(type => (
                        <button 
                          key={type} onClick={() => setFilterType(type)}
                          className={`px-3 py-1 rounded-lg transition ${filterType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Apple Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Broker</th>
                        <th className="py-3 px-4">Stock Name</th>
                        <th className="py-3 px-4">ISIN</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Buy Date</th>
                        <th className="py-3 px-4">Sell Date</th>
                        <th className="py-3 px-4">Holding</th>
                        <th className="py-3 px-4 text-right">Realised P&L</th>
                        <th className="py-3 px-4">Rules & Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredAudit.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition group">
                          <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{item.id}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E6F6F2] text-[#00A37D] border border-[#A3E4D4] whitespace-nowrap">
                              {item.broker}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-[#00A37D] transition-colors">{item.stock_name}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{item.isin}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                              item.classified_type === "STCG" ? "bg-slate-100 text-slate-800 border border-slate-200" :
                              item.classified_type === "LTCG" ? "bg-[#E6F6F2] text-[#00A37D] border border-[#A3E4D4]" :
                              "bg-purple-50 text-purple-700 border border-purple-100"
                            }`}>
                              {item.classified_type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">{item.buy_date}</td>
                          <td className="py-3.5 px-4 text-slate-500">{item.sell_date}</td>
                          <td className="py-3.5 px-4 text-slate-500 font-mono">{item.holding_days}d</td>
                          <td className={`py-3.5 px-4 text-right font-extrabold text-sm ${item.adjusted_pnl >= 0 ? "text-[#00A37D]" : "text-rose-600"}`}>
                            {formatRupee(item.adjusted_pnl)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">{item.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2 flex justify-between text-xs text-slate-400 font-medium">
                  <span>Showing {filteredAudit.length} of {taxResult.auditTrail.length} consolidated trades</span>
                  <span>Finance (No. 2) Act 2024 Compliance</span>
                </div>
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}
