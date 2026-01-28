import { z } from "zod";
import { pgTable, text, integer, boolean, timestamp, decimal, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============ DRIZZLE TABLE DEFINITIONS ============

// Clubs table
export const clubsTable = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  logo_url: text("logo_url"),
  address: text("address"),
  join_code: text("join_code").notNull().unique(),
  contract_pdf_url: text("contract_pdf_url"),
  waiver_content: text("waiver_content"),
  waiver_version: integer("waiver_version").default(1),
  contract_version: integer("contract_version").default(1),
  onboarding_complete: boolean("onboarding_complete").default(false).notNull(),
  billing_card_token: text("billing_card_token"),
  billing_card_last_four: text("billing_card_last_four"),
  billing_customer_code: text("billing_customer_code"),
  billing_bank_token: text("billing_bank_token"),
  billing_bank_last_four: text("billing_bank_last_four"),
  billing_method: text("billing_method", { enum: ["card", "bank"] }),
  coaches_can_bill: boolean("coaches_can_bill").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Profiles (users) table - linked to Supabase Auth
export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey(), // Links to Supabase auth.users.id
  email: text("email").notNull().unique(),
  full_name: text("full_name").notNull(),
  role: text("role", { enum: ["admin", "coach", "parent"] }).notNull(),
  club_id: uuid("club_id").references(() => clubsTable.id),
  has_signed_documents: boolean("has_signed_documents").default(false).notNull(),
  can_bill: boolean("can_bill").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Club documents table
export const clubDocumentsTable = pgTable("club_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  document_type: text("document_type", { enum: ["waiver", "contract"] }).notNull(),
  file_url: text("file_url").notNull(),
  version: integer("version").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Club forms table - for storing Google Forms and other external links
export const clubFormsTable = pgTable("club_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Club signatures table
export const clubSignaturesTable = pgTable("club_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  user_id: uuid("user_id").references(() => profilesTable.id).notNull(),
  document_type: text("document_type", { enum: ["contract", "waiver"] }).notNull(),
  document_version: integer("document_version").notNull(),
  signed_name: text("signed_name").notNull(),
  signed_at: timestamp("signed_at").defaultNow().notNull(),
  ip_address: text("ip_address"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Programs table
export const programsTable = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  monthly_fee: decimal("monthly_fee", { precision: 10, scale: 2 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Program contracts table - defines pricing tiers for a program
// e.g., "National Team - 4 days/week - $500/month" or "3 days/week - $350/month"
export const programContractsTable = pgTable("program_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  program_id: uuid("program_id").references(() => programsTable.id).notNull(),
  team_id: uuid("team_id"), // Optional - for team-specific contracts
  name: text("name").notNull(),
  description: text("description"),
  monthly_price: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  paid_in_full_price: decimal("paid_in_full_price", { precision: 10, scale: 2 }), // Discounted upfront price
  initiation_fee: decimal("initiation_fee", { precision: 10, scale: 2 }), // One-time fee
  sessions_per_week: integer("sessions_per_week").notNull(),
  contract_document_url: text("contract_document_url"), // Custom contract PDF URL (overrides club default)
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Athlete contracts table - tracks which athletes have which contracts
export const athleteContractsTable = pgTable("athlete_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  program_contract_id: uuid("program_contract_id").references(() => programContractsTable.id).notNull(),
  start_date: text("start_date").notNull(),
  end_date: text("end_date"),
  custom_price: decimal("custom_price", { precision: 10, scale: 2 }), // Optional - overrides contract monthly_price
  payment_plan: text("payment_plan", { enum: ["paid_in_full", "monthly"] }).default("monthly").notNull(),
  signed_name: text("signed_name"), // Parent's typed signature
  signed_at: timestamp("signed_at"), // When contract was signed
  initiation_fee_paid: boolean("initiation_fee_paid").default(false).notNull(),
  status: text("status", { enum: ["active", "cancelled", "expired"] }).default("active").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Contract templates table (legacy - for document signing)
export const contractTemplatesTable = pgTable("contract_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  program_id: uuid("program_id").references(() => programsTable.id).notNull(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Teams table
export const teamsTable = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  program_id: uuid("program_id").references(() => programsTable.id).notNull(),
  coach_id: uuid("coach_id").references(() => profilesTable.id),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Athletes table
export const athletesTable = pgTable("athletes", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  parent_id: uuid("parent_id").references(() => profilesTable.id).notNull(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  date_of_birth: text("date_of_birth").notNull(),
  graduation_year: integer("graduation_year").notNull(),
  tags: text("tags").array().default([]),
  paid_through_date: text("paid_through_date"),
  is_locked: boolean("is_locked").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Athlete team roster (dual-rostering support)
export const athleteTeamRostersTable = pgTable("athlete_team_rosters", {
  id: uuid("id").primaryKey().defaultRandom(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  team_id: uuid("team_id").references(() => teamsTable.id).notNull(),
  program_id: uuid("program_id").references(() => programsTable.id).notNull(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  contract_signed: boolean("contract_signed").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Facilities table
export const facilitiesTable = pgTable("facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Courts/Fields table (belongs to facilities)
export const courtsTable = pgTable("courts", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  facility_id: uuid("facility_id").references(() => facilitiesTable.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Sessions table
export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  team_id: uuid("team_id").references(() => teamsTable.id),
  program_id: uuid("program_id").references(() => programsTable.id).notNull(),
  facility_id: uuid("facility_id").references(() => facilitiesTable.id),
  court_id: uuid("court_id").references(() => courtsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  session_type: text("session_type", { enum: ["practice", "clinic", "drop_in"] }).notNull(),
  start_time: timestamp("start_time").notNull(),
  end_time: timestamp("end_time").notNull(),
  location: text("location"),
  capacity: integer("capacity"),
  drop_in_price: decimal("drop_in_price", { precision: 10, scale: 2 }),
  status: text("status", { enum: ["scheduled", "cancelled", "completed"] }).default("scheduled").notNull(),
  cancellation_reason: text("cancellation_reason"),
  recurrence_group_id: uuid("recurrence_group_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Registrations table
export const registrationsTable = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  session_id: uuid("session_id").references(() => sessionsTable.id).notNull(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  checked_in: boolean("checked_in").default(false).notNull(),
  check_in_time: timestamp("check_in_time"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Contracts table
export const contractsTable = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  program_id: uuid("program_id").references(() => programsTable.id).notNull(),
  template_id: uuid("template_id").references(() => contractTemplatesTable.id).notNull(),
  signed_at: timestamp("signed_at"),
  signature_data: text("signature_data"),
  status: text("status", { enum: ["pending", "signed", "expired"] }).default("pending").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Payments table
export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  payment_type: text("payment_type", { enum: ["monthly", "clinic", "drop_in", "cash", "event"] }).notNull(),
  payment_method: text("payment_method", { enum: ["credit_card", "ach", "cash"] }).notNull(),
  helcim_transaction_id: text("helcim_transaction_id"),
  months_paid: integer("months_paid"),
  status: text("status", { enum: ["pending", "completed", "failed"] }).default("pending").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Platform ledger table
export const platformLedgerTable = pgTable("platform_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  payment_id: uuid("payment_id").references(() => paymentsTable.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fee_type: text("fee_type", { enum: ["monthly", "clinic", "drop_in", "event"] }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Events table - standalone events like clinics, camps, tryouts
export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  program_id: uuid("program_id").references(() => programsTable.id),
  team_id: uuid("team_id").references(() => teamsTable.id),
  title: text("title").notNull(),
  description: text("description"),
  event_type: text("event_type", { enum: ["clinic", "camp", "tryout", "tournament", "other"] }).notNull(),
  start_time: timestamp("start_time").notNull(),
  end_time: timestamp("end_time").notNull(),
  location: text("location"),
  capacity: integer("capacity"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["scheduled", "cancelled", "completed"] }).default("scheduled").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Event rosters table - athletes registered for events
export const eventRostersTable = pgTable("event_rosters", {
  id: uuid("id").primaryKey().defaultRandom(),
  event_id: uuid("event_id").references(() => eventsTable.id).notNull(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  payment_id: uuid("payment_id").references(() => paymentsTable.id),
  checked_in: boolean("checked_in").default(false).notNull(),
  check_in_time: timestamp("check_in_time"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Event coaches table - coaches assigned to events
export const eventCoachesTable = pgTable("event_coaches", {
  id: uuid("id").primaryKey().defaultRandom(),
  event_id: uuid("event_id").references(() => eventsTable.id).notNull(),
  coach_id: uuid("coach_id").references(() => profilesTable.id).notNull(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============ TYPE DEFINITIONS (for compatibility) ============

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
  billing_card_token?: string;
  billing_card_last_four?: string;
  billing_customer_code?: string;
  billing_bank_token?: string;
  billing_bank_last_four?: string;
  billing_method?: 'card' | 'bank';
  coaches_can_bill: boolean;
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

export interface ClubForm {
  id: string;
  club_id: string;
  name: string;
  url: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  club_id: string;
  has_signed_documents: boolean;
  can_bill: boolean;
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

export interface ProgramContract {
  id: string;
  club_id: string;
  program_id: string;
  team_id?: string;
  name: string;
  description?: string;
  monthly_price: number;
  paid_in_full_price?: number;
  initiation_fee?: number;
  sessions_per_week: number;
  contract_document_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface AthleteContract {
  id: string;
  club_id: string;
  athlete_id: string;
  program_contract_id: string;
  start_date: string;
  end_date?: string;
  custom_price?: number;
  payment_plan: 'paid_in_full' | 'monthly';
  signed_name?: string;
  signed_at?: string;
  initiation_fee_paid: boolean;
  status: 'active' | 'cancelled' | 'expired';
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
  graduation_year: number;
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
  contract_signed: boolean;
  created_at: string;
}

export interface Facility {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Court {
  id: string;
  club_id: string;
  facility_id: string;
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
  court_id?: string;
  title: string;
  description?: string;
  session_type: 'practice' | 'clinic' | 'drop_in';
  start_time: string;
  end_time: string;
  location?: string;
  capacity?: number;
  drop_in_price?: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  cancellation_reason?: string;
  recurrence_group_id?: string;
  created_at: string;
}

export interface Event {
  id: string;
  club_id: string;
  program_id?: string;
  team_id?: string;
  title: string;
  description?: string;
  event_type: 'clinic' | 'camp' | 'tryout' | 'tournament' | 'other';
  start_time: string;
  end_time: string;
  location?: string;
  capacity?: number;
  price: number;
  status: 'scheduled' | 'cancelled' | 'completed';
  created_at: string;
}

export interface EventRoster {
  id: string;
  event_id: string;
  athlete_id: string;
  club_id: string;
  payment_id?: string;
  checked_in: boolean;
  check_in_time?: string;
  created_at: string;
}

export interface EventCoach {
  id: string;
  event_id: string;
  coach_id: string;
  club_id: string;
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
  payment_type: 'monthly' | 'clinic' | 'drop_in' | 'cash' | 'event';
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

// ============ ZOD SCHEMAS ============

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
  graduation_year: z.number().min(2020).max(2040, "Invalid graduation year"),
  tags: z.array(z.string()).default([]),
});

export const insertFacilitySchema = z.object({
  name: z.string().min(1, "Facility name is required"),
  description: z.string().optional(),
});

export const insertCourtSchema = z.object({
  facility_id: z.string().min(1, "Facility is required"),
  name: z.string().min(1, "Court/Field name is required"),
  description: z.string().optional(),
});

export const insertSessionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  session_type: z.enum(['practice', 'clinic', 'drop_in']),
  team_id: z.string().optional(),
  program_id: z.string().min(1, "Program is required"),
  facility_id: z.string().optional(),
  court_id: z.string().optional(),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location: z.string().optional(),
  capacity: z.number().optional(),
  drop_in_price: z.number().optional(),
});

export const insertProgramContractSchema = z.object({
  program_id: z.string().min(1, "Program is required"),
  team_id: z.string().optional(),
  name: z.string().min(1, "Contract name is required"),
  description: z.string().optional(),
  monthly_price: z.number().min(0, "Price must be positive"),
  paid_in_full_price: z.number().min(0).optional(),
  initiation_fee: z.number().min(0).optional(),
  sessions_per_week: z.number().min(1, "At least 1 session per week required").max(7, "Maximum 7 sessions per week"),
  contract_document_url: z.string().optional(),
});

export const insertAthleteContractSchema = z.object({
  athlete_id: z.string().min(1, "Athlete is required"),
  program_contract_id: z.string().min(1, "Contract is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  custom_price: z.number().min(0).optional(),
  payment_plan: z.enum(["paid_in_full", "monthly"]).default("monthly"),
  signed_name: z.string().optional(),
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

// Event schemas
export const insertEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  event_type: z.enum(['clinic', 'camp', 'tryout', 'tournament', 'other']),
  program_id: z.string().optional(),
  team_id: z.string().optional(),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location: z.string().optional(),
  capacity: z.number().optional(),
  price: z.number().min(0, "Price must be non-negative"),
});

export const insertEventRosterSchema = z.object({
  event_id: z.string().min(1, "Event is required"),
  athlete_id: z.string().min(1, "Athlete is required"),
});

export const insertEventCoachSchema = z.object({
  event_id: z.string().min(1, "Event is required"),
  coach_id: z.string().min(1, "Coach is required"),
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
export type InsertCourt = z.infer<typeof insertCourtSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertProgramContract = z.infer<typeof insertProgramContractSchema>;
export type InsertAthleteContract = z.infer<typeof insertAthleteContractSchema>;
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export type TimeBlock = z.infer<typeof timeBlockSchema>;
export type CreateRecurringSession = z.infer<typeof createRecurringSessionSchema>;
export type CashPayment = z.infer<typeof cashPaymentSchema>;
export type CancelSession = z.infer<typeof cancelSessionSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertEventRoster = z.infer<typeof insertEventRosterSchema>;
export type InsertEventCoach = z.infer<typeof insertEventCoachSchema>;
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
