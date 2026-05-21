// src/services/emailService.js — Nodemailer + Gmail SMTP
const nodemailer = require('nodemailer');

// ── Tạo transporter ────────────────────────────────────────────
const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null; // fallback mode

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
};

// ── HTML template OTP ──────────────────────────────────────────
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
              <p style="margin:0 0 8px;font-size:15px;color:#64748b;">Xin chào,</p>
              <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;">${userName}</p>

              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                Bạn vừa đăng ký tài khoản tại <strong>FPT-SMEP</strong>. Vui lòng nhập mã OTP bên dưới để kích hoạt tài khoản của bạn:
              </p>

              <!-- OTP Box -->
              <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:1px;text-transform:uppercase;">
                  Mã xác thực OTP
                </p>
                <p style="margin:0;font-size:44px;font-weight:800;color:#034EA2;letter-spacing:12px;font-family:'Courier New',monospace;">
                  ${otp}
                </p>
                <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;">
                  Mã có hiệu lực trong <strong style="color:#ef4444;">${expiresMinutes} phút</strong>
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này. Mã OTP sẽ tự động hết hạn và không ảnh hưởng đến tài khoản của bạn.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © ${new Date().getFullYear()} FPT University · Startup Mentoring &amp; Evaluation Platform
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
 * Gửi OTP qua Gmail SMTP. Nếu chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD,
 * tự động in OTP ra console (chế độ demo).
 *
 * @param {string} toEmail  - Email người nhận
 * @param {string} otp      - Mã OTP 6 số
 * @param {string} userName - Tên người dùng để cá nhân hoá email
 */
const sendOtpEmail = async (toEmail, otp, userName = 'Bạn') => {
  const transporter = createTransporter();

  if (!transporter) {
    // ── FALLBACK: log ra console ──────────────────────────────
    console.log('\n────────────────────────────────────');
    console.log(`[EmailService - DEMO MODE] OTP for ${toEmail}`);
    console.log(`  Name : ${userName}`);
    console.log(`  OTP  : ${otp}`);
    console.log('  (Set GMAIL_USER + GMAIL_APP_PASSWORD in .env to send real emails)');
    console.log('────────────────────────────────────\n');
    return;
  }

  const mailOptions = {
    from: `"FPT-SMEP" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `[FPT-SMEP] Mã OTP xác thực tài khoản: ${otp}`,
    html: buildOtpHtml(userName, otp),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EmailService] OTP sent to ${toEmail}`);
  } catch (err) {
    // Không throw — để flow vẫn tiếp tục, chỉ log lỗi
    console.error(`[EmailService] Failed to send email to ${toEmail}:`, err.message);
    // Fallback: in OTP ra console để dev vẫn test được
    console.log(`[EmailService - FALLBACK] OTP for ${toEmail}: ${otp}`);
  }
};

module.exports = { sendOtpEmail };
