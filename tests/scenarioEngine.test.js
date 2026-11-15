import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCashFlowAnalysis,
  calculateOverviewIntelligence,
} from '../src/utils/financialServices.js'
import {
  deleteScenarioRecord,
  getDemoFinancialData,
  getFinancialData,
  saveScenarioRecord,
} from '../src/data/financialStore.js'
import {
  calculateLoanTerms,
  compareScenarioOutcomes,
  createScenarioTemplates,
  createBaselineFingerprint,
  scenarioDateOffset,
  simulateScenario,
  validateScenarioAssumptions,
} from '../src/utils/scenarioEngine.js'

const fixture = () => structuredClone(getDemoFinancialData())
const named = (values) => ({ name: 'Test scenario', description: '', ...values })

test('no-op customer selection preserves the baseline simulation', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 30)
  const result = simulateScenario(data, named({ type: 'customer-loss', customerId: 'cust-kora-craft', revenueReductionPercent: 0 }), 30)
  assert.equal(result.openingCash, baseline.currentCash)
  assert.equal(result.closingBalance, baseline.closingBalance)
  assert.deepEqual(result.forecast.map((point) => point.balance), baseline.forecast.map((point) => point.balance))
})

test('payment delay moves the selected inflow once and leaves invoice terms unchanged', () => {
  const data = fixture()
  const dueDate = data.invoices[0].dueDate
  const result = simulateScenario(data, named({ type: 'payment-delay', customerId: 'cust-aarav-living', invoiceId: 'INV-1048', delayDays: 15 }), 30)
  const receipt = result.events.filter((event) => event.invoiceId === 'INV-1048')
  assert.equal(receipt.length, 1)
  assert.equal(receipt[0].day, 19)
  assert.equal(data.invoices[0].dueDate, dueDate)
})

test('payment moved outside the horizon is identified and excluded from closing cash', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 30)
  const result = simulateScenario(data, named({ type: 'payment-delay', customerId: 'cust-aarav-living', invoiceId: 'INV-1048', delayDays: 30 }), 30)
  assert.equal(result.impact.outsideHorizonReceipts.length, 1)
  assert.equal(result.impact.outsideHorizonReceipts[0].amount, 25000)
  assert.equal(result.closingBalance, baseline.closingBalance - 25000)
})

test('fixed expense increase changes one selected scheduled outflow by the requested amount', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 30)
  const result = simulateScenario(data, named({ type: 'expense-increase', scope: 'expense', expenseId: 'EXP-MATERIALS-1', adjustmentMode: 'fixed', value: 5000 }), 30)
  assert.equal(result.impact.expenseIncrease, 5000)
  assert.equal(result.expectedOutflows, baseline.expectedOutflows + 5000)
})

test('percentage increase applies only to matching scheduled category outflows', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 30)
  const result = simulateScenario(data, named({ type: 'expense-increase', scope: 'category', category: 'operating', adjustmentMode: 'percentage', value: 20 }), 30)
  assert.equal(result.impact.expenseIncrease, 14400)
  assert.equal(result.expectedOutflows, baseline.expectedOutflows + 14400)
})

test('purchase enters the forecast on its effective date and only affects later balances', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 30)
  const date = scenarioDateOffset(data, 10)
  const result = simulateScenario(data, named({ type: 'purchase', description: 'New machine', amount: 30000, effectiveDate: date }), 30)
  const day = 10
  assert.equal(result.forecast[day - 1].balance, baseline.forecast[day - 1].balance)
  assert.equal(result.forecast[day].balance, baseline.forecast[day].balance - 30000)
  assert.equal(result.impact.additionalExpenses, 30000)
})

test('hiring includes recruitment and monthly salary only on included dates', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 90)
  const result = simulateScenario(data, named({ type: 'hiring', description: 'Operations hire', recruitmentCost: 2000, monthlySalary: 10000, joiningDate: scenarioDateOffset(data, 5), monthsIncluded: 3 }), 90)
  assert.equal(result.impact.additionalExpenses, 32000)
  assert.equal(result.expectedOutflows, baseline.expectedOutflows + 32000)
  assert.equal(result.events.filter((event) => event.category === 'hiring').length, 4)
})

test('reducing-balance loan EMI and in-horizon repayments reconcile', () => {
  const data = fixture()
  const principal = 120000
  const rate = 12
  const term = 12
  const terms = calculateLoanTerms(principal, rate, term)
  const monthlyRate = rate / 100 / 12
  const expectedEmi = principal * monthlyRate * ((1 + monthlyRate) ** term) / (((1 + monthlyRate) ** term) - 1)
  assert.ok(Math.abs(terms.emi - expectedEmi) < 1e-8)
  assert.ok(Math.abs(terms.totalInterest - (terms.totalRepayment - principal)) < 1e-8)
  const result = simulateScenario(data, named({ type: 'financing', loanAmount: principal, disbursementDate: scenarioDateOffset(data, 1), annualInterestRate: rate, repaymentMonths: term, processingFee: 1000 }), 90)
  assert.equal(result.impact.financingInflows, principal)
  assert.equal(result.impact.loanRepayments, terms.emi * 2)
  assert.ok(Math.abs(result.impact.netCashImpact - (principal - 1000 - terms.emi * 2)) < 1e-7)
})

test('major customer loss removes only that customer expected receipts', () => {
  const data = fixture()
  const baseline = calculateCashFlowAnalysis(data, 30)
  const result = simulateScenario(data, named({ type: 'customer-loss', customerId: 'cust-aarav-living', revenueReductionPercent: 0 }), 30)
  assert.equal(result.impact.removedInflows, 25000)
  assert.equal(result.expectedInflows, baseline.expectedInflows - 25000)
})

