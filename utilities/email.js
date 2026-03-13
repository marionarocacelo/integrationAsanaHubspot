const nodemailer = require('nodemailer');

/**
 * Sends an error notification email. No-op if EMAIL_TO or SMTP config is missing.
 * @param {string} subject - Email subject
 * @param {string} body - Plain-text body (e.g. timestamp, text, serialized error)
 */
async function sendErrorNotification(subject, body) {
    const to = (process.env.EMAIL_TO || '').trim();
    if (!to) return;

    const host = (process.env.SMTP_HOST || '').trim();
    if (!host) return;

    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();

    const transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: user && pass ? { user, pass } : undefined
    });

    const from = (process.env.EMAIL_FROM || user || 'noreply@localhost').trim();

    try {
        await transporter.sendMail({
            from,
            to,
            subject: subject || 'ERROR INTEGRACIÓ ASANA HUBSPOT - RAILWAY',
            text: body
        });
    } catch (err) {
        console.error('Failed to send error notification email:', err.message);
    }
}

module.exports = { sendErrorNotification };
