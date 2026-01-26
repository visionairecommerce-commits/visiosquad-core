import { z } from "zod";

// User roles
export type UserRole = 'admin' | 'coach' | 'parent';

// Base types matching Supabase tables
export interface Club {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  club_id: string;
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

export interface Session {
  id: string;
  club_id: string;
  team_id?: string;
  program_id: string;
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
  created_at: string;
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
});

export const insertAthleteSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  tags: z.array(z.string()).default([]),
});

export const insertSessionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  session_type: z.enum(['practice', 'clinic', 'drop_in']),
  team_id: z.string().optional(),
  program_id: z.string().min(1, "Program is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location: z.string().optional(),
  capacity: z.number().optional(),
  price: z.number().optional(),
});

export const cashPaymentSchema = z.object({
  athlete_id: z.string().min(1, "Athlete is required"),
  months: z.number().min(1, "At least 1 month required").max(12, "Maximum 12 months"),
});

export const cancelSessionSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required"),
});

// Type exports
export type InsertProgram = z.infer<typeof insertProgramSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertAthlete = z.infer<typeof insertAthleteSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type CashPayment = z.infer<typeof cashPaymentSchema>;
export type CancelSession = z.infer<typeof cancelSessionSchema>;

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
