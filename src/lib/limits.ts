import { UserProfile, AdminConfig } from '@/types';
import { AppFeatureId, APP_FEATURES } from './constants';
import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: 'tier_restricted' | 'monthly_limit_reached' | 'plan_expired' | 'feature_expired' | 'feature_disabled';
  message: string;
  currentUsage?: number;
  maxLimit?: number;
  expiryDate?: Date | null;
}

/**
 * Strips raw markdown asterisks and converts markdown bullets to clean unicode bullets.
 * Guarantees that saved documents and viewed content do not contain ugly markdown asterisks.
 */
export function cleanDocumentAsterisks(content: string): string {
  if (!content) return '';
  return content
    // Convert markdown bullet points (* item or - item) to clean bullets (• item)
    .replace(/^(\s*)\*\s+/gm, '$1• ')
    .replace(/^(\s*)-\s+/gm, '$1• ')
    // Remove bold/italic asterisks: ***text*** -> text, **text** -> text, *text* -> text
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*([^\*\n]+)\*/g, '$1')
    // Remove double or triple asterisks left behind
    .replace(/\*{2,}/g, '')
    // Remove isolated single asterisks not part of words
    .replace(/(^|\s)\*(\s|$)/g, '$1$2')
    .trim();
}

/**
 * Calculate user account creation date
 */
export function getUserCreationDate(profile: UserProfile | null): Date {
  if (!profile?.createdAt) return new Date();
  if (profile.createdAt?.toDate && typeof profile.createdAt.toDate === 'function') {
    return profile.createdAt.toDate();
  }
  if (profile.createdAt?.seconds) {
    return new Date(profile.createdAt.seconds * 1000);
  }
  const parsed = new Date(profile.createdAt);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Calculate user subscription expiry date
 */
export function getUserSubscriptionExpiry(profile: UserProfile | null): Date | null {
  if (!profile?.subscriptionExpiry) return null;
  if (profile.subscriptionExpiry?.toDate && typeof profile.subscriptionExpiry.toDate === 'function') {
    return profile.subscriptionExpiry.toDate();
  }
  if (profile.subscriptionExpiry?.seconds) {
    return new Date(profile.subscriptionExpiry.seconds * 1000);
  }
  const parsed = new Date(profile.subscriptionExpiry);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Get monthly count of generated documents for user
 */
export async function getMonthlyDocumentCount(userId: string): Promise<number> {
  if (!userId) return 0;
  try {
    const docsRef = collection(db, `users/${userId}/generated_documents`);
    const snap = await getDocs(docsRef);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let count = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      let docDate: Date | null = null;
      if (data.createdAt?.toDate) {
        docDate = data.createdAt.toDate();
      } else if (data.createdAt?.seconds) {
        docDate = new Date(data.createdAt.seconds * 1000);
      } else if (data.createdAt) {
        docDate = new Date(data.createdAt);
      }
      
      if (docDate && !isNaN(docDate.getTime())) {
        if (docDate.getMonth() === currentMonth && docDate.getFullYear() === currentYear) {
          count++;
        }
      } else {
        // Fallback: count if created recently
        count++;
      }
    });

    return count;
  } catch (err) {
    console.warn("Error counting monthly documents:", err);
    return 0;
  }
}

/**
 * Check if user has access.
 * Subscriptions and tier limits are removed; access is determined solely by
 * Blacklist (blocked_emails) and Whitelist verification.
 */
export async function checkFeatureAccess(
  featureId: AppFeatureId,
  profile: UserProfile | null,
  config?: AdminConfig | null,
  currentDocCount?: number
): Promise<FeatureAccessResult> {
  if (!profile) {
    return {
      allowed: false,
      reason: 'tier_restricted',
      message: 'You must be signed in to access this feature.'
    };
  }

  const email = profile.email?.toLowerCase().trim() || '';
  const isSuper = email === 'arvin8786@gmail.com' || profile.role === 'owner' || profile.role === 'admin' || profile.role === 'moderator' || profile.isAdmin;

  // 1. Blacklist Check
  try {
    const blockedSnap = await getDoc(doc(db, 'blocked_emails', email));
    if (blockedSnap.exists()) {
      return {
        allowed: false,
        reason: 'feature_disabled',
        message: 'Your account has been blocked by the system administrator.'
      };
    }
  } catch (err) {
    console.warn("Error checking blocked list:", err);
  }

  // 2. Whitelist Check
  if (!isSuper) {
    try {
      const whitelistSnap = await getDoc(doc(db, 'whitelist', email));
      if (!whitelistSnap.exists()) {
        // Also check original email casing if different
        const origEmail = profile.email?.trim() || '';
        let altAllowed = false;
        if (origEmail && origEmail !== email) {
          const altSnap = await getDoc(doc(db, 'whitelist', origEmail));
          altAllowed = altSnap.exists();
        }
        if (!altAllowed) {
          return {
            allowed: false,
            reason: 'tier_restricted',
            message: 'Your account requires whitelist approval from the administrator.'
          };
        }
      }
    } catch (err) {
      console.warn("Error checking whitelist:", err);
    }
  }

  return {
    allowed: true,
    message: 'Access granted'
  };
}