test('unexpected expense appears once on its chosen date', () => {
  const data = fixture()
  const result = simulateScenario(data, named({ type: 'unexpected-expense', description: 'Emergency repair', amount: 25000, effectiveDate: scenarioDateOffset(data, 3) }), 30)
  assert.equal(result.events.filter((event) => event.id === 'scenario-unexpected-expense').length, 1)
  assert.equal(result.impact.additionalExpenses, 25000)
})

test('three saved scenarios recalculate over a shared comparison horizon', () => {
  const data = fixture()
  const first = simulateScenario(data, { ...named({ type: 'purchase', description: 'Equipment', amount: 5000, effectiveDate: scenarioDateOffset(data, 10) }), id: 'a' }, 90)
  const second = simulateScenario(data, { ...named({ type: 'custom', adjustmentType: 'inflow', amount: 8000, description: 'New order', effectiveDate: scenarioDateOffset(data, 10) }), id: 'b' }, 90)
  const third = simulateScenario(data, { ...named({ type: 'unexpected-expense', amount: 1000, description: 'Repair', effectiveDate: scenarioDateOffset(data, 2) }), id: 'c' }, 90)
  assert.deepEqual([first, second, third].map((result) => result.forecast.length), [91, 91, 91])
  assert.equal(compareScenarioOutcomes([first, second, third]).mostFavorableId, 'b')
})

test('scenario templates prefill valid editable assumptions', () => {
  const data = fixture()
  const templates = createScenarioTemplates(data)
  assert.equal(templates.length, 7)
  assert.deepEqual(templates.map((template) => template.assumptions.type), ['payment-delay', 'expense-increase', 'purchase', 'hiring', 'unexpected-expense', 'customer-loss', 'financing'])
  for (const template of templates) assert.deepEqual(validateScenarioAssumptions(template.assumptions, data), [])
})

test('scenario save, refresh, update and deletion preserve assumptions only', () => {
  const originalWindow = globalThis.window
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  try {
    const data = fixture()
    const assumptions = named({ type: 'unexpected-expense', amount: 25000, description: 'Repair', effectiveDate: '2026-11-21' })
    const saved = saveScenarioRecord({ name: assumptions.name, description: assumptions.description, type: assumptions.type, assumptions, horizonDays: 30, baselineFingerprint: createBaselineFingerprint(data) })
    assert.equal(saved.scenario.version, 1)
    const refreshed = getFinancialData().scenarios.find((item) => item.id === saved.scenario.id)
    assert.deepEqual(refreshed.assumptions, assumptions)
    const updated = saveScenarioRecord({ name: 'Updated name', description: '', type: assumptions.type, assumptions, horizonDays: 60, baselineFingerprint: 'changed' }, refreshed.id)
    assert.equal(updated.scenario.id, refreshed.id)
    assert.equal(getFinancialData().scenarios.length, 1)
    assert.equal(deleteScenarioRecord(refreshed.id).scenarios.length, 0)
  } finally {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('identical assumptions produce deterministic output and do not mutate baseline data', () => {
  const data = fixture()
  const before = JSON.stringify(data)
  const assumptions = named({ type: 'hiring', description: 'Hire', recruitmentCost: 0, monthlySalary: 15000, joiningDate: scenarioDateOffset(data, 7), monthsIncluded: 3 })
  const first = simulateScenario(data, assumptions, 90)
  const second = simulateScenario(data, assumptions, 90)
  assert.deepEqual(first.forecast.map((point) => point.balance), second.forecast.map((point) => point.balance))
  assert.equal(first.closingBalance, second.closingBalance)
  assert.equal(JSON.stringify(data), before)
})

test('daily scenario balances reconcile to opening cash and all movements', () => {
  const data = fixture()
  const assumptions = named({ type: 'financing', loanAmount: 100000, disbursementDate: scenarioDateOffset(data, 2), annualInterestRate: 9, repaymentMonths: 18, processingFee: 1500 })
  const result = simulateScenario(data, assumptions, 90)
  for (const point of result.forecast) {
    const movement = result.events.filter((event) => event.day > 0 && event.day <= point.day && event.day <= 90).reduce((sum, event) => sum + (event.type === 'inflow' ? event.amount : -event.amount), 0)
    assert.ok(Math.abs(point.balance - (result.openingCash + movement)) < 1e-7)
  }
  assert.equal(result.closingBalance, result.forecast.at(-1).balance)
})

test('baseline fingerprints change with financial records but ignore saved scenario records', () => {
  const data = fixture()
  const fingerprint = createBaselineFingerprint(data)
  data.scenarios.push({ id: 'SCN-X', assumptions: {} })
  assert.equal(createBaselineFingerprint(data), fingerprint)
  data.expenses[0].amount += 1
  assert.notEqual(createBaselineFingerprint(data), fingerprint)
})

test('scenario evaluation leaves Overview and Cash Flow baseline calculations unchanged', () => {
  const data = fixture()
  const cashBefore = calculateCashFlowAnalysis(data, 30)
  const overviewBefore = calculateOverviewIntelligence(data, 30)
  simulateScenario(data, named({ type: 'financing', loanAmount: 100000, disbursementDate: scenarioDateOffset(data, 2), annualInterestRate: 10, repaymentMonths: 24, processingFee: 500 }), 30)
  const cashAfter = calculateCashFlowAnalysis(data, 30)
  const overviewAfter = calculateOverviewIntelligence(data, 30)
  assert.equal(cashAfter.closingBalance, cashBefore.closingBalance)
  assert.equal(overviewAfter.expectedClosingBalance, overviewBefore.expectedClosingBalance)
  assert.equal(overviewAfter.lowestProjectedBalance, overviewBefore.lowestProjectedBalance)
})
