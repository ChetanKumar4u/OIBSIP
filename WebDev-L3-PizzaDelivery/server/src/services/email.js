const nodemailer = require("nodemailer");

function createEmailService(config) {
  const smtpConfigured = Boolean(config.smtpHost && config.smtpUser && config.smtpPass);
  const transport = smtpConfigured
    ? nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass }
    })
    : null;

  async function send({ to, subject, text, html }) {
    if (transport) {
      await transport.sendMail({ from: config.emailFrom, to, subject, text, html });
      return "email";
    }
    if (config.nodeEnv !== "production") {
      console.info(`[development email] to=${to} subject=${subject}\n${text}`);
      return "console";
    }
    throw new Error("SMTP is not configured; email cannot be sent in production.");
  }

  return { send, smtpConfigured };
}

module.exports = { createEmailService };
