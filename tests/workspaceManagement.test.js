import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWorkspaceBackup, deleteCustomerRecord, deleteExpenseRecord, deleteInvoiceRecord, getDemoFinancialData, getFinancialData, importFinancialRecords, migrateFinancialData, recordExpensePayment, recordInvoicePayment, resetFinancialData, restoreWorkspaceBackup, saveCustomerRecord, saveExpenseRecord, saveInvoiceRecord, switchFinancialWorkspace, validateFinancialData, validateWorkspaceBackup,
} from '../src/data/financialStore.js'
import { calculateCashFlowAnalysis, calculateCustomerIntelligence, calculateExpenseIntelligence } from '../src/utils/financialServices.js'
import { simulateScenario, scenarioDateOffset } from '../src/utils/scenarioEngine.js'

function withStore(callback) {
  const originalWindow = globalThis.window
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  storage.set('finsight.financial-data.v1', JSON.stringify(getDemoFinancialData()))
  try { switchFinancialWorkspace('user'); return callback(storage) } finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow }
}

test('customer CRUD preserves stable IDs and blocks deletion with linked invoices', () => withStore(() => {
  let data = saveCustomerRecord({ name: 'New Shop', email: 'shop@example.com' })
  const created = data.customers.at(-1)
  assert.ok(created.id)
  data = saveCustomerRecord({ name: 'New Shop Ltd', companyName: 'New Shop', email: 'shop@example.com' }, created.id)
  assert.equal(data.customers.at(-1).id, created.id)
  data = saveInvoiceRecord({ customerId: created.id, amount: 500, issueDate: '2026-11-14', dueDate: '2026-11-20' })
  assert.throws(() => deleteCustomerRecord(created.id), /linked invoices/)
  assert.equal(calculateCustomerIntelligence(data).profiles.find((item) => item.id === created.id).invoiceCount, 1)
}))

test('invoice CRUD, partial/full payment, no overpayment, and remaining balances reconcile', () => withStore(() => {
  let data = saveCustomerRecord({ name: 'Billing Co' })
  const customerId = data.customers[0].id
  data = saveInvoiceRecord({ customerId, amount: 1000, issueDate: '2026-11-14', dueDate: '2026-11-30' })
  const invoice = data.invoices.at(-1)
  data = recordInvoicePayment(invoice.id, 250, '2026-11-15')
  assert.equal(calculateCustomerIntelligence(data).profiles.find((item) => item.id === invoice.customerId).outstanding, 750)
  assert.throws(() => recordInvoicePayment(invoice.id, 751, '2026-11-15'), /exceeds the outstanding/)
  data = recordInvoicePayment(invoice.id, 750, '2026-11-16')
  assert.equal(data.payments.filter((item) => item.invoiceId === invoice.id).reduce((sum, item) => sum + item.amount, 0), 1000)
  assert.throws(() => deleteInvoiceRecord(invoice.id), /payment history/)
  assert.equal(validateFinancialData(data), true)
}))

test('expense CRUD and full payment update cash forecasts and scenario baseline', () => withStore(() => {
  let data = saveExpenseRecord({ label: 'User utilities', category: 'operating', amount: 8000, dueDate: scenarioDateOffset(getFinancialData(), 10) })
  const expense = data.expenses.at(-1)
  const before = calculateCashFlowAnalysis(data, 30)
  assert.ok(before.events.some((event) => event.id === expense.id))
  data = saveExpenseRecord({ label: 'New utility label', category: 'operating', amount: 9000, dueDate: scenarioDateOffset(data, 12) }, expense.id)
  assert.equal(data.expenses.find((item) => item.id === expense.id).label, 'New utility label')
  data = recordExpensePayment(expense.id, scenarioDateOffset(data, 5))
  assert.equal(calculateExpenseIntelligence(data).records.find((item) => item.id === expense.id).isPaid, true)
  assert.ok(!calculateCashFlowAnalysis(data, 30).events.some((event) => event.id === expense.id))
  const after = simulateScenario(data, { type: 'purchase', name: 'test', description: 'Test', amount: 1, effectiveDate: scenarioDateOffset(data, 5) }, 30)
  assert.equal(after.openingCash, before.currentCash)
  assert.ok(after.events.some((event) => event.expenseId === expense.id && event.status === 'actual'))
  assert.throws(() => deleteExpenseRecord(expense.id), /linked financial transaction/)
  assert.throws(() => saveExpenseRecord({ label: 'Unsafe edit', category: 'operating', amount: 1, dueDate: scenarioDateOffset(data, 12) }, expense.id), /linked financial transaction/)
}))

