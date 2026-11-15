export function estimatePayment(invoice, model, asOf) {
  const history = invoice.paymentHistory
  const invoicesPaid = Number.isFinite(history?.invoicesPaid) ? history.invoicesPaid : 0
  const paidLate = Number.isFinite(history?.paidLate) ? history.paidLate : 0
  const averageDaysLate = Number.isFinite(history?.averageDaysLate) ? history.averageDaysLate : 0
  const lateRate = invoicesPaid ? paidLate / invoicesPaid : 0
  let risk = invoicesPaid ? 'low' : 'unrated'
  if (invoicesPaid >= 3 && (lateRate >= model.highLateRate || averageDaysLate >= model.highAverageDelayDays)) risk = 'high'
  else if (invoicesPaid && (lateRate >= model.mediumLateRate || averageDaysLate >= model.mediumAverageDelayDays)) risk = 'medium'

  const predictedDelayDays = ['low', 'unrated'].includes(risk) ? 0 : Math.max(1, Math.round(averageDaysLate))
  const dueDateValue = String(invoice.dueDate ?? '')
  const dueDateParts = dueDateValue.split('-').map(Number)
  const parsedDueDate = parseSampleDate(dueDateValue)
  const hasReliableDueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateValue) && !Number.isNaN(parsedDueDate.getTime()) && parsedDueDate.getFullYear() === dueDateParts[0] && parsedDueDate.getMonth() === dueDateParts[1] - 1 && parsedDueDate.getDate() === dueDateParts[2]
  const dueDate = hasReliableDueDate ? parsedDueDate : null
  const expectedDate = new Date(dueDate)
  if (dueDate) expectedDate.setDate(expectedDate.getDate() + predictedDelayDays)
  const today = startOfDay(asOf)
  const isOverdue = Boolean(dueDate && dueDate < today)
  const status = isOverdue ? 'Overdue' : risk === 'high' ? 'Likely delayed' : risk === 'medium' ? 'Possible delay' : risk === 'unrated' ? 'Payment history unavailable' : 'On-time expected'
  const riskExplanation = risk === 'high'
    ? `High payment risk: Illustrative history records ${paidLate} late payments among ${invoicesPaid} invoices (${Math.round(lateRate * 100)}%), with an average ${averageDaysLate}-day delay. This meets the configured high-risk threshold; review the open balance and confirm expected timing with the customer.`
    : risk === 'medium'
      ? `Medium payment risk: Illustrative history records ${paidLate} late payments among ${invoicesPaid} invoices (${Math.round(lateRate * 100)}%), with an average ${averageDaysLate}-day delay. This meets a configured medium-risk threshold; allow for timing variance when planning receipt of the open balance.`
      : risk === 'low'
        ? `Low payment risk: Illustrative history records ${invoicesPaid - paidLate} payments not marked late among ${invoicesPaid} invoices, with an average ${averageDaysLate}-day delay. No configured medium or high threshold is met; continue monitoring the due date.`
        : 'Risk is unrated because no usable payment-history summary is available. The due date can support scheduling, but this record does not support a payment-risk classification.'

  return { risk, lateRate, predictedDelayDays, expectedDate: dueDate ? expectedDate : null, isOverdue, hasReliableDueDate, status, riskExplanation }
}

export function parseSampleDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function daysBetween(start, end) {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endDay - startDay) / 86400000)
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
