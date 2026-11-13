export function estimatePayment(invoice, model, asOf) {
  const { invoicesPaid, paidLate, averageDaysLate } = invoice.paymentHistory
  const lateRate = invoicesPaid ? paidLate / invoicesPaid : 0
  let risk = 'low'
  if (invoicesPaid >= 3 && (lateRate >= model.highLateRate || averageDaysLate >= model.highAverageDelayDays)) risk = 'high'
  else if (lateRate >= model.mediumLateRate || averageDaysLate >= model.mediumAverageDelayDays) risk = 'medium'

  const predictedDelayDays = risk === 'low' ? 0 : Math.max(1, Math.round(averageDaysLate))
  const dueDate = parseSampleDate(invoice.dueDate)
  const expectedDate = new Date(dueDate)
  expectedDate.setDate(expectedDate.getDate() + predictedDelayDays)
  const today = startOfDay(asOf)
  const isOverdue = dueDate < today
  const status = isOverdue ? 'Overdue' : risk === 'high' ? 'Likely delayed' : risk === 'medium' ? 'Possible delay' : 'On-time expected'
  const riskExplanation = risk === 'high'
    ? `High payment risk: This customer has paid ${paidLate} of its last ${invoicesPaid} invoices late, averaging ${averageDaysLate} days beyond terms.`
    : risk === 'medium'
      ? `Medium payment risk: ${paidLate} of ${invoicesPaid} previous invoices were late, with an average delay of ${averageDaysLate} days.`
      : `Low payment risk: ${invoicesPaid - paidLate} of ${invoicesPaid} previous invoices were paid on time, with an average delay of ${averageDaysLate} day${averageDaysLate === 1 ? '' : 's'}.`

  return { risk, lateRate, predictedDelayDays, expectedDate, isOverdue, status, riskExplanation }
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
