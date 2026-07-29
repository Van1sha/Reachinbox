'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [particles, setParticles] = useState<Array<{ x: number; y: number; delay: number; size: number }>>([]);

  useEffect(() => {
    // Generate random particles for background animation
    const p = Array.from({ length: 30 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
      size: Math.random() * 3 + 1,
    }));
    setParticles(p);

    // Check if already authenticated
    authApi.me().then((data) => {
      if (data?.user) router.push('/dashboard');
    }).catch(() => {}).finally(() => setChecking(false));
  }, [router]);

  const handleGoogleLogin = () => {
    window.location.href = authApi.googleLoginUrl();
  };

  const handleDevLogin = async () => {
    setLoading(true);
    try {
      await authApi.devLogin();
      router.push('/dashboard');
    } catch (e) {
      console.error('Dev login failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-600/10 rounded-full blur-[80px] animate-float" style={{ animationDelay: '4s' }} />

        {/* Particles */}
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-indigo-400/30 animate-float"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${4 + p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4 glow-indigo">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">ReachInbox</h1>
          <p className="text-gray-400 text-sm">Smart Email Scheduler with Adaptive Rate Limiting</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 gradient-border">
          <h2 className="text-xl font-semibold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-8">Sign in to access your email scheduling dashboard</p>


          {/* Login Button */}
          <button
            id="dev-login-btn"
            onClick={handleDevLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            )}
            {loading ? 'Signing in...' : 'Sign In to ReachInbox'}
          </button>

          <p className="text-xs text-gray-600 text-center mt-4">
            Secure single-click access to your dashboard
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          {[
            { icon: '⚡', label: 'BullMQ Powered' },
            { icon: '🎯', label: 'Smart Rate Limiting' },
            { icon: '📊', label: 'Live Timeline' },
          ].map((f) => (
            <div key={f.label} className="text-center">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-xs text-gray-500">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
