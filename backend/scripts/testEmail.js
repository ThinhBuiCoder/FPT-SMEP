require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log("Using EMAIL_USER:", process.env.EMAIL_USER);
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.CLASS_NOTIFY_EMAIL || process.env.EMAIL_USER,
      subject: "Test Email from Backend",
      text: "This is a test email to check if SMTP works.",
    });
    console.log("✅ Email sent successfully:", info.messageId);
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
  }
}

testEmail();
