import { demoBusiness, receivablesDemo } from '../data/demoData.js'
import { estimatePayment, parseSampleDate } from './paymentPrediction.js'

export function predictInvoice(invoice, asOf = parseSampleDate(demoBusiness.asOf.slice(0, 10))) {
  return estimatePayment(invoice, receivablesDemo.predictionModel, asOf)
}

export function parseLocalDate(value) {
  return parseSampleDate(value)
}

export function formatInvoiceDate(date) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function getOutstandingSummary(invoices, asOf) {
  const predictions = invoices.map((invoice) => ({ prediction: invoice.prediction ?? predictInvoice(invoice, asOf) }))
  return {
    totalOutstanding: invoices.reduce((total, invoice) => total + invoice.amount, 0),
    highRiskCount: predictions.filter(({ prediction }) => prediction.risk === 'high').length,
    overdueCount: predictions.filter(({ prediction }) => prediction.isOverdue).length,
  }
}
