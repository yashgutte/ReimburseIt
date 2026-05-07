require("dotenv").config();
const nodemailer = require("nodemailer");

function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.MAIL_ENABLED !== "false",
  );
}

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * @returns {{ sent: boolean, skipped?: boolean, reason?: string, error?: string }}
 */
async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    console.log("not configured");
    return { sent: false, skipped: true, reason: "not_configured" };
  }
  try {
    const transporter = buildTransport();
    console.log("transporter", transporter);
    console.log("to", to);
    console.log("subject", subject);
    console.log("text", text);
    console.log("html", html);
    console.log("process.env.SMTP_FROM", process.env.SMTP_FROM);
    console.log("process.env.SMTP_USER", process.env.SMTP_USER);
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html: html || `<pre style="font-family:sans-serif">${escapeHtml(text)}</pre>`,
    });
    return { sent: true };
  } catch (err) {
    console.error("sendMail:", err.message);
    return { sent: false, error: err.message };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendLoginCredentialsEmail({
  to,
  recipientName,
  loginEmail,
  password,
  subject,
}) {
  const sub = subject || "Your reimbursement system login";
  const text = [
    `Hello ${recipientName || "there"},`,
    "",
    "Your account is ready. Use these credentials to sign in:",
    "",
    `Login (email): ${loginEmail}`,
    `Password: ${password}`,
    "",
    "Please sign in and change your password from your profile when possible.",
    "",
    "— ReimburseIt",
  ].join("\n");

  const html = `
    <p>Hello ${escapeHtml(recipientName || "there")},</p>
    <p>Your account is ready. Use these credentials to sign in:</p>
    <ul>
      <li><strong>Login (email):</strong> ${escapeHtml(loginEmail)}</li>
      <li><strong>Password:</strong> ${escapeHtml(password)}</li>
    </ul>
    <p>Please sign in and change your password from your profile when possible.</p>
    <p>— ReimburseIt</p>
  `;

  const result = await sendMail({ to, subject: sub, text, html });
  return { to, ...result };
}

async function sendExpenseSubmittedToEmployee({
  to,
  employeeName,
  expenseId,
  category,
  amount,
  currency,
}) {
  const subject = `Expense #${expenseId} submitted`;
  const text = [
    `Hello ${employeeName || "there"},`,
    "",
    `Your reimbursement request #${expenseId} was submitted successfully.`,
    `Category: ${category}`,
    `Amount: ${amount} ${currency}`,
    "",
    "You will be notified when it is approved or rejected.",
    "",
    "— ReimburseIt",
  ].join("\n");
  return sendMail({ to, subject, text });
}

async function sendExpensePendingForApprover({
  to,
  approverName,
  submitterName,
  expenseId,
  category,
  amount,
  currency,
}) {
  const subject = `Action required: expense #${expenseId}`;
  const text = [
    `Hello ${approverName || "there"},`,
    "",
    `${submitterName} submitted expense #${expenseId} for your approval.`,
    `Category: ${category}`,
    `Amount: ${amount} ${currency}`,
    "",
    "Please open the manager approvals dashboard to approve or reject.",
    "",
    "— ReimburseIt",
  ].join("\n");
  return sendMail({ to, subject, text });
}

async function sendExpenseDecisionToEmployee({
  to,
  employeeName,
  expenseId,
  decision,
  reason,
  category,
  amount,
  currency,
  approverName,
}) {
  const approved = decision === "approved";
  const subject = approved
    ? `Expense #${expenseId} approved`
    : `Expense #${expenseId} rejected`;
  const reasonLine =
    reason && String(reason).trim()
      ? `Approver note: ${String(reason).trim()}`
      : "No comment was provided.";
  const text = [
    `Hello ${employeeName || "there"},`,
    "",
    approved
      ? `Your expense request #${expenseId} has been fully approved.`
      : `Your expense request #${expenseId} was rejected.`,
    approverName ? `Decision by: ${approverName}` : "",
    `Category: ${category}`,
    `Amount: ${amount} ${currency}`,
    "",
    reasonLine,
    "",
    "— ReimburseIt",
  ]
    .filter(Boolean)
    .join("\n");
  return sendMail({ to, subject, text });
}

module.exports = {
  isMailConfigured,
  sendMail,
  sendLoginCredentialsEmail,
  sendExpenseSubmittedToEmployee,
  sendExpensePendingForApprover,
  sendExpenseDecisionToEmployee,
};
