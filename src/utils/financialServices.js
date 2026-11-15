import { createCashFlowModel, getFinancialData, getFinancialTransactions, getInvoiceRiskIndicators } from '../data/financialStore.js'
import { parseSampleDate, daysBetween } from './paymentPrediction.js'
import { simulateCashFlow } from './simulation.js'
import { formatWorkspaceDate } from './formatters.js'

function isReliableDate(value) {
  const dateKey = String(value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false
  const [year, month, day] = dateKey.split('-').map(Number)
  const parsed = parseSampleDate(dateKey)
  return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
}

export function calculateCurrentCash(data = getFinancialData()) {
  const asOf = parseSampleDate(data.business.asOf.slice(0, 10))
  return getFinancialTransactions(data).reduce((balance, event) => {
    if (event.status !== 'actual' || !isReliableDate(event.date) || !Number.isFinite(event.amount) || !['inflow', 'outflow'].includes(event.type) || parseSampleDate(String(event.date).slice(0, 10)) > asOf) return balance
    return balance + (event.type === 'inflow' ? event.amount : -event.amount)
  }, data.business.currentCash)
}

export function calculateOutstandingReceivables(data = getFinancialData()) {
  return getInvoiceRiskIndicators(data).reduce((sum, invoice) => sum + invoice.remainingAmount, 0)
}

export function calculateTotalExpenses(data = getFinancialData()) {
  return data.expenses.reduce((sum, expense) => sum + expense.amount, 0)
}

export function calculateExpectedInflows(data = getFinancialData(), horizonDays = 30) {
  return createCashFlowModel(data, horizonDays).events.filter((event) => event.type === 'inflow').reduce((sum, event) => sum + event.amount, 0)
}

export function calculateExpectedOutflows(data = getFinancialData(), horizonDays = 30) {
  return createCashFlowModel(data, horizonDays).events.filter((event) => event.type === 'outflow').reduce((sum, event) => sum + event.amount, 0)
}

export function calculateReceivablesSummary(data = getFinancialData(), invoiceIndicators = getInvoiceRiskIndicators(data)) {
  const openInvoices = invoiceIndicators.filter((invoice) => invoice.remainingAmount > 0)
  return {
    totalOutstanding: openInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0),
    openInvoiceCount: openInvoices.length,
    highRiskCount: openInvoices.filter((invoice) => invoice.prediction.risk === 'high').length,
    overdueCount: openInvoices.filter((invoice) => invoice.prediction.isOverdue && invoice.prediction.hasReliableDueDate).length,
  }
}

export function classifyLiquidityStatus({ currentCash, lowestBalance, negativeDays }) {
  if (negativeDays > 0) return 'shortage'
  if (lowestBalance < currentCash * 0.2) return 'tight'
  return 'stable'
}

export function classifyFinancialHealth({ liquidityStatus, hasOpenReceivableRisk = false }) {
  if (liquidityStatus === 'shortage') return { label: 'At Risk', tone: 'at-risk' }
  if (liquidityStatus === 'tight' || hasOpenReceivableRisk) return { label: 'Needs Attention', tone: 'attention' }
  return { label: 'Healthy', tone: 'healthy' }
}

export function calculateDailyProjectedCashBalances(data = getFinancialData(), horizonDays = 30) {
  const model = createCashFlowModel(data, horizonDays)
  model.currentCash = calculateCurrentCash(data)
  return simulateCashFlow(model, {}, parseSampleDate(data.business.asOf.slice(0, 10))).forecast
}

export function calculateCustomerPaymentStatistics(data = getFinancialData()) {
  const invoices = getInvoiceRiskIndicators(data)
  return data.customers.map((customer) => {
    const own = invoices.filter((invoice) => invoice.customerId === customer.id)
    return { customerId: customer.id, invoiceCount: own.length, outstanding: own.reduce((sum, invoice) => sum + invoice.remainingAmount, 0), highRiskCount: own.filter((invoice) => invoice.prediction.risk === 'high').length, ...customer.paymentHistory }
  })
}

export function calculateInvoiceRiskIndicators(data = getFinancialData()) { return getInvoiceRiskIndicators(data) }

