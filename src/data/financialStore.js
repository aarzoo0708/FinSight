import { estimatePayment, parseSampleDate, daysBetween } from '../utils/paymentPrediction.js'

export const STORAGE_KEY = 'finsight.financial-data.v1'
export const SCHEMA_VERSION = 2
export const BACKUP_VERSION = 1
const workspaceKey = (mode) => `${STORAGE_KEY}.${mode}`

const freshDemoData = () => ({
  schemaVersion: SCHEMA_VERSION,
  business: { id: 'business-nila-homeware', name: 'Nila Homeware', category: 'Homeware', currency: 'INR', fiscalStartMonth: 4, datePreference: 'DD MMM YYYY', workspaceLabel: 'DEMO WORKSPACE', asOf: '2026-11-14T12:00:00+05:30', currentCash: 50000 },
  predictionModel: { highLateRate: 0.6, mediumLateRate: 0.3, highAverageDelayDays: 12, mediumAverageDelayDays: 5 },
  customers: [
    ['cust-aarav-living','Aarav Living',{ invoicesPaid:13,paidLate:1,averageDaysLate:1 }],
    ['cust-mira-studio','Mira Studio',{ invoicesPaid:4,paidLate:3,averageDaysLate:13 }],
    ['cust-house-saanjh','House of Saanjh',{ invoicesPaid:6,paidLate:2,averageDaysLate:5 }],
    ['cust-woven-room','The Woven Room',{ invoicesPaid:5,paidLate:2,averageDaysLate:6 }],
    ['cust-indigo-nest','Indigo Nest',{ invoicesPaid:8,paidLate:5,averageDaysLate:45 }],
    ['cust-kora-craft','Kora Craft',{ invoicesPaid:8,paidLate:1,averageDaysLate:2 }],
  ].map(([id,name,paymentHistory])=>({id,name,paymentHistory})),
  invoices: [
    ['INV-1048','cust-aarav-living',25000,'2026-11-03','2026-11-18'],['INV-1052','cust-mira-studio',18000,'2026-11-02','2026-11-23'],['INV-1056','cust-house-saanjh',20000,'2026-11-08','2026-11-29'],['INV-1061','cust-woven-room',17000,'2026-11-10','2026-12-08'],['INV-1064','cust-indigo-nest',34500,'2026-10-01','2026-11-01'],['INV-1070','cust-kora-craft',32000,'2026-11-12','2026-12-20'],
  ].map(([id,customerId,amount,issueDate,dueDate])=>({id,customerId,amount,issueDate,dueDate,currency:'INR'})),
  payments: [],
  expenses: [
    {id:'EXP-MATERIALS-1',amount:23000,dueDate:'2026-11-20',category:'operating',label:'Materials & freight'},
    {id:'EXP-PAYROLL-1',amount:20000,dueDate:'2026-11-27',category:'operating',label:'Workshop payroll'},
    {id:'EXP-KILN-1',amount:28000,dueDate:'2026-12-01',category:'planned-purchase',label:'Ceramic kiln instalment'},
    {id:'EXP-MATERIALS-2',amount:16000,dueDate:'2026-12-09',category:'operating',label:'Materials & freight'},
    {id:'EXP-RENT-1',amount:13000,dueDate:'2026-12-13',category:'operating',label:'Studio rent & utilities'},
  ],
  transactions: [], scenarios: [], insights: [], workspaceMode: 'demo',
})

function freshUserData() {
  const data = freshDemoData()
  const now = new Date()
  data.business = { ...data.business, id: 'business-user-workspace', name: 'Your Business', category: '', workspaceLabel: 'YOUR WORKSPACE', asOf: now.toISOString(), currentCash: 0 }
  data.customers = []
  data.invoices = []
  data.payments = []
  data.expenses = []
  data.transactions = []
  data.scenarios = []
  data.insights = []
  data.workspaceMode = 'user'
  return data
}

export function isDemoWorkspace(data = getFinancialData()) { return data.workspaceMode !== 'user' }

function assertUserWorkspace(data) {
  if (data.workspaceMode !== 'user') throw new Error('Demo records are read-only. Open Settings & Data and start your own workspace to manage separate business records.')
}

