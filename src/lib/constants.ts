export const APP_FEATURES = [
  { id: 'resumeGeneration', name: 'Resume Generation', description: 'AI-powered professional resume builder' },
  { id: 'coverLetterGeneration', name: 'Cover Letter', description: 'Tailored cover letter generator' },
  { id: 'resignationGeneration', name: 'Resignation Letter', description: 'Professional resignation letter generator' },
  { id: 'interviewPrep', name: 'Interview Prep', description: 'AI Mock interviews and feedback' },
  { id: 'careerVault', name: 'Career Vault', description: 'Storage for professional milestones' },
  { id: 'aiAssistant', name: 'Global AI Assistant', description: 'Context-aware AI help across the app' },
  { id: 'signatureVault', name: 'Signature Vault', description: 'Digital signature management' }
] as const;

export type AppFeatureId = typeof APP_FEATURES[number]['id'];

export const PLAN_TIERS = [
  { id: 'freeTrial', name: 'Free Trial', color: 'orange' },
  { id: 'free', name: 'Free', color: 'slate' },
  { id: 'pro', name: 'Pro', color: 'blue' }
] as const;

export type PlanId = typeof PLAN_TIERS[number]['id'];