export function generateScenarioProjection(data = getFinancialData(), assumptions = {}, horizonDays = 30) {
  const model = createCashFlowModel(data, horizonDays)
  model.currentCash = calculateCurrentCash(data)
  return simulateCashFlow(model, { ...assumptions }, parseSampleDate(data.business.asOf.slice(0, 10)))
}

export function calculateEventDay(date, data = getFinancialData()) {
  return daysBetween(parseSampleDate(data.business.asOf.slice(0, 10)), parseSampleDate(date))
}

export function calculateCashFlowAnalysis(data = getFinancialData(), horizonDays = 30) {
  const model = createCashFlowModel(data, horizonDays)
  model.currentCash = calculateCurrentCash(data)
  const projection = simulateCashFlow(model, {}, parseSampleDate(data.business.asOf.slice(0, 10)))
  const movements = Array.from({ length: horizonDays + 1 }, (_, day) => {
    const dayEvents = model.events.filter((event) => event.day === day)
    const inflows = dayEvents.filter((event) => event.type === 'inflow' && event.status !== 'actual').reduce((sum, event) => sum + event.amount, 0)
    const outflows = dayEvents.filter((event) => event.type === 'outflow' && event.status !== 'actual').reduce((sum, event) => sum + event.amount, 0)
    const actualInflows = dayEvents.filter((event) => event.type === 'inflow' && event.status === 'actual').reduce((sum, event) => sum + event.amount, 0)
    const actualOutflows = dayEvents.filter((event) => event.type === 'outflow' && event.status === 'actual').reduce((sum, event) => sum + event.amount, 0)
    return { ...projection.forecast[day], inflows, outflows, actualInflows, actualOutflows, netMovement: inflows + actualInflows - outflows - actualOutflows, events: dayEvents }
  })
  const inflows = model.events.filter((event) => event.type === 'inflow' && event.status !== 'actual').reduce((sum, event) => sum + event.amount, 0)
  const outflows = model.events.filter((event) => event.type === 'outflow' && event.status !== 'actual').reduce((sum, event) => sum + event.amount, 0)
  const negativeDays = movements.filter((point) => point.balance < 0)
  const lowest = movements.reduce((minimum, point) => point.balance < minimum.balance ? point : minimum, movements[0])
  const riskStatus = classifyLiquidityStatus({ currentCash: model.currentCash, lowestBalance: lowest.balance, negativeDays: negativeDays.length })
  const warnings = []
  if (negativeDays.length) warnings.push(`Projected cash falls below zero for ${negativeDays.length} day${negativeDays.length === 1 ? '' : 's'}, beginning ${negativeDays[0].date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`)
  else if (riskStatus === 'tight') warnings.push(`The projected low point is ${lowest.balance.toLocaleString('en-IN')} INR, below 20% of current cash.`)
  else warnings.push('The projected balance remains above the low-buffer threshold throughout this horizon.')
  const breakdown = model.events.filter((event) => event.status !== 'actual').reduce((groups, event) => {
    const key = event.type === 'inflow' ? 'Customer payments' : event.category === 'planned-purchase' ? 'Planned purchases' : 'Operating expenses'
    groups[key] = (groups[key] ?? 0) + event.amount
    return groups
  }, {})
  return { horizonDays, currentCash: model.currentCash, expectedInflows: inflows, expectedOutflows: outflows, netMovement: projection.closingBalance - model.currentCash, closingBalance: projection.closingBalance, forecast: movements, events: model.events, lowestBalance: lowest.balance, lowestBalanceDate: lowest.date, negativeDays: negativeDays.length, riskStatus, warnings, breakdown }
}

