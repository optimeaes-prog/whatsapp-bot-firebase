import * as nodemailer from "nodemailer";
import { defineString, defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getActiveOrgId } from "./requestContext";
import { AlertSeverity } from "../types";

const SMTP_HOST = defineString("SMTP_HOST", { default: "smtp.gmail.com" });
const SMTP_PORT = defineString("SMTP_PORT", { default: "465" });
const SMTP_USER = defineString("SMTP_USER", { default: "" });
const SMTP_PASS = defineSecret("SMTP_PASS");
const ALERT_EMAIL_RECIPIENT = defineString("ALERT_EMAIL_RECIPIENT", { default: "optimea.es@gmail.com" });
const DATABASE_ID = "realestate-whatsapp-bot";

const SEVERITY_CONFIG: Record<AlertSeverity, { emoji: string; color: string; borderColor: string; bgColor: string }> = {
    info: { emoji: "ℹ️", color: "#1976d2", borderColor: "#bbdefb", bgColor: "#e3f2fd" },
    warning: { emoji: "⚠️", color: "#f57c00", borderColor: "#ffe0b2", bgColor: "#fff3e0" },
    critical: { emoji: "🚨", color: "#d32f2f", borderColor: "#ffcccc", bgColor: "#fff5f5" },
    healthy: { emoji: "✅", color: "#2e7d32", borderColor: "#c8e6c9", bgColor: "#e8f5e9" },
};

export async function sendAlert(
    subject: string,
    message: string,
    details?: any,
    severity: AlertSeverity = "warning"
) {
    const config = SEVERITY_CONFIG[severity];
    console.log(`[ALERT:${severity.toUpperCase()}] ${subject}: ${message}`);

    // 1. Log to Firestore
    try {
        const db = getFirestore(admin.app(), DATABASE_ID);
        await db.collection(`organizations/${getActiveOrgId()}/system_alerts`).add({
            subject,
            message,
            details: details || null,
            severity,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resolved: false
        });
    } catch (err) {
        console.error("Failed to log alert to Firestore:", err);
    }

    // 2. Send Email
    const user = SMTP_USER.value();
    const pass = SMTP_PASS.value();

    if (!user || !pass) {
        console.warn("SMTP_USER or SMTP_PASS not configured. Email alert skipped.");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST.value(),
        port: parseInt(SMTP_PORT.value()),
        secure: SMTP_PORT.value() === "465",
        auth: {
            user,
            pass,
        },
    });

    const mailOptions = {
        from: `"WhatsApp Bot Alert" <${user}>`,
        to: ALERT_EMAIL_RECIPIENT.value(),
        subject: `${config.emoji} BOT ALERT [${severity.toUpperCase()}]: ${subject}`,
        text: `[${severity.toUpperCase()}] ${message}\n\nDetails: ${JSON.stringify(details, null, 2)}`,
        html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid ${config.borderColor}; border-radius: 8px; background-color: ${config.bgColor};">
        <h2 style="color: ${config.color};">${config.emoji} Alerta del Bot de WhatsApp</h2>
        <p><strong>Severidad:</strong> <span style="color: ${config.color}; font-weight: bold;">${severity.toUpperCase()}</span></p>
        <p><strong>Asunto:</strong> ${subject}</p>
        <p><strong>Mensaje:</strong> ${message}</p>
        ${details ? `<pre style="background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(details, null, 2)}</pre>` : ""}
        <hr style="border: 0; border-top: 1px solid ${config.borderColor}; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">Enviado automáticamente por el bot de WhatsApp.</p>
      </div>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email alert sent:", info.messageId);
    } catch (error) {
        console.error("Failed to send email alert:", error);
    }
}

export async function sendHealthReport(
    subject: string,
    message: string,
    summary: {
        chatsChecked: number;
        discrepanciesFound: number;
        alertsInLastHour: number;
        status: "OK" | "ISSUES";
        responseRate?: number;
    },
    details?: any
) {
    const config = summary.status === "OK" ? SEVERITY_CONFIG.healthy : SEVERITY_CONFIG.warning;
    console.log(`[HEALTH_REPORT:${summary.status}] ${subject}`);

    const user = SMTP_USER.value();
    const pass = SMTP_PASS.value();

    if (!user || !pass) {
        console.warn("SMTP_USER or SMTP_PASS not configured. Health report skipped.");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST.value(),
        port: parseInt(SMTP_PORT.value()),
        secure: SMTP_PORT.value() === "465",
        auth: {
            user,
            pass,
        },
    });

    const mailOptions = {
        from: `"WhatsApp Bot Status" <${user}>`,
        to: ALERT_EMAIL_RECIPIENT.value(),
        subject: `${config.emoji} STATUS REPORT: ${subject}`,
        html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid ${config.borderColor}; border-radius: 8px; background-color: ${config.bgColor};">
        <h2 style="color: ${config.color};">${config.emoji} Reporte de Estado del Bot</h2>
        <p><strong>Estado:</strong> <span style="color: ${config.color}; font-weight: bold;">${summary.status}</span></p>
        <p><strong>Resumen:</strong></p>
        <ul>
          <li>Chats verificados: ${summary.chatsChecked}</li>
          <li>Discrepancias actuales: ${summary.discrepanciesFound}</li>
          <li>Alertas en la última hora: ${summary.alertsInLastHour}</li>
          ${summary.responseRate !== undefined ? `<li>Tasa de respuesta (24h): ${summary.responseRate}%</li>` : ""}
        </ul>
        <p><strong>Mensaje:</strong> ${message}</p>
        ${details ? `<h3 style="margin-top: 20px;">Detalles adicionales:</h3><pre style="background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(details, null, 2)}</pre>` : ""}
        <hr style="border: 0; border-top: 1px solid ${config.borderColor}; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">Este es un reporte automático enviado cada hora.</p>
      </div>
    `,
    };

    // 1. Log to Firestore
    try {
        const db = getFirestore(admin.app(), DATABASE_ID);
        await db.collection(`organizations/${getActiveOrgId()}/system_alerts`).add({
            subject: `STATUS REPORT: ${subject}`,
            message,
            details: { ...summary, ...(details || {}) },
            severity: summary.status === "OK" ? "healthy" : "warning",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resolved: summary.status === "OK"
        });
    } catch (err) {
        console.error("Failed to log health report to Firestore:", err);
    }

    try {
        if (summary.status !== "OK") {
            const info = await transporter.sendMail(mailOptions);
            console.log("Health report sent:", info.messageId);
        } else {
            console.log("Health report is OK. Email alert skipped.");
        }
    } catch (error) {
        console.error("Failed to send health report:", error);
    }
}
