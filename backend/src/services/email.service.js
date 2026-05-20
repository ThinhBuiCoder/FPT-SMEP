const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendClassCreatedNotification({ classes, createdBy, recipientEmails = [] }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email service is not configured");
    return { sent: false, error: "Email service is not configured" };
  }

  if (!Array.isArray(classes) || classes.length === 0) {
    return { sent: false, error: "No classes to send" };
  }

  const creatorInfo = createdBy 
    ? `${createdBy.name || "Unknown"} - ${createdBy.email || "Unknown"}` 
    : "System/Unknown";

  const classListHtml = classes.map((c, i) => 
    `<li>${i + 1}. ${c.classCode} - ${c.subjectCode} - ${c.semester} ${c.year}</li>`
  ).join("");

  const classListText = classes.map((c, i) => 
    `${i + 1}. ${c.classCode} - ${c.subjectCode} - ${c.semester} ${c.year}`
  ).join("\n");

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2e6c80;">New Class Created Successfully</h2>
      <p>Hello Student,</p>
      <p>A new class creation action has been completed in FPT-SMEP.</p>
      <ul>
        <li><strong>Created by:</strong> ${creatorInfo}</li>
        <li><strong>Total classes created:</strong> ${classes.length}</li>
      </ul>
      <p><strong>Classes:</strong></p>
      <ul>
        ${classListHtml}
      </ul>
      <br/>
      <p>Regards,<br/>FPT-SMEP System</p>
    </div>
  `;

  const textBody = `
Hello Student,

A new class creation action has been completed in FPT-SMEP.

Created by: ${creatorInfo}
Total classes created: ${classes.length}

Classes:
${classListText}

Regards,
FPT-SMEP System
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"FPT-SMEP System" <de180359letrungkien@gmail.com>',
      to: process.env.CLASS_NOTIFY_EMAIL || "de180359letrungkien@gmail.com",
      bcc: recipientEmails,
      subject: "[ FPT-SMEP ] New Class Created",
      text: textBody,
      html: htmlBody,
    });
    return { sent: true, to: "Students (BCC)" };
  } catch (err) {
    console.error("Failed to send class created notification:", err.message);
    return { sent: false, error: err.message };
  }
}

async function sendStudentImportedNotification({ importedStudents, classInfo }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email service is not configured");
    return { sent: false, error: "Email service is not configured" };
  }

  if (!Array.isArray(importedStudents) || importedStudents.length === 0) {
    return { sent: false, error: "No students to send" };
  }

  const recipientEmails = importedStudents.map(s => s.email).filter(Boolean);
  if (recipientEmails.length === 0) {
    return { sent: false, error: "No valid emails found" };
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2e6c80;">Class Enrollment Notification</h2>
      <p>Hello Student,</p>
      <p>You have been successfully added to a new class in FPT-SMEP.</p>
      <ul>
        <li><strong>Class Code:</strong> ${classInfo.classCode}</li>
        <li><strong>Subject:</strong> ${classInfo.subjectCode}</li>
        <li><strong>Semester:</strong> ${classInfo.semester} ${classInfo.year}</li>
      </ul>
      <br/>
      <p>Please login to the system to view more details.</p>
      <p>Regards,<br/>FPT-SMEP System</p>
    </div>
  `;

  const textBody = `
Hello Student,

You have been successfully added to a new class in FPT-SMEP.

Class Code: ${classInfo.classCode}
Subject: ${classInfo.subjectCode}
Semester: ${classInfo.semester} ${classInfo.year}

Please login to the system to view more details.

Regards,
FPT-SMEP System
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"FPT-SMEP System" <de180359letrungkien@gmail.com>',
      to: process.env.CLASS_NOTIFY_EMAIL || "de180359letrungkien@gmail.com",
      bcc: recipientEmails,
      subject: `[ FPT-SMEP ] You have been added to ${classInfo.classCode}`,
      text: textBody,
      html: htmlBody,
    });
    return { sent: true, to: "Students (BCC)" };
  } catch (err) {
    console.error("Failed to send student imported notification:", err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  sendClassCreatedNotification,
  sendStudentImportedNotification,
};
