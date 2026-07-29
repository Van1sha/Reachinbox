import nodemailer from 'nodemailer';
import { Sender } from '../models/Sender';

interface SendEmailOptions {
  sender: Sender;
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

// Cache transports per sender to avoid re-creating connections
const transportCache = new Map<string, nodemailer.Transporter>();

function getTransport(sender: Sender): nodemailer.Transporter {
  if (transportCache.has(sender.id)) {
    return transportCache.get(sender.id)!;
  }

  const transport = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpSecure,
    auth: {
      user: sender.etherealUser,
      pass: sender.etherealPass,
    },
  });

  transportCache.set(sender.id, transport);
  return transport;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { sender, to, subject, html } = options;
  const transport = getTransport(sender);

  const info = await transport.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    html,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}

/**
 * Creates a new Ethereal test account and returns credentials.
 * Used to auto-generate sender accounts for demo.
 */
export async function createEtherealAccount(): Promise<{
  user: string;
  pass: string;
  smtp: { host: string; port: number };
}> {
  const testAccount = await nodemailer.createTestAccount();
  return {
    user: testAccount.user,
    pass: testAccount.pass,
    smtp: {
      host: 'smtp.ethereal.email',
      port: 587,
    },
  };
}
