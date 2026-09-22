import { UserProfile } from "@/types";

export function calculateReadinessScore(profile: UserProfile | null): number {
  if (!profile) return 0;

  let score = 0;
  const weights = {
    personal: 20,
    experience: 30,
    education: 20,
    skills: 15,
    summary: 15,
  };

  // Personal (check for essential fields)
  if (profile.displayName && profile.email && profile.phone && profile.address) {
    score += weights.personal;
  } else if (profile.displayName && profile.email) {
    score += weights.personal / 2;
  }

  // Experience
  if (profile.experience && profile.experience.length > 0) {
    score += weights.experience;
  }

  // Education
  if (profile.education && profile.education.length > 0) {
    score += weights.education;
  }

  // Skills
  if (profile.skills && profile.skills.length >= 3) {
    score += weights.skills;
  } else if (profile.skills && profile.skills.length > 0) {
    score += weights.skills / 2;
  }

  // Summary
  if (profile.professionalSummary && profile.professionalSummary.length > 50) {
    score += weights.summary;
  }

  return Math.min(100, score);
}

export function getProfileTips(profile: UserProfile | null): string[] {
  const tips: string[] = [];
  if (!profile) return ["Please create a profile first."];

  if (!profile.phone || !profile.address) {
    tips.push("Add contact details to your personal info.");
  }
  if (!profile.experience || profile.experience.length === 0) {
    tips.push("Add at least one work experience record.");
  }
  if (!profile.education || profile.education.length === 0) {
    tips.push("Include your educational background.");
  }
  if (!profile.skills || profile.skills.length < 5) {
    tips.push("List at least 5 professional skills.");
  }
  if (!profile.professionalSummary || profile.professionalSummary.length < 50) {
    tips.push("Write a compelling professional summary.");
  }

  if (tips.length === 0) {
    tips.push("Your profile is solid! Try generating some documents now.");
  }

  return tips;
}
