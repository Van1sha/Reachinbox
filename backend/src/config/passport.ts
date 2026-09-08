import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

export function setupPassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const hasValidGoogleConfig =
    Boolean(clientID && clientSecret && clientID !== 'your_google_client_id_here' && clientSecret !== 'your_google_client_secret_here');

  if (hasValidGoogleConfig) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: clientID!,
          clientSecret: clientSecret!,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const user = {
              id: profile.id,
              email: profile.emails?.[0]?.value || '',
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value || '',
              provider: 'google',
            };
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
    console.log('✅ Google OAuth initialized');
  } else {
    console.log('ℹ️ Google OAuth not configured — Dev login is enabled');
  }

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });
}