test('CSV record import rejects invalid and duplicate rows without partial writes', () => withStore(() => {
  const initial = getFinancialData()
  const result = importFinancialRecords('customers', [{ name: 'Imported Shop', email: 'valid@example.com' }, { name: '', email: 'bad' }])
  assert.equal(result.imported, 0)
  assert.equal(result.errors.length, 1)
  assert.equal(getFinancialData().customers.length, initial.customers.length)
  const importedCustomer = importFinancialRecords('customers', [{ name: 'Imported Shop', email: 'valid@example.com' }])
  assert.equal(importedCustomer.imported, 1)
  const duplicated = importFinancialRecords('customers', [{ name: 'Imported Shop', email: 'valid@example.com' }])
  assert.equal(duplicated.errors.length, 1)
  const invoiceFields = { customerId: getFinancialData().customers[0].id, amount: 25000, issueDate: '2026-11-03', dueDate: '2026-11-18' }
  assert.equal(importFinancialRecords('invoices', [invoiceFields]).imported, 1)
  const duplicateInvoice = importFinancialRecords('invoices', [invoiceFields])
  assert.equal(duplicateInvoice.errors.length, 1)
  const good = importFinancialRecords('customers', [{ name: 'Another Shop', email: 'another@example.com' }])
  assert.equal(good.imported, 1)
  assert.equal(getFinancialData().customers.some((item) => item.email === 'another@example.com'), true)
}))

test('JSON backup validates schema and relationships and restores stable IDs', () => withStore(() => {
  const customer = saveCustomerRecord({ name: 'Backup customer' })
  saveInvoiceRecord({ customerId: customer.customers[0].id, amount: 100, issueDate: '2026-11-14', dueDate: '2026-11-30' })
  const backup = createWorkspaceBackup()
  assert.equal(validateWorkspaceBackup(backup).invoices[0].customerId, backup.data.invoices[0].customerId)
  const restored = restoreWorkspaceBackup(backup)
  assert.equal(restored.invoices[0].id, backup.data.invoices[0].id)
  const broken = structuredClone(backup)
  broken.data.invoices[0].customerId = 'missing-customer'
  assert.throws(() => restoreWorkspaceBackup(broken), /relationship validation/)
  assert.equal(getFinancialData().invoices[0].customerId, backup.data.invoices[0].customerId)
}))

test('schema v1 migrates; malformed stored records are preserved rather than reset', () => withStore((storage) => {
  const v1 = getDemoFinancialData(); v1.schemaVersion = 1; delete v1.business.currency
  const migrated = migrateFinancialData(v1)
  assert.equal(migrated.schemaVersion, 2)
  assert.equal(migrated.business.currency, 'INR')
  storage.set('finsight.financial-data.v1', '{broken json')
  getFinancialData()
  assert.equal(storage.get('finsight.financial-data.v1'), '{broken json')
}))

test('confirmed demo reset restores seed records and demo mode', () => withStore(() => {
  saveCustomerRecord({ name: 'User record' })
  const reset = resetFinancialData()
  assert.equal(reset.workspaceMode, 'demo')
  assert.equal(reset.customers.length, getDemoFinancialData().customers.length)
  assert.equal(switchFinancialWorkspace('user').customers[0].name, 'User record')
}))

test('demo and user workspace records stay isolated and demo writes are blocked', () => {
  const originalWindow = globalThis.window
  const storage = new Map()
  globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  try {
    const demo = getDemoFinancialData()
    storage.set('finsight.financial-data.v1', JSON.stringify(demo))
    assert.throws(() => saveCustomerRecord({ name: 'Should not be saved' }), /read-only/)
    assert.throws(() => saveInvoiceRecord({ customerId: 'cust-aarav-living', amount: 100, issueDate: '2026-11-14', dueDate: '2026-11-20' }), /read-only/)
    assert.throws(() => recordInvoicePayment('INV-1048', 1, '2026-11-15'), /read-only/)
    assert.throws(() => saveExpenseRecord({ label: 'Should not be saved', category: 'operating', amount: 10, dueDate: '2026-11-20' }), /read-only/)
    assert.throws(() => recordExpensePayment('EXP-MATERIALS-1', '2026-11-15'), /read-only/)
    assert.throws(() => importFinancialRecords('customers', [{ name: 'Should not be saved' }]), /read-only/)
    const user = switchFinancialWorkspace('user')
    assert.equal(user.customers.length, 0)
    assert.equal(user.invoices.length, 0)
    saveCustomerRecord({ name: 'Separate user record' })
    const reopenedDemo = switchFinancialWorkspace('demo')
    assert.equal(reopenedDemo.customers.length, demo.customers.length)
    assert.equal(reopenedDemo.invoices.length, demo.invoices.length)
    assert.equal(switchFinancialWorkspace('user').customers[0].name, 'Separate user record')
  } finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow }
})