export function calculateCustomerIntelligence(data = getFinancialData()) {
  const invoices = getInvoiceRiskIndicators(data)
  const invoicesByCustomer = new Map(data.customers.map((customer) => [customer.id, []]))
  invoices.forEach((invoice) => invoicesByCustomer.get(invoice.customerId)?.push(invoice))
  const profiles = data.customers.map((customer) => {
    const linkedInvoices = invoicesByCustomer.get(customer.id) ?? []
    const openInvoices = linkedInvoices.filter((invoice) => invoice.remainingAmount > 0)
    const history = customer.paymentHistory ?? null
    const highestRiskInvoice = openInvoices.reduce((highest, invoice) => {
      const rank = { high: 3, medium: 2, low: 1, unrated: 0 }
      return !highest || rank[invoice.prediction.risk] > rank[highest.prediction.risk] ? invoice : highest
    }, null)
    let riskExplanation = 'No open invoice exposure is currently linked to this customer.'
    if (highestRiskInvoice && history?.invoicesPaid > 0) {
      const lateRate = history.paidLate / history.invoicesPaid
      const historyText = `Illustrative demo history: ${history.paidLate} of ${history.invoicesPaid} prior invoices marked late (${Math.round(lateRate * 100)}%), with an average delay of ${history.averageDaysLate} days.`
      riskExplanation = `${historyText} Current open invoices receive a ${highestRiskInvoice.prediction.risk} indicator under the workspace's rule-based thresholds. Review the linked balances and due dates when planning receipts.`
    } else if (highestRiskInvoice) {
      riskExplanation = 'No usable payment-history summary is available, so this customer has no payment-risk classification. Review the open invoice balances and due dates directly.'
    }
    const totalInvoiced = linkedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
    const totalReceived = linkedInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0)
    const outstanding = linkedInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)
    return {
      id: customer.id,
      name: customer.name,
      companyName: customer.companyName ?? customer.businessName ?? customer.company ?? null,
      active: linkedInvoices.length > 0,
      risk: highestRiskInvoice?.prediction.risk ?? 'none',
      riskExplanation,
      totalInvoiced,
      totalReceived,
      hasRecordedPayments: linkedInvoices.some((invoice) => data.payments.some((payment) => payment.invoiceId === invoice.id)),
      outstanding,
      invoiceCount: linkedInvoices.length,
      openInvoiceCount: openInvoices.length,
      highRiskInvoiceCount: openInvoices.filter((invoice) => invoice.prediction.risk === 'high').length,
      paymentHistory: history ? { ...history } : null,
      reliabilityRate: history?.invoicesPaid > 0 && Number.isFinite(history.paidLate) ? Math.max(0, 1 - history.paidLate / history.invoicesPaid) : null,
      averageDaysLate: history?.invoicesPaid > 0 ? history.averageDaysLate : null,
      invoices: linkedInvoices,
    }
  })
  return {
    totalCustomers: profiles.length,
    activeCustomers: profiles.filter((profile) => profile.active).length,
    totalOutstanding: profiles.reduce((sum, profile) => sum + profile.outstanding, 0),
    highRiskCustomers: profiles.filter((profile) => profile.risk === 'high').length,
    profiles,
  }
}

