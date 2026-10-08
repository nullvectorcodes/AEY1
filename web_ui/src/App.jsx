import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  ShieldCheck, 
  CheckCircle2, Info, 
  AlertCircle, XCircle, Clock, LayoutDashboard, Zap, FileText, 
  ArrowUpRight, ArrowDownRight, UploadCloud, Search,
  PanelLeftClose, PanelLeftOpen, Calculator, RotateCcw,
  Trash2, Plus, Layers, Filter, AlertTriangle, HelpCircle,
  Sparkles, TrendingDown, Download, Scale, Award, Check, ExternalLink,
  ChevronRight, BarChart3
} from 'lucide-react';
import { 
  formatRupee, parseSingleBrokerStatement, consolidateMultipleStatements, computeTax, 
  generateHarvestingRecommendations, LTCG_EXEMPTION_LIMIT,
  computeModelTaxSavings, BENCHMARK_PERSONAS, PANELIST_MOCK_DATA,
  PANELIST_MIXED_CRYPTO_MOCK_DATA, PANELIST_CRYPTO_ONLY_MOCK_DATA,
  VDA_CRYPTO_RATE, VDA_TDS_RATE
} from './tax_engine_js';

// Plain-Language Tooltip Terms Definition
const TAX_EXPLANATIONS = {
  STCG: "Profit from shares or mutual funds held for 1 year or less before selling. Taxed at a flat 20% under Section 111A.",
  LTCG: "Profit from shares held for more than 1 year. The first ₹1.25 lakh in profit each financial year is 100% tax-free; profits above that are taxed at 12.5%.",
  TAX_PAYABLE: "The total final tax amount you owe to the Income Tax Department for this financial year, including the 4% Health & Education Cess.",
  EXEMPTION_HEADROOM: "How much more long-term profit (LTCG) you can book before 31-March at 0% tax before any tax liability kicks in.",
  SET_OFF: "Income Tax rules allowing you to subtract short-term losses from gains to reduce your overall taxable income.",
  INTRADAY: "Profits or losses from same-day buying and selling. Treated as speculative business income and taxed at your regular income tax slab rate.",
  HARVESTING: "Strategically selling specific shares before 31-March to lock in losses or utilize tax-free limits, reducing your tax bill.",
  VDA_CRYPTO: "Virtual Digital Assets (Crypto / NFT) are governed by Section 115BBH. Taxed at a flat 30% (+4% cess). Crucially, under Section 115BBH(2)(b), crypto losses cannot offset any gains or carry forward. Section 194S 1% TDS is claimed as tax credit.",
  TDS_194S: "1% Tax Deducted at Source by crypto exchanges on sale considerations. AEY automatically credits this against your final tax payable."
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
  const [selectedPersonaId, setSelectedPersonaId] = useState("live");
  const [savingsSuccessMsg, setSavingsSuccessMsg] = useState(null);

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

  // Model Tax Savings & Comparative Benchmark Engine
  const modelSavings = computeModelTaxSavings(activeTrades, activePositions, harvesting);

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

  const loadPanelistDemoData = () => {
    setIsDemoData(false);
    setUserFiles(PANELIST_MOCK_DATA);
    setBrokerFilter("ALL");
    setUploadError(null);
    setSimStclInput("");
    setSimLtclInput("");
    setSelectedPersonaId("live");
    setSavingsSuccessMsg("Panelist Demonstration Dataset Loaded: Multi-broker equity trades, pre-2018 grandfathered shares, and open positions ready for tax-loss harvesting!");
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    setTimeout(() => setSavingsSuccessMsg(null), 6000);
  };

  const loadMixedCryptoDemoData = () => {
    setIsDemoData(false);
    setUserFiles(PANELIST_MIXED_CRYPTO_MOCK_DATA);
    setBrokerFilter("ALL");
    setUploadError(null);
    setSimStclInput("");
    setSimLtclInput("");
    setSelectedPersonaId("persona_5");
    setSavingsSuccessMsg("🪙 Mixed Crypto & Equity Demonstration Loaded: Enforcing Section 115BBH isolation (BTC/SOL gains taxed, ETH loss set-off disallowed), Section 194S TDS credited, and Equity harvesting optimized!");
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 }
    });
    setTimeout(() => setSavingsSuccessMsg(null), 7000);
  };

  const handleDownloadMockCsv = (fileName) => {
    const link = document.createElement('a');
    link.href = `/mock_data/${fileName}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAudit = taxResult.auditTrail.filter(item => {
    const matchesSearch = item.stock_name.toLowerCase().includes(searchTerm.toLowerCase()) || item.isin.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterType === "ALL") return matchesSearch;
    if (filterType === "STCG") return matchesSearch && item.classified_type === "STCG";
    if (filterType === "LTCG") return matchesSearch && item.classified_type === "LTCG";
    if (filterType === "INTRADAY") return matchesSearch && item.classified_type.includes("Speculative");
    if (filterType === "CRYPTO") return matchesSearch && (item.is_crypto || item.classified_type.includes("VDA") || item.classified_type.includes("Crypto"));
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

    if (taxResult.hasCrypto) {
      storyParts.push(`Under Section 115BBH, your ${formatRupee(taxResult.grossCryptoGains)} crypto profits (BTC & SOL) are taxed at flat 30% + 4% cess (${formatRupee(taxResult.cryptoGrossTax)}). ${formatRupee(taxResult.cryptoLossDisallowed)} in crypto losses (ETH) were legally isolated from offsetting gains (shielding you from Section 143(1)(a) defect notices and 200% Section 270A penalties), and ${formatRupee(taxResult.cryptoTdsCredits)} in Section 194S TDS credits were recovered.`);
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
              onClick={() => setNavSection("benchmark")}
              className={`w-full flex items-center ${sidebarCollapsed ? "justify-center px-0" : "justify-between px-3.5"} py-2.5 rounded-xl text-xs font-bold transition ${
                navSection === "benchmark" 
                  ? "bg-[#E6F6F2] text-[#00A37D]" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Scale className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Model Savings & Benchmark</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="bg-[#00A37D] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                  {modelSavings.pctSavedVsBaseline > 0 ? `${modelSavings.pctSavedVsBaseline.toFixed(0)}% Saved` : "Audit"}
                </span>
              )}
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

                {/* AEY MODEL TAX SAVINGS SPOTLIGHT CARD */}
                <div className="apple-card p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-[#042f24] text-white rounded-2xl shadow-lg border border-emerald-900/40 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                          <Scale className="w-3 h-3 text-[#00A37D]" /> AEY Model Tax Advantage
                        </span>
                        <span className="text-xs text-slate-400">Finance (No. 2) Act 2024</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                        How Much Tax Are You Saving With Our Model vs. Paying Otherwise?
                      </h3>
                    </div>

                    <button 
                      onClick={() => setNavSection("benchmark")}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00A37D] hover:bg-[#008767] text-white transition shadow-sm shrink-0"
                    >
                      <span>Full Benchmark Audit</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 3 Pillars Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Column 1: Otherwise / Siloed */}
                    <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">1. Paying Otherwise</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Siloed Broker
                        </span>
                      </div>
                      <div className="text-2xl font-black text-rose-400 tracking-tight">
                        {formatRupee(modelSavings.withoutAeyTax)}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Taxes calculated per broker in isolation. Zero cross-broker loss set-offs, un-grandfathered gains, and zero harvesting.
                      </p>
                    </div>

                    {/* Column 2: Traditional CA */}
                    <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">2. Traditional CA Audit</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          + ₹3.5k Fee
                        </span>
                      </div>
                      <div className="text-2xl font-black text-amber-300 tracking-tight">
                        {formatRupee(modelSavings.caTaxAndFees)}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Standard statutory set-off with ₹3,500 CA consultation fee. Zero round-trip friction-adjusted harvesting before 31-March.
                      </p>
                    </div>

                    {/* Column 3: With AEY Engine */}
                    <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-2 relative overflow-hidden">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">3. With AEY Model</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#00A37D] text-white shadow-sm">
                          Our Model
                        </span>
                      </div>
                      <div className="text-2xl font-black text-emerald-400 tracking-tight">
                        {formatRupee(modelSavings.aeyFinalNetOutflow)}
                      </div>
                      <p className="text-[11px] text-emerald-200/80 leading-snug">
                        Instant cross-broker set-off + automated Section 112A pre-2018 grandfathering + friction-netted tax harvesting.
                      </p>
                    </div>
                  </div>

                  {/* Net Savings Highlight Strip */}
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-300">
                        Net Tax Saved with AEY: <strong className="text-emerald-300 font-extrabold text-sm">{formatRupee(modelSavings.netSavedVsBaseline)}</strong> ({modelSavings.pctSavedVsBaseline.toFixed(1)}% total tax reduction)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-300">
                      {modelSavings.breakdown.crossBrokerSetoff > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                          Cross Set-Off: +{formatRupee(modelSavings.breakdown.crossBrokerSetoff)}
                        </span>
                      )}
                      {modelSavings.breakdown.grandfathering > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                          Grandfathering: +{formatRupee(modelSavings.breakdown.grandfathering)}
                        </span>
                      )}
                      {modelSavings.breakdown.lossHarvesting > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                          Harvesting: +{formatRupee(modelSavings.breakdown.lossHarvesting)}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                        CA Fee Avoided: +₹3,500
                      </span>
                    </div>
                  </div>
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

                {/* Crypto / VDA Section 115BBH Compliance Card */}
                {taxResult.hasCrypto && (
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/40 shadow-xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black text-lg">
                          🪙
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-white">Virtual Digital Assets (Schedule VDA - Sec 115BBH)</h4>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              Statutory Isolation Active
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Segregates crypto from equity: Flat 30% tax + 4% cess on profitable transfers. Blocks illegal crypto loss netting to safeguard against Sec 143(1)(a) defect notices.
                          </p>
                        </div>
                      </div>

                      <div className="text-right bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Sec 194S TDS Claimed</span>
                        <span className="text-sm font-black text-emerald-400">-{formatRupee(taxResult.cryptoTdsCredits)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gross VDA Gains</span>
                        <span className="text-lg font-black text-emerald-400 mt-1 block">{formatRupee(taxResult.grossCryptoGains)}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">BTC & SOL realized gains</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-900/50">
                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Disallowed VDA Loss</span>
                        <span className="text-lg font-black text-amber-300 mt-1 block">{formatRupee(taxResult.cryptoLossDisallowed)}</span>
                        <span className="text-[10px] text-amber-500/80 block mt-0.5">ETH loss (Barred Sec 115BBH(2))</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-900/50">
                        <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider block">Sec 270A Penalty Shield</span>
                        <span className="text-lg font-black text-purple-300 mt-1 block">{formatRupee(taxResult.cryptoPenaltyRiskAverted)}</span>
                        <span className="text-[10px] text-purple-400/80 block mt-0.5">200% under-reporting averted</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-rose-900/50">
                        <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Net Crypto Tax Payable</span>
                        <span className="text-lg font-black text-rose-400 mt-1 block">{formatRupee(taxResult.cryptoNetPayable)}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">31.2% less TDS credit</span>
                      </div>
                    </div>
                  </div>
                )}

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
            {/* TAB: MODEL SAVINGS & PANELIST BENCHMARK SUITE */}
            {/* ------------------------------------------------------------- */}
            {navSection === "benchmark" && (
              <div className="space-y-8">
                
                {/* Success Toast */}
                {savingsSuccessMsg && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 flex items-center justify-between shadow-sm animate-fade-in">
                    <div className="flex items-center gap-2.5 font-bold text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-[#00A37D]" />
                      <span>{savingsSuccessMsg}</span>
                    </div>
                    <button onClick={() => setSavingsSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
                      ✕
                    </button>
                  </div>
                )}

                {/* Benchmark Hero Header with 1-Click Panelist Suite */}
                <div className="apple-card p-6 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-[#032e23] text-white rounded-3xl shadow-xl border border-emerald-900/50 space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-[#00A37D]" /> Panelist & CA Evaluation Engine
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          Finance (No. 2) Act 2024
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        AEY Model vs. Alternative Approaches
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                        See exactly how much tax an investor pays when filing through individual brokers or traditional CAs versus our automated client-side engine.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                      <button
                        onClick={loadPanelistDemoData}
                        className="btn-aey px-4 py-3 rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                        title="Loads multi-broker Zerodha + Groww + open holdings"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>⚡ 1-Click Equity Multi-Broker</span>
                      </button>

                      <button
                        onClick={loadMixedCryptoDemoData}
                        className="px-4 py-3 rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer border border-amber-400/40"
                        title="Loads mixed Zerodha + Groww + CoinDCX crypto with BTC, ETH, SOL"
                      >
                        <span>🪙 1-Click Mixed Crypto + Equity</span>
                      </button>

                      <div className="relative group inline-block">
                        <button className="w-full px-4 py-3 rounded-2xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition">
                          <Download className="w-4 h-4 text-[#00A37D]" />
                          <span>Download Mock CSVs</span>
                        </button>
                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto absolute right-0 mt-2 w-80 p-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-40 space-y-1">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Ready-To-Upload Broker CSVs
                          </div>
                          {[
                            { name: "Mixed Equity & Crypto Portfolio (Commingled)", file: "mixed_equity_crypto_portfolio.csv", tag: "Featured" },
                            { name: "CoinDCX VDA Crypto Trades (Sec 115BBH)", file: "coindcx_crypto_fy24.csv", tag: "Crypto" },
                            { name: "Zerodha P&L Trades (STCG + Grandfathered)", file: "zerodha_trades_fy24.csv", tag: "Equity" },
                            { name: "Groww P&L Trades (STCL + Intraday)", file: "groww_trades_fy24.csv", tag: "Equity" },
                            { name: "Open Portfolio Holdings (Harvest Candidates)", file: "open_holdings_harvesting.csv", tag: "Holdings" },
                            { name: "Master Panelist Consolidated Demo", file: "master_panelist_demo.csv", tag: "Bundle" }
                          ].map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleDownloadMockCsv(item.file)}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 hover:text-emerald-300 transition flex items-center justify-between"
                            >
                              <div className="truncate pr-2">
                                <span className="block truncate">{item.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{item.file}</span>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold shrink-0">{item.tag}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scenario / Persona Switcher Tabs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                      <span>Select Case Scenario to Evaluate:</span>
                      <span className="text-[11px] text-emerald-400">Comparing Against Siloed & CA Baselines</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      <button
                        onClick={() => setSelectedPersonaId("live")}
                        className={`p-3 rounded-2xl text-left border transition ${
                          selectedPersonaId === "live"
                            ? "bg-emerald-500/20 border-emerald-400 text-white shadow-sm"
                            : "bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        }`}
                      >
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Active Data
                        </div>
                        <div className="text-xs font-bold text-white truncate mt-1">Live Portfolio</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {modelSavings.pctSavedVsBaseline.toFixed(0)}% Tax Saved
                        </div>
                      </button>

                      {BENCHMARK_PERSONAS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPersonaId(p.id)}
                          className={`p-3 rounded-2xl text-left border transition ${
                            selectedPersonaId === p.id
                              ? "bg-emerald-500/20 border-emerald-400 text-white shadow-sm"
                              : "bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 truncate">
                            {p.tag}
                          </div>
                          <div className="text-xs font-bold text-white truncate mt-1">{p.name}</div>
                          <div className="text-[10px] text-emerald-400 mt-0.5 font-bold">
                            {p.pctSaved.toFixed(0)}% Tax Saved
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Scenario Card Display */}
                {(() => {
                  const isLive = selectedPersonaId === "live";
                  const pData = isLive ? null : BENCHMARK_PERSONAS.find(p => p.id === selectedPersonaId);
                  
                  const baselineTax = isLive ? modelSavings.withoutAeyTax : pData.baselineTax;
                  const caTotal = isLive ? modelSavings.caTaxAndFees : pData.caTaxAndFees;
                  const aeyPreTax = isLive ? modelSavings.aeyPreHarvestTax : pData.aeyPreHarvestTax;
                  const harvestSaved = isLive ? modelSavings.aeyHarvestingSavings : pData.harvestBenefit;
                  const aeyFinalOutflow = isLive ? modelSavings.aeyFinalNetOutflow : pData.aeyFinalOutflow;
                  const savedVsBaseline = isLive ? modelSavings.netSavedVsBaseline : pData.netSavedVsBaseline;
                  const savedVsCA = isLive ? modelSavings.netSavedVsCA : pData.netSavedVsCA;
                  const pctSaved = isLive ? modelSavings.pctSavedVsBaseline : pData.pctSaved;
                  const scenarioDesc = isLive 
                    ? `Live consolidated calculation across ${activeFilesList.length} statements (${activeTrades.length} trades, ${activePositions.length} open positions).`
                    : pData.description;
                  const takeaway = isLive
                    ? `You are saving ${formatRupee(savedVsBaseline)} (${pctSaved.toFixed(1)}%) with AEY compared to paying taxes on each broker's siloed download.`
                    : pData.keyTakeaway;

                  return (
                    <div className="space-y-6">
                      
                      {/* Scenario Summary Banner */}
                      <div className="apple-card p-6 border-l-4 border-l-[#00A37D] flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#00A37D] uppercase tracking-wider">
                            {isLive ? "Live Portfolio Evaluation" : pData.tag}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900">
                            {isLive ? "Current Consolidated Portfolio Analysis" : pData.name}
                          </h3>
                          <p className="text-xs text-slate-600 font-medium max-w-3xl">
                            {scenarioDesc}
                          </p>
                        </div>

                        <div className="bg-[#E6F6F2] border border-[#A3E4D4] rounded-2xl p-4 text-center shrink-0 min-w-[200px]">
                          <span className="text-[10px] font-extrabold text-[#00A37D] uppercase tracking-wider block">Net Tax Saved With AEY</span>
                          <span className="text-2xl font-black text-[#00A37D] block mt-0.5">{formatRupee(savedVsBaseline)}</span>
                          <span className="text-[11px] font-bold text-emerald-800 block mt-0.5">🔥 {pctSaved.toFixed(1)}% Total Tax Reduction</span>
                        </div>
                      </div>

                      {/* 4-Way Head-to-Head Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* 1. Siloed Baseline */}
                        <div className="apple-card p-5 border-slate-200/90 flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approach 1</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Siloed Baseline
                              </span>
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-sm">Paying Otherwise</h4>
                            <p className="text-[11px] text-slate-500 mt-1">Separate broker P&L downloads without cross-broker set-off</p>
                            
                            <div className="text-2xl font-black text-rose-600 mt-4 tracking-tight">
                              {formatRupee(baselineTax)}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                            <div className="flex justify-between">
                              <span>Cross Set-off:</span>
                              <strong className="text-rose-600 font-bold">None (Trapped)</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Grandfathering:</span>
                              <strong className="text-rose-600 font-bold">Uncalculated</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Tax Harvesting:</span>
                              <strong className="text-slate-400 font-bold">₹0 (Zero)</strong>
                            </div>
                          </div>
                        </div>

                        {/* 2. Traditional CA */}
                        <div className="apple-card p-5 border-slate-200/90 flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approach 2</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                CA / Spreadsheet
                              </span>
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-sm">Traditional CA Audit</h4>
                            <p className="text-[11px] text-slate-500 mt-1">Manual spreadsheet audit + ₹3,500 CA consultation fee</p>
                            
                            <div className="text-2xl font-black text-amber-600 mt-4 tracking-tight">
                              {formatRupee(caTotal)}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                            <div className="flex justify-between">
                              <span>Set-off & Audit:</span>
                              <strong className="text-slate-700 font-bold">Manual (2-5 days)</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Professional Fee:</span>
                              <strong className="text-amber-600 font-bold">₹3,500.00</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Tax Harvesting:</span>
                              <strong className="text-slate-400 font-bold">₹0 (None)</strong>
                            </div>
                          </div>
                        </div>

                        {/* 3. AEY Pre-Harvest */}
                        <div className="apple-card p-5 border-slate-200/90 flex flex-col justify-between space-y-4">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approach 4A</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#00A37D] border border-[#A3E4D4]">
                                Statutory Rules
                              </span>
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-sm">AEY Consolidated</h4>
                            <p className="text-[11px] text-slate-500 mt-1">Sec 70/71 set-offs + Sec 112A pre-2018 grandfathering</p>
                            
                            <div className="text-2xl font-black text-slate-900 mt-4 tracking-tight">
                              {formatRupee(aeyPreTax)}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                            <div className="flex justify-between">
                              <span>Finance Act 2024:</span>
                              <strong className="text-[#00A37D] font-bold">Verified</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Cross Set-off:</span>
                              <strong className="text-[#00A37D] font-bold">Instant</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Client-Side Privacy:</span>
                              <strong className="text-[#00A37D] font-bold">100% Local</strong>
                            </div>
                          </div>
                        </div>

                        {/* 4. AEY With Harvesting */}
                        <div className="apple-card p-5 border-[#00A37D] bg-gradient-to-b from-[#F2FBF8] to-white flex flex-col justify-between space-y-4 shadow-md">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black text-[#00A37D] uppercase tracking-wider">Approach 4B</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#00A37D] text-white">
                                Full AEY Model
                              </span>
                            </div>
                            <h4 className="font-extrabold text-slate-900 text-sm">With Tax Harvesting</h4>
                            <p className="text-[11px] text-slate-500 mt-1">Net outflow after executing recommended harvesting</p>
                            
                            <div className="text-2xl font-black text-[#00A37D] mt-4 tracking-tight">
                              {formatRupee(aeyFinalOutflow)}
                            </div>
                          </div>

                          <div className="pt-3 border-emerald-100 text-[11px] text-slate-600 space-y-1">
                            <div className="flex justify-between">
                              <span>Harvest Benefit:</span>
                              <strong className="text-[#00A37D] font-extrabold">+{formatRupee(harvestSaved)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Saved vs Siloed:</span>
                              <strong className="text-[#00A37D] font-extrabold">{formatRupee(savedVsBaseline)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Saved vs CA:</span>
                              <strong className="text-[#00A37D] font-extrabold">{formatRupee(savedVsCA)}</strong>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Statutory Mechanism Explanation Box */}
                      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-3">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-[#00A37D]" />
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Statutory Tax Mechanism in this Scenario</h4>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          {takeaway}
                        </p>
                      </div>

                      {/* Detailed Statutory Comparison Table */}
                      <div className="apple-card p-6 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                          <div>
                            <h4 className="font-bold text-sm text-slate-900">Comprehensive Architecture & Feature Comparison Matrix</h4>
                            <p className="text-xs text-slate-500">Benchmark against Naive Broker, Traditional CA, Legacy Portals, and AEY Engine</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full">
                            Finance (No. 2) Act 2024
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                                <th className="py-3 px-3">Evaluation Metric</th>
                                <th className="py-3 px-3 text-rose-700">Approach 1: Siloed Broker</th>
                                <th className="py-3 px-3 text-amber-700">Approach 2: Traditional CA</th>
                                <th className="py-3 px-3 text-slate-600">Approach 3: Legacy FinTech</th>
                                <th className="py-3 px-3 text-[#00A37D] font-black">Approach 4: AEY Engine</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">STCG Tax Rate (Sec 111A)</td>
                                <td className="py-3 px-3 text-slate-600">20% (Isolated)</td>
                                <td className="py-3 px-3 text-slate-600">20% (Manual)</td>
                                <td className="py-3 px-3 text-rose-600 font-bold">15% (Outdated Pre-2024)</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">20% Flat (Verified)</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">LTCG Tax Rate (Sec 112A)</td>
                                <td className="py-3 px-3 text-slate-600">12.5% (Per-Broker Exemption)</td>
                                <td className="py-3 px-3 text-slate-600">12.5% (&gt; ₹1.25L)</td>
                                <td className="py-3 px-3 text-rose-600 font-bold">10% (&gt; ₹1L Outdated)</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">12.5% (&gt; ₹1.25L Verified)</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">Pre-2018 Grandfathering</td>
                                <td className="py-3 px-3 text-rose-600">Ignored (FIFO buy price)</td>
                                <td className="py-3 px-3 text-slate-700">Manual / Spreadsheet</td>
                                <td className="py-3 px-3 text-slate-500">Partial / Missing FMV</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">Automated 31-Jan-2018 FMV</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">Multi-Broker Loss Set-Off</td>
                                <td className="py-3 px-3 text-rose-600 font-bold">None (Losses trapped)</td>
                                <td className="py-3 px-3 text-slate-700">Manual Cross Set-Off</td>
                                <td className="py-3 px-3 text-slate-500">Manual Uploads</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">Instant Multi-Broker Consolidation</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">Virtual Digital Assets (Crypto / VDA)</td>
                                <td className="py-3 px-3 text-rose-600 font-bold">Unsupported (Equity only)</td>
                                <td className="py-3 px-3 text-rose-600">Risky manual netting (Triggers Sec 143(1)(a) defect & 200% penalty)</td>
                                <td className="py-3 px-3 text-rose-600">Crashes on mixed broker CSVs</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">Schedule VDA Isolated + 31.2% Flat Tax + Sec 194S TDS Credit</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">Tax-Loss Harvesting Engine</td>
                                <td className="py-3 px-3 text-slate-400">None</td>
                                <td className="py-3 px-3 text-slate-400">None (Filed after year-end)</td>
                                <td className="py-3 px-3 text-slate-400">None</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">Friction-Adjusted (STT/GST netted)</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">LTCG Exemption Step-Up</td>
                                <td className="py-3 px-3 text-slate-400">Unused Headroom Lost</td>
                                <td className="py-3 px-3 text-slate-400">None</td>
                                <td className="py-3 px-3 text-slate-400">None</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">Algorithmic Cost Step-Up (0% Tax)</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">Client-Side Privacy</td>
                                <td className="py-3 px-3 text-slate-600">Broker Server</td>
                                <td className="py-3 px-3 text-slate-600">Email / Unencrypted PDF</td>
                                <td className="py-3 px-3 text-rose-600">Remote Cloud Server</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">100% In-Browser (Zero Cloud)</td>
                              </tr>
                              <tr>
                                <td className="py-3 px-3 font-bold text-slate-900">Advisory Fee</td>
                                <td className="py-3 px-3 text-slate-700">₹0</td>
                                <td className="py-3 px-3 text-amber-700 font-bold">₹3,000 to ₹15,000</td>
                                <td className="py-3 px-3 text-slate-700">₹500 to ₹2,500</td>
                                <td className="py-3 px-3 text-[#00A37D] font-extrabold">₹0 (Free / Open Model)</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Visual Infographic Banner */}
                      <div className="apple-card p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 text-white">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 block">Executive Infographic</span>
                            <h4 className="font-black text-base text-white">Efficiency & Statutory Benchmark Comparison</h4>
                          </div>
                          <a
                            href="/model_comparison_table.jpg"
                            download="AEY_Model_Comparison_Benchmark.jpg"
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition"
                          >
                            <Download className="w-3.5 h-3.5 text-[#00A37D]" /> Download High-Res Infographic
                          </a>
                        </div>
                        <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/60 flex justify-center">
                          <img
                            src="/model_comparison_table.jpg"
                            alt="AEY Engine vs Market Alternatives: Statutory Tax & Efficiency Benchmark"
                            className="w-full h-auto object-contain rounded-2xl shadow-xl"
                          />
                        </div>
                      </div>

                      {/* Panelist Testing Guide & CSV Sandbox */}
                      <div className="apple-card p-6 bg-slate-50 border border-slate-200/90 space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-[#00A37D]" />
                          <h4 className="font-bold text-sm text-slate-900">Panelist Quick-Test Walkthrough</h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          To demonstrate the engine in real time to jury members or Chartered Accountants:
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                            <strong className="font-bold text-slate-900 block">Step 1: Get Mock Statements</strong>
                            <p className="text-slate-500 text-[11px]">Click "Download Mock CSVs" or tap "1-Click Load Panelist Demo" above.</p>
                          </div>
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                            <strong className="font-bold text-slate-900 block">Step 2: Check Cross-Broker Offsets</strong>
                            <p className="text-slate-500 text-[11px]">Notice Groww's ₹26,000 STCL automatically absorbing Zerodha's STCG under Sec 70.</p>
                          </div>
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
                            <strong className="font-bold text-slate-900 block">Step 3: Check Tax Harvesting</strong>
                            <p className="text-slate-500 text-[11px]">Navigate to the "Tax Harvesting" tab to see algorithmic sell recommendations for HDFC Bank & Airtel.</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })()}

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
                      {["ALL", "STCG", "LTCG", "INTRADAY", "CRYPTO"].map(type => (
                        <button 
                          key={type} onClick={() => setFilterType(type)}
                          className={`px-3 py-1 rounded-lg transition ${filterType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                        >
                          {type === "CRYPTO" ? "🪙 VDA / Crypto" : type}
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
                              item.is_crypto || item.classified_type.includes("VDA") ? "bg-amber-100 text-amber-900 border border-amber-300" :
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
