# Mathematical Proof & Statutory Breakdown of AEY’s 42.2% Net Tax Savings

> **Document Type**: Statutory Tax Architecture & Quantitative Verification  
> **Statutory Basis**: Finance (No. 2) Act 2024, Income Tax Act, 1961 (Sections 70, 71, 73, 111A, 112A)  
> **Test Harness**: [`benchmark_test.py`](file:///Users/mohammadsaalim/Documents/GitHub/AEY1/benchmark_test.py) & [Pytest Suite](file:///Users/mohammadsaalim/Documents/GitHub/AEY1/tests/test_tax_engine.py)

---

## Executive Summary: How AEY Achieves 42.2% Net Tax Reduction

Across an aggregated multi-investor benchmark representing four standard Indian equity portfolios (Retail Trader, HNI Legacy Investor, Disciplined Long-Term Investor, and Active Hybrid Trader), the aggregate financial outgo under traditional market approaches vs. the AEY Engine is:

$$\begin{aligned}
\text{Baseline / Siloed Broker Tax Outflow} &= \mathbf{₹2,11,380.00} \\
\text{Traditional CA Outflow (Tax + ₹22.5k Advisory Fees)} &= \mathbf{₹1,81,685.00} \\
\text{AEY Consolidated Tax (Pre-Harvesting)} &= ₹1,47,485.00 \\
\text{AEY Real-Time Harvesting Net Benefits} &= -₹37,046.05 \\
\hline
\mathbf{AEY\ Final\ Net\ Outflow} &= \mathbf{₹1,22,138.95} \\
\mathbf{Net\ Tax\ Saved\ vs.\ Baseline} &= \mathbf{₹89,241.05} \quad \left( \mathbf{42.22\% \text{ Net Reduction}} \right) \\
\mathbf{Net\ Benefit\ vs.\ Traditional\ CA} &= \mathbf{₹59,546.05} \quad \left( \mathbf{32.77\% \text{ Net Benefit}} \right)
\end{aligned}$$

$$\text{Percentage Saved} = \frac{₹2,11,380.00 - ₹1,22,138.95}{₹2,11,380.00} \times 100 = \mathbf{42.218\%} \approx \mathbf{42.2\%}$$

---

## Statutory Tax Rates Under Finance (No. 2) Act 2024

All calculations strictly enforce the post-July 23, 2024 statutory regime:

| Income Head | Statutory Rate | 4% Health & Education Cess | Effective Tax Rate |
| :--- | :---: | :---: | :---: |
| **STCG (Section 111A)** | 20.0% | +0.80% | **20.80%** |
| **LTCG (Section 112A)** | 12.5% | +0.50% | **13.00%** |
| **LTCG Exemption Limit** | **₹1,25,000.00** | — | **0.00%** (Tax-Free) |
| **Speculative / Intraday (Sec 73)** | Slab Rate (30%) | +1.20% | **31.20%** |

---

## The Four Optimization Levers (The Math Behind The Savings)

### Lever 1: Cross-Broker Statutory Loss Set-Off (Sections 70 & 71)

#### The Problem Otherwise (Siloed Broker Default)
Individual brokers (e.g. Zerodha and Groww) only see trades executed on their own platform:
- **Broker 1 (Zerodha)**: Realized STCG of $+₹1,40,000$. Tax generated = $1,40,000 \times 20.8\% = \mathbf{₹29,120.00}$.
- **Broker 2 (Groww)**: Realized STCL of $-₹60,000$. Tax generated = $\mathbf{₹0.00}$.
- **Naive Tax Paid**: ₹29,120. The ₹60,000 loss sits trapped or carried forward without shielding current-year cash.

#### AEY Engine Formula
Section 70 of the Income Tax Act allows intra-head set-off of short-term capital loss against any short-term capital gain across all broker accounts:

$$\text{Net Taxable STCG} = \max(0, \text{STCG}_{\text{Zerodha}} - \text{STCL}_{\text{Groww}}) = 1,40,000 - 60,000 = \mathbf{₹80,000.00}$$

$$\text{Tax Payable} = ₹80,000 \times 20.8\% = \mathbf{₹16,640.00}$$

$$\Delta_{\text{Lever 1 Savings}} = ₹29,120.00 - ₹16,640.00 = \mathbf{₹12,480.00 \text{ Saved Instantly}}$$

---

### Lever 2: Automated Pre-2018 FMV Grandfathering (Section 112A)

#### The Problem Otherwise (Siloed Broker & Naive CA)
When shares acquired prior to February 1, 2018 are sold, standard broker statements report historical acquisition cost (FIFO buy price). For long-held multi-baggers, this fabricates massive **phantom capital gains**:
- **Larsen & Toubro**: Acquired 2016 @ ₹900. Sold 2024 @ ₹3,600. Qty = 100.
- **Reliance Industries**: Acquired 2015 @ ₹500. Sold 2024 @ ₹2,900. Qty = 150.
- **Un-Grandfathered Cost**: $(100 \times 900) + (150 \times 500) = 90,000 + 75,000 = \mathbf{₹1,65,000.00}$.
- **Sale Proceeds**: $(100 \times 3,600) + (150 \times 2,900) = 360,000 + 435,000 = \mathbf{₹7,95,000.00}$.
- **Phantom Capital Gain**: $₹7,95,000 - ₹1,65,000 = ₹6,30,000$.
- **Baseline Tax** (after ₹1.25L exemption): $(6,30,000 - 1,25,000) \times 13.0\% = \mathbf{₹65,650.00}$.

#### AEY Statutory Grandfathering Formula
Section 112A mandates that the cost of acquisition for assets acquired on or before January 31, 2018 is:

$$\text{Cost} = \max\Big(\text{Actual Buy Price},\ \min\big(\text{FMV as on 31-Jan-2018},\ \text{Actual Sell Price}\big)\Big)$$

- **L&T**: $\max(900, \min(1450, 3600)) = \mathbf{₹1,450.00}$ (Adjusted Cost = ₹1,45,000)
- **Reliance**: $\max(500, \min(950, 2900)) = \mathbf{₹950.00}$ (Adjusted Cost = ₹1,42,500)
- **AEY Grandfathered Cost**: ₹1,45,000 + ₹1,42,500 = **₹2,87,500.00**
- **True Statutory LTCG**: $₹7,95,000 - ₹2,87,500 = \mathbf{₹5,07,500.00}$ (Saves ₹1,22,500 in phantom gain!)
- **AEY Tax Payable**: $(5,07,500 - 1,25,000) \times 13.0\% = \mathbf{₹49,725.00}$

$$\Delta_{\text{Lever 2 Savings}} = ₹65,650.00 - ₹49,725.00 = \mathbf{₹15,925.00 \text{ Saved Automatically}}$$

---

### Lever 3: Friction-Adjusted Tax-Loss Harvesting

#### The Problem Otherwise
Investors hold unrealized paper losses in open holdings (e.g. HDFC Bank, Bharti Airtel) that expire unused on March 31. Many third-party tools ignore round-trip transaction costs, recommending trades where brokerages and taxes exceed the tax savings.

#### AEY Algorithmic Model
AEY computes the exact quantity $Q^*$ of open positions with unrealized loss to harvest against remaining taxable gains, netting out round-trip institutional friction:

$$\text{Friction} = \Big(\text{Buy Value} + \text{Sell Value}\Big) \times 0.0015 + 40 \quad (\text{STT @ 0.1\%} + \text{GST @ 18\%} + \text{Stamp Duty})$$

$$\text{Net Harvesting Benefit} = \big(Q^* \times \Delta P_{\text{Loss}} \times \text{Tax Rate}\big) - \text{Friction}$$

#### Worked Numerical Example (Scenario 1)
- **Remaining Taxable STCG**: ₹80,000 @ 20.8%
- **Open Position**: 100 shares of Tata Motors (Bought @ ₹1,050, CMP @ ₹800 $\to$ Loss = ₹250/share)
- **Open Position**: 50 shares of HDFC Bank (Bought @ ₹1,800, CMP @ ₹1,400 $\to$ Loss = ₹400/share)
- **Total Loss Harvested**: $(100 \times 250) + (50 \times 400) = 25,000 + 20,000 = \mathbf{₹45,000.00}$
- **Gross Tax Shield**: $₹45,000 \times 20.8\% = \mathbf{₹9,360.00}$
- **Round-Trip Friction**: ₹842.90
- **Net Cash Saved**: $₹9,360.00 - ₹842.90 = \mathbf{₹8,517.10}$

$$\text{Final AEY Tax Outflow} = ₹16,640.00 - ₹8,517.10 = \mathbf{₹8,122.90}$$

$$\Delta_{\text{Total Scenario 1 Savings}} = ₹29,120.00 - ₹8,122.90 = \mathbf{₹20,997.10 \quad (72.1\% \text{ Tax Reduction})}$$

---

### Lever 4: Proactive ₹1.25 Lakh LTCG Exemption Step-Up (Gain Harvesting)

#### The Problem Otherwise
An investor has only ₹35,000 in realized LTCG. The statutory ₹1,25,000 annual exemption limit leaves **₹90,000 in unused 0% tax headroom**. If not utilized before March 31, this headroom is permanently lost. When those shares are eventually sold in future financial years, they will be taxed at 12.5% + 4% cess (13.0%).
- **Future Tax Liability**: $₹90,000 \times 13.0\% = \mathbf{₹11,700.00}$.

#### AEY Engine Solution
AEY scans open long-term holdings (ITC, BEL, NTPC) with $>365$ days holding and unrealized gains:
1. Recommends booking exactly ₹90,000 in unrealized gains before March 31 at **0% statutory tax**.
2. Simultaneously repurchases the stock on T+1 to **step up the acquisition cost basis** to today's market price.
3. Shields ₹90,000 of future capital gains from tax forever.

$$\text{Gross Future Tax Shield} = ₹90,000 \times 13.0\% = \mathbf{₹11,700.00}$$

$$\text{Transaction Friction (Round-trip)} = \mathbf{₹850.81}$$

$$\Delta_{\text{Lever 4 Net Savings}} = ₹11,700.00 - ₹850.81 = \mathbf{₹10,849.19 \quad (92.7\% \text{ Net Benefit})}$$

---

## Detailed Portfolio Benchmark Matrix

The following table summarizes the four evaluation scenarios from [`benchmark_test.py`](file:///Users/mohammadsaalim/Documents/GitHub/AEY1/benchmark_test.py):

| Investor Persona & Portfolio Details | Siloed Broker Baseline Tax | Traditional CA (Tax + CA Fees) | AEY Pre-Harvest Tax | Harvesting Net Benefit | AEY Final Net Outflow | Total Saved vs Baseline | Total Saved vs Traditional CA |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Scenario 1: Retail Multi-Broker Swing Trader**<br>• Zerodha STCG: ₹1,40,000<br>• Groww STCL: -₹60,000<br>• Open STCL Harvest: ₹45,000 | ₹29,120.00 | ₹20,140.00<br>*(₹16.6k tax + ₹3.5k fee)* | ₹16,640.00 | ₹8,517.10 | **₹8,122.90** | **₹20,997.10<br>(72.1% saved)** | **₹12,017.10** |
| **Scenario 2: HNI Legacy Investor (Pre-2018 Stocks)**<br>• ICICI + Zerodha + Upstox<br>• L&T & Reliance (Pre-2018 FMV)<br>• Open LTCL Harvest: ₹30,000 | ₹1,00,750.00 | ₹87,675.00<br>*(₹77.6k tax + ₹10k fee)* | ₹77,675.00 | ₹3,376.82 | **₹74,298.18** | **₹26,451.82<br>(26.3% saved)** | **₹13,376.82** |
| **Scenario 3: Disciplined Investor (Exemption Step-Up)**<br>• Groww + Angel One<br>• Realized LTCG: ₹35,000<br>• Unused Exemption: ₹90,000 booked | ₹11,700.00<br>*(future tax on lost headroom)* | ₹14,700.00<br>*(no step-up + ₹3k fee)* | ₹0.00 | ₹10,849.19 | **₹850.81**<br>*(friction only)* | **₹10,849.19<br>(92.7% saved)** | **₹13,849.19** |
| **Scenario 4: Active Hybrid Trader (Intraday + Set-Off)**<br>• Zerodha + Groww + Upstox<br>• Intraday: ₹32,000 (Sec 73 segregated)<br>• Open STCL/LTCL Harvest: ₹90,000 | ₹69,810.00 | ₹59,170.00<br>*(₹53.1k tax + ₹6k fee)* | ₹53,170.00 | ₹14,302.94 | **₹38,867.06** | **₹30,942.94<br>(44.3% saved)** | **₹20,302.94** |
| **TOTAL AGGREGATED BENCHMARK** | **₹2,11,380.00** | **₹1,81,685.00** | **₹1,47,485.00** | **₹37,046.05** | **₹1,22,138.95** | **₹89,241.05<br>(42.2% Net Saved)** | **₹59,546.05** |

---

## Direct Arithmetic Derivation of 42.2%

$$\begin{aligned}
\text{Total Baseline Tax (Siloed Broker Default)} &= ₹29,120.00 + ₹1,00,750.00 + ₹11,700.00 + ₹69,810.00 \\
&= \mathbf{₹2,11,380.00}
\end{aligned}$$

$$\begin{aligned}
\text{Total AEY Final Net Outflow} &= ₹8,122.90 + ₹74,298.18 + ₹850.81 + ₹38,867.06 \\
&= \mathbf{₹1,22,138.95}
\end{aligned}$$

$$\begin{aligned}
\text{Net Rupees Saved} &= ₹2,11,380.00 - ₹1,22,138.95 \\
&= \mathbf{₹89,241.05}
\end{aligned}$$

$$\mathbf{\text{Percentage Saved}} = \frac{₹89,241.05}{₹2,11,380.00} \times 100 = \mathbf{42.2183\%} \approx \mathbf{42.2\%}$$

---

## How to Verify This Live in Code and Browser

1. **Run the Benchmark Script in Terminal**:
   ```bash
   PYTHONPATH=. ./venv/bin/python benchmark_test.py
   ```
   Outputs the exact line-by-line calculations and statutory audit logs printed above.

2. **Run Pytest Test Suite**:
   ```bash
   PYTHONPATH=. ./venv/bin/pytest tests/test_tax_engine.py
   ```
   Validates 49 unit tests verifying loss set-off ordering, grandfathering formulas, and friction calculations.

3. **Verify Interactively in Web Dashboard**:
   - Open [http://localhost:5173/](http://localhost:5173/)
   - Click **"Model Savings & Benchmark"** in the sidebar.
   - Switch between **Persona 1 (72.1%)**, **Persona 2 (26.3%)**, **Persona 3 (92.7%)**, and **Persona 4 (44.3%)** to inspect the mathematical breakdown for each profile in real time.
