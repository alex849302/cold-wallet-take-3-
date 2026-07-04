// Transactional email via SMTP (nodemailer). Configured from env (see config.js).
// In dev this is typically Gmail SMTP with an App Password.
import nodemailer from 'nodemailer';
import { config } from '../config.js';

let _transport = null;

// True only when SMTP is actually configured. Lets callers degrade gracefully
// (e.g. log the reset link instead of throwing) when email isn't set up yet.
export function isMailEnabled() {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

// Lazily build (and cache) the transport so importing this file never connects.
function getTransport() {
  if (!isMailEnabled()) {
    throw new Error('SMTP is not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS in .env).');
  }
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      // 587 → STARTTLS (secure:false + upgrade), 465 → implicit TLS.
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return _transport;
}

// Send the password-reset email with a one-time link. Throws if SMTP fails.
export async function sendPasswordResetEmail(to, resetLink) {
  const transport = getTransport();
  const from = `CoreCold <${config.smtp.from}>`;

  const text =
    `We received a request to reset your CoreCold password.\n\n` +
    `Reset it here (link expires in 1 hour):\n${resetLink}\n\n` +
    `If you didn't request this, you can safely ignore this email.`;

  const html = `
    <div style="background:#08090A;padding:32px;font-family:Inter,Arial,sans-serif;color:#EAECEF">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#0E0E11;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 28px 8px">
          <h1 style="margin:0;font-size:20px;color:#fff">Core<span style="color:#00E676">Cold</span></h1>
          <p style="margin:4px 0 0;font-size:12px;color:#8B9099">Secure Cold Wallet</p>
        </td></tr>
        <tr><td style="padding:8px 28px 0">
          <h2 style="font-size:18px;color:#fff;margin:16px 0 8px">Reset your password</h2>
          <p style="font-size:14px;line-height:1.6;color:#B7BDC6;margin:0 0 24px">
            We received a request to reset your CoreCold password. Click the button below to choose a new one. This link expires in 1 hour.
          </p>
          <a href="${resetLink}" style="display:inline-block;background:#00E676;color:#08090A;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px">Reset Password</a>
          <p style="font-size:12px;color:#8B9099;margin:24px 0 0">Or paste this link into your browser:</p>
          <p style="font-size:12px;color:#00E676;word-break:break-all;margin:4px 0 0">${resetLink}</p>
        </td></tr>
        <tr><td style="padding:24px 28px 28px">
          <p style="font-size:12px;color:#474D57;margin:0;border-top:1px solid rgba(255,255,255,.06);padding-top:16px">
            If you didn't request this, you can safely ignore this email — your password won't change.
          </p>
        </td></tr>
      </table>
    </div>`;

  return transport.sendMail({
    from,
    to,
    subject: 'Reset your CoreCold password',
    text,
    html,
  });
}

/* ── Admin operational alerts ──────────────────────────────────────────────────
   Immediate emails to ADMIN_NOTIFICATION_EMAIL for events the admin must act on
   (new support messages, withdrawal requests, deposits, transfers, …). Designed
   as a generic builder + sender so every event type reuses the same path. */

// True only when SMTP is configured AND a destination address is set.
export function isAdminNotifyEnabled() {
  return isMailEnabled() && Boolean(config.adminNotificationEmail);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Pure: build the email payload (exported so it's unit-testable without sending).
export function buildAdminAlertEmail({ subject, title, rows = [] }) {
  const text = `${title}\n\n` + rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const rowHtml = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#8B9099;font-size:12px;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td>` +
    `<td style="padding:6px 0;color:#EAECEF;font-size:13px;word-break:break-word">${escapeHtml(v)}</td></tr>`).join('');
  const html = `
    <div style="background:#08090A;padding:32px;font-family:Inter,Arial,sans-serif;color:#EAECEF">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#0E0E11;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden">
        <tr><td style="padding:24px 28px 4px">
          <h1 style="margin:0;font-size:18px;color:#fff">Core<span style="color:#00E676">Cold</span> <span style="color:#FFB300;font-size:12px;font-weight:600">ADMIN</span></h1>
          <h2 style="font-size:17px;color:#fff;margin:14px 0 4px">${escapeHtml(title)}</h2>
        </td></tr>
        <tr><td style="padding:8px 28px 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table>
        </td></tr>
      </table>
    </div>`;
  return {
    from: `CoreCold <${config.smtp.from}>`,
    to: config.adminNotificationEmail,
    subject,
    text,
    html,
  };
}

// Send a generic admin alert. Returns false (no throw) when alerts are disabled.
export async function sendAdminAlert(opts) {
  if (!isAdminNotifyEnabled()) return false;
  await getTransport().sendMail(buildAdminAlertEmail(opts));
  return true;
}

// Event #4 — a user posted a new support chat message.
export function notifyAdminNewSupportMessage({ userEmail, text, when = new Date() }) {
  return sendAdminAlert({
    subject: `New support message from ${userEmail || 'a user'}`,
    title: 'New Support Chat Message',
    rows: [
      ['User', userEmail || '—'],
      ['Time', when.toISOString()],
      ['Message', text],
    ],
  });
}

const DEPOSIT_UNIT  = { btc: 'BTC', eth: 'ETH', sol: 'SOL', tron: 'TRX', usdt_trc20: 'USDT', usdt_erc20: 'USDT' };
const DEPOSIT_LABEL = { btc: 'Bitcoin', eth: 'Ethereum', sol: 'Solana', tron: 'TRON', usdt_trc20: 'USDT (TRC-20)', usdt_erc20: 'USDT (ERC-20)' };
export const assetUnit = (assetId) => DEPOSIT_UNIT[assetId] || String(assetId).toUpperCase();

// Event #1 — a deposit was detected on a user's on-chain address.
export function notifyAdminDeposit({ userEmail, userName, asset, amount, address, when = new Date() }) {
  const unit = DEPOSIT_UNIT[asset] || asset.toUpperCase();
  return sendAdminAlert({
    subject: `Deposit detected — ${amount} ${unit} for ${userName || userEmail || 'a user'}`,
    title: 'Deposit Detected',
    rows: [
      ['User', `${userName || ''} ${userEmail ? `<${userEmail}>` : ''}`.trim() || '—'],
      ['Asset', DEPOSIT_LABEL[asset] || asset],
      ['Amount', `${amount} ${unit}`],
      ['Address', address || '—'],
      ['Time', when.toISOString()],
    ],
  });
}

/* ── User-facing notifications ─────────────────────────────────────────────── */

// Generic branded email to a specific USER address. Returns false if SMTP is off
// or no recipient is given (callers stay best-effort).
export async function sendUserEmail({ to, subject, title, intro, rows = [] }) {
  if (!isMailEnabled() || !to) return false;
  const rowHtml = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#8B9099;font-size:12px;white-space:nowrap">${escapeHtml(k)}</td>` +
    `<td style="padding:6px 0;color:#EAECEF;font-size:13px;word-break:break-word">${escapeHtml(v)}</td></tr>`).join('');
  const text = `${title}\n\n${intro ? intro + '\n\n' : ''}` + rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = `
    <div style="background:#08090A;padding:32px;font-family:Inter,Arial,sans-serif;color:#EAECEF">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#0E0E11;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden">
        <tr><td style="padding:24px 28px 4px">
          <h1 style="margin:0;font-size:18px;color:#fff">Core<span style="color:#00E676">Cold</span></h1>
          <h2 style="font-size:18px;color:#00E676;margin:14px 0 6px">${escapeHtml(title)}</h2>
          ${intro ? `<p style="font-size:14px;line-height:1.6;color:#B7BDC6;margin:0 0 8px">${escapeHtml(intro)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:8px 28px 24px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowHtml}</table>
        </td></tr>
      </table>
    </div>`;
  await getTransport().sendMail({ from: `CoreCold <${config.smtp.from}>`, to, subject, text, html });
  return true;
}

// Funds credited to the user (admin-simulated deposit). `credits`: [{assetId, amount}].
export function notifyUserDeposit({ userEmail, credits = [], when = new Date() }) {
  if (!credits.length) return Promise.resolve(false);
  const summary = credits.map((c) => `${c.amount} ${assetUnit(c.assetId)}`).join(', ');
  return sendUserEmail({
    to: userEmail,
    subject: `Funds received — ${summary} credited to your CoreCold wallet`,
    title: 'Funds Received',
    intro: 'Good news — your CoreCold account has been credited. The funds are now available in your wallet.',
    rows: [
      ...credits.map((c) => [DEPOSIT_LABEL[c.assetId] || c.assetId, `+${c.amount} ${assetUnit(c.assetId)}`]),
      ['Time', when.toISOString()],
    ],
  });
}

// A user's withdrawal/transfer was approved by an admin and "sent".
export function notifyUserWithdrawalApproved({ userEmail, assetId, amount, to, when = new Date() }) {
  const unit = assetUnit(assetId);
  return sendUserEmail({
    to: userEmail,
    subject: `Transfer approved — ${amount} ${unit} sent`,
    title: 'Transfer Approved & Sent',
    intro: 'Your withdrawal has been approved by our team and the funds have been sent successfully.',
    rows: [
      ['Asset', DEPOSIT_LABEL[assetId] || assetId],
      ['Amount', `${amount} ${unit}`],
      ['To', to || '—'],
      ['Status', 'Completed'],
      ['Time', when.toISOString()],
    ],
  });
}
