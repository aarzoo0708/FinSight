import { parseSampleDate } from './paymentPrediction.js'
import { formatWorkspaceDate } from './formatters.js'

export function parseLocalDate(value) {
  return parseSampleDate(value)
}

export function formatInvoiceDate(date) {
  return formatWorkspaceDate(date)
}

