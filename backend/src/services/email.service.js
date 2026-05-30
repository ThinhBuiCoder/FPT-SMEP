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

async function sendWorkshopNotificationEmail({ to, workshop, recipientName, format }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("Email service is not configured");
    return { sent: false, error: "Email service is not configured" };
  }

  if (!to) {
    return { sent: false, error: "Recipient email is required" };
  }

  const dateStr = new Date(workshop.startDate).toLocaleDateString();
  const deadlineStr = workshop.checkInDeadline ? new Date(workshop.checkInDeadline).toLocaleString() : 'N/A';
  let locationInfoHtml = '';
  let locationInfoText = '';
  if (format === 'ONLINE') {
    locationInfoHtml = `Meeting Link: <a href="${workshop.meetingLink || "#"}">${workshop.meetingLink || "TBD"}</a>`;
    locationInfoText = `Meeting Link: ${workshop.meetingLink || "TBD"}`;
  } else if (format === 'OFFLINE') {
    locationInfoHtml = `Location: ${workshop.location || "TBD"}`;
    locationInfoText = `Location: ${workshop.location || "TBD"}`;
  } else {
    locationInfoHtml = `Location: ${workshop.location || "TBD"} | Meeting Link: <a href="${workshop.meetingLink || "#"}">${workshop.meetingLink || "TBD"}</a>`;
    locationInfoText = `Location: ${workshop.location || "TBD"} | Meeting Link: ${workshop.meetingLink || "TBD"}`;
  }

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const workshopLink = `${clientUrl}/workshops`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
      <h2 style="color: #034EA2; border-bottom: 2px solid #51B848; padding-bottom: 12px;">New ${workshop.type} Scheduled</h2>
      <p>Hello ${recipientName || "Student"},</p>
      <p>A new ${workshop.type.toLowerCase()} has been announced that you are invited to attend.</p>
      <div style="background-color: #f8fafc; border-left: 4px solid #034EA2; padding: 16px; margin: 20px 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1e293b;">${workshop.title}</h3>
        <p style="margin: 6px 0; font-size: 14px; color: #475569;">${workshop.description || "No description provided."}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;"/>
        <ul style="list-style: none; padding-left: 0; margin: 0; font-size: 14px; color: #334155;">
          <li><strong>📅 Date:</strong> ${dateStr}</li>
          <li><strong>🕒 Time:</strong> ${workshop.startTime} - ${workshop.endTime}</li>
          <li><strong>📍 Location:</strong> ${locationInfoHtml}</li>
          <li><strong>⏰ Check-in Deadline:</strong> ${deadlineStr}</li>
        </ul>
      </div>
      <p>Please log in to FPT-SMEP system to view details and mark your attendance.</p>
      <div style="margin-top: 20px; text-align: center;">
        <a href="${workshopLink}" style="background-color: #034EA2; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Workshop Details</a>
      </div>
      <p style="margin-top: 30px;">Regards,<br/>FPT-SMEP Team</p>
    </div>
  `;

  const textBody = `
Hello ${recipientName || "Student"},

A new ${workshop.type.toLowerCase()} has been announced: "${workshop.title}"

Description: ${workshop.description || "No description"}
Date: ${dateStr}
Time: ${workshop.startTime} - ${workshop.endTime}
Location: ${locationInfoText}
Check-in Deadline: ${deadlineStr}

Please login to the FPT-SMEP system to view details:
${workshopLink}

Regards,
FPT-SMEP Team
  `.trim();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"FPT-SMEP System" <de180359letrungkien@gmail.com>',
      to,
      subject: `[FPT-SMEP] New ${workshop.type} Scheduled: ${workshop.title}`,
      text: textBody,
      html: htmlBody,
    });
    return { sent: true, to };
  } catch (err) {
    console.error("Failed to send workshop email notification:", err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  sendClassCreatedNotification,
  sendStudentImportedNotification,
  sendWorkshopNotificationEmail,
};