export function validateFinancialData(value) {
  if (!(value?.schemaVersion === SCHEMA_VERSION && value.business && Array.isArray(value.customers) && Array.isArray(value.invoices) && Array.isArray(value.payments) && Array.isArray(value.expenses) && Array.isArray(value.transactions ?? []) && Array.isArray(value.scenarios ?? []) && Array.isArray(value.insights ?? []))) return false
  const uniqueIds = (records) => records.every((record) => typeof record.id === 'string' && Boolean(record.id.trim())) && new Set(records.map((record) => record.id)).size === records.length
  if (![value.customers, value.invoices, value.payments, value.expenses, value.transactions ?? [], value.scenarios ?? [], value.insights ?? []].every(uniqueIds)) return false
  const customerIds = new Set(value.customers.map(({ id }) => id))
  const invoiceIds = new Set(value.invoices.map(({ id }) => id))
  const expenseIds = new Set(value.expenses.map(({ id }) => id))
  const invoiceTotals = new Map()
  for (const payment of value.payments) invoiceTotals.set(payment.invoiceId, (invoiceTotals.get(payment.invoiceId) ?? 0) + Number(payment.amount))
  return value.invoices.every((invoice) => customerIds.has(invoice.customerId) && Number.isFinite(invoice.amount) && invoice.amount > 0 && isValidDateKey(invoice.issueDate) && isValidDateKey(invoice.dueDate) && (invoiceTotals.get(invoice.id) ?? 0) <= invoice.amount + 0.00001)
    && value.payments.every((payment) => invoiceIds.has(payment.invoiceId) && Number.isFinite(payment.amount) && payment.amount > 0 && isValidDateKey(payment.date) && (!payment.customerId || value.invoices.find((invoice) => invoice.id === payment.invoiceId)?.customerId === payment.customerId))
    && value.expenses.every((expense) => typeof expense.category === 'string' && Boolean(expense.category) && isValidDateKey(expense.dueDate) && Number.isFinite(expense.amount) && expense.amount > 0)
    && (value.transactions ?? []).every((transaction) => {
      const invoice = transaction.invoiceId ? value.invoices.find((item) => item.id === transaction.invoiceId) : null
      return (!transaction.invoiceId || invoiceIds.has(transaction.invoiceId)) && (!transaction.customerId || customerIds.has(transaction.customerId)) && (!invoice || !transaction.customerId || invoice.customerId === transaction.customerId) && (!transaction.expenseId || expenseIds.has(transaction.expenseId)) && Number.isFinite(Number(transaction.amount)) && (!transaction.date || isValidDateKey(transaction.date))
    })
    && typeof value.business.name === 'string' && Boolean(value.business.name.trim()) && Number.isFinite(Number(value.business.currentCash))
}

function isValidDateKey(value) {
  const key = String(value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const date = parseSampleDate(key)
  const [year, month, day] = key.split('-').map(Number)
  return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function migrateFinancialData(value) {
  if (!value || typeof value !== 'object') return null
  if (value.schemaVersion === SCHEMA_VERSION) return value
  if (value.schemaVersion !== 1) return null
  return {
    ...value,
    schemaVersion: SCHEMA_VERSION,
    business: { category: '', currency: 'INR', fiscalStartMonth: 4, datePreference: 'DD MMM YYYY', ...value.business },
    transactions: Array.isArray(value.transactions) ? value.transactions : [],
    scenarios: Array.isArray(value.scenarios) ? value.scenarios : [],
    insights: Array.isArray(value.insights) ? value.insights : [],
    workspaceMode: value.workspaceMode ?? 'demo',
  }
}

let storageError = ''
export function getFinancialStorageError() { return storageError }

export function getFinancialData() {
  if (typeof window === 'undefined') return freshDemoData()
  storageError = ''
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      const migrated = migrateFinancialData(parsed)
      if (validateFinancialData(migrated)) {
        if (migrated !== parsed) persistFinancialData(migrated)
        return migrated
      }
      storageError = 'Saved workspace data is invalid or uses an unsupported version. It has been preserved; export or restore a validated backup before replacing it.'
      return freshDemoData()
    }
  } catch (error) {
    storageError = 'Saved workspace data could not be read. It has been preserved; check browser storage or restore a validated backup.'
    return freshDemoData()
  }
  const initial = freshDemoData()
  persistFinancialData(initial)
  return initial
}

export function persistFinancialData(data, { force = false } = {}) {
  if (typeof window === 'undefined') return false
  if (storageError && !force) return false
  try {
    const serialized = JSON.stringify(data)
    window.localStorage.setItem(STORAGE_KEY, serialized)
    window.localStorage.setItem(workspaceKey(data.workspaceMode === 'user' ? 'user' : 'demo'), serialized)
    storageError = ''
    return true
  } catch { storageError = 'Workspace changes could not be saved to browser storage.'; return false }
}

