import { useState, useEffect } from 'react';
import { UserProfile, AdminConfig } from '@/types';
import { AppFeatureId } from '@/lib/constants';
import { checkFeatureAccess, FeatureAccessResult, getMonthlyDocumentCount } from '@/lib/limits';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useFeatureAccess(featureId: AppFeatureId, profile: UserProfile | null) {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [access, setAccess] = useState<FeatureAccessResult>({
    allowed: true,
    message: 'Checking permissions...'
  });
  const [loading, setLoading] = useState(true);
  const [monthlyDocCount, setMonthlyDocCount] = useState(0);

  // Subscribe to real-time admin configuration updates
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin_config', 'global'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as AdminConfig);
      }
    }, (err) => {
      console.warn("Could not listen to admin config:", err);
    });

    return () => unsub();
  }, []);

  // Update monthly document usage
  useEffect(() => {
    if (profile?.uid) {
      getMonthlyDocumentCount(profile.uid).then(count => {
        setMonthlyDocCount(count);
      });
    }
  }, [profile?.uid]);

  // Re-check access whenever profile, config, or monthlyDocCount changes
  useEffect(() => {
    let isMounted = true;
    
    const evaluate = async () => {
      setLoading(true);
      const result = await checkFeatureAccess(featureId, profile, config, monthlyDocCount);
      if (isMounted) {
        setAccess(result);
        setLoading(false);
      }
    };

    evaluate();

    return () => {
      isMounted = false;
    };
  }, [featureId, profile, config, monthlyDocCount]);

  const refreshUsage = async () => {
    if (profile?.uid) {
      const count = await getMonthlyDocumentCount(profile.uid);
      setMonthlyDocCount(count);
      const result = await checkFeatureAccess(featureId, profile, config, count);
      setAccess(result);
    }
  };

  return {
    ...access,
    loading,
    config,
    monthlyDocCount,
    refreshUsage
  };
}