export function queryCustomerProfiles(profiles, { query = '', risk = 'all', sortBy = 'outstanding-desc' } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = profiles.filter((profile) => {
    const matchesSearch = `${profile.name} ${profile.companyName ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
    return matchesSearch && (risk === 'all' || profile.risk === risk)
  })
  const descending = sortBy.endsWith('-desc')
  const direction = descending ? -1 : 1
  if (sortBy.startsWith('reliability-')) {
    return filtered.sort((left, right) => {
      if (left.reliabilityRate === null) return right.reliabilityRate === null ? left.name.localeCompare(right.name) : 1
      if (right.reliabilityRate === null) return -1
      return (left.reliabilityRate - right.reliabilityRate) * direction || left.name.localeCompare(right.name)
    })
  }
  return filtered.sort((left, right) => (left.outstanding - right.outstanding) * direction || left.name.localeCompare(right.name))
}


export function calculateExpenseIntelligence(data = getFinancialData()) {
  const asOf = data.business.asOf.slice(0, 10)
  const records = data.expenses.map((expense) => {
    const paymentStatus = expense.paymentStatus ?? expense.status ?? null
    const normalizedStatus = typeof paymentStatus === 'string' ? paymentStatus.toLowerCase() : null
    const transaction = data.transactions.find((item) => item.expenseId === expense.id || item.sourceExpenseId === expense.id) ?? null
    const isPaid = normalizedStatus === 'paid' || normalizedStatus === 'settled'
    const isUnpaid = ['unpaid', 'open', 'overdue'].includes(normalizedStatus)
    const hasReliableDueDate = isReliableDate(expense.dueDate)
    return { ...expense, supplier: expense.supplier ?? null, paymentStatus: normalizedStatus, transaction, isPaid, isUnpaid, hasReliableDueDate, isOverdue: hasReliableDueDate && !transaction && expense.dueDate < asOf && isUnpaid, isTransactionLinked: Boolean(transaction), isUpcoming: hasReliableDueDate && expense.dueDate > asOf && !isPaid && !transaction }
  })
  const recordedTotal = records.reduce((sum, expense) => sum + expense.amount, 0)
  const paidRecords = records.filter((expense) => expense.isPaid)
  const statusTrackedCount = records.filter((expense) => expense.paymentStatus !== null).length
  const upcoming = records.filter((expense) => expense.isUpcoming)
  const overdue = records.filter((expense) => expense.isOverdue)
  const categoryMap = records.reduce((groups, expense) => {
    const category = expense.category || 'uncategorized'
    const current = groups.get(category) ?? { category, amount: 0, count: 0, percentage: 0 }
    current.amount += expense.amount
    current.count += 1
    groups.set(category, current)
    return groups
  }, new Map())
  const categories = [...categoryMap.values()].map((group) => ({ ...group, percentage: recordedTotal ? group.amount / recordedTotal * 100 : 0 })).sort((left, right) => right.amount - left.amount)
  const largestExpense = records.reduce((largest, expense) => !largest || expense.amount > largest.amount ? expense : largest, null)
  const largestCategory = categories[0] ?? null
  return {
    records,
    recordedTotal,
    paidTotal: paidRecords.reduce((sum, expense) => sum + expense.amount, 0),
    paidCount: paidRecords.length,
    statusTrackedCount,
    hasPaymentStatus: records.length > 0 && statusTrackedCount === records.length,
    upcomingCount: upcoming.length,
    upcomingTotal: upcoming.reduce((sum, expense) => sum + expense.amount, 0),
    overdueCount: overdue.length,
    overdueTotal: overdue.reduce((sum, expense) => sum + expense.amount, 0),
    categories,
    largestExpense,
    largestCategory,
    concentration: largestCategory?.percentage ?? 0,
  }
}

export function queryExpenseRecords(records, { query = '', category = 'all', payment = 'all', sortBy = 'due-asc' } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = records.filter((expense) => {
    const matchesSearch = `${expense.label ?? ''} ${expense.supplier ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
    const matchesCategory = category === 'all' || expense.category === category
    const matchesPayment = payment === 'all' || (payment === 'paid' ? expense.isPaid : payment === 'unpaid' ? expense.isUnpaid : true)
    return matchesSearch && matchesCategory && matchesPayment
  })
  const [field, direction] = sortBy.split('-')
  const factor = direction === 'desc' ? -1 : 1
  return filtered.sort((left, right) => {
    if (field === 'amount') return (left.amount - right.amount) * factor || left.id.localeCompare(right.id)
    return left.dueDate.localeCompare(right.dueDate) * factor || left.id.localeCompare(right.id)
  })
}

export function calculateOverviewIntelligence(data = getFinancialData(), horizonDays = 30) {
  const cashFlow = calculateCashFlowAnalysis(data, horizonDays)
  const invoiceIndicators = calculateInvoiceRiskIndicators(data)
  const openInvoices = invoiceIndicators.filter((invoice) => invoice.remainingAmount > 0)
  const overdueInvoices = openInvoices.filter((invoice) => invoice.prediction.isOverdue)
  const highRiskInvoices = openInvoices.filter((invoice) => invoice.prediction.risk === 'high')
  const customers = calculateCustomerIntelligence(data)
  const expenseAnalysis = calculateExpenseIntelligence(data)
  const bufferThreshold = Math.max(0, cashFlow.currentCash * 0.2)
  const shortfall = cashFlow.riskStatus === 'shortage'
  const lowBuffer = cashFlow.riskStatus === 'tight'
  const financialHealth = classifyFinancialHealth({ liquidityStatus: cashFlow.riskStatus, hasOpenReceivableRisk: overdueInvoices.length > 0 || highRiskInvoices.length > 0 })
  let healthStatus = financialHealth.label
  let healthTone = financialHealth.tone
  let healthReason = `Projected cash stays at or above the ${formatCompactINR(bufferThreshold)} liquidity buffer, with no open overdue or high-risk receivables.`
  if (shortfall) {
    healthReason = `The ${horizonDays}-day baseline falls below zero on ${formatOverviewDate(cashFlow.forecast.find((point) => point.balance < 0)?.date)}. This is a modeled cash shortfall, not a confirmed event.`
  } else if (financialHealth.tone === 'attention') {
    const reasons = []
    if (cashFlow.currentCash <= 0) reasons.push('there is no positive opening cash buffer')
    else if (lowBuffer) reasons.push(`the projected low point of ${formatCompactINR(cashFlow.lowestBalance)} is below the ${formatCompactINR(bufferThreshold)} buffer`)
    if (overdueInvoices.length) reasons.push(`${overdueInvoices.length} open invoice${overdueInvoices.length === 1 ? '' : 's'} past due`)
    if (highRiskInvoices.length) reasons.push(`${highRiskInvoices.length} open invoice${highRiskInvoices.length === 1 ? '' : 's'} with a high rule-based risk indicator`)
    healthReason = `Needs attention because ${reasons.join(' and ')}.`
  }

  const alerts = []
  if (shortfall) {
    const firstNegative = cashFlow.forecast.find((point) => point.balance < 0)
    alerts.push({ id: 'liquidity-shortfall', severity: 'critical', title: 'Projected cash falls below zero', detail: `The baseline reaches ${formatCompactINR(firstNegative.balance)} on ${formatOverviewDate(firstNegative.date)} and remains negative for ${cashFlow.negativeDays} projected day${cashFlow.negativeDays === 1 ? '' : 's'}.`, why: 'A negative modeled balance points to a potential timing gap between receipts and scheduled outflows.', action: 'Review the daily forecast and expense timing.', href: '#cash-flow', related: null })
  } else if (lowBuffer) {
    const detail = cashFlow.currentCash <= 0
      ? `Opening cash is ${formatCompactINR(cashFlow.currentCash)}; the baseline does not begin with a positive cash buffer.`
      : `The lowest projected cash is ${formatCompactINR(cashFlow.lowestBalance)} on ${formatOverviewDate(cashFlow.lowestBalanceDate)}, below the ${formatCompactINR(bufferThreshold)} (20%) buffer.`
    alerts.push({ id: 'liquidity-buffer', severity: 'attention', title: 'Projected liquidity buffer is low', detail, why: 'Less cash remains available to absorb delays or unexpected costs.', action: 'Review the cash-flow timeline and upcoming outflows.', href: '#cash-flow', related: null })
  }

  const overdueIds = new Set(overdueInvoices.map((invoice) => invoice.id))
  overdueInvoices.forEach((invoice) => alerts.push({ id: `invoice-overdue-${invoice.id}`, severity: 'high', title: `${invoice.customer} · ${invoice.id} is past due`, detail: `${formatCompactINR(invoice.remainingAmount)} remains open after its ${formatOverviewDate(invoice.dueDate)} due date${invoice.prediction.risk === 'high' ? `; the existing rule also marks its payment risk high` : ''}.`, why: 'Past-due receivables can delay cash availability; payment timing remains an estimate.', action: 'Review the open invoice and follow up with the customer.', href: '#receivables', related: { type: 'invoice', id: invoice.id, label: `${invoice.customer} · ${invoice.id}` } }))
  highRiskInvoices.filter((invoice) => !overdueIds.has(invoice.id)).forEach((invoice) => alerts.push({ id: `invoice-risk-${invoice.id}`, severity: 'attention', title: `${invoice.customer} · ${invoice.id} has a high risk indicator`, detail: `${formatCompactINR(invoice.remainingAmount)} is outstanding. The existing rule-based estimate indicates possible payment delay.`, why: invoice.prediction.riskExplanation, action: 'Review the invoice and consider a customer follow-up.', href: '#receivables', related: { type: 'invoice', id: invoice.id, label: `${invoice.customer} · ${invoice.id}` } }))

  const largeExpenseThreshold = bufferThreshold
  const largestUpcomingExpense = expenseAnalysis.records.filter((expense) => expense.isUpcoming && calculateEventDay(expense.dueDate, data) <= horizonDays).sort((left, right) => right.amount - left.amount)[0]
  if (largestUpcomingExpense && largestUpcomingExpense.amount >= largeExpenseThreshold && largeExpenseThreshold > 0) {
    const share = Math.round(largestUpcomingExpense.amount / cashFlow.currentCash * 100)
    alerts.push({ id: `expense-${largestUpcomingExpense.id}`, severity: 'attention', title: `${largestUpcomingExpense.label} is a large scheduled outflow`, detail: `${formatCompactINR(largestUpcomingExpense.amount)} is scheduled for ${formatOverviewDate(largestUpcomingExpense.dueDate)}, about ${share}% of current cash. Payment status is not recorded.`, why: 'This single scheduled expense is large relative to the current cash balance.', action: 'Review the expense schedule and projected balance.', href: '#expenses', related: { type: 'expense', id: largestUpcomingExpense.id, label: largestUpcomingExpense.label } })
  }

  const seenAlertIds = new Set()
  const uniqueAlerts = alerts.filter((alert) => {
    if (seenAlertIds.has(alert.id)) return false
    seenAlertIds.add(alert.id)
    return true
  }).sort((left, right) => ({ critical: 0, high: 1, attention: 2 }[left.severity] - ({ critical: 0, high: 1, attention: 2 }[right.severity])))

  const rawTransactions = data.transactions.filter((transaction) => transaction.date && dateKey(transaction.date) <= data.business.asOf.slice(0, 10)).map((transaction) => ({
    id: transaction.id,
    date: dateKey(transaction.date),
    label: transaction.description ?? transaction.label ?? transaction.name ?? 'Financial transaction',
    type: ['inflow', 'outflow'].includes(transaction.type) ? transaction.type : 'transaction',
    amount: transaction.amount,
    invoiceId: transaction.invoiceId,
    expenseId: transaction.expenseId ?? transaction.sourceExpenseId,
  }))
  const linkedPaymentIds = new Set(data.transactions.flatMap((transaction) => [transaction.paymentId, transaction.sourcePaymentId].filter(Boolean)))
  const transactionPaymentKeys = new Set(data.transactions.filter((transaction) => transaction.invoiceId && transaction.date).map((transaction) => `${transaction.invoiceId}|${dateKey(transaction.date)}|${transaction.amount}`))
  const paymentActivity = data.payments.filter((payment) => payment.date && dateKey(payment.date) <= data.business.asOf.slice(0, 10) && !linkedPaymentIds.has(payment.id) && !transactionPaymentKeys.has(`${payment.invoiceId}|${dateKey(payment.date)}|${payment.amount}`)).map((payment) => ({ id: payment.id, date: dateKey(payment.date), label: `Payment received · ${payment.invoiceId}`, type: 'inflow', amount: payment.amount, invoiceId: payment.invoiceId }))
  const activityById = new Map([...rawTransactions, ...paymentActivity].map((event) => {
    const id = event.id ?? `${event.type}|${dateKey(event.date)}|${event.label}|${event.amount}`
    return [id, { ...event, id }]
  }))
  const recentActivity = [...activityById.values()].sort((left, right) => dateKey(right.date).localeCompare(dateKey(left.date))).slice(0, 6)

  return {
    horizonDays,
    cashFlow,
    currentCash: cashFlow.currentCash,
    outstandingReceivables: openInvoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0),
    upcomingExpenseCommitments: cashFlow.expectedOutflows,
    expectedClosingBalance: cashFlow.closingBalance,
    lowestProjectedBalance: cashFlow.lowestBalance,
    lowestProjectedBalanceDate: cashFlow.lowestBalanceDate,
    healthStatus,
    healthTone,
    healthReason,
    bufferThreshold,
    alerts: uniqueAlerts,
    recentActivity,
    snapshot: {
      totalCustomers: customers.totalCustomers,
      highRiskCustomers: customers.highRiskCustomers,
      totalInvoices: data.invoices.length,
      outstandingInvoices: openInvoices.length,
      totalScheduledExpenses: expenseAnalysis.upcomingCount,
    },
  }
}

