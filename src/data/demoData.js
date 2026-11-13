import { daysBetween, estimatePayment, parseSampleDate } from '../utils/paymentPrediction.js'

export const demoBusiness = {
  name: 'Nila Homeware',
  workspaceLabel: 'DEMO WORKSPACE',
  asOf: '2026-11-14T12:00:00+05:30',
}

export const receivablesDemo = {
  predictionModel: {
    highLateRate: 0.6,
    mediumLateRate: 0.3,
    highAverageDelayDays: 12,
    mediumAverageDelayDays: 5,
  },
  invoices: [
    {
      id: 'INV-1048', customer: 'Aarav Living', amount: 25000, issueDate: '2026-11-03', dueDate: '2026-11-18',
      paymentHistory: { invoicesPaid: 13, paidLate: 1, averageDaysLate: 1 },
    },
    {
      id: 'INV-1052', customer: 'Mira Studio', amount: 18000, issueDate: '2026-11-02', dueDate: '2026-11-23',
      paymentHistory: { invoicesPaid: 4, paidLate: 3, averageDaysLate: 13 },
    },
    {
      id: 'INV-1056', customer: 'House of Saanjh', amount: 20000, issueDate: '2026-11-08', dueDate: '2026-11-29',
      paymentHistory: { invoicesPaid: 6, paidLate: 2, averageDaysLate: 5 },
    },
    {
      id: 'INV-1061', customer: 'The Woven Room', amount: 17000, issueDate: '2026-11-10', dueDate: '2026-12-08',
      paymentHistory: { invoicesPaid: 5, paidLate: 2, averageDaysLate: 6 },
    },
    {
      id: 'INV-1064', customer: 'Indigo Nest', amount: 34500, issueDate: '2026-10-01', dueDate: '2026-11-01',
      paymentHistory: { invoicesPaid: 8, paidLate: 5, averageDaysLate: 45 },
    },
    {
      id: 'INV-1070', customer: 'Kora Craft', amount: 32000, issueDate: '2026-11-12', dueDate: '2026-12-20',
      paymentHistory: { invoicesPaid: 8, paidLate: 1, averageDaysLate: 2 },
    },
  ],
}

const asOfDate = parseSampleDate(demoBusiness.asOf.slice(0, 10))
const forecastHorizonDays = 30
const expectedInvoiceEvents = receivablesDemo.invoices.flatMap((invoice) => {
  const prediction = estimatePayment(invoice, receivablesDemo.predictionModel, asOfDate)
  const day = daysBetween(asOfDate, prediction.expectedDate)
  if (day < 1 || day > forecastHorizonDays) return []
  return [{
    day,
    type: 'inflow',
    amount: invoice.amount,
    label: `${invoice.customer} · invoice ${invoice.id.replace('INV-', '')}`,
    invoiceId: invoice.id,
    risk: prediction.risk,
  }]
})

const operatingEvents = [
  { day: 6, type: 'outflow', amount: 23000, category: 'operating', label: 'Materials & freight' },
  { day: 13, type: 'outflow', amount: 20000, category: 'operating', label: 'Workshop payroll' },
  { day: 17, type: 'outflow', amount: 28000, category: 'planned-purchase', label: 'Ceramic kiln instalment', risk: 'upcoming' },
  { day: 25, type: 'outflow', amount: 16000, category: 'operating', label: 'Materials & freight' },
  { day: 29, type: 'outflow', amount: 13000, category: 'operating', label: 'Studio rent & utilities' },
]

const cashFlowEvents = [...expectedInvoiceEvents, ...operatingEvents].sort((left, right) => left.day - right.day)
const highRiskInvoiceEvents = expectedInvoiceEvents.filter((event) => event.risk === 'high')
const plannedPurchaseEventIndex = cashFlowEvents.findIndex((event) => event.category === 'planned-purchase')

export const cashFlowDemo = {
  horizonDays: forecastHorizonDays,
  currentCash: 50000,
  events: cashFlowEvents,
  risks: [
    ...highRiskInvoiceEvents.map((event) => {
      const invoice = receivablesDemo.invoices.find((item) => item.id === event.invoiceId)
      return {
        id: `invoice-${invoice.id.replace('INV-', '').toLowerCase()}`,
        kind: 'high',
        title: `${invoice.customer} · Invoice ${invoice.id.replace('INV-', '')}`,
        amount: invoice.amount,
        dueInDays: daysBetween(asOfDate, parseSampleDate(invoice.dueDate)),
        detail: 'Payment history suggests this may arrive late.',
        eventIndex: cashFlowEvents.findIndex((item) => item.invoiceId === invoice.id),
      }
    }),
    {
      id: 'kiln-instalment',
      kind: 'upcoming',
      title: 'Ceramic kiln instalment',
      amount: operatingEvents.find((event) => event.category === 'planned-purchase').amount,
      dueInDays: operatingEvents.find((event) => event.category === 'planned-purchase').day,
      detail: 'A larger than usual expense is scheduled.',
      eventIndex: plannedPurchaseEventIndex,
    },
  ],
}
