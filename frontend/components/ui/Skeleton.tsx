'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

export function TableSkeleton({ rows = 5 }: SkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-900/50 border border-gray-800/50" style={{ animationDelay: `${i * 0.1}s` }}>
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-xl p-4 border border-gray-800/50">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">
      <div className="text-5xl mb-4 animate-float">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-300 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-xs mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}
