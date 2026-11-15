# FinSight hackathon demo (about 6 minutes)

## 0:00–0:35 · The MSME cash-visibility problem

“A small business can know its current bank balance and still be surprised by a late customer payment or several expenses falling due together. FinSight connects those records so an owner can see the upcoming cash picture and test a decision before acting.”

Confirm that the **DEMO WORKSPACE** label is visible. Explain that its business records are sample data saved locally in the browser.

## 0:35–1:15 · Overview

Open **Overview**. Point out current cash, outstanding receivables, scheduled expense commitments, and the projected closing and low-point balances. Explain that the risk status and alerts are generated from transparent rules and the same shared forecast used elsewhere. The demo has no dated historical transactions, so the activity area does not invent a transaction history.

## 1:15–2:00 · Cash Flow Intelligence

Open **Cash Flow** and choose a forecast horizon. Show the daily projected balance and the inflow/outflow schedule. Explain that invoice due dates and expense schedules are expected movements, not confirmed transfers. Open a timeline item to show the source record and date.

## 2:00–2:40 · Receivables

Open **Receivables**, filter or sort by risk, then inspect a high-risk open invoice. Describe the available payment-history summary and the configured deterministic risk rules. Clarify that the aggregate demo history is illustrative, there are no payment records in this seed, and no trained model is used. Show the invoice balance and that partial payments would reduce it through linked payment records.

## 2:40–3:25 · Customers and Expenses

Open **Customers** and view a profile to trace its linked invoices and outstanding total. Then open **Expenses** to show scheduled amounts, categories, and due dates. Explain that the expense dataset does not assert payment status unless a recorded event supports it.

## 3:25–4:00 · Insights & Actions

Open **Insights & Actions**. Choose one warning and show the supporting figures, affected records, and suggested next step. Emphasize that the insight is a traceable rule-based cue, not a generated ML prediction.

## 4:00–5:10 · Financial Digital Twin

Open **Scenario Lab**. Start with the shared baseline and change one assumption, such as delaying a major receipt or increasing a scheduled expense. Compare the resulting closing balance and lowest projected point. State that this is a hypothetical copy of the assumptions: the baseline invoices and expenses remain unchanged and simulated changes do not become actual transactions.

## 5:10–5:45 · Reports

Open **Reports**, choose a report category, review its preview and current data-availability notes, then export a CSV or PDF. Point out the INR values and distinguish current records from projected values.

## 5:45–6:10 · Safe data management and close

Open **Settings & Data** and show the workspace label and browser-local persistence. Explain that sample data is read-only. Starting a user workspace creates a separate empty dataset, and switching back preserves both workspaces. Close with: “FinSight helps an MSME see beyond today’s balance by connecting what is owed, what is due, and what could happen next.”

### Presenter notes

- Reset or reopen the demo workspace before the presentation if the browser profile was used for exploration.
- Do not describe forecast receipts as guaranteed collections or sample payment history as recorded receipts.
- Browser screenshots and localStorage are browser-specific; there is no cloud sync in this prototype.
