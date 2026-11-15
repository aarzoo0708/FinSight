import { getFinancialData, getFinancialTransactions, getInvoiceRiskIndicators } from '../data/financialStore.js'
import { calculateCashFlowAnalysis, calculateCustomerIntelligence, calculateExpenseIntelligence, calculateOverviewIntelligence, generateFinancialInsights } from './financialServices.js'
import { simulateScenario } from './scenarioEngine.js'
import { parseSampleDate, daysBetween } from './paymentPrediction.js'
import { formatWorkspaceDate } from './formatters.js'

export const REPORT_TYPES = [
  { id: 'overview', title: 'Financial Overview Report', description: 'Current position, open insights and the forecast in one view.' },
  { id: 'cash-flow', title: 'Cash Flow Report', description: 'Expected movements and daily projected balance.' },
  { id: 'receivables', title: 'Receivables Report', description: 'Open invoice balances, due dates and rule-based risk.' },
  { id: 'customers', title: 'Customer Performance Report', description: 'Customer invoicing, outstanding balances and available history indicators.' },
  { id: 'expenses', title: 'Expense Analysis Report', description: 'Scheduled commitments and their category distribution.' },
  { id: 'risk', title: 'Financial Risk Report', description: 'Open insight-service warnings and their recommended actions.' },
  { id: 'scenario', title: 'Digital Twin Scenario Report', description: 'Compare a saved hypothetical scenario with its baseline.' },
]

export const formatReportINR = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const dateKey = (value) => value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : String(value ?? '').slice(0, 10)
const inRange = (value, start, end) => Boolean(value) && dateKey(value) >= start && dateKey(value) <= end
const money = (value) => formatReportINR(value)
const dateLabel = (value) => value ? formatWorkspaceDate(value instanceof Date ? value : parseSampleDate(dateKey(value))) : 'Not available'
const recordsToRows = (records, columns) => records.map((record) => columns.map((column) => column.value(record)))

export function getReportDateDefaults(data = getFinancialData()) {
  const start = dateKey(data.business.asOf)
  const endDate = parseSampleDate(start)
  endDate.setDate(endDate.getDate() + 30)
  return { startDate: start, endDate: dateKey(endDate) }
}

export function validateReportFilters(filters, data = getFinancialData()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.startDate ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(filters.endDate ?? '')) return 'Choose valid start and end dates.'
  if (filters.startDate > filters.endDate) return 'The start date must be on or before the end date.'
  for (const key of [filters.startDate, filters.endDate]) if (dateKey(parseSampleDate(key)) !== key) return 'Choose real calendar dates for the report period.'
  if (['overview', 'cash-flow', 'risk', 'scenario'].includes(filters.type) && daysBetween(parseSampleDate(dateKey(data.business.asOf)), parseSampleDate(filters.endDate)) > 90) return 'Forecast-based reports support periods up to 90 days from the current data date.'
  if (daysBetween(parseSampleDate(dateKey(data.business.asOf)), parseSampleDate(filters.endDate)) < 0 && !data.transactions.some((item) => item.date && inRange(item.date, filters.startDate, filters.endDate))) return 'No dated historical transactions are available for this period. Choose a period that includes the current date or available dated records.'
  return ''
}

