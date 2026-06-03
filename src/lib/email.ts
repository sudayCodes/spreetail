import { Resend } from 'resend'

// Initialized lazily so build-time static analysis doesn't throw without the key
const FROM = 'Spreetail <onboarding@resend.dev>'
function getResend() {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendExpenseEditedEmail({
  to,
  editorName,
  expenseDescription,
  groupName,
  expenseUrl,
}: {
  to: string[]
  editorName: string
  expenseDescription: string
  groupName: string
  expenseUrl: string
}) {
  const resend = getResend()
  if (!to.length || !resend) return

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${editorName} edited "${expenseDescription}" in ${groupName}`,
    html: `
      <p>Hi,</p>
      <p><strong>${editorName}</strong> edited the expense <strong>"${expenseDescription}"</strong> in <strong>${groupName}</strong>.</p>
      <p><a href="${expenseUrl}">View the updated expense →</a></p>
      <p style="color:#888;font-size:12px">You received this because you are a member of ${groupName} on Spreetail.</p>
    `,
  }).catch(() => {})
}

export async function sendSettlementEmail({
  to,
  payerName,
  receiverName,
  amount,
  groupName,
  groupUrl,
}: {
  to: string[]
  payerName: string
  receiverName: string
  amount: number   // cents
  groupName: string
  groupUrl: string
}) {
  const resend = getResend()
  if (!to.length || !resend) return

  const display = `$${(amount / 100).toFixed(2)}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${payerName} paid ${receiverName} ${display} in ${groupName}`,
    html: `
      <p>Hi,</p>
      <p><strong>${payerName}</strong> recorded a payment of <strong>${display}</strong> to <strong>${receiverName}</strong> in <strong>${groupName}</strong>.</p>
      <p>If this is incorrect, open the group to review.</p>
      <p><a href="${groupUrl}">View group →</a></p>
      <p style="color:#888;font-size:12px">You received this because you are a member of ${groupName} on Spreetail.</p>
    `,
  }).catch(() => {})
}
