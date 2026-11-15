import test from 'node:test'
import assert from 'node:assert/strict'
import { getDemoFinancialData } from '../src/data/financialStore.js'
import { buildReport, formatReportINR, getReportDateDefaults, reportToCsv, validateReportFilters } from '../src/utils/reporting.js'

const make = () => structuredClone(getDemoFinancialData())
const filters = (data, type, updates = {}) => ({ ...getReportDateDefaults(data), type, ...updates })

test('all seven report types build a preview from shared service results', () => {
  const data = make()
  const types = ['overview', 'cash-flow', 'receivables', 'customers', 'expenses', 'risk', 'scenario']
  for (const type of types) {
    const report = buildReport(data, filters(data, type))
    assert.ok(report.definition.title)
    assert.ok(Array.isArray(report.metrics))
    assert.ok(Array.isArray(report.rows))
  }
  assert.equal(buildReport(data, filters(data, 'receivables')).rows.length, 4)
  assert.equal(buildReport(data, filters(data, 'expenses')).rows.length, 5)
})

test('date validation rejects inverted, malformed and unsupported historical periods', () => {
  const data = make()
  assert.match(validateReportFilters({ ...filters(data, 'overview'), startDate: '2026-12-01', endDate: '2026-11-30' }, data), /on or before/)
  assert.match(validateReportFilters({ ...filters(data, 'overview'), startDate: '2026-02-30' }, data), /real calendar dates/)
  assert.match(validateReportFilters({ ...filters(data, 'overview'), startDate: '2026-10-01', endDate: '2026-10-31' }, data), /No dated historical transactions/)
})

test('customer, category and scenario filters select matching records', () => {
  const data = make()
  const customerReport = buildReport(data, filters(data, 'receivables', { customerId: 'cust-aarav-living' }))
  assert.equal(customerReport.rows.length, 1)
  assert.equal(customerReport.rows[0][1], 'Aarav Living')
  const categoryReport = buildReport(data, filters(data, 'expenses', { category: 'planned-purchase' }))
  assert.equal(categoryReport.rows.length, 1)
  assert.equal(categoryReport.rows[0][1], 'planned-purchase')
  data.scenarios = [{ id: 'SCN-1', name: 'Test purchase', type: 'purchase', assumptions: { type: 'purchase', name: 'Test', description: 'Desk', amount: 2000, effectiveDate: '2026-11-20' }, horizonDays: 30 }]
  const scenario = buildReport(data, filters(data, 'scenario', { scenarioId: 'SCN-1' }))
  assert.equal(scenario.scenario.saved.id, 'SCN-1')
  assert.equal(scenario.rows.find((row) => row[0] === 'Closing balance')[1], formatReportINR(scenario.scenario.baseline.closingBalance))
  assert.equal(scenario.rows.find((row) => row[0] === 'Closing balance')[2], formatReportINR(scenario.scenario.simulated.closingBalance))
})

test('CSV quotes commas and quotes, and neutralizes spreadsheet formulas', () => {
  const csv = reportToCsv({ columns: [{ label: 'Memo' }, { label: 'Value' }], rows: [['Sales, "Retail"', '=HYPERLINK("x")'], ['ordinary', '+SUM(A1:A2)'], ['negative', '-4']] })
  assert.match(csv, /"Sales, ""Retail"""/)
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/)
  assert.match(csv, /"'\+SUM\(A1:A2\)"/)
  assert.match(csv, /"'-4"/)
})

test('reporting handles empty tables and uses Indian rupee formatting', () => {
  const data = make()
  data.invoices = []
  const report = buildReport(data, filters(data, 'receivables'))
  assert.equal(report.rows.length, 0)
  assert.equal(formatReportINR(123456), '₹1,23,456')
})

test('report generation is read-only for source financial records', () => {
  const data = make()
  const snapshot = JSON.stringify(data)
  buildReport(data, filters(data, 'overview'))
  assert.equal(JSON.stringify(data), snapshot)
})