export function switchFinancialWorkspace(mode) {
  if (!['demo', 'user'].includes(mode)) throw new Error('Choose the demo or user workspace.')
  const current = getFinancialData()
  if (storageError) throw new Error(storageError)
  if (typeof window === 'undefined') return mode === 'demo' ? freshDemoData() : freshUserData()
  try {
    window.localStorage.setItem(workspaceKey(current.workspaceMode === 'user' ? 'user' : 'demo'), JSON.stringify(current))
    let next
    const stored = window.localStorage.getItem(workspaceKey(mode))
    if (stored) {
      const parsed = JSON.parse(stored)
      next = migrateFinancialData(parsed)
      if (!validateFinancialData(next) || next.workspaceMode !== mode) throw new Error(`The saved ${mode} workspace is invalid. It was preserved and has not been replaced.`)
    } else next = mode === 'demo' ? freshDemoData() : freshUserData()
    if (!persistFinancialData(next, { force: true })) throw new Error(storageError || 'Workspace could not be activated.')
    return next
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`The saved ${mode} workspace could not be read. It was preserved.`)
    throw error
  }
}

export function syncInsightStatuses(data, generatedInsights) {
  const previous = new Map((Array.isArray(data.insights) ? data.insights : []).map((item) => [item.id, item]))
  const insights = generatedInsights.map((insight) => {
    const saved = previous.get(insight.id)
    const fingerprint = JSON.stringify({ severity: insight.severity, title: insight.title, detail: insight.detail, why: insight.why, related: insight.related, dates: insight.dates, supportingFigures: insight.supportingFigures })
    const changed = Boolean(saved?.fingerprint && saved.fingerprint !== fingerprint)
    const status = !saved || changed || (saved.status === 'resolved' && insight.severity === 'critical') ? 'open' : saved.status
    return { id: insight.id, status: ['open', 'reviewed', 'resolved'].includes(status) ? status : 'open', updatedAt: changed ? null : saved?.updatedAt ?? null, fingerprint }
  })
  const changed = JSON.stringify(data.insights ?? []) !== JSON.stringify(insights)
  if (changed) {
    const updated = { ...data, insights }
    persistFinancialData(updated)
    return updated
  }
  return data
}

export function updateInsightStatus(insightId, status) {
  if (!['open', 'reviewed', 'resolved'].includes(status)) throw new Error('Unsupported insight status.')
  const data = getFinancialData()
  if (!(data.insights ?? []).some((insight) => insight.id === insightId)) throw new Error('This insight is no longer active. Refresh the page to update the list.')
  data.insights = data.insights.map((insight) => insight.id === insightId ? { ...insight, status, updatedAt: new Date().toISOString() } : insight)
  if (!persistFinancialData(data)) throw new Error('The insight status could not be saved to browser storage.')
  return data
}

export function resetFinancialData() {
  const initial = freshDemoData()
  if (!persistFinancialData(initial, { force: true })) throw new Error(getFinancialStorageError() || 'Demo workspace could not be reset.')
  return initial
}

export function getDemoFinancialData() { return freshDemoData() }

function makeStableId(prefix, records) {
  const existing = new Set(records.map((item) => item.id))
  let id
  do { id = `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}` } while (existing.has(id))
  return id
}

function saveOrThrow(data, message) {
  if (!validateFinancialData(data)) throw new Error('The change would break workspace schema or record relationships and was not saved.')
  if (!persistFinancialData(data)) throw new Error(getFinancialStorageError() || message)
  return data
}

