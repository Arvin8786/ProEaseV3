import React from 'react';
import { UserProfile } from '@/types';
import { AppFeatureId } from '@/lib/constants';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Lock, ShieldAlert } from 'lucide-react';

interface AccessGuardProps {
  profile: UserProfile | null;
  feature: AppFeatureId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AccessGuard({ profile, feature, children, fallback }: AccessGuardProps) {
  const access = useFeatureAccess(feature, profile);

  if (access.loading) return <>{children}</>;

  if (!profile) return null;

  if (!access.allowed) {
    if (fallback) return <>{fallback}</>;
    
    return (
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50 flex flex-col items-center text-center space-y-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900">Access Restricted</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">
            {access.message || "This feature is restricted by administrator policies (whitelist/blacklist)."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Alias for backwards compatibility
export const PlanGuard = AccessGuard;
