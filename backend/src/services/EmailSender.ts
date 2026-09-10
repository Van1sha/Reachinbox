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

// Cache transports per sender to avoid re-creating connections on every send.
// Entries are evicted when a send fails so a fresh transport is created on retry.
const transportCache = new Map<string, nodemailer.Transporter>();

function createTransport(sender: Sender): nodemailer.Transporter {
  // Prefer the dedicated smtpUser/smtpPass fields; fall back to the legacy
  // etherealUser/etherealPass columns so existing rows keep working.
  const user = sender.smtpUser || sender.etherealUser;
  let pass = sender.smtpPass || sender.etherealPass;
  if (pass && sender.smtpHost?.includes('gmail')) {
    pass = pass.replace(/\s+/g, '');
  }

  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpSecure,
    auth: { user, pass },
    // Explicit timeouts — without these nodemailer can hang for minutes on a
    // blocked port, consuming the BullMQ job slot silently.
    connectionTimeout: 10_000,  // 10 s to establish TCP connection
    greetingTimeout: 10_000,    // 10 s to receive SMTP greeting
    socketTimeout: 30_000,      // 30 s of inactivity before giving up
  });
}

function getTransport(sender: Sender): nodemailer.Transporter {
  if (transportCache.has(sender.id)) {
    return transportCache.get(sender.id)!;
  }
  const transport = createTransport(sender);
  transportCache.set(sender.id, transport);
  return transport;
}