export function updateWorkspaceSettings(fields) {
  const data = getFinancialData()
  const name = String(fields.name ?? data.business.name).trim()
  const category = String(fields.category ?? '').trim()
  const fiscalStartMonth = Number(fields.fiscalStartMonth)
  const currency = String(fields.currency ?? 'INR').toUpperCase()
  const datePreference = String(fields.datePreference ?? 'DD MMM YYYY')
  if (!name) throw new Error('Enter a business display name.')
  if (!Number.isInteger(fiscalStartMonth) || fiscalStartMonth < 1 || fiscalStartMonth > 12) throw new Error('Choose a valid financial year start month.')
  if (!['INR', 'USD', 'EUR', 'GBP'].includes(currency)) throw new Error('Choose a supported display currency.')
  if (!['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(datePreference)) throw new Error('Choose a supported date display format.')
  data.business = { ...data.business, name, category, currency, fiscalStartMonth, datePreference }
  return saveOrThrow(data, 'Workspace settings could not be saved.')
}

function normalizeCustomer(fields) {
  const name = String(fields.name ?? '').trim()
  const companyName = String(fields.companyName ?? '').trim()
  const email = String(fields.email ?? '').trim()
  const phone = String(fields.phone ?? '').trim()
  if (!name) throw new Error('Customer name is required.')
  if (name.length > 120 || companyName.length > 120 || email.length > 160 || phone.length > 50) throw new Error('Customer fields exceed the supported length.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid customer email address.')
  return { name, ...(companyName ? { companyName } : {}), ...(email ? { email } : {}), ...(phone ? { phone } : {}) }
}

export function saveCustomerRecord(fields, customerId = null) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  const normalized = normalizeCustomer(fields)
  const duplicate = data.customers.find((customer) => customer.id !== customerId && ((normalized.email && customer.email?.toLowerCase() === normalized.email.toLowerCase()) || customer.name.toLowerCase() === normalized.name.toLowerCase()))
  if (duplicate) throw new Error(`A customer with this name or email already exists (${duplicate.id}).`)
  if (customerId) {
    const index = data.customers.findIndex((item) => item.id === customerId)
    if (index < 0) throw new Error('Customer not found. Refresh and try again.')
    data.customers[index] = { ...data.customers[index], ...normalized, id: customerId, recordSource: 'user-edited' }
  } else {
    const id = fields.id ? String(fields.id).trim() : makeStableId('CUST', data.customers)
    if (!id || data.customers.some((customer) => customer.id === id)) throw new Error('Customer ID is invalid or already exists.')
    data.customers.push({ id, ...normalized, paymentHistory: null, recordSource: 'user' })
  }
  return saveOrThrow(data, 'Customer could not be saved.')
}

export function deleteCustomerRecord(customerId) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  if (!data.customers.some((customer) => customer.id === customerId)) throw new Error('Customer not found.')
  const blockers = [
    data.invoices.some((invoice) => invoice.customerId === customerId) && 'linked invoices',
    data.transactions.some((transaction) => transaction.customerId === customerId) && 'linked transactions',
    (data.scenarios ?? []).some((scenario) => scenario.assumptions?.customerId === customerId) && 'saved scenarios',
  ].filter(Boolean)
  if (blockers.length) throw new Error(`This customer has ${blockers.join(', ')}. Resolve those relationships before deleting the customer.`)
  data.customers = data.customers.filter((customer) => customer.id !== customerId)
  return saveOrThrow(data, 'Customer could not be deleted.')
}

function normalizeInvoice(fields, data) {
  const customerId = String(fields.customerId ?? '').trim()
  const amount = Number(fields.amount)
  const issueDate = String(fields.issueDate ?? '').trim()
  const dueDate = String(fields.dueDate ?? '').trim()
  if (!data.customers.some((customer) => customer.id === customerId)) throw new Error('Choose an existing customer for this invoice.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invoice amount must be greater than zero.')
  if (!isValidDateKey(issueDate) || !isValidDateKey(dueDate)) throw new Error('Enter valid issue and due dates.')
  if (dueDate < issueDate) throw new Error('Due date cannot be before issue date.')
  return { customerId, amount, issueDate, dueDate, currency: data.business.currency ?? 'INR' }
}

export function saveInvoiceRecord(fields, invoiceId = null) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  const normalized = normalizeInvoice(fields, data)
  if (invoiceId) {
    const index = data.invoices.findIndex((invoice) => invoice.id === invoiceId)
    if (index < 0) throw new Error('Invoice not found. Refresh and try again.')
    const paid = data.payments.filter((payment) => payment.invoiceId === invoiceId).reduce((sum, payment) => sum + payment.amount, 0)
    if (data.invoices[index].customerId !== normalized.customerId && (paid > 0 || data.transactions.some((transaction) => transaction.invoiceId === invoiceId))) throw new Error('Customer cannot be changed after an invoice has linked payment or transaction history.')
    if (normalized.amount < paid) throw new Error(`Invoice amount cannot be below ${paid} already received.`)
    data.invoices[index] = { ...data.invoices[index], ...normalized, id: invoiceId, recordSource: 'user-edited' }
  } else {
    const id = fields.id ? String(fields.id).trim() : makeStableId('INV', data.invoices)
    if (!id || data.invoices.some((invoice) => invoice.id === id)) throw new Error('Invoice ID is invalid or already exists.')
    data.invoices.push({ id, ...normalized, recordSource: 'user' })
  }
  return saveOrThrow(data, 'Invoice could not be saved.')
}

export function deleteInvoiceRecord(invoiceId) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  if (data.payments.some((payment) => payment.invoiceId === invoiceId)) throw new Error('This invoice has payment history. Keep it for reconciliation; delete is unavailable.')
  if (data.transactions.some((transaction) => transaction.invoiceId === invoiceId)) throw new Error('This invoice has linked transactions. Resolve those links before deletion.')
  if (!data.invoices.some((invoice) => invoice.id === invoiceId)) throw new Error('Invoice not found.')
  data.invoices = data.invoices.filter((invoice) => invoice.id !== invoiceId)
  return saveOrThrow(data, 'Invoice could not be deleted.')
}

