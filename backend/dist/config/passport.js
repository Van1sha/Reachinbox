"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPassport = setupPassport;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
function setupPassport() {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const hasValidGoogleConfig = Boolean(clientID && clientSecret && clientID !== 'your_google_client_id_here' && clientSecret !== 'your_google_client_secret_here');
    if (hasValidGoogleConfig) {
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: clientID,
            clientSecret: clientSecret,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
        }, async (_accessToken, _refreshToken, profile, done) => {
            try {
                const user = {
                    id: profile.id,
                    email: profile.emails?.[0]?.value || '',
                    name: profile.displayName,
                    avatar: profile.photos?.[0]?.value || '',
                    provider: 'google',
                };
                return done(null, user);
            }
            catch (error) {
                return done(error);
            }
        }));
        console.log('✅ Google OAuth initialized');
    }
    else {
        console.log('ℹ️ Google OAuth not configured — Dev login is enabled');
    }
    passport_1.default.serializeUser((user, done) => {
        done(null, user);
    });
    passport_1.default.deserializeUser((user, done) => {
        done(null, user);
    });
}
