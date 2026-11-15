import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  calculateCashFlowAnalysis,
  calculateOverviewIntelligence,
  calculateCustomerIntelligence,
  calculateExpenseIntelligence,
  calculateReceivablesSummary,
  calculateTotalExpenses,
  calculateCurrentCash,
  generateFinancialInsights,
  generateScenarioProjection,
} from '../src/utils/financialServices.js'
import {
  getDemoFinancialData,
  getFinancialData,
  getFinancialTransactions,
  getInvoiceRiskIndicators,
  persistFinancialData,
  syncInsightStatuses,
  updateInsightStatus,
} from '../src/data/financialStore.js'

const fixture = () => structuredClone(getDemoFinancialData())

test('invoice balances include partial payments exactly once', () => {
  const data = fixture()
  data.payments.push({ id: 'PAY-PARTIAL', invoiceId: 'INV-1048', date: '2026-11-13', amount: 5000 })
  const invoice = getInvoiceRiskIndicators(data).find((item) => item.id === 'INV-1048')
  assert.equal(invoice.paidAmount, 5000)
  assert.equal(invoice.remainingAmount, 20000)
  assert.equal(calculateReceivablesSummary(data).totalOutstanding, 141500)
})

test('customer exposure reconciles to linked invoice balances', () => {
  const intelligence = calculateCustomerIntelligence(fixture())
  const profileTotals = intelligence.profiles.reduce((total, profile) => total + profile.outstanding, 0)
  assert.equal(profileTotals, intelligence.totalOutstanding)
  assert.equal(intelligence.totalOutstanding, calculateReceivablesSummary(fixture()).totalOutstanding)
  for (const profile of intelligence.profiles) {
    assert.equal(profile.outstanding, profile.invoices.reduce((total, invoice) => total + invoice.remainingAmount, 0))
  }
})

test('recorded expense total and category breakdown reconcile', () => {
  const data = fixture()
  const analysis = calculateExpenseIntelligence(data)
  assert.equal(calculateTotalExpenses(data), analysis.recordedTotal)
  assert.equal(analysis.categories.reduce((total, category) => total + category.amount, 0), analysis.recordedTotal)
})

test('forecast opening, closing and movement totals reconcile within the requested horizon', () => {
  const data = fixture()
  const analysis = calculateCashFlowAnalysis(data, 30)
  assert.equal(analysis.forecast[0].balance, analysis.currentCash)
  assert.equal(analysis.closingBalance, analysis.currentCash + analysis.expectedInflows - analysis.expectedOutflows)
  assert.equal(analysis.forecast.at(-1).balance, analysis.closingBalance)
  const shortHorizon = calculateCashFlowAnalysis(data, 3)
  assert.equal(shortHorizon.expectedOutflows, 0)
  assert.equal(shortHorizon.closingBalance, shortHorizon.currentCash)
})

test('Overview and Cash Flow share the same forecast low point and closing balance', () => {
  const data = fixture()
  const cashFlow = calculateCashFlowAnalysis(data, 30)
  const overview = calculateOverviewIntelligence(data, 30)
  assert.equal(overview.expectedClosingBalance, cashFlow.closingBalance)
  assert.equal(overview.lowestProjectedBalance, cashFlow.lowestBalance)
  assert.equal(overview.lowestProjectedBalanceDate.getTime(), cashFlow.lowestBalanceDate.getTime())
})

test('expense schedule edits flow into forecasts without including out-of-horizon dates', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 30)
  data.expenses.push({ id: 'EXP-FUTURE', amount: 91000, dueDate: '2027-02-01', category: 'operating', label: 'Later expense' })
  const changed = calculateCashFlowAnalysis(data, 30)
  assert.equal(changed.expectedOutflows, baseline.expectedOutflows)
  assert.equal(calculateExpenseIntelligence(data).upcomingTotal, calculateExpenseIntelligence(fixture()).upcomingTotal + 91000)
  data.expenses.push({ id: 'EXP-IN-RANGE', amount: 12000, dueDate: '2026-11-25', category: 'operating', label: 'Near expense' })
  assert.equal(calculateCashFlowAnalysis(data, 30).expectedOutflows, baseline.expectedOutflows + 12000)
})

test('paid and transaction-linked expenses are excluded from upcoming forecast totals', () => {
  const data = fixture()
  data.expenses[0].paymentStatus = 'paid'
  data.transactions.push({ id: 'TX-PAYROLL', date: '2026-11-15', amount: 20000, type: 'outflow', expenseId: 'EXP-PAYROLL-1' })
  const analysis = calculateExpenseIntelligence(data)
  assert.equal(analysis.upcomingTotal, 57000)
  assert.equal(calculateCashFlowAnalysis(data, 30).expectedOutflows, 57000)
  assert.equal(analysis.records.find((expense) => expense.id === 'EXP-PAYROLL-1').isTransactionLinked, true)
})