export function generateFinancialInsights(data = getFinancialData(), horizonDays = 30) {
  const overview = calculateOverviewIntelligence(data, horizonDays)
  const generated = overview.alerts.map((alert) => {
    const relatedType = alert.related?.type
    const category = alert.id.startsWith('liquidity-') ? 'cash-flow'
      : relatedType === 'expense' ? 'expenses'
        : relatedType === 'invoice' ? 'receivables' : 'cash-flow'
    const severity = alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : 'medium'
    const relatedRecord = relatedType === 'invoice' ? data.invoices.find((item) => item.id === alert.related.id)
      : relatedType === 'expense' ? data.expenses.find((item) => item.id === alert.related.id) : null
    return {
      ...alert,
      id: `insight-${alert.id}`,
      sourceId: alert.id,
      category,
      severity,
      status: 'open',
      related: alert.related ? { ...alert.related, href: `${alert.href}` } : null,
      dates: relatedRecord ? [relatedRecord.dueDate].filter(Boolean) : overview.cashFlow.lowestBalanceDate ? [dateKey(overview.cashFlow.lowestBalanceDate)] : [],
      supportingFigures: relatedType === 'invoice'
        ? { outstanding: data.invoices.find((item) => item.id === alert.related.id) ? calculateInvoiceRiskIndicators(data).find((item) => item.id === alert.related.id)?.remainingAmount : null }
        : relatedType === 'expense' ? { scheduledAmount: relatedRecord?.amount ?? null }
          : { currentCash: overview.currentCash, expectedInflows: overview.cashFlow.expectedInflows, expectedOutflows: overview.cashFlow.expectedOutflows, projectedClosing: overview.expectedClosingBalance, lowestBalance: overview.lowestProjectedBalance },
    }
  })

  const customerAnalysis = calculateCustomerIntelligence(data)
  customerAnalysis.profiles.filter((customer) => customer.highRiskInvoiceCount >= 2).forEach((customer) => {
    generated.push({
      id: `insight-customer-multiple-risk-${customer.id}`, sourceId: `customer-multiple-risk-${customer.id}`,
      severity: 'high', category: 'customer-risk', title: `${customer.name} has multiple high-risk invoices`,
      detail: `${customer.highRiskInvoiceCount} of this customer's open invoices carry a high rule-based payment-risk indicator; ${formatCompactINR(customer.outstanding)} remains outstanding.`,
      why: `Several open invoices share one customer exposure, so delayed receipts may affect more of the forecast. The high-risk indicators use ${customer.paymentHistory?.invoicesPaid ? 'illustrative customer history summaries, not recorded payment transactions' : 'available invoice evidence without a verified payment-history baseline'}.`,
      action: 'Review the linked invoices and consider a coordinated customer follow-up.', href: '#customers',
      related: { type: 'customer', id: customer.id, label: customer.name, href: '#customers' },
      dates: customer.invoices.filter((invoice) => invoice.remainingAmount > 0 && invoice.prediction.risk === 'high').map((invoice) => invoice.dueDate),
      supportingFigures: { highRiskInvoices: customer.highRiskInvoiceCount, outstanding: customer.outstanding }, status: 'open',
    })
  })

  const expenses = calculateExpenseIntelligence(data)
  if (expenses.largestCategory && expenses.concentration >= 60) {
    generated.push({
      id: `insight-expense-concentration-${expenses.largestCategory.category}`, sourceId: `expense-concentration-${expenses.largestCategory.category}`,
      severity: 'medium', category: 'expenses', title: `Expense schedules are concentrated in ${expenses.largestCategory.category.replaceAll('-', ' ')}`,
      detail: `${formatCompactINR(expenses.largestCategory.amount)} across ${expenses.largestCategory.count} recorded expense${expenses.largestCategory.count === 1 ? '' : 's'} represents ${expenses.concentration.toFixed(1)}% of total scheduled expense value.`,
      why: 'A concentrated schedule can make cash planning more sensitive to changes in this category.',
      action: 'Review the category schedule and confirm the listed commitments.', href: '#expenses',
      related: { type: 'expense-category', id: expenses.largestCategory.category, label: expenses.largestCategory.category, href: '#expenses' },
      dates: expenses.records.filter((item) => item.category === expenses.largestCategory.category).map((item) => item.dueDate),
      supportingFigures: { categoryAmount: expenses.largestCategory.amount, sharePercent: expenses.concentration }, status: 'open',
    })
  }
  const severityRank = { critical: 0, high: 1, medium: 2, informational: 3 }
  return [...new Map(generated.map((item) => [item.id, item])).values()].sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || left.title.localeCompare(right.title))
}

function formatCompactINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function formatOverviewDate(value) {
  const date = value instanceof Date ? value : parseSampleDate(String(value).slice(0, 10))
  return formatWorkspaceDate(date)
}

function dateKey(value) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  return String(value ?? '').slice(0, 10)
}
