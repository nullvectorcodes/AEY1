# AEY — Multi-Broker Indian Equity Tax & Harvesting Engine

AEY is a client-side, privacy-focused Indian Equity Capital Gains Tax Analysis and Tax Harvesting Engine. It ingests, validates, and consolidates Profit and Loss (P&L) statements from multiple Indian brokers—including Zerodha, Groww, Upstox, Angel One, and ICICI Direct—into a unified tax report compliant with the Finance (No. 2) Act 2024.

---

## Key Capabilities

- **Multi-Broker Statement Consolidation**: Ingests multiple broker P&L files (`.xlsx`, `.xls`, `.csv`) simultaneously. Identifies broker formats automatically and flags duplicate trade entries across uploads.
- **Finance (No. 2) Act 2024 Statutory Rules**:
  - **STCG (Section 111A)**: 20% flat tax rate on delivery trades held for 365 days or less.
  - **LTCG (Section 112A)**: 12.5% flat tax rate on aggregate long-term gains exceeding the ₹1,25,000 annual exemption limit.
  - **Intraday Trades (Section 73)**: Segregated into speculative business income.
  - **Health and Education Cess**: 4% cess applied to basic capital gains tax.
- **Pre-2018 Grandfathering Engine**: Computes grandfathered cost of acquisition for equity shares acquired on or before January 31, 2018 under Section 112A:
  $$\text{Cost} = \max(\text{Actual Buy Price}, \min(\text{FMV as of 31-Jan-2018}, \text{Sell Price}))$$
- **Statutory Loss Set-Off Rules (Sections 70 and 71)**: Enforces statutory loss set-off sequence (STCL against STCG, LTCL against LTCG, and remaining STCL against LTCG).
- **Cross-Broker Tax Harvesting**: Analyzes open positions across all brokers to identify friction-adjusted tax-loss harvesting and LTCG cost-basis step-up opportunities.
- **What-If Loss Simulator**: Allows real-time numerical input simulation to model tax savings before executing trades.
- **Client-Side Privacy**: File parsing and calculations execute locally within the user's web browser. No financial data is transmitted to external servers.

---

## Project Structure

```
AEY1/
├── src/tax_engine/              # Python Core Engine Package
│   ├── parser.py                # Multi-signature Header Hunter & Excel Parser
│   ├── engine.py                # Capital Gains Tax & Set-Off Logic
│   ├── harvesting.py            # Tax Harvesting Recommendation Engine
│   ├── tax_rules.py             # Statutory Rates, Rules & Currency Formatter
│   └── synthetic_generator.py   # Test Excel Statement Generator
├── tests/                       # Pytest Suite
│   └── test_tax_engine.py       # Unit Tests (7 passing tests)
├── web_ui/                      # Web Application (React, Vite, Tailwind CSS)
│   ├── src/
│   │   ├── App.jsx              # Application Dashboard
│   │   ├── tax_engine_js.js     # JavaScript Tax Engine Translation
│   │   └── index.css            # Style Definitions and Typography
│   ├── index.html               # Entry HTML
│   └── vite.config.js           # Vite Configuration
├── PRD_AEY_Tax_Engine.md        # Product Requirements Document
├── User_Manual_and_Tax_Engine_Logic.md # CA-Grade Engine Specifications
├── worked_example.py            # CLI Worked Example Script
└── README.md                    # Project Readme
```

---

## Quickstart Guide

### 1. Python Engine and Test Suite Execution

```bash
# Clone repository
git clone https://github.com/nullvectorcodes/AEY1.git
cd AEY1

# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Execute CLI worked example
python3 worked_example.py

# Run Pytest suite
PYTHONPATH=. pytest tests/test_tax_engine.py
```

### 2. Local Web Application Execution

```bash
cd web_ui

# Install dependencies
npm install

# Start Vite development server
npm run dev -- --port 5173
```

Navigate to `http://localhost:5173` in a web browser.

---

## Documentation

- `PRD_AEY_Tax_Engine.md`: Product Requirements Document.
- `User_Manual_and_Tax_Engine_Logic.md`: Technical documentation of statutory set-off rules, header hunter algorithms, and user procedures.

---

## License
Distributed under the MIT License.