export function recordInvoicePayment(invoiceId, amount, date = new Date().toISOString().slice(0, 10)) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  const invoice = data.invoices.find((item) => item.id === invoiceId)
  if (!invoice) throw new Error('Invoice not found.')
  const alreadyPaid = data.payments.filter((payment) => payment.invoiceId === invoiceId).reduce((sum, payment) => sum + payment.amount, 0)
  const remaining = Math.max(0, invoice.amount - alreadyPaid)
  const paymentAmount = Number(amount)
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Payment amount must be greater than zero.')
  if (paymentAmount > remaining + 0.00001) throw new Error(`Payment exceeds the outstanding balance of ${remaining}.`)
  if (!isValidDateKey(date)) throw new Error('Enter a valid payment date.')
  data.payments.push({ id: makeStableId('PAY', data.payments), invoiceId, customerId: invoice.customerId, amount: paymentAmount, date, recordSource: 'user' })
  return saveOrThrow(data, 'Payment could not be recorded.')
}

export function recordExpensePayment(expenseId, date = new Date().toISOString().slice(0, 10)) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  const expense = data.expenses.find((item) => item.id === expenseId)
  if (!expense) throw new Error('Expense not found.')
  if (data.transactions.some((transaction) => transaction.expenseId === expenseId || transaction.sourceExpenseId === expenseId)) throw new Error('A transaction is already linked to this expense.')
  if (!isValidDateKey(date)) throw new Error('Enter a valid payment date.')
  const transaction = { id: makeStableId('TX', data.transactions), expenseId, date, amount: expense.amount, type: 'outflow', category: expense.category, description: expense.label, recordSource: 'user' }
  data.transactions.push(transaction)
  data.expenses = data.expenses.map((item) => item.id === expenseId ? { ...item, paymentStatus: 'paid' } : item)
  return saveOrThrow(data, 'Expense payment could not be recorded.')
}

export function createWorkspaceBackup(data = getFinancialData()) {
  return { backupVersion: BACKUP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: structuredClone(data) }
}

export function validateWorkspaceBackup(backup) {
  if (backup?.backupVersion !== BACKUP_VERSION || ![1, SCHEMA_VERSION].includes(backup?.schemaVersion)) throw new Error('Backup version is unsupported.')
  const migrated = migrateFinancialData(backup.data)
  if (!validateFinancialData(migrated)) throw new Error('Backup data failed schema or relationship validation. Existing workspace data was not changed.')
  return migrated
}

export function restoreWorkspaceBackup(backup) {
  const restored = validateWorkspaceBackup(backup)
  restored.workspaceMode = 'user'
  if (!persistFinancialData(restored, { force: true })) throw new Error(getFinancialStorageError() || 'Backup could not be restored.')
  return restored
}

export function importFinancialRecords(type, records) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  if (!['customers', 'invoices', 'expenses'].includes(type) || !Array.isArray(records)) throw new Error('Choose customers, invoices, or expenses for import.')
  const ids = new Set(data[type].map((item) => item.id))
  const errors = []
  const normalized = []
  records.forEach((fields, index) => {
    try {
      if (type === 'customers') {
        const record = normalizeCustomer(fields)
        if (data.customers.some((item) => item.name.toLowerCase() === record.name.toLowerCase() || (record.email && item.email?.toLowerCase() === record.email.toLowerCase())) || normalized.some((item) => item.name.toLowerCase() === record.name.toLowerCase() || (record.email && item.email?.toLowerCase() === record.email.toLowerCase()))) throw new Error('Duplicate customer name or email.')
        const id = fields.id ? String(fields.id).trim() : makeStableId('CUST', [...data.customers, ...normalized])
        if (!id || ids.has(id)) throw new Error('Duplicate customer ID.')
        ids.add(id); normalized.push({ id, ...record, paymentHistory: null, recordSource: 'user' })
      } else if (type === 'invoices') {
        const record = normalizeInvoice(fields, data)
        const duplicateInvoice = (item) => item.customerId === record.customerId && item.amount === record.amount && item.issueDate === record.issueDate && item.dueDate === record.dueDate
        if (data.invoices.some(duplicateInvoice) || normalized.some(duplicateInvoice)) throw new Error('Duplicate invoice with matching customer, amount, issue date, and due date.')
        const id = fields.id ? String(fields.id).trim() : makeStableId('INV', [...data.invoices, ...normalized])
        if (!id || ids.has(id)) throw new Error('Duplicate invoice ID.')
        ids.add(id); normalized.push({ id, ...record, recordSource: 'user' })
      } else {
        const record = normalizeExpenseFields(fields)
        const id = fields.id ? String(fields.id).trim() : makeStableId('EXP', [...data.expenses, ...normalized])
        const duplicateExpense = (item) => item.label.toLowerCase() === record.label.toLowerCase() && item.dueDate === record.dueDate && item.amount === record.amount
        if (!id || ids.has(id) || data.expenses.some(duplicateExpense) || normalized.some(duplicateExpense)) throw new Error('Duplicate expense ID or matching description, date, and amount.')
        ids.add(id); normalized.push({ id, ...record, recordSource: 'user' })
      }
    } catch (error) { errors.push({ row: index + 2, message: error.message }) }
  })
  if (errors.length) return { data, imported: 0, errors }
  data[type].push(...normalized)
  return { data: saveOrThrow(data, 'Imported records could not be saved.'), imported: normalized.length, errors: [] }
}

