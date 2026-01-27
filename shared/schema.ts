import { z } from "zod";

// User roles
export type UserRole = 'admin' | 'coach' | 'parent';

// Base types matching Supabase tables
export interface Club {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  join_code: string;
  contract_pdf_url?: string;
  waiver_content?: string;
  waiver_version?: number;
  contract_version?: number;
  onboarding_complete: boolean;
  created_at: string;
}

export interface ClubDocument {
  id: string;
  club_id: string;
  document_type: 'waiver' | 'contract';
  file_url: string;
  version: number;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  club_id: string;
  has_signed_documents: boolean;
  created_at: string;
}

export interface ClubSignature {
  id: string;
  club_id: string;
  user_id: string;
  document_type: 'contract' | 'waiver';
  document_version: number;
  signed_name: string;
  signed_at: string;
  ip_address?: string;
  created_at: string;
}

export interface Program {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  monthly_fee: number;
  created_at: string;
}

export interface ContractTemplate {
  id: string;
  program_id: string;
  club_id: string;
  content: string;
  created_at: string;
}

export interface Team {
  id: string;
  club_id: string;
  program_id: string;
  coach_id: string | null;
  name: string;
  created_at: string;
}

export interface Athlete {
  id: string;
  club_id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  tags: string[];
  paid_through_date?: string;
  is_locked: boolean;
  created_at: string;
}

export interface AthleteTeamRoster {
  id: string;
  athlete_id: string;
  team_id: string;
  program_id: string;
  club_id: string;
  created_at: string;
}

export interface Facility {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Session {
  id: string;
  club_id: string;
  team_id?: string;
  program_id: string;
  facility_id?: string;
  title: string;
  description?: string;
  session_type: 'practice' | 'clinic' | 'drop_in';
  start_time: string;
  end_time: string;
  location?: string;
  capacity?: number;
  price?: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  cancellation_reason?: string;
  recurrence_group_id?: string;
  created_at: string;
}

export interface RecurrencePattern {
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  timeBlocks: {
    days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
    startTime: string;
    endTime: string;
  }[];
  repeatUntil: string;
}

export interface Registration {
  id: string;
  club_id: string;
  session_id: string;
  athlete_id: string;
  checked_in: boolean;
  check_in_time?: string;
  created_at: string;
}

export interface Contract {
  id: string;
  club_id: string;
  athlete_id: string;
  program_id: string;
  template_id: string;
  signed_at?: string;
  signature_data?: string;
  status: 'pending' | 'signed' | 'expired';
  created_at: string;
}

export interface Payment {
  id: string;
  club_id: string;
  athlete_id: string;
  amount: number;
  payment_type: 'monthly' | 'clinic' | 'drop_in' | 'cash';
  payment_method: 'credit_card' | 'ach' | 'cash';
  helcim_transaction_id?: string;
  months_paid?: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface PlatformLedger {
  id: string;
  club_id: string;
  payment_id: string;
  amount: number;
  fee_type: 'monthly' | 'clinic' | 'drop_in';
  created_at: string;
}

// Insert schemas for forms
export const insertProgramSchema = z.object({
  name: z.string().min(1, "Program name is required"),
  description: z.string().optional(),
  monthly_fee: z.number().min(0, "Fee must be positive"),
});

export const insertTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  program_id: z.string().min(1, "Program is required"),
  coach_id: z.string().optional().nullable(),
});

export const insertAthleteSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  tags: z.array(z.string()).default([]),
});

export const insertFacilitySchema = z.object({
  name: z.string().min(1, "Facility name is required"),
  description: z.string().optional(),
});

export const insertSessionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  session_type: z.enum(['practice', 'clinic', 'drop_in']),
  team_id: z.string().optional(),
  program_id: z.string().min(1, "Program is required"),
  facility_id: z.string().optional(),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location: z.string().optional(),
  capacity: z.number().optional(),
  price: z.number().optional(),
});

export const dayOfWeekSchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

export const timeBlockSchema = z.object({
  days: z.array(dayOfWeekSchema).min(1, "At least one day required"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format"),
});

export const recurrencePatternSchema = z.object({
  startDate: z.string().optional(),
  timeBlocks: z.array(timeBlockSchema).min(1, "At least one time block required"),
  repeatUntil: z.string().min(1, "End date is required"),
});

export const createRecurringSessionSchema = insertSessionSchema.omit({ 
  start_time: true, 
  end_time: true 
}).extend({
  recurrence: recurrencePatternSchema,
  forceCreate: z.boolean().optional(),
});

export const cashPaymentSchema = z.object({
  athlete_id: z.string().min(1, "Athlete is required"),
  months: z.number().min(1, "At least 1 month required").max(12, "Maximum 12 months"),
});

export const cancelSessionSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
});

// Club creation schema (for Directors)
export const createClubSchema = z.object({
  name: z.string().min(2, "Club name must be at least 2 characters"),
  director_name: z.string().min(2, "Your name is required"),
  director_email: z.string().email("Valid email is required"),
  director_password: z.string().min(8, "Password must be at least 8 characters"),
});

// User registration schema (for Parents/Coaches)
export const registerUserSchema = z.object({
  join_code: z.string().length(6, "Club code must be 6 characters"),
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(['coach', 'parent']),
});

// E-signature schema
export const signDocumentSchema = z.object({
  signed_name: z.string().min(2, "Please type your full legal name"),
  document_type: z.enum(['contract', 'waiver']),
  agreed: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

// Club documents upload schema
export const updateClubDocumentsSchema = z.object({
  contract_pdf_url: z.string().optional(),
  waiver_content: z.string().min(10, "Waiver content is required"),
});

// Club settings schema
export const updateClubSettingsSchema = z.object({
  name: z.string().min(2, "Club name is required").optional(),
  address: z.string().optional(),
  logo_url: z.string().optional(),
});

// Update facility schema (for CRUD)
export const updateFacilitySchema = z.object({
  name: z.string().min(1, "Facility name is required").optional(),
  description: z.string().optional(),
});

// Type exports
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertAthlete = z.infer<typeof insertAthleteSchema>;
export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export type TimeBlock = z.infer<typeof timeBlockSchema>;
export type CreateRecurringSession = z.infer<typeof createRecurringSessionSchema>;
export type CashPayment = z.infer<typeof cashPaymentSchema>;
export type CancelSession = z.infer<typeof cancelSessionSchema>;
export type CreateClub = z.infer<typeof createClubSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type SignDocument = z.infer<typeof signDocumentSchema>;
export type Login = z.infer<typeof loginSchema>;
export type UpdateClubDocuments = z.infer<typeof updateClubDocumentsSchema>;
export type UpdateClubSettings = z.infer<typeof updateClubSettingsSchema>;
export type UpdateFacility = z.infer<typeof updateFacilitySchema>;

// Generate unique 6-character club code
export const generateClubCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Convenience fee calculations
export const calculateConvenienceFee = (amount: number, method: 'credit_card' | 'ach' | 'cash'): number => {
  if (method === 'credit_card') {
    return amount * 1.03;
  }
  return amount;
};

// Platform fee calculations
export const PLATFORM_FEES = {
  monthly: 1.00,
  clinic: 1.00,
  drop_in: 0.75,
} as const;

// Access state calculation
export const isAthleteAccessLocked = (paidThroughDate?: string): boolean => {
  if (!paidThroughDate) return true;
  const paidThrough = new Date(paidThroughDate);
  const gracePeriod = new Date();
  gracePeriod.setDate(gracePeriod.getDate() - 7);
  return paidThrough < gracePeriod;
};