export function buildReport(data = getFinancialData(), filters) {
  const definition = REPORT_TYPES.find((item) => item.id === filters.type) ?? REPORT_TYPES[0]
  const horizonDays = Math.max(1, Math.min(90, daysBetween(parseSampleDate(dateKey(data.business.asOf)), parseSampleDate(filters.endDate))))
  const cash = calculateCashFlowAnalysis(data, horizonDays)
  const selectedForecastPoints = cash.forecast.filter((point) => inRange(point.date, filters.startDate, filters.endDate))
  const overview = calculateOverviewIntelligence(data, horizonDays)
  const invoiceIndicators = getInvoiceRiskIndicators(data)
  const customerProfiles = calculateCustomerIntelligence(data).profiles
  const expenses = calculateExpenseIntelligence(data)
  const periodEvents = cash.events.filter((event) => inRange(event.date, filters.startDate, filters.endDate))
  const allActuals = getFinancialTransactions(data).filter((event) => event.status === 'actual' && inRange(event.date, filters.startDate, filters.endDate))
  const actualInflows = allActuals.filter((event) => event.type === 'inflow').reduce((sum, event) => sum + Number(event.amount || 0), 0)
  const actualOutflows = allActuals.filter((event) => event.type === 'outflow').reduce((sum, event) => sum + Number(event.amount || 0), 0)
  const rawStartDay = daysBetween(parseSampleDate(dateKey(data.business.asOf)), parseSampleDate(filters.startDate))
  const startDay = Math.max(0, rawStartDay)
  const openingCash = rawStartDay < 0 ? null : startDay === 0 ? cash.currentCash : cash.forecast[Math.min(startDay - 1, cash.forecast.length - 1)]?.balance ?? cash.currentCash
  const filteredCashEvents = periodEvents
  let rows = []
  let columns = []
  let metrics = []
  let notes = []
  let chartPoints = []
  let executiveSummary = ''

  if (filters.type === 'overview') {
    const historicalPeriod = daysBetween(parseSampleDate(dateKey(data.business.asOf)), parseSampleDate(filters.endDate)) < 0
    const closing = historicalPeriod ? null : selectedForecastPoints.at(-1)?.balance ?? cash.currentCash
    const periodLow = selectedForecastPoints.reduce((low, point) => !low || point.balance < low.balance ? point : low, null)
    metrics = [
      ['Current cash', money(cash.currentCash), 'Actual snapshot'], ['Outstanding receivables', money(overview.outstandingReceivables), 'Open invoice balances'],
      ['Actual dated inflows', money(actualInflows), 'Recorded transactions in selected period'], ['Actual dated outflows', money(actualOutflows), 'Recorded transactions in selected period'],
      ['Expected inflows', money(filteredCashEvents.filter((item) => item.type === 'inflow').reduce((s, x) => s + x.amount, 0)), 'Scheduled estimate in selected period'],
      ['Scheduled outflows', money(filteredCashEvents.filter((item) => item.type === 'outflow').reduce((s, x) => s + x.amount, 0)), 'Unpaid scheduled expense commitments'],
      ['Projected closing balance', closing === null ? 'Unavailable' : money(closing), historicalPeriod ? 'Historical closing balance is not recorded' : `Projection through ${dateLabel(selectedForecastPoints.at(-1)?.date)}`], ['Lowest projected balance', periodLow ? money(periodLow.balance) : 'Unavailable', periodLow ? dateLabel(periodLow.date) : 'No projection for a past period'],
      ['Financial health', overview.healthStatus, overview.healthReason],
    ]
    const insights = generateFinancialInsights(data, horizonDays).filter((insight) => { const saved = (data.insights ?? []).find((item) => item.id === insight.id); return (saved?.status ?? insight.status ?? 'open') === 'open' })
    columns = [{ label: 'Severity', value: (x) => x.severity }, { label: 'Insight', value: (x) => x.title }, { label: 'Why it matters', value: (x) => x.why }, { label: 'Recommended action', value: (x) => x.action }]
    rows = recordsToRows(insights, columns)
    notes = ['Current cash is the stored business snapshot. Expected movements are scheduled estimates, not confirmed payments.', historicalPeriod ? 'This selected period is historical; dated transactions may be reported, but historical balances and a past forecast are unavailable.' : 'Historical transaction records are included only when present in the shared store.']
    executiveSummary = historicalPeriod ? `Current cash is ${money(cash.currentCash)} and current outstanding receivables are ${money(overview.outstandingReceivables)}. Historical closing cash is unavailable for the selected past period.` : `Current cash is ${money(cash.currentCash)} with ${money(overview.outstandingReceivables)} outstanding. Forecast closing cash is ${money(closing)} over the selected horizon.`
  } else if (filters.type === 'cash-flow') {
    columns = [{ label: 'Date', value: (x) => dateLabel(x.date) }, { label: 'Actual inflows', value: (x) => money(x.actualInflow) }, { label: 'Expected inflows', value: (x) => money(x.expectedInflow) }, { label: 'Actual outflows', value: (x) => money(x.actualOutflow) }, { label: 'Expected outflows', value: (x) => money(x.expectedOutflow) }, { label: 'Net movement', value: (x) => money(x.net) }, { label: 'Projected balance', value: (x) => x.balance === null ? 'Unavailable' : money(x.balance) }]
    const forecastPoints = selectedForecastPoints
    chartPoints = forecastPoints.map((point) => ({ date: point.date, balance: point.balance }))
    const actualByDate = new Map()
    for (const event of allActuals) {
      const key = dateKey(event.date)
      const day = actualByDate.get(key) ?? { inflow: 0, outflow: 0 }
      day[event.type] += Number(event.amount) || 0
      actualByDate.set(key, day)
    }
    const dayKeys = new Set([...forecastPoints.map((point) => dateKey(point.date)), ...actualByDate.keys()])
    const forecastByDate = new Map(forecastPoints.map((point) => [dateKey(point.date), point]))
    rows = [...dayKeys].sort().map((key) => {
      const point = forecastByDate.get(key)
      const expectedInflow = point?.inflows ?? 0
      const expectedOutflow = point?.outflows ?? 0
      const datedActual = actualByDate.get(key) ?? { inflow: 0, outflow: 0 }
      return [dateLabel(key), money(datedActual.inflow), money(expectedInflow), money(datedActual.outflow), money(expectedOutflow), money(datedActual.inflow + expectedInflow - datedActual.outflow - expectedOutflow), point?.balance ?? null]
    })
    const closing = rawStartDay < 0 ? null : cash.forecast.filter((point) => inRange(point.date, filters.startDate, filters.endDate)).at(-1)?.balance ?? openingCash
    const periodLow = forecastPoints.reduce((low, point) => !low || point.balance < low.balance ? point : low, null)
    const negativeForecastPoints = forecastPoints.filter((point) => point.balance < 0)
    metrics = [['Opening cash', openingCash === null ? 'Unavailable' : money(openingCash), rawStartDay < 0 ? 'Historical opening balance is not recorded' : 'At selected period start'], ['Actual inflows', money(actualInflows), 'Dated actual events only'], ['Expected inflows', money(filteredCashEvents.filter((x) => x.type === 'inflow').reduce((s, x) => s + x.amount, 0)), 'Estimated receipts'], ['Actual outflows', money(actualOutflows), 'Dated actual events only'], ['Expected outflows', money(filteredCashEvents.filter((x) => x.type === 'outflow').reduce((s, x) => s + x.amount, 0)), 'Scheduled commitments'], ['Net movement', closing === null ? 'Unavailable' : money(closing - openingCash), 'Actuals plus scheduled estimates'], ['Projected closing balance', closing === null ? 'Unavailable' : money(closing), 'Selected period end'], ['Lowest projected balance', periodLow ? money(periodLow.balance) : 'Unavailable', periodLow ? dateLabel(periodLow.date) : 'No forecast point in selected period'], ['Cash shortage days', String(negativeForecastPoints.length), negativeForecastPoints.length ? `First projected below-zero day: ${dateLabel(negativeForecastPoints[0].date)}` : 'No below-zero forecast day']]
    notes = ['Forecast events are estimates. They are not confirmed collections or payments.', 'The opening balance for a future start date includes modeled movements before that date. Historical balances are unavailable without a dated opening balance.']
    executiveSummary = rawStartDay < 0 ? `${money(actualInflows)} actual inflows and ${money(actualOutflows)} actual outflows are recorded in the selected historical period. Historical balances are unavailable.` : `${money(openingCash)} opening cash; ${money(closing - openingCash)} net movement; ${money(closing)} projected closing cash.`
  } else if (filters.type === 'receivables') {
    const invoices = invoiceIndicators.filter((invoice) => invoice.remainingAmount > 0 && inRange(invoice.dueDate, filters.startDate, filters.endDate) && (!filters.customerId || invoice.customerId === filters.customerId))
    columns = [{ label: 'Invoice', value: (x) => x.id }, { label: 'Customer', value: (x) => x.customer }, { label: 'Invoice amount', value: (x) => money(x.amount) }, { label: 'Remaining balance', value: (x) => money(x.remainingAmount) }, { label: 'Due date', value: (x) => dateLabel(x.dueDate) }, { label: 'Risk', value: (x) => x.prediction.risk }, { label: 'Risk explanation', value: (x) => x.prediction.riskExplanation }]
    rows = recordsToRows(invoices, columns)
    metrics = [['Open invoices', String(invoices.length), 'Filtered by selected due dates'], ['Outstanding balance', money(invoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0)), 'Paid amounts deducted once']]
    notes = ['Paid invoices are excluded. Remaining balances account for recorded partial payments.', 'Risk labels are rule-based indicators, not trained-model predictions.']
    executiveSummary = `${invoices.length} open invoice${invoices.length === 1 ? '' : 's'} due in this period total ${money(invoices.reduce((sum, invoice) => sum + invoice.remainingAmount, 0))}.`
  } else if (filters.type === 'customers') {
    const profiles = customerProfiles.filter((profile) => !filters.customerId || profile.id === filters.customerId)
    columns = [{ label: 'Customer', value: (x) => x.name }, { label: 'Total invoiced', value: (x) => money(x.totalInvoiced) }, { label: 'Outstanding', value: (x) => money(x.outstanding) }, { label: 'Invoices', value: (x) => String(x.invoiceCount) }, { label: 'Risk indicator', value: (x) => x.risk ?? 'unrated' }, { label: 'Payment history', value: (x) => x.paymentHistory ? `${x.paymentHistory.invoicesPaid} prior · ${x.paymentHistory.paidLate} late · avg ${x.paymentHistory.averageDaysLate} days (illustrative)` : 'Unavailable' }]
    rows = recordsToRows(profiles, columns)
    metrics = [['Customers', String(profiles.length), 'Shared customer directory'], ['Outstanding', money(profiles.reduce((sum, item) => sum + item.outstanding, 0)), 'Linked invoice balances']]
    notes = ['Customer balances and invoiced totals are current shared-store snapshots. Payment-history figures are illustrative demo indicators where provided; they are not newly observed transactions.']
    executiveSummary = `${profiles.length} customer profiles are included. Outstanding balances reconcile to the linked open invoices.`
  } else if (filters.type === 'expenses') {
    const records = expenses.records.filter((item) => inRange(item.dueDate, filters.startDate, filters.endDate) && (!filters.category || item.category === filters.category))
    columns = [{ label: 'Expense', value: (x) => x.label }, { label: 'Category', value: (x) => x.category }, { label: 'Amount', value: (x) => money(x.amount) }, { label: 'Due date', value: (x) => dateLabel(x.dueDate) }, { label: 'Payment status', value: (x) => x.paymentStatus ?? 'Not provided' }]
    rows = recordsToRows(records, columns)
    metrics = [['Scheduled expenses', String(records.length), 'Selected period and category'], ['Scheduled total', money(records.reduce((sum, item) => sum + item.amount, 0)), 'Does not infer missing payment status']]
    notes = ['Expense payment status is shown only when supplied by the shared records.']
    executiveSummary = `${records.length} scheduled expense${records.length === 1 ? '' : 's'} total ${money(records.reduce((sum, item) => sum + item.amount, 0))}.`
  } else if (filters.type === 'risk') {
    const insights = generateFinancialInsights(data, horizonDays).filter((insight) => { const saved = (data.insights ?? []).find((item) => item.id === insight.id); return (saved?.status ?? insight.status ?? 'open') === 'open' })
    columns = [{ label: 'Severity', value: (x) => x.severity }, { label: 'Risk / insight', value: (x) => x.title }, { label: 'Detail', value: (x) => x.detail }, { label: 'Recommended action', value: (x) => x.action }, { label: 'Related item', value: (x) => x.related?.label ?? 'Business-wide' }]
    rows = recordsToRows(insights, columns)
    metrics = [['Open insights', String(insights.length), 'Existing insight service only'], ['Critical and high', String(insights.filter((x) => ['critical', 'high'].includes(x.severity)).length), 'Open generated insights']]
    notes = ['Only open insights produced by the existing financial insight service are included.']
    executiveSummary = `${insights.length} open insight${insights.length === 1 ? '' : 's'} are in the selected forecast context.`
  } else {
    const saved = (data.scenarios ?? []).find((scenario) => scenario.id === filters.scenarioId)
    if (!saved) return { definition, metrics: [], columns: [], rows: [], notes: ['Select a saved scenario to preview this report.'], executiveSummary: 'No saved scenario selected.', scenario: null, horizonDays }
    const scenarioHorizon = Math.max(1, Math.min(90, horizonDays, Number(saved.horizonDays) || 30))
    const baseline = calculateCashFlowAnalysis(data, scenarioHorizon)
    const simulated = simulateScenario(data, { ...saved.assumptions, id: saved.id }, scenarioHorizon)
    const comparison = [['Opening cash', money(baseline.currentCash), money(simulated.openingCash)], ['Expected inflows', money(baseline.expectedInflows), money(simulated.expectedInflows)], ['Expected outflows', money(baseline.expectedOutflows), money(simulated.expectedOutflows)], ['Closing balance', money(baseline.closingBalance), money(simulated.closingBalance)], ['Lowest projected balance', money(baseline.lowestBalance), money(simulated.lowestBalance)], ['Days below zero', String(baseline.negativeDays), String(simulated.negativeDays)]]
    columns = [{ label: 'Metric', value: (x) => x[0] }, { label: 'Baseline', value: (x) => x[1] }, { label: 'Simulated', value: (x) => x[2] }]
    const assumptionRows = Object.entries(saved.assumptions ?? {}).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => [`Assumption · ${key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}`, '—', String(value)])
    rows = [...comparison, ...assumptionRows]
    metrics = [['Scenario', saved.name, 'Simulated assumptions'], ['Net cash impact', money(simulated.closingBalance - baseline.closingBalance), 'Scenario less baseline'], ['Lowest simulated balance', money(simulated.lowestBalance), dateLabel(simulated.lowestBalanceDate)]]
    notes = ['All scenario values are hypothetical and do not alter financial records.', ...simulated.recommendations.map((item) => `${item.title}: ${item.why} Action: ${item.action}`)]
    executiveSummary = `${saved.name} is simulated against the current baseline. Closing cash changes by ${money(simulated.closingBalance - baseline.closingBalance)} over ${scenarioHorizon} days.`
    return { definition, metrics, columns, rows, notes, executiveSummary, scenario: { saved, baseline, simulated }, horizonDays: scenarioHorizon, actuals: { inflows: actualInflows, outflows: actualOutflows } }
  }
  return { definition, metrics, columns, rows, notes, executiveSummary, chartPoints, horizonDays, actuals: { inflows: actualInflows, outflows: actualOutflows }, generatedAt: new Date() }
}

export function reportToCsv(report) {
  const quote = (value) => {
    let text = String(value ?? '')
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return [report.columns.map((column) => quote(column.label)).join(','), ...report.rows.map((row) => row.map(quote).join(','))].join('\r\n')
}