function normalizeExpenseFields(fields) {
  const label = String(fields.label ?? '').trim()
  const category = String(fields.category ?? '').trim()
  const dueDate = String(fields.dueDate ?? '').trim()
  const amount = Number(fields.amount)
  if (!label) throw new Error('Enter an expense description.')
  if (!category) throw new Error('Select an expense category.')
  const dateParts = dueDate.split('-').map(Number)
  const parsedDate = parseSampleDate(dueDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.getFullYear() !== dateParts[0] || parsedDate.getMonth() !== dateParts[1] - 1 || parsedDate.getDate() !== dateParts[2]) throw new Error('Enter a valid due date.')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.')
  return { label, category, dueDate, amount }
}

function createExpenseId(data) {
  const existingIds = new Set(data.expenses.map((expense) => expense.id))
  let id
  do {
    const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    id = `EXP-${suffix}`
  } while (existingIds.has(id))
  return id
}

export function saveExpenseRecord(fields, expenseId = null) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  const normalized = normalizeExpenseFields(fields)
  if (expenseId) {
    const index = data.expenses.findIndex((expense) => expense.id === expenseId)
    if (index < 0) throw new Error('That expense could not be found. Refresh and try again.')
    if (data.transactions.some((transaction) => transaction.expenseId === expenseId || transaction.sourceExpenseId === expenseId)) throw new Error('This expense has a linked financial transaction. Edit the transaction and expense together to avoid mismatched records.')
    data.expenses[index] = { ...data.expenses[index], ...normalized, id: expenseId, recordSource: 'user-edited' }
  } else {
    data.expenses.push({ id: createExpenseId(data), ...normalized, recordSource: 'user' })
  }
  if (!persistFinancialData(data)) throw new Error('The expense could not be saved to browser storage.')
  return data
}

export function deleteExpenseRecord(expenseId) {
  const data = getFinancialData()
  assertUserWorkspace(data)
  if (!data.expenses.some((expense) => expense.id === expenseId)) throw new Error('That expense could not be found. Refresh and try again.')
  if (data.transactions.some((transaction) => transaction.expenseId === expenseId || transaction.sourceExpenseId === expenseId)) throw new Error('This expense has a linked financial transaction. Remove or reconcile that transaction before deleting the expense.')
  data.expenses = data.expenses.filter((expense) => expense.id !== expenseId)
  if (!persistFinancialData(data)) throw new Error('The expense could not be deleted from browser storage.')
  return data
}

function createScenarioId(data) {
  const existingIds = new Set((data.scenarios ?? []).map((scenario) => scenario.id))
  let id
  do {
    const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
    id = `SCN-${suffix}`
  } while (existingIds.has(id))
  return id
}

export function saveScenarioRecord(scenario, scenarioId = null) {
  const data = getFinancialData()
  const now = new Date().toISOString()
  const normalized = {
    name: String(scenario.name ?? '').trim(),
    description: String(scenario.description ?? '').trim(),
    type: String(scenario.type ?? ''),
    assumptions: structuredClone(scenario.assumptions ?? scenario),
    horizonDays: Number(scenario.horizonDays ?? 30),
    baselineFingerprint: String(scenario.baselineFingerprint ?? ''),
    version: 1,
  }
  if (!normalized.name || !normalized.type || !Number.isFinite(normalized.horizonDays)) throw new Error('Enter a name and valid scenario assumptions before saving.')
  if (!Array.isArray(data.scenarios)) data.scenarios = []
  let saved
  if (scenarioId) {
    const index = data.scenarios.findIndex((item) => item.id === scenarioId)
    if (index < 0) throw new Error('That saved scenario could not be found. Refresh and try again.')
    saved = { ...data.scenarios[index], ...normalized, id: scenarioId, createdAt: data.scenarios[index].createdAt, updatedAt: now }
    data.scenarios[index] = saved
  } else {
    saved = { ...normalized, id: createScenarioId(data), createdAt: now, updatedAt: now }
    data.scenarios.push(saved)
  }
  if (!persistFinancialData(data)) throw new Error('The scenario could not be saved to browser storage.')
  return { data, scenario: saved }
}

