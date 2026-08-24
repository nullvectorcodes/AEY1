# AEY — Multi-Broker Indian Equity Tax & Harvesting Engine

[![Budget 2024 Verified](https://img.shields.io/badge/Budget_2024-Verified-00A37D?style=for-the-badge)](https://github.com/nullvectorcodes/AEY1)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Vite + React](https://img.shields.io/badge/Frontend-Vite_%2B_React-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

**AEY** is a high-performance, privacy-first **Indian Equity Capital Gains Tax Analysis & Tax Harvesting Engine** designed for retail investors, traders, and CAs. It ingests, validates, and consolidates P&L statements from multiple brokers (**Zerodha, Groww, Upstox, Angel One, ICICI Direct**) into a unified tax calculation compliant with the **Finance (No. 2) Act 2024**.

---

## 🚀 Key Features

- 📊 **Multi-Broker Statement Consolidation**: Upload multiple broker P&L files (`.xlsx`, `.xls`, `.csv`) in one go. Automatically detects broker formats and checks for duplicate trade entries.
- 🎯 **Finance (No. 2) Act 2024 Compliance**:
  - **STCG (Sec 111A)**: Flat 20% tax rate.
  - **LTCG (Sec 112A)**: Flat 12.5% tax rate on aggregate LTCG exceeding the **₹1.25 Lakh exemption limit** per FY.
  - **Intraday Trades (Sec 73)**: Segregated into speculative business income.
  - **4% Cess**: Health & Education Cess calculated on basic tax.
- 📈 **Pre-2018 Grandfathering Engine**: Automatically computes grandfathered cost of acquisition for pre-2018 holdings under Section 112A:
  $$\text{Cost} = \max(\text{Buy Price}, \min(\text{FMV as of 31-Jan-2018}, \text{Sell Price}))$$
- ⚖️ **Statutory Set-Off Rules (Sections 70 & 71)**: Enforces exact statutory loss set-off sequence (STCL -> STCG, LTCL -> LTCG, remaining STCL -> LTCG).
- 💡 **Cross-Broker Tax Harvesting Engine**: Scans open holdings across all brokers to identify friction-adjusted tax-loss harvesting and LTCG cost-basis step-up opportunities.
- 🧪 **Interactive What-If Loss Simulator**: Real-time numerical input simulator calculating instant tax savings.
- 🔒 **100% Client-Side Privacy**: All parsing and computation happen locally inside the browser. Zero financial data is sent to external servers.

---

## 📁 Project Structure & Where to Find Code

```
AEY1/
├── src/tax_engine/              # Python Core Engine Package
│   ├── parser.py                # Multi-signature Header Hunter & Excel Parser
│   ├── engine.py                # Capital Gains Tax & Set-Off Calculation Logic
│   ├── harvesting.py            # Friction-Adjusted Tax Harvesting Engine
│   ├── tax_rules.py             # Statutory Rates, Rules & Rupee Formatter
│   └── synthetic_generator.py   # Test Excel Statement Generator
├── tests/                       # Pytest Suite
│   └── test_tax_engine.py       # 7 Unit Tests covering all tax & parser rules
├── web_ui/                      # Web Application (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── App.jsx              # Main Dashboard UI & Multi-Broker Tray
│   │   ├── tax_engine_js.js     # JavaScript Core Tax Engine & Header Hunter
│   │   └── index.css            # Styling & Plus Jakarta Sans Font Config
│   ├── index.html               # Entry HTML
│   └── vite.config.js           # Vite & Tailwind v4 Config
├── PRD_AEY_Tax_Engine.md        # Product Requirements Document
├── User_Manual_and_Tax_Engine_Logic.md # CA-Grade Engine Specifications & Manual
├── worked_example.py            # CLI Worked Example Script
└── README.md                    # Project Readme
```

---

## ⚡ Quickstart Guide

### 1. Running Python Core Engine & Tests

```bash
# Clone repository
git clone https://github.com/nullvectorcodes/AEY1.git
cd AEY1

# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt  # pandas, openpyxl, pytest

# Run worked example CLI script
python3 worked_example.py

# Run Pytest unit test suite
PYTHONPATH=. pytest tests/test_tax_engine.py
```

### 2. Running Web Application Locally

```bash
cd web_ui

# Install dependencies
npm install

# Start Vite local dev server
npm run dev -- --port 5173
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 📖 Documentation Artifacts
- **[PRD_AEY_Tax_Engine.md](PRD_AEY_Tax_Engine.md)**: Full Product Requirements Document.
- **[User_Manual_and_Tax_Engine_Logic.md](User_Manual_and_Tax_Engine_Logic.md)**: Engine mathematical formulas, set-off sequence diagrams, and user guide.

---

## 📄 License
Licensed under the [MIT License](LICENSE).
