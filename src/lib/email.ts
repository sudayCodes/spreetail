import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
// Use onboarding@resend.dev until a custom domain is verified in Resend dashboard
const FROM = 'Spreetail <onboarding@resend.dev>'

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
  if (!to.length || !process.env.RESEND_API_KEY) return

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
  }).catch(() => {}) // never block the main flow on email failure
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
  if (!to.length || !process.env.RESEND_API_KEY) return

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
