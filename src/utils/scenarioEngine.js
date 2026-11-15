import { createCashFlowModel, getFinancialData, getInvoiceRiskIndicators } from '../data/financialStore.js'
import { calculateCashFlowAnalysis, calculateCurrentCash, calculateCustomerIntelligence, classifyFinancialHealth, classifyLiquidityStatus } from './financialServices.js'
import { daysBetween, parseSampleDate } from './paymentPrediction.js'
import { simulateCashFlow } from './simulation.js'
import { formatINR } from './formatters.js'

export const SCENARIO_VERSION = 1
export const SCENARIO_TYPES = ['payment-delay', 'expense-increase', 'purchase', 'hiring', 'financing', 'customer-loss', 'unexpected-expense', 'custom']

export function calculateLoanTerms(principal, annualInterestPercent, repaymentMonths) {
  const monthlyRate = annualInterestPercent / 100 / 12
  const emi = monthlyRate === 0
    ? principal / repaymentMonths
    : principal * monthlyRate * ((1 + monthlyRate) ** repaymentMonths) / (((1 + monthlyRate) ** repaymentMonths) - 1)
  const totalRepayment = emi * repaymentMonths
  return { emi, totalRepayment, totalInterest: totalRepayment - principal }
}

export function createBaselineFingerprint(data = getFinancialData()) {
  const material = {
    business: data.business,
    predictionModel: data.predictionModel,
    customers: data.customers,
    invoices: data.invoices,
    payments: data.payments,
    expenses: data.expenses,
    transactions: data.transactions,
  }
  const text = JSON.stringify(material)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `baseline-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function eventDay(dateValue, asOf) {
  return daysBetween(parseSampleDate(asOf), parseSampleDate(dateValue))
}

function dateAtDay(asOf, day) {
  const date = parseSampleDate(asOf)
  date.setDate(date.getDate() + day)
  return date
}

function monthlyDate(joiningDate, monthOffset) {
  const source = parseSampleDate(joiningDate)
  const targetMonth = new Date(source.getFullYear(), source.getMonth() + monthOffset, 1)
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
  targetMonth.setDate(Math.min(source.getDate(), lastDay))
  return targetMonth
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = parseSampleDate(value)
  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

export function validateScenarioAssumptions(assumptions, data = getFinancialData()) {
  const issues = []
  if (!assumptions || !SCENARIO_TYPES.includes(assumptions.type)) return ['Choose a supported scenario type.']
  if (!String(assumptions.name ?? '').trim()) issues.push('Give this scenario a name.')
  const asOf = data.business.asOf.slice(0, 10)
  const laterDate = (value) => isValidDateKey(value) && value > asOf
  const customerExists = (id) => data.customers.some((customer) => customer.id === id)
  const amountPositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0
  if (assumptions.type === 'payment-delay') {
    if (!customerExists(assumptions.customerId)) issues.push('Select an existing customer.')
    if (assumptions.invoiceId && !data.invoices.some((invoice) => invoice.id === assumptions.invoiceId && invoice.customerId === assumptions.customerId)) issues.push('Select an invoice linked to that customer.')
    if (!Number.isInteger(Number(assumptions.delayDays)) || Number(assumptions.delayDays) < 1 || Number(assumptions.delayDays) > 365) issues.push('Enter a delay between 1 and 365 days.')
  }
  if (assumptions.type === 'expense-increase') {
    if (!['all', 'category', 'expense'].includes(assumptions.scope)) issues.push('Choose which scheduled expenses to adjust.')
    if (assumptions.scope === 'category' && !data.expenses.some((expense) => expense.category === assumptions.category)) issues.push('Choose an existing expense category.')
    if (assumptions.scope === 'expense' && !data.expenses.some((expense) => expense.id === assumptions.expenseId)) issues.push('Choose an existing expense record.')
    if (!['percentage', 'fixed'].includes(assumptions.adjustmentMode) || !Number.isFinite(Number(assumptions.value)) || Number(assumptions.value) <= 0) issues.push('Enter a positive percentage or fixed amount.')
  }
  if (['purchase', 'unexpected-expense'].includes(assumptions.type)) {
    if (!amountPositive(assumptions.amount)) issues.push('Enter an amount greater than zero.')
    if (!laterDate(assumptions.effectiveDate)) issues.push('Choose a date after the current as-of date.')
    if (!String(assumptions.description ?? '').trim()) issues.push('Add a short description.')
  }
  if (assumptions.type === 'hiring') {
    if (!Number.isFinite(Number(assumptions.recruitmentCost)) || Number(assumptions.recruitmentCost) < 0) issues.push('Enter a valid one-time recruitment cost.')
    if (!amountPositive(assumptions.monthlySalary)) issues.push('Enter a monthly salary greater than zero.')
    if (!laterDate(assumptions.joiningDate)) issues.push('Choose a joining date after the current as-of date.')
    if (!Number.isInteger(Number(assumptions.monthsIncluded)) || Number(assumptions.monthsIncluded) < 1 || Number(assumptions.monthsIncluded) > 36) issues.push('Choose between 1 and 36 salary months.')
  }
  if (assumptions.type === 'financing') {
    if (!amountPositive(assumptions.loanAmount)) issues.push('Enter a loan amount greater than zero.')
    if (!laterDate(assumptions.disbursementDate)) issues.push('Choose a disbursement date after the current as-of date.')
    if (!Number.isFinite(Number(assumptions.annualInterestRate)) || Number(assumptions.annualInterestRate) < 0 || Number(assumptions.annualInterestRate) > 100) issues.push('Enter an annual interest rate from 0% to 100%.')
    if (!Number.isInteger(Number(assumptions.repaymentMonths)) || Number(assumptions.repaymentMonths) < 1 || Number(assumptions.repaymentMonths) > 360) issues.push('Choose a repayment term from 1 to 360 months.')
    if (!Number.isFinite(Number(assumptions.processingFee)) || Number(assumptions.processingFee) < 0) issues.push('Enter a valid processing fee.')
  }
  if (assumptions.type === 'customer-loss') {
    if (!customerExists(assumptions.customerId)) issues.push('Select an existing customer.')
    if (!Number.isFinite(Number(assumptions.revenueReductionPercent)) || Number(assumptions.revenueReductionPercent) < 0 || Number(assumptions.revenueReductionPercent) > 100) issues.push('Enter a revenue reduction from 0% to 100%.')
  }
  if (assumptions.type === 'custom') {
    if (!['inflow', 'outflow'].includes(assumptions.adjustmentType)) issues.push('Choose an inflow or outflow adjustment.')
    if (!amountPositive(assumptions.amount)) issues.push('Enter an amount greater than zero.')
    if (!laterDate(assumptions.effectiveDate)) issues.push('Choose an effective date after the current as-of date.')
    if (!String(assumptions.description ?? '').trim()) issues.push('Describe the custom adjustment.')
  }
  return issues
}

function applyAssumption(modelEvents, assumptions, data, horizonDays) {
  const asOf = data.business.asOf.slice(0, 10)
  const events = modelEvents.map((event) => ({ ...event }))
  const impact = { addedInflows: 0, removedInflows: 0, delayedInflows: 0, addedExpenses: 0, expenseIncrease: 0, financingInflows: 0, loanRepayments: 0, emi: null, loanTerms: null, outsideHorizonReceipts: [], outsideHorizonCosts: [], unmodeledReceipts: [], noMatchingExpenseEvents: false }
  const addEvent = ({ id, date, type, amount, category, label }) => {
    const day = eventDay(date, asOf)
    if (day < 1) return false
    events.push({ id, day, date: parseSampleDate(date), type, amount, category, label })
    return day <= horizonDays
  }

  if (assumptions.type === 'payment-delay') {
    const selected = events.filter((event) => event.type === 'inflow' && (assumptions.invoiceId ? event.invoiceId === assumptions.invoiceId : event.customerId === assumptions.customerId))
    const modeledInvoiceIds = new Set(events.filter((event) => event.type === 'inflow').map((event) => event.invoiceId))
    impact.unmodeledReceipts = getInvoiceRiskIndicators(data).filter((invoice) => invoice.remainingAmount > 0 && !modeledInvoiceIds.has(invoice.id) && (assumptions.invoiceId ? invoice.id === assumptions.invoiceId : invoice.customerId === assumptions.customerId)).map((invoice) => ({ invoiceId: invoice.id, label: `${invoice.customer} · ${invoice.id}`, amount: invoice.remainingAmount, expectedDate: invoice.prediction.expectedDate }))
    selected.forEach((event) => {
      event.day += Number(assumptions.delayDays)
      event.date = dateAtDay(asOf, event.day)
      event.expectedDate = event.date
      impact.delayedInflows += event.amount
      if (event.day > horizonDays) impact.outsideHorizonReceipts.push({ invoiceId: event.invoiceId, label: event.label, amount: event.amount, expectedDate: event.date })
    })
  }

  if (assumptions.type === 'expense-increase') {
    const eligibleExpenseIds = new Set(events.filter((event) => event.type === 'outflow').map((event) => event.id))
    impact.noMatchingExpenseEvents = ![...eligibleExpenseIds].some((id) => {
      const expense = data.expenses.find((record) => record.id === id)
      return expense && (assumptions.scope === 'all' || (assumptions.scope === 'category' && expense.category === assumptions.category) || (assumptions.scope === 'expense' && expense.id === assumptions.expenseId))
    })
    events.forEach((event) => {
      if (event.type !== 'outflow') return
      const expense = data.expenses.find((record) => record.id === event.id)
      if (!expense) return
      const applies = assumptions.scope === 'all' || (assumptions.scope === 'category' && expense.category === assumptions.category) || (assumptions.scope === 'expense' && expense.id === assumptions.expenseId)
      if (!applies) return
      const extra = assumptions.adjustmentMode === 'percentage' ? event.amount * Number(assumptions.value) / 100 : Number(assumptions.value)
      event.amount += extra
      impact.expenseIncrease += extra
    })
  }

  if (assumptions.type === 'purchase' || assumptions.type === 'unexpected-expense') {
    const included = addEvent({ id: `scenario-${assumptions.type}`, date: assumptions.effectiveDate, type: 'outflow', amount: Number(assumptions.amount), category: assumptions.type === 'purchase' ? 'planned-purchase' : 'unexpected-expense', label: assumptions.description })
    if (included) impact.addedExpenses += Number(assumptions.amount)
    else impact.outsideHorizonCosts.push({ label: assumptions.description, amount: Number(assumptions.amount), date: assumptions.effectiveDate })
  }

  if (assumptions.type === 'hiring') {
    const recruitmentCost = Number(assumptions.recruitmentCost)
    const recruitmentIncluded = addEvent({ id: 'scenario-hiring-recruitment', date: assumptions.joiningDate, type: 'outflow', amount: recruitmentCost, category: 'hiring', label: `${assumptions.description || 'Hiring'} · recruitment` })
    if (recruitmentIncluded) impact.addedExpenses += recruitmentCost
    else if (recruitmentCost > 0) impact.outsideHorizonCosts.push({ label: `${assumptions.description || 'Hiring'} · recruitment`, amount: recruitmentCost, date: assumptions.joiningDate })
    for (let offset = 0; offset < Number(assumptions.monthsIncluded); offset += 1) {
      const date = monthlyDate(assumptions.joiningDate, offset)
      const key = dateKey(date)
      if (key > asOf) {
        const salary = Number(assumptions.monthlySalary)
        const included = addEvent({ id: `scenario-hiring-salary-${offset + 1}`, date: key, type: 'outflow', amount: salary, category: 'hiring', label: `${assumptions.description || 'New employee'} · salary ${offset + 1}` })
        if (included) impact.addedExpenses += salary
        else impact.outsideHorizonCosts.push({ label: `${assumptions.description || 'New employee'} · salary ${offset + 1}`, amount: salary, date: key })
      }
    }
  }

  if (assumptions.type === 'financing') {
    const disbursementDay = eventDay(assumptions.disbursementDate, asOf)
    const terms = calculateLoanTerms(Number(assumptions.loanAmount), Number(assumptions.annualInterestRate), Number(assumptions.repaymentMonths))
    impact.loanTerms = terms
    impact.emi = terms.emi
    const disbursementIncluded = addEvent({ id: 'scenario-loan-disbursement', date: assumptions.disbursementDate, type: 'inflow', amount: Number(assumptions.loanAmount), category: 'financing', label: 'Illustrative loan disbursement' })
    impact.financingInflows = disbursementIncluded ? Number(assumptions.loanAmount) : 0
    if (!disbursementIncluded) impact.outsideHorizonReceipts.push({ label: 'Illustrative loan disbursement', amount: Number(assumptions.loanAmount), expectedDate: parseSampleDate(assumptions.disbursementDate) })
    if (Number(assumptions.processingFee) > 0) {
      const feeIncluded = addEvent({ id: 'scenario-loan-processing-fee', date: assumptions.disbursementDate, type: 'outflow', amount: Number(assumptions.processingFee), category: 'financing-fee', label: 'Illustrative processing fee' })
      if (feeIncluded) impact.addedExpenses += Number(assumptions.processingFee)
      else impact.outsideHorizonCosts.push({ label: 'Illustrative processing fee', amount: Number(assumptions.processingFee), date: assumptions.disbursementDate })
    }
    for (let month = 1; month <= Number(assumptions.repaymentMonths); month += 1) {
      const date = monthlyDate(assumptions.disbursementDate, month)
      const key = dateKey(date)
      if (eventDay(key, asOf) <= horizonDays) {
        addEvent({ id: `scenario-loan-emi-${month}`, date: key, type: 'outflow', amount: terms.emi, category: 'loan-repayment', label: `Illustrative loan EMI ${month}` })
        impact.loanRepayments += terms.emi
      }
    }
  }

  if (assumptions.type === 'customer-loss') {
    const future = events.filter((event) => event.type === 'inflow' && event.customerId === assumptions.customerId)
    impact.removedInflows += future.reduce((sum, event) => sum + event.amount, 0)
    const excluded = new Set(future.map((event) => event.id))
    for (let index = events.length - 1; index >= 0; index -= 1) if (excluded.has(events[index].id)) events.splice(index, 1)
    const reduction = Number(assumptions.revenueReductionPercent ?? 0)
    if (reduction > 0) {
      events.forEach((event) => {
        if (event.type !== 'inflow') return
        const lost = event.amount * reduction / 100
        event.amount -= lost
        impact.removedInflows += lost
      })
    }
  }

  if (assumptions.type === 'custom') {
    const included = addEvent({ id: 'scenario-custom-adjustment', date: assumptions.effectiveDate, type: assumptions.adjustmentType, amount: Number(assumptions.amount), category: 'custom-adjustment', label: assumptions.description })
    if (included && assumptions.adjustmentType === 'inflow') impact.addedInflows += Number(assumptions.amount)
    else if (included) impact.addedExpenses += Number(assumptions.amount)
    else if (assumptions.adjustmentType === 'inflow') impact.outsideHorizonReceipts.push({ label: assumptions.description, amount: Number(assumptions.amount), expectedDate: parseSampleDate(assumptions.effectiveDate) })
    else impact.outsideHorizonCosts.push({ label: assumptions.description, amount: Number(assumptions.amount), date: assumptions.effectiveDate })
  }
  return { events, impact }
}

function healthReason({ liquidityStatus, lowestBalance, buffer, negativeDays, highRiskInvoices, overdueInvoices }) {
  if (liquidityStatus === 'shortage') return `The scenario produces ${negativeDays} negative-balance day${negativeDays === 1 ? '' : 's'}; the first begins on the displayed shortfall date.`
  if (liquidityStatus === 'tight') return `The lowest projected cash of ${formatINR(lowestBalance)} is below the 20% liquidity buffer of ${formatINR(buffer)}.`
  if (overdueInvoices || highRiskInvoices) return `The cash buffer stays above threshold, but the baseline still has ${overdueInvoices} overdue and ${highRiskInvoices} high-risk open invoice${overdueInvoices + highRiskInvoices === 1 ? '' : 's'}.`
  return 'The projected balance stays above the 20% cash buffer and no open overdue or high-risk receivables require attention.'
}

function scenarioRecommendations(result, assumptions, data) {
  const recommendations = []
  if (result.negativeDays > 0) {
    recommendations.push({ title: 'The scenario creates a projected cash shortfall', why: `${result.negativeDays} forecast day${result.negativeDays === 1 ? '' : 's'} fall below zero; the first is ${result.firstShortfallDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`, metric: `Lowest balance ${formatINR(result.lowestBalance)}`, action: assumptions.type === 'purchase' ? 'Review the purchase date or amount before committing.' : 'Review expenses and expected collections; compare financing needs before committing.', href: assumptions.type === 'purchase' ? '#expenses' : '#cash-flow' })
  } else if (result.liquidityStatus === 'tight') {
    recommendations.push({ title: 'The liquidity buffer becomes tight', why: 'The scenario low point is below the existing 20% buffer.', metric: `Low ${formatINR(result.lowestBalance)} · buffer ${formatINR(result.bufferThreshold)}`, action: assumptions.type === 'hiring' ? 'Review the joining date and recurring salary commitment.' : 'Compare the timing of discretionary outflows with expected collections.', href: assumptions.type === 'hiring' ? '#expenses' : '#cash-flow' })
  }
  if (assumptions.type === 'payment-delay' && result.impact.delayedInflows > 0) {
    recommendations.push({ title: 'Collections arrive later in this assumption', why: 'A later receipt can reduce cash available before the expected payment date, even if it remains within the horizon.', metric: `Timing shifted · ${formatINR(result.impact.delayedInflows)}`, action: 'Review the customer balance and compare the affected dates with scheduled outflows.', href: '#receivables' })
  }
  if (assumptions.type === 'customer-loss' && result.impact.removedInflows > 0) {
    recommendations.push({ title: 'Expected receipts are removed for the selected customer', why: 'The customer’s invoice records remain intact, but their expected receipts are excluded from this scenario.', metric: `Receipts removed or reduced · ${formatINR(result.impact.removedInflows)}`, action: 'Consider how alternative sales or expense timing could cover the modeled gap.', href: '#customers' })
  }
  if (assumptions.type === 'expense-increase' && result.impact.expenseIncrease > 0) {
    recommendations.push({ title: 'Scheduled expense commitments increase', why: 'The selected adjustment applies to matching unpaid, unlinked expenses in this forecast window.', metric: `Additional outflow · ${formatINR(result.impact.expenseIncrease)}`, action: 'Review the affected expense records and whether the increase is necessary.', href: '#expenses' })
  }
  if (assumptions.type === 'financing' && result.impact.emi !== null) {
    recommendations.push({ title: 'Assess repayment capacity beyond the disbursement', why: 'The initial loan inflow is offset by scheduled EMI outflows; only installments within this horizon affect this forecast.', metric: `Illustrative EMI · ${formatINR(result.impact.emi)}`, action: 'Review the full-term repayment and compare financing assumptions before making a commitment.', href: '#cash-flow' })
  }
  if (assumptions.type === 'payment-delay' || assumptions.type === 'customer-loss') {
    const customer = data.customers.find((record) => record.id === assumptions.customerId)
    if (customer) {
      const profile = calculateCustomerIntelligence(data).profiles.find((record) => record.id === customer.id)
      const riskyInvoice = profile?.invoices.find((invoice) => invoice.remainingAmount > 0 && invoice.prediction.risk === 'high')
      if (riskyInvoice) recommendations.push({ title: 'A linked invoice has a high rule-based risk indicator', why: riskyInvoice.prediction.riskExplanation, metric: `${riskyInvoice.id} · outstanding ${formatINR(riskyInvoice.remainingAmount)}`, action: 'Review the invoice and consider a customer follow-up; no message is sent by FinSight.', href: '#receivables' })
    }
  }
  if (!recommendations.length) recommendations.push({ title: 'No liquidity warning from this scenario', why: 'The modeled cash balance remains above the existing buffer rule for this horizon.', metric: `Lowest balance ${formatINR(result.lowestBalance)}`, action: 'Compare the scenario with the baseline and confirm the assumptions before acting.', href: '#cash-flow' })
  return recommendations
}

export function simulateScenario(data = getFinancialData(), assumptions, horizonDays = 30) {
  const validation = validateScenarioAssumptions(assumptions, data)
  if (validation.length) throw new Error(validation.join(' '))
  const baseline = calculateCashFlowAnalysis(data, horizonDays)
  const model = createCashFlowModel(data, horizonDays)
  model.currentCash = calculateCurrentCash(data)
  const transformed = applyAssumption(model.events, assumptions, data, horizonDays)
  const simulation = simulateCashFlow({ ...model, events: transformed.events }, {}, parseSampleDate(data.business.asOf.slice(0, 10)))
  const expectedInflows = transformed.events.filter((event) => event.type === 'inflow' && event.status !== 'actual' && event.day <= horizonDays).reduce((sum, event) => sum + event.amount, 0)
  const expectedOutflows = transformed.events.filter((event) => event.type === 'outflow' && event.status !== 'actual' && event.day <= horizonDays).reduce((sum, event) => sum + event.amount, 0)
  const negativePoints = simulation.forecast.filter((point) => point.balance < 0)
  const lowestPoint = simulation.forecast.reduce((low, point) => point.balance < low.balance ? point : low, simulation.forecast[0])
  const liquidityStatus = classifyLiquidityStatus({ currentCash: baseline.currentCash, lowestBalance: lowestPoint.balance, negativeDays: negativePoints.length })
  const indicators = getInvoiceRiskIndicators(data).filter((invoice) => invoice.remainingAmount > 0)
  const overdueInvoices = indicators.filter((invoice) => invoice.prediction.isOverdue && invoice.prediction.hasReliableDueDate).length
  const highRiskInvoices = indicators.filter((invoice) => invoice.prediction.risk === 'high').length
  const health = classifyFinancialHealth({ liquidityStatus, hasOpenReceivableRisk: overdueInvoices > 0 || highRiskInvoices > 0 })
  const result = {
    scenario: assumptions,
    horizonDays,
    openingCash: baseline.currentCash,
    expectedInflows,
    expectedOutflows,
    netMovement: simulation.closingBalance - baseline.currentCash,
    closingBalance: simulation.closingBalance,
    lowestBalance: lowestPoint.balance,
    minimumBalance: lowestPoint.balance,
    lowestBalanceDate: lowestPoint.date,
    minimumBalanceDay: lowestPoint.day,
    negativeDays: negativePoints.length,
    firstShortfallDate: negativePoints[0]?.date ?? null,
    liquidityStatus,
    healthStatus: health.label,
    healthTone: health.tone,
    bufferThreshold: Math.max(0, baseline.currentCash * 0.2),
    baseline,
    forecast: simulation.forecast,
    events: transformed.events,
    impact: {
      additionalInflows: transformed.impact.addedInflows,
      financingInflows: transformed.impact.financingInflows,
      delayedInflows: transformed.impact.delayedInflows,
      removedInflows: transformed.impact.removedInflows,
      additionalExpenses: transformed.impact.addedExpenses + transformed.impact.expenseIncrease,
      expenseIncrease: transformed.impact.expenseIncrease,
      loanRepayments: transformed.impact.loanRepayments,
      emi: transformed.impact.emi,
      loanTerms: transformed.impact.loanTerms,
      netCashImpact: simulation.closingBalance - baseline.closingBalance,
      outsideHorizonReceipts: transformed.impact.outsideHorizonReceipts,
      outsideHorizonCosts: transformed.impact.outsideHorizonCosts,
      unmodeledReceipts: transformed.impact.unmodeledReceipts,
      noMatchingExpenseEvents: transformed.impact.noMatchingExpenseEvents,
    },
  }
  result.healthReason = healthReason({ liquidityStatus, lowestBalance: result.lowestBalance, buffer: result.bufferThreshold, negativeDays: result.negativeDays, highRiskInvoices, overdueInvoices })
  result.recommendations = scenarioRecommendations(result, assumptions, data)
  return result
}

export function compareScenarioOutcomes(results) {
  const criteria = 'Fewest negative-balance days, then highest lowest balance, then highest closing balance.'
  if (!results.length) return { mostFavorableId: null, leastFavorableId: null, criteria }
  const ranked = [...results].sort((left, right) => left.negativeDays - right.negativeDays || right.lowestBalance - left.lowestBalance || right.closingBalance - left.closingBalance)
  return { mostFavorableId: ranked[0].scenario.id ?? ranked[0].scenario.name, leastFavorableId: ranked.at(-1).scenario.id ?? ranked.at(-1).scenario.name, criteria }
}

export const scenarioDateOffset = (data, days) => dateKey(dateAtDay(data.business.asOf.slice(0, 10), days))

export function createScenarioTemplates(data = getFinancialData()) {
  const invoices = getInvoiceRiskIndicators(data)
  const firstProjectedReceipt = createCashFlowModel(data, 30).events.filter((event) => event.type === 'inflow').sort((left, right) => right.amount - left.amount)[0]
  const largestInvoice = invoices.find((invoice) => invoice.id === firstProjectedReceipt?.invoiceId)
    ?? invoices.filter((invoice) => invoice.remainingAmount > 0).sort((left, right) => right.remainingAmount - left.remainingAmount)[0]
  const operating = data.expenses.find((expense) => expense.category === 'operating')
  const planned = data.expenses.find((expense) => expense.category === 'planned-purchase')
  const customer = data.customers.find((record) => record.id === largestInvoice?.customerId) ?? data.customers[0]
  return [
    { label: 'Delay a payment · 15 days', assumptions: { type: 'payment-delay', name: 'Customer payment delayed 15 days', description: '', customerId: customer?.id ?? '', invoiceId: largestInvoice?.customerId === customer?.id ? largestInvoice.id : '', delayChoice: '15', delayDays: 15 } },
    { label: 'Operating costs · +20%', assumptions: { type: 'expense-increase', name: 'Operating costs increase 20%', description: '', scope: 'category', category: operating?.category ?? '', adjustmentMode: 'percentage', value: 20 } },
    { label: 'New equipment', assumptions: { type: 'purchase', name: 'New equipment purchase', description: planned?.label ?? 'Equipment purchase', amount: planned?.amount ?? 50000, effectiveDate: scenarioDateOffset(data, 14) } },
    { label: 'Hire an employee', assumptions: { type: 'hiring', name: 'Hire a new employee', description: 'New employee', recruitmentCost: 10000, monthlySalary: 25000, joiningDate: scenarioDateOffset(data, 14), monthsIncluded: 3 } },
    { label: 'Unexpected · ₹25,000', assumptions: { type: 'unexpected-expense', name: 'Unexpected expense', description: 'Unplanned repair or cost', amount: 25000, effectiveDate: scenarioDateOffset(data, 7) } },
    { label: 'Major customer loss', assumptions: { type: 'customer-loss', name: 'Major customer stops paying', description: '', customerId: customer?.id ?? '', revenueReductionPercent: 0 } },
    { label: 'Business loan', assumptions: { type: 'financing', name: 'Illustrative business loan', description: '', loanAmount: 100000, disbursementDate: scenarioDateOffset(data, 1), annualInterestRate: 12, repaymentMonths: 12, processingFee: 0 } },
  ]
}
