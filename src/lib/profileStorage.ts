import { UserProfile, UserActivity } from '../types';
import { db } from './firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

export async function logProfileActivity(uid: string, type: UserActivity['type'], action: string, detail: string, link?: string) {
  const activity: UserActivity = {
    id: Math.random().toString(36).substr(2, 9),
    type,
    action,
    detail,
    link,
    timestamp: new Date()
  };

  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      activities: arrayUnion(activity)
    });
    
    // Update local too
    const current = getLocalProfile(uid);
    const activities = [...(current.activities || []), activity];
    saveLocalProfile(uid, { ...current, activities });
    
    return true;
  } catch (e) {
    console.error('Failed to log activity:', e);
    return false;
  }
}

export function getLocalProfile(uid: string): Partial<UserProfile> {
  try {
    const saved = localStorage.getItem(`proease_profile_${uid}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading local profile', e);
  }
  return {
    displayName: 'User',
    experience: [],
    education: [],
    skills: [],
    references: [],
    languages: [],
  };
}

export function saveLocalProfile(uid: string, profile: Partial<UserProfile>) {
  try {
    localStorage.setItem(`proease_profile_${uid}`, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('local-profile-updated', { detail: { uid } }));
  } catch (e) {
    console.error('Error saving local profile', e);
  }
}

export async function updateLocalProfileField(uid: string, fields: Partial<UserProfile>) {
   const current = getLocalProfile(uid);
   const updated = { ...current, ...fields };
   saveLocalProfile(uid, updated);
   
   // Also sync to Firestore if possible
   try {
     const userRef = doc(db, 'users', uid);
     // Filter out non-serializable fields if any (usually not in Partial<UserProfile>)
     await updateDoc(userRef, {
       ...fields,
       updatedAt: new Date()
     });
   } catch (e) {
     console.warn('Silent record sync to Firestore failed. Local storage remains updated.', e);
   }
   
   return updated;
}