export function deleteScenarioRecord(scenarioId) {
  const data = getFinancialData()
  if (!Array.isArray(data.scenarios) || !data.scenarios.some((scenario) => scenario.id === scenarioId)) throw new Error('That saved scenario could not be found. Refresh and try again.')
  data.scenarios = data.scenarios.filter((scenario) => scenario.id !== scenarioId)
  if (!persistFinancialData(data)) throw new Error('The scenario could not be deleted from browser storage.')
  return data
}

export function getCustomerPaymentStatistics(data = getFinancialData()) {
  return data.customers.map((customer) => {
    const history = customer.paymentHistory ?? { invoicesPaid: 0, paidLate: 0, averageDaysLate: 0 }
    return { customerId: customer.id, ...history, lateRate: history.invoicesPaid ? history.paidLate / history.invoicesPaid : 0 }
  })
}

function uniqueByStableId(records) {
  const seen = new Set()
  return records.filter((record) => {
    if (!record.id) return true
    if (seen.has(record.id)) return false
    seen.add(record.id)
    return true
  })
}

export function getInvoiceRiskIndicators(data = getFinancialData()) {
  const customers = new Map(data.customers.map((customer) => [customer.id, customer]))
  const payments = uniqueByStableId(data.payments)
  const paymentsByInvoice = payments.reduce((map, payment) => map.set(payment.invoiceId, [...(map.get(payment.invoiceId) ?? []), payment]), new Map())
  const asOf = parseSampleDate(data.business.asOf.slice(0, 10))
  return data.invoices.map((invoice) => {
    const customer = customers.get(invoice.customerId)
    if (!customer) throw new Error(`Invoice ${invoice.id} references missing customer ${invoice.customerId}`)
    const paidAmount = (paymentsByInvoice.get(invoice.id) ?? []).reduce((total, payment) => total + payment.amount, 0)
    const remainingAmount = Math.max(0, invoice.amount - paidAmount)
    const prediction = estimatePayment({ ...invoice, paymentHistory: customer.paymentHistory ?? { invoicesPaid: 0, paidLate: 0, averageDaysLate: 0 } }, data.predictionModel, asOf)
    return { ...invoice, customerId: customer.id, customer: customer.name, paymentHistory: customer.paymentHistory ?? null, paidAmount, remainingAmount, prediction }
  })
}

