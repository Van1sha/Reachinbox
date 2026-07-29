'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, sendersApi } from '@/lib/api';
import { User } from '@/types';
import Button from '@/components/ui/Button';

interface DashboardHeaderProps {
  onCompose: () => void;
}

export default function DashboardHeader({ onCompose }: DashboardHeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    authApi.me().then((d) => setUser(d.user)).catch(() => router.push('/'));
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await authApi.logout().catch(() => {});
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 glass border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-bold gradient-text text-lg hidden sm:block">ReachInbox</span>
        </div>

        {/* Center: Live pulse indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>

        {/* Right: Compose + User */}
        <div className="flex items-center gap-3">
          <Button
            id="compose-btn"
            variant="gradient"
            size="sm"
            onClick={onCompose}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Compose
          </Button>

          {/* User menu */}
          {user && (
            <div className="relative">
              <button
                id="user-menu-btn"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-800 transition-colors"
              >
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                    {user.name[0]}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-xs font-medium text-gray-200 leading-tight">{user.name}</p>
                  <p className="text-xs text-gray-500 leading-tight">{user.email}</p>
                </div>
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 glass rounded-xl border border-gray-700/50 shadow-xl z-50 animate-scale-in">
                  <div className="p-3 border-b border-gray-800">
                    <p className="text-sm font-medium text-gray-200">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="p-1">
                    <button
                      id="signout-btn"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {signingOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