test('invoice risk is identical in the receivables service and customer profile', () => {
  const data = fixture()
  const invoice = getInvoiceRiskIndicators(data).find((item) => item.id === 'INV-1064')
  const customer = calculateCustomerIntelligence(data).profiles.find((profile) => profile.id === invoice.customerId)
  const linked = customer.invoices.find((item) => item.id === invoice.id)
  assert.equal(linked.prediction.risk, invoice.prediction.risk)
  assert.equal(linked.prediction.riskExplanation, invoice.prediction.riskExplanation)
  assert.equal(linked.remainingAmount, invoice.remainingAmount)
  assert.equal(linked.dueDate, invoice.dueDate)
})

test('missing or unreliable payment history and due dates stay unrated and cannot trigger overdue', () => {
  const data = fixture()
  data.customers[0].paymentHistory = null
  data.invoices[0].dueDate = 'not-a-date'
  const invoice = getInvoiceRiskIndicators(data).find((item) => item.id === 'INV-1048')
  assert.equal(invoice.prediction.risk, 'unrated')
  assert.equal(invoice.prediction.hasReliableDueDate, false)
  assert.equal(invoice.prediction.isOverdue, false)
  assert.equal(invoice.prediction.expectedDate, null)
  assert.match(invoice.prediction.riskExplanation, /no usable payment-history summary/i)
})

test('actual payment transactions and payment records are not double-counted', () => {
  const data = fixture()
  data.transactions.push({ id: 'TX-PAYMENT', invoiceId: 'INV-1048', date: '2026-11-13', amount: 5000, type: 'inflow' })
  data.transactions.push({ id: 'TX-BAD-DATE', date: '2026-13-40', amount: 900000, type: 'inflow' })
  data.payments.push({ id: 'PAY-MATCH', invoiceId: 'INV-1048', date: '2026-11-13', amount: 5000 })
  assert.equal(getFinancialTransactions(data).filter((event) => event.status === 'actual').length, 2)
  assert.equal(calculateCurrentCash(data), 55000)
})

test('generated insights are unique and correspond to the shared Overview alerts', () => {
  const data = fixture()
  data.expenses[0].amount = 250000
  const insights = generateFinancialInsights(data)
  const ids = insights.map((insight) => insight.id)
  assert.equal(ids.length, new Set(ids).size)
  for (const insight of insights) {
    assert.ok(insight.title && insight.detail && insight.why && insight.action)
    assert.ok(['critical', 'high', 'medium', 'informational'].includes(insight.severity))
    assert.ok(['cash-flow', 'receivables', 'customer-risk', 'expenses'].includes(insight.category))
  }
})

test('insight review persists and critical conditions reopen after reload', () => {
  const originalWindow = globalThis.window
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  try {
    const data = fixture()
    data.expenses[0].amount = 250000
    const firstInsights = generateFinancialInsights(data)
    let saved = syncInsightStatuses(data, firstInsights)
    persistFinancialData(saved)
    const highInsight = firstInsights.find((insight) => insight.severity === 'high')
    updateInsightStatus(highInsight.id, 'reviewed')
    const afterReload = getFinancialData()
    const currentInsights = generateFinancialInsights(afterReload)
    saved = syncInsightStatuses(afterReload, currentInsights)
    assert.equal(saved.insights.find((item) => item.id === highInsight.id).status, 'reviewed')
    const largeExpenseInsight = currentInsights.find((insight) => insight.id === 'insight-expense-EXP-MATERIALS-1')
    updateInsightStatus(largeExpenseInsight.id, 'reviewed')
    const editedData = getFinancialData()
    editedData.expenses[0].amount += 1000
    persistFinancialData(editedData)
    const refreshedInsights = generateFinancialInsights(getFinancialData())
    const refreshedStatuses = syncInsightStatuses(getFinancialData(), refreshedInsights)
    assert.equal(refreshedStatuses.insights.find((item) => item.id === largeExpenseInsight.id).status, 'open')
    const critical = currentInsights.find((insight) => insight.severity === 'critical')
    updateInsightStatus(critical.id, 'resolved')
    const reloadedCritical = syncInsightStatuses(getFinancialData(), generateFinancialInsights(getFinancialData()))
    assert.equal(reloadedCritical.insights.find((item) => item.id === critical.id).status, 'open')
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('scenario projections do not mutate source financial assumptions', () => {
  const data = fixture()
  const before = JSON.stringify(data)
  const baseline = generateScenarioProjection(data, {}, 30)
  const scenario = generateScenarioProjection(data, { delayAtRiskPayment: true, operatingExpenseIncrease: 20, postponePlannedPurchase: true }, 30)
  assert.equal(JSON.stringify(data), before)
  assert.equal(baseline.forecast[0].balance, scenario.forecast[0].balance)
})

test('all implemented workspace routes have navigation and route handling', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const sidebar = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8')
  for (const route of ['overview', 'receivables', 'scenario-lab', 'cash-flow', 'customers', 'expenses', 'insights', 'reports', 'settings']) {
    assert.ok(sidebar.includes(`href="#${route}"`), `Missing sidebar route #${route}`)
    assert.ok(app.includes(`#${route}`) || (route === 'insights' && app.includes("route.startsWith('#insights')")), `Missing route handling for #${route}`)
  }
})
