"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const router = (0, express_1.Router)();
// Initiate Google OAuth flow
router.get('/google', (req, res, next) => {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const hasValidGoogleConfig = Boolean(clientID && clientSecret && clientID !== 'your_google_client_id_here' && clientSecret !== 'your_google_client_secret_here');
    if (!hasValidGoogleConfig) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=oauth_not_configured`);
    }
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
    })(req, res, next);
});
// Google OAuth callback
router.get('/google/callback', passport_1.default.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed` }), (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
});
// Get current user
router.get('/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user: req.user });
});
// Logout
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err)
            return next(err);
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });
});
// One-click login (works in both dev and production demo deployments)
router.post('/dev-login', (req, res) => {
    const mockUser = {
        id: 'dev-user-1',
        email: 'demo@reachinbox.com',
        name: 'Demo Evaluator',
        avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=6366f1&color=fff',
        provider: 'dev',
    };
    req.login(mockUser, (err) => {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ user: mockUser });
    });
});
exports.default = router;
