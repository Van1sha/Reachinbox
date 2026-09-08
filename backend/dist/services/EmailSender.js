"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.createEtherealAccount = createEtherealAccount;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Cache transports per sender to avoid re-creating connections
const transportCache = new Map();
function getTransport(sender) {
    if (transportCache.has(sender.id)) {
        return transportCache.get(sender.id);
    }
    const transport = nodemailer_1.default.createTransport({
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
async function sendEmail(options) {
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
        previewUrl: nodemailer_1.default.getTestMessageUrl(info),
    };
}
/**
 * Creates a new Ethereal test account and returns credentials.
 * Used to auto-generate sender accounts for demo.
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