export function getFinancialTransactions(data = getFinancialData()) {
  const actual = uniqueByStableId(data.transactions).map((transaction) => ({ ...transaction, status: 'actual' }))
  const linkedPaymentIds = new Set(data.transactions.flatMap((transaction) => [transaction.paymentId, transaction.sourcePaymentId].filter(Boolean)))
  const transactionPaymentCounts = uniqueByStableId(data.transactions).reduce((counts, transaction) => {
    if (!transaction.paymentId && !transaction.sourcePaymentId && transaction.type === 'inflow' && transaction.invoiceId && transaction.date && Number.isFinite(transaction.amount)) {
      const key = `${transaction.invoiceId}|${String(transaction.date).slice(0, 10)}|${transaction.amount}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, new Map())
  const payments = uniqueByStableId(data.payments).flatMap((payment) => {
    const key = `${payment.invoiceId}|${String(payment.date ?? '').slice(0, 10)}|${payment.amount}`
    const matchingTransactions = transactionPaymentCounts.get(key) ?? 0
    if (linkedPaymentIds.has(payment.id)) return []
    if (payment.date && matchingTransactions > 0) {
      transactionPaymentCounts.set(key, matchingTransactions - 1)
      return []
    }
    return [{ id: payment.id, date: payment.date, amount: payment.amount, type: 'inflow', category: 'customer-payment', invoiceId: payment.invoiceId, status: 'actual' }]
  })
  const expenses = data.expenses.filter((expense) => !['paid', 'settled'].includes(String(expense.paymentStatus ?? expense.status ?? '').toLowerCase()) && !data.transactions.some((transaction) => transaction.expenseId === expense.id || transaction.sourceExpenseId === expense.id)).map((expense) => ({ id: expense.id, date: expense.dueDate, amount: expense.amount, type: 'outflow', category: expense.category, label: expense.label, status: 'expected' }))
  const expenseTransactions = actual.map((transaction) => {
    if (!transaction.expenseId && !transaction.sourceExpenseId) return transaction
    const expenseId = transaction.expenseId ?? transaction.sourceExpenseId
    return { ...transaction, amount: Number(transaction.amount) || data.expenses.find((expense) => expense.id === expenseId)?.amount || 0, status: 'actual', type: transaction.type || 'outflow' }
  })
  return [...expenseTransactions, ...payments, ...expenses]
}

export function getExpectedInvoiceEvents(data = getFinancialData(), horizonDays = 30) {
  return getInvoiceRiskIndicators(data).flatMap((invoice) => {
    if (!invoice.remainingAmount || !invoice.prediction.expectedDate) return []
    const day = daysBetween(parseSampleDate(data.business.asOf.slice(0, 10)), invoice.prediction.expectedDate)
    if (day < 1 || day > horizonDays) return []
    return [{ id: `forecast-${invoice.id}`, day, date: invoice.prediction.expectedDate, type: 'inflow', amount: invoice.remainingAmount, label: `${invoice.customer} · invoice ${invoice.id.replace('INV-', '')}`, invoiceId: invoice.id, customerId: invoice.customerId, risk: invoice.prediction.risk, expectedDate: invoice.prediction.expectedDate }]
  })
}

export function createCashFlowModel(data = getFinancialData(), horizonDays = 30) {
  const asOf = parseSampleDate(data.business.asOf.slice(0, 10))
  const expenses = data.expenses.filter((expense) => !['paid', 'settled'].includes(String(expense.paymentStatus ?? expense.status ?? '').toLowerCase()) && !data.transactions.some((transaction) => transaction.expenseId === expense.id || transaction.sourceExpenseId === expense.id)).map((expense) => {
    const day = daysBetween(asOf, parseSampleDate(expense.dueDate))
    return { id: expense.id, day, date: parseSampleDate(expense.dueDate), type: 'outflow', amount: expense.amount, category: expense.category, label: expense.label }
  }).filter((event) => event.day > 0 && event.day <= horizonDays)
  const actualEvents = getFinancialTransactions(data).filter((event) => event.status === 'actual' && ['inflow', 'outflow'].includes(event.type) && isValidDateKey(event.date)).flatMap((event) => {
    const date = parseSampleDate(String(event.date).slice(0, 10))
    const day = daysBetween(asOf, date)
    return day > 0 && day <= horizonDays ? [{ id: `actual-${event.id}`, day, date, type: event.type, amount: Number(event.amount), category: event.category ?? 'actual', label: event.label ?? event.description ?? event.id, invoiceId: event.invoiceId, customerId: event.customerId, expenseId: event.expenseId ?? event.sourceExpenseId, status: 'actual' }] : []
  })
  const events = [...getExpectedInvoiceEvents(data, horizonDays), ...expenses.filter((event) => !data.transactions.some((transaction) => (transaction.expenseId === event.id || transaction.sourceExpenseId === event.id) && transaction.date && isValidDateKey(transaction.date) && parseSampleDate(String(transaction.date).slice(0, 10)) <= asOf)), ...actualEvents].sort((a,b)=>a.day-b.day)
  const paid = uniqueByStableId(data.payments).reduce((total,payment)=>total+payment.amount,0)
  const invoiceRisks = getInvoiceRiskIndicators(data).filter((invoice)=>invoice.prediction.risk==='high').map((invoice)=>({id:`invoice-${invoice.id.toLowerCase()}`,invoiceId:invoice.id,kind:'high',title:`${invoice.customer} · Invoice ${invoice.id.replace('INV-','')}`,amount:invoice.remainingAmount,expectedDate:invoice.prediction.expectedDate,detail:invoice.prediction.riskExplanation}))
  const plannedPurchase = data.expenses.find((expense) => expense.category === 'planned-purchase' && daysBetween(asOf, parseSampleDate(expense.dueDate)) > 0 && daysBetween(asOf, parseSampleDate(expense.dueDate)) <= horizonDays && !['paid', 'settled'].includes(String(expense.paymentStatus ?? expense.status ?? '').toLowerCase()) && !data.transactions.some((transaction) => transaction.expenseId === expense.id || transaction.sourceExpenseId === expense.id))
  const risks = [...invoiceRisks]
  if (plannedPurchase) risks.push({ id: plannedPurchase.id.toLowerCase(), kind: 'upcoming', title: plannedPurchase.label, amount: plannedPurchase.amount, expectedDate: parseSampleDate(plannedPurchase.dueDate), detail: 'A larger than usual expense is scheduled.' })
  return { horizonDays, currentCash: data.business.currentCash, events, risks, paidToDate: paid }
}
