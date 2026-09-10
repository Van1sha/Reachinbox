"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.createEtherealAccount = createEtherealAccount;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Cache transports per sender to avoid re-creating connections on every send.
// Entries are evicted when a send fails so a fresh transport is created on retry.
const transportCache = new Map();
function createTransport(sender) {
    // Prefer the dedicated smtpUser/smtpPass fields; fall back to the legacy
    // etherealUser/etherealPass columns so existing rows keep working.
    const user = sender.smtpUser || sender.etherealUser;
    const pass = sender.smtpPass || sender.etherealPass;
    return nodemailer_1.default.createTransport({
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpSecure,
        auth: { user, pass },
        // Explicit timeouts — without these nodemailer can hang for minutes on a
        // blocked port, consuming the BullMQ job slot silently.
        connectionTimeout: 10000, // 10 s to establish TCP connection
        greetingTimeout: 10000, // 10 s to receive SMTP greeting
        socketTimeout: 30000, // 30 s of inactivity before giving up
    });
}
function getTransport(sender) {
    if (transportCache.has(sender.id)) {
        return transportCache.get(sender.id);
    }
    const transport = createTransport(sender);
    transportCache.set(sender.id, transport);
    return transport;
}
async function sendViaResendApi(apiKey, options) {
    const { sender, to, subject, html } = options;
    // Resend free tier strictly requires sending from onboarding@resend.dev
    // unless a custom domain has been verified via DNS on resend.com.
    const configuredFrom = process.env.RESEND_FROM_EMAIL;
    let fromAddress;
    if (configuredFrom) {
        fromAddress = configuredFrom;
    }
    else if (sender.email.endsWith('@resend.dev') || sender.email.endsWith('.resend.dev')) {
        fromAddress = `"${sender.name}" <${sender.email}>`;
    }
    else {
        fromAddress = `"${sender.name}" <onboarding@resend.dev>`;
    }
    const sendWithFrom = async (from) => {
        const payload = {
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
        const data = (await res.json());
        return { ok: res.ok, status: res.status, data };
    };
    let result = await sendWithFrom(fromAddress);
    // If Resend failed because domain is not verified, automatically fallback to onboarding@resend.dev
    const fallbackFrom = `"${sender.name}" <onboarding@resend.dev>`;
    if (!result.ok &&
        result.data?.message?.toLowerCase().includes('not verified') &&
        fromAddress !== fallbackFrom) {
        console.log(`⚠️ Resend rejected domain (${fromAddress}). Retrying with onboarding@resend.dev...`);
        result = await sendWithFrom(fallbackFrom);
    }
    if (!result.ok) {
        throw new Error(result.data?.message || `Resend API error (${result.status}): ${JSON.stringify(result.data)}`);
    }
    return {
        messageId: result.data.id || 'resend-' + Date.now(),
        previewUrl: false,
    };
}
async function sendEmail(options) {
    const { sender, to, subject, html } = options;
    const user = sender.smtpUser || sender.etherealUser;
    const pass = sender.smtpPass || sender.etherealPass;
    // Check if Resend HTTP API should be used (HTTPS port 443 — bypasses cloud SMTP port blocks)
    const resendKey = process.env.RESEND_API_KEY ||
        (pass?.startsWith('re_') ? pass : null) ||
        (sender.smtpHost === 'smtp.resend.com' ? pass : null);
    if (resendKey) {
        return sendViaResendApi(resendKey, options);
    }
    const transport = getTransport(sender);
    let info;
    try {
        info = await transport.sendMail({
            from: `"${sender.name}" <${sender.email}>`,
            to,
            subject,
            html,
        });
    }
    catch (err) {
        // Evict the cached transport so the next retry gets a fresh connection
        // instead of reusing a broken one.
        transportCache.delete(sender.id);
        if (err.message?.includes('Connection timeout') ||
            err.code === 'ETIMEDOUT' ||
            err.code === 'ESOCKETTIMEDOUT') {
            const isRenderOrCloud = !!(process.env.RENDER || process.env.NODE_ENV === 'production');
            if (isRenderOrCloud) {
                throw new Error(`Connection timeout to ${sender.smtpHost}:${sender.smtpPort}. ` +
                    `Render Free tier blocks outbound SMTP ports (25, 465, 587). ` +
                    `To send emails on Render Free tier, use Resend API (HTTPS port 443, set RESEND_API_KEY or use Resend API key starting with re_) or upgrade to Render Starter plan.`);
            }
        }
        throw err;
    }
    return {
        messageId: info.messageId,
        // getTestMessageUrl returns a preview URL for Ethereal accounts and false
        // for all real SMTP providers — safe to call in both cases.
        previewUrl: nodemailer_1.default.getTestMessageUrl(info),
    };
}
/**
 * Creates a new Ethereal test account and returns credentials.
 * Only useful in local development — Ethereal is unreachable from most
 * production environments and its SMTP port is often blocked by cloud hosts.
 */
async function createEtherealAccount() {
    const testAccount = await nodemailer_1.default.createTestAccount();
    return {
        user: testAccount.user,
        pass: testAccount.pass,
        smtp: {
            host: 'smtp.ethereal.email',
            port: 587,
        },
    };
}