async function sendViaResendApi(
  apiKey: string,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const { sender, to, subject, html } = options;

  // Resend free tier strictly requires sending from onboarding@resend.dev
  // unless a custom domain has been verified via DNS on resend.com.
  const configuredFrom = process.env.RESEND_FROM_EMAIL;
  let fromAddress: string;
  if (configuredFrom) {
    fromAddress = configuredFrom;
  } else if (sender.email.endsWith('@resend.dev') || sender.email.endsWith('.resend.dev')) {
    fromAddress = `"${sender.name}" <${sender.email}>`;
  } else {
    fromAddress = `"${sender.name}" <onboarding@resend.dev>`;
  }

  const sendWithFrom = async (from: string) => {
    const payload: Record<string, any> = {
      from,
      to: [to],
      subject,
      html,
    };

    if (sender.email) {
      payload.reply_to = sender.email;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as any;
    return { ok: res.ok, status: res.status, data };
  };

  let result = await sendWithFrom(fromAddress);

  // If Resend failed because domain is not verified, automatically fallback to onboarding@resend.dev
  const fallbackFrom = `"${sender.name}" <onboarding@resend.dev>`;
  if (
    !result.ok &&
    result.data?.message?.toLowerCase().includes('not verified') &&
    fromAddress !== fallbackFrom
  ) {
    console.log(`⚠️ Resend rejected domain (${fromAddress}). Retrying with onboarding@resend.dev...`);
    result = await sendWithFrom(fallbackFrom);
  }

  if (!result.ok) {
    throw new Error(
      result.data?.message || `Resend API error (${result.status}): ${JSON.stringify(result.data)}`
    );
  }

  return {
    messageId: result.data.id || 'resend-' + Date.now(),
    previewUrl: false,
  };
}

async function sendViaBrevoApi(
  apiKey: string,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const { sender, to, subject, html } = options;

  // Brevo strictly requires the sender email to be verified on the Brevo account.
  // Fall back to SMTP_USER or BREVO_FROM_EMAIL if the sender in the DB is a dummy demo email.
  const fallbackEmail = process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || 'vanisha9897@gmail.com';
  const isDummyEmail = !sender.email || sender.email.includes('reachinbox.com') || sender.email.includes('ethereal');
  const senderEmail = (isDummyEmail && fallbackEmail) ? fallbackEmail : (sender.email || fallbackEmail);

  const payload = {
    sender: {
      name: sender.name || 'ReachInbox',
      email: senderEmail,
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as any;

  if (!res.ok) {
    throw new Error(
      data?.message || `Brevo API error (${res.status}): ${JSON.stringify(data)}`
    );
  }

  return {
    messageId: data.messageId || 'brevo-' + Date.now(),
    previewUrl: false,
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { sender, to, subject, html } = options;
  const user = sender.smtpUser || sender.etherealUser;
  const pass = sender.smtpPass || sender.etherealPass;

  // Check if Brevo HTTP API should be used (HTTPS port 443 — works on Render Free tier)
  const isBrevoSender =
    sender.smtpHost === 'smtp-relay.brevo.com' ||
    sender.smtpHost === 'smtp.brevo.com' ||
    (pass?.startsWith('xkeysib-') ?? false) ||
    Boolean(process.env.BREVO_API_KEY && (sender.smtpHost?.includes('brevo') || !sender.smtpHost));

  const brevoKey = isBrevoSender
    ? (pass?.startsWith('xkeysib-') ? pass : (process.env.BREVO_API_KEY || pass))
    : null;

  if (brevoKey) {
    return sendViaBrevoApi(brevoKey, options);
  }

  // Check if Resend HTTP API should be used (HTTPS port 443 — bypasses cloud SMTP port blocks)
  const isResendSender =
    sender.smtpHost === 'smtp.resend.com' ||
    (pass?.startsWith('re_') ?? false);

  const resendKey = isResendSender
    ? (pass?.startsWith('re_') ? pass : (process.env.RESEND_API_KEY || (sender.smtpHost === 'smtp.resend.com' ? pass : null)))
    : null;

  // If sender is an Ethereal sender, redirect it to any working HTTP API or env SMTP
  if (sender.smtpHost?.includes('ethereal')) {
    if (process.env.BREVO_API_KEY) {
      return sendViaBrevoApi(process.env.BREVO_API_KEY, options);
    }
    if (process.env.RESEND_API_KEY) {
      return sendViaResendApi(process.env.RESEND_API_KEY, options);
    }
    if (process.env.SMTP_PASS) {
      sender.smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      sender.smtpPort = parseInt(process.env.SMTP_PORT || '465');
      sender.smtpSecure = process.env.SMTP_SECURE !== 'false';
      sender.smtpUser = process.env.SMTP_USER || sender.email;
      sender.smtpPass = process.env.SMTP_PASS;
    } else {
      const isCloud = Boolean(process.env.RENDER || process.env.NODE_ENV === 'production');
      if (isCloud) {
        throw new Error(
          'Demo Ethereal sender cannot connect on Render because Render blocks port 587. Please add your Brevo API key (BREVO_API_KEY) in Render Dashboard or add a Brevo sender in Compose.'
        );
      }
    }
  }

  const transport = getTransport(sender);

  let info: nodemailer.SentMessageInfo;
  try {
    info = await transport.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to,
      subject,
      html,
    });
  } catch (err: any) {
    // Evict the cached transport so the next retry gets a fresh connection
    // instead of reusing a broken one.
    transportCache.delete(sender.id);

    if (
      err.message?.includes('Connection timeout') ||
      err.code === 'ETIMEDOUT' ||
      err.code === 'ESOCKETTIMEDOUT'
    ) {
      const isRenderOrCloud = !!(process.env.RENDER || process.env.NODE_ENV === 'production');
      if (isRenderOrCloud) {
        throw new Error(
          `Connection timeout to ${sender.smtpHost}:${sender.smtpPort}. ` +
          `Render Free tier blocks outbound SMTP ports (25, 465, 587). ` +
          `To send emails on Render Free tier, use Resend API (HTTPS port 443, set RESEND_API_KEY or use Resend API key starting with re_) or upgrade to Render Starter plan.`
        );
      }
    }

    throw err;
  }

  return {
    messageId: info.messageId,
    // getTestMessageUrl returns a preview URL for Ethereal accounts and false
    // for all real SMTP providers — safe to call in both cases.
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}

/**
 * Creates a new Ethereal test account and returns credentials.
 * Only useful in local development — Ethereal is unreachable from most
 * production environments and its SMTP port is often blocked by cloud hosts.
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
