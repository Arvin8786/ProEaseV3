export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  phone?: string;
  address?: string;
  website?: string;
  linkedin?: string;
  nationality?: string;
  visaStatus?: string;
  dateOfBirth?: string;
  gender?: string;
  professionalSummary?: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  references: Reference[];
  languages: Language[];
  projects?: Project[];
  certifications?: Certification[];
  signatureURL?: string;
  plan?: 'freeTrial' | 'free' | 'pro' | string;
  subscriptionExpiry?: any;
  isAdmin?: boolean;
  role?: 'user' | 'moderator' | 'owner' | 'admin';
  activities?: UserActivity[];
  createdAt: any;
  updatedAt: any;
}

export interface ScheduledMessage {
  id: string;
  userId: string;
  recipientPhone: string;
  message: string;
  scheduledAt: any;
  status: 'pending' | 'sent' | 'cancelled';
  docId?: string;
  docType?: string;
  createdAt: any;
}

export interface UserActivity {
  id: string;
  type: 'experience' | 'education' | 'reference' | 'language' | 'skill' | 'personal' | 'signature' | 'summary' | 'document' | 'payment' | 'interview';
  action: string;
  detail: string;
  timestamp: any;
  link?: string;
}

export interface PaymentRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  proofUrl: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: any;
  processedAt?: any;
}

export interface Reference {
  id: string;
  name: string;
  position: string;
  company: string;
  email?: string;
  phone?: string;
  isVisible?: boolean;
}

export interface Language {
  id: string;
  name: string;
  proficiency: 'Basic' | 'Intermediate' | 'Fluent' | 'Native';
}

export interface Experience {
  id: string;
  company: string;
  position: string;
  industry?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  description: string;
  isCurrent: boolean;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
}

export interface WhiteListEntry {
  email: string;
  addedBy: string;
  addedAt: any;
}

export interface AccessRequest {
  id: string;
  email: string;
  requestedAt: any;
  status: 'pending' | 'approved' | 'rejected';
}

export interface DocumentRequest {
  id: string;
  transactionId: string;
  userId: string;
  userEmail: string;
  userName: string;
  docType: 'resume' | 'cover_letter' | 'tailored_resume' | 'resignation';
  title: string;
  amount: number; // in RM (e.g. 1.00 each)
  currency: 'MYR' | 'RM';
  status: 'pending_approval' | 'approved' | 'rejected';
  paymentStatus: 'unpaid' | 'paid' | 'verified' | 'waived';
  isBypassed?: boolean;
  paymentProofRef?: string;
  paymentReference?: string;
  paymentProofUrl?: string;
  draftContent: string;
  finalContent?: string;
  params?: any;
  approvedAt?: any;
  approvedBy?: string;
  rejectedReason?: string;
  rejectionReason?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface AdminConfig {
  id: 'global_config';
  features?: {
    [key: string]: boolean;
  };
  featureTiers?: {
    [featureId: string]: string[];
  };
  featureExpiryDays?: {
    [featureIdOrPlanId: string]: number;
  };
  planLimits?: {
    freeTrial: { docsPerMonth: number };
    free: { docsPerMonth: number };
    pro: { docsPerMonth: number };
  };
  documentPricing?: {
    resume: number;
    cover_letter: number;
    tailored_resume?: number;
    resignation?: number;
  };
  paymentInfo?: {
    duitNowNumber?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    qrCodeUrl?: string;
    instructions?: string;
  };
  enforceLimitsOnAdmin?: boolean;
  paymentQrUrl?: string;
  geminiApiKey?: string;
  updatedAt: any;
}

export interface AttendanceRecord {
  id: string;
  date: string; // ISO string
  status: 'present' | 'leave' | 'overtime' | 'absent';
  hours?: number;
  notes?: string;
}

export interface SalaryConfig {
  baseSalary: number;
  epfRate: number; // e.g. 0.11
  socsoRate: number;
  eisRate: number;
  allowances: number;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  link?: string;
}

export interface Document {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'image';
  createdAt: any;
  fields?: DocumentField[];
}

export interface DocumentField {
  id: string;
  label: string;
  value: string;
  x: number;
  y: number;
  page: number;
}

export type UploadedDocCategory = 
  | 'offer_letter'
  | 'payslip'
  | 'employment_contract'
  | 'resignation_acceptance'
  | 'education_cert'
  | 'tax_ea_form'
  | 'other';

export interface UploadedDocument {
  id: string;
  userId: string;
  category: UploadedDocCategory;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string;
  companyName?: string;
  issueDate?: string;
  notes?: string;
  isLargeFile?: boolean;
  elements?: any[];
  createdAt: any;
  updatedAt?: any;
}
