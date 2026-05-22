// src/services/emailService.js — Nodemailer + Gmail SMTP
const nodemailer = require('nodemailer');

// ── Create transporter ─────────────────────────────────────────
const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null; // fallback to console mode

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

// ── OTP HTML template ──────────────────────────────────────────
const buildOtpHtml = (userName, otp, expiresMinutes = 5) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
          style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#034EA2 0%,#0066CC 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">
                ✦ FPT-SMEP
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">
                Startup Mentoring &amp; Evaluation Platform
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#64748b;">Hello,</p>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;">${userName}</p>

              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                You recently signed up for <strong>FPT-SMEP</strong>. Please enter the OTP code below
                to verify your email address and activate your account:
              </p>

              <!-- OTP Box -->
              <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">
                  Your Verification Code
                </p>
                <p style="margin:0;font-size:44px;font-weight:800;color:#034EA2;letter-spacing:12px;font-family:'Courier New',monospace;">
                  ${otp}
                </p>
                <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">
                  This code expires in <strong style="color:#ef4444;">${expiresMinutes} minutes</strong>
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If you did not request this, you can safely ignore this email.
                The OTP will expire automatically and your account will not be affected.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © ${new Date().getFullYear()} FPT University &nbsp;·&nbsp; Startup Mentoring &amp; Evaluation Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ── sendOtpEmail ───────────────────────────────────────────────
/**
 * Send an OTP email via Gmail SMTP (Nodemailer).
 * If GMAIL_USER / GMAIL_APP_PASSWORD are not set, falls back to console log.
 *
 * Required env vars:
 *   GMAIL_USER         — your Gmail address (e.g. you@gmail.com)
 *   GMAIL_APP_PASSWORD — Gmail App Password (not your account password)
 *                        Enable at: Google Account → Security → 2-Step Verification → App passwords
 *
 * @param {string} toEmail  - Recipient email address
 * @param {string} otp      - 6-digit OTP code
 * @param {string} userName - User's display name for personalisation
 */
const sendOtpEmail = async (toEmail, otp, userName = 'there') => {
  const transporter = createTransporter();

  if (!transporter) {
    // ── FALLBACK: log to console ───────────────────────────────
    console.log('\n────────────────────────────────────────');
    console.log(`[EmailService - DEMO MODE] OTP for ${toEmail}`);
    console.log(`  Name : ${userName}`);
    console.log(`  OTP  : ${otp}`);
    console.log('  (Set GMAIL_USER + GMAIL_APP_PASSWORD in .env to send real emails)');
    console.log('────────────────────────────────────────\n');
    return;
  }

  const mailOptions = {
    from: `"FPT-SMEP · No Reply" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `[FPT-SMEP] Your account verification code: ${otp}`,
    html: buildOtpHtml(userName, otp),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EmailService] OTP sent to ${toEmail}`);
  } catch (err) {
    // Do not throw — let the flow continue; only log the error
    console.error(`[EmailService] Failed to send email to ${toEmail}:`, err.message);
    // Fallback: print OTP to console so devs can still test the flow
    console.log(`[EmailService - FALLBACK] OTP for ${toEmail}: ${otp}`);
  }
};

// ── Reset Password HTML template ───────────────────────────────
const buildResetPasswordHtml = (userName, resetUrl, expiresHours = 1) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
          style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#034EA2 0%,#0066CC 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">
                ✦ FPT-SMEP
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">
                Startup Mentoring &amp; Evaluation Platform
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#64748b;">Hello,</p>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;">${userName}</p>

              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                We received a request to reset the password for your <strong>FPT-SMEP</strong> account.
                Click the button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${resetUrl}"
                  style="display:inline-block;background:linear-gradient(135deg,#034EA2,#0066CC);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
                  Reset My Password
                </a>
              </div>

              <!-- URL fallback -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">
                  Or copy this link into your browser:
                </p>
                <p style="margin:0;font-size:12px;color:#475569;word-break:break-all;">${resetUrl}</p>
              </div>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                This link expires in <strong style="color:#ef4444;">${expiresHours} hour</strong>.
                If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © ${new Date().getFullYear()} FPT University &nbsp;·&nbsp; Startup Mentoring &amp; Evaluation Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ── sendResetPasswordEmail ─────────────────────────────────────
/**
 * Send a password-reset email with a clickable link.
 *
 * @param {string} toEmail   - Recipient email address
 * @param {string} resetUrl  - Full reset URL, e.g. http://localhost:5173/reset-password/<token>
 * @param {string} userName  - User's display name
 */
const sendResetPasswordEmail = async (toEmail, resetUrl, userName = 'there') => {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('\n────────────────────────────────────────');
    console.log(`[EmailService - DEMO MODE] Reset link for ${toEmail}`);
    console.log(`  Name : ${userName}`);
    console.log(`  URL  : ${resetUrl}`);
    console.log('  (Set GMAIL_USER + GMAIL_APP_PASSWORD in .env to send real emails)');
    console.log('────────────────────────────────────────\n');
    return;
  }

  const mailOptions = {
    from: `"FPT-SMEP · No Reply" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '[FPT-SMEP] Reset your password',
    html: buildResetPasswordHtml(userName, resetUrl),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Reset password email sent to ${toEmail}`);
  } catch (err) {
    console.error(`[EmailService] Failed to send reset email to ${toEmail}:`, err.message);
    console.log(`[EmailService - FALLBACK] Reset URL for ${toEmail}: ${resetUrl}`);
  }
};

module.exports = { sendOtpEmail, sendResetPasswordEmail };
