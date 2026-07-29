import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';

const router = Router();

// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` }),
  (req: Request, res: Response) => {
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// Get current user
router.get('/me', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

// Logout
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

// Dev-only mock login (for development without Google credentials)
if (process.env.NODE_ENV === 'development') {
  router.post('/dev-login', (req: Request, res: Response) => {
    const mockUser = {
      id: 'dev-user-1',
      email: 'dev@reachinbox.com',
      name: 'Dev User',
      avatar: 'https://ui-avatars.com/api/?name=Dev+User&background=6366f1&color=fff',
      provider: 'dev',
    };
    req.login(mockUser, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ user: mockUser });
    });
  });
}

export default router;
