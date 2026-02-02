import { z } from "zod";
import { pgTable, text, integer, boolean, timestamp, decimal, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============ DRIZZLE TABLE DEFINITIONS ============

// Communication settings type for clubs
export type CommunicationSettings = {
  include_director_in_chats: boolean;
};

// Sport types for clubs
export type SportType = 'soccer' | 'football' | 'basketball' | 'indoor_volleyball' | 'beach_volleyball';

// Clubs table
export const clubsTable = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sport: text("sport", { enum: ["soccer", "football", "basketball", "indoor_volleyball", "beach_volleyball"] }),
  logo_url: text("logo_url"),
  address: text("address"),
  join_code: text("join_code").notNull().unique(),
  contract_pdf_url: text("contract_pdf_url"),
  waiver_content: text("waiver_content"),
  waiver_version: integer("waiver_version").default(1),
  contract_version: integer("contract_version").default(1),
  contract_url: text("contract_url"), // External contract signing link (PandaDoc, SignWell, etc.)
  contract_instructions: text("contract_instructions"), // Instructions for signing contracts
  onboarding_complete: boolean("onboarding_complete").default(false).notNull(),
  billing_card_token: text("billing_card_token"),
  billing_card_last_four: text("billing_card_last_four"),
  billing_customer_code: text("billing_customer_code"),
  billing_bank_token: text("billing_bank_token"),
  billing_bank_last_four: text("billing_bank_last_four"),
  billing_method: text("billing_method", { enum: ["card", "bank"] }),
  coaches_can_bill: boolean("coaches_can_bill").default(false).notNull(),
  communication_settings: jsonb("communication_settings").$type<CommunicationSettings>().default({ include_director_in_chats: false }),
  current_season_id: uuid("current_season_id"), // Reference to active season (set after seasons table created)
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Seasons table - defines club seasons for automatic data cleanup
export const seasonsTable = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  name: text("name").notNull(), // e.g., "Fall 2025", "Spring 2026"
  start_date: timestamp("start_date").notNull(),
  end_date: timestamp("end_date").notNull(),
  is_active: boolean("is_active").default(false).notNull(),
  chat_data_deleted: boolean("chat_data_deleted").default(false).notNull(), // Flag to track if cleanup ran
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clubIdIdx: index("seasons_club_id_idx").on(table.club_id),
  activeIdx: index("seasons_active_idx").on(table.club_id, table.is_active),
}));

// Profiles (users) table - linked to Supabase Auth
export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey(), // Links to Supabase auth.users.id
  email: text("email").notNull().unique(),
  full_name: text("full_name").notNull(),
  role: text("role", { enum: ["admin", "coach", "parent", "athlete", "owner"] }).notNull(),
  club_id: uuid("club_id").references(() => clubsTable.id),
  has_signed_documents: boolean("has_signed_documents").default(false).notNull(),
  can_bill: boolean("can_bill").default(false).notNull(),
  contract_status: text("contract_status", { enum: ["unsigned", "pending", "verified"] }).default("unsigned"),
  contract_method: text("contract_method", { enum: ["digital", "paper"] }),
  athlete_id: uuid("athlete_id"), // For athlete role users - links to their athlete record
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
  program_id: uuid("program_id"), // Optional - form only visible to athletes in this program
  team_id: uuid("team_id"), // Optional - form only visible to athletes on this team
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Club form views table - tracks when users click on forms
export const clubFormViewsTable = pgTable("club_form_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  form_id: uuid("form_id").references(() => clubFormsTable.id).notNull(),
  user_id: uuid("user_id").references(() => profilesTable.id).notNull(),
  viewed_at: timestamp("viewed_at").defaultNow().notNull(),
});

// ============ MESSAGING SYSTEM (SafeSport Compliant) ============

// Chat channels table
export const chatChannelsTable = pgTable("chat_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  name: text("name"), // Optional name for group chats
  channel_type: text("channel_type", { enum: ["direct", "team", "program", "group", "event"] }).notNull(),
  audience_type: text("audience_type", { enum: ["individual", "roster", "team", "program", "event"] }).default("individual"), // Telegram-style targeting
  team_id: uuid("team_id"), // Optional - for team/roster channels
  program_id: uuid("program_id"), // Optional - for program channels
  event_id: uuid("event_id"), // Optional - for event roster channels
  created_by: uuid("created_by").references(() => profilesTable.id).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clubIdIdx: index("chat_channels_club_id_idx").on(table.club_id),
  teamIdIdx: index("chat_channels_team_id_idx").on(table.team_id),
  eventIdIdx: index("chat_channels_event_id_idx").on(table.event_id),
}));

// Channel participants table
export const channelParticipantsTable = pgTable("channel_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel_id: uuid("channel_id").references(() => chatChannelsTable.id).notNull(),
  user_id: uuid("user_id").references(() => profilesTable.id).notNull(),
  role: text("role", { enum: ["admin", "coach", "parent", "athlete", "owner"] }).notNull(),
  athlete_id: uuid("athlete_id"), // If participant is an athlete (for SafeSport tracking)
  is_director_auto_added: boolean("is_director_auto_added").default(false).notNull(), // Track if director was auto-added
  last_read_at: timestamp("last_read_at"),
  joined_at: timestamp("joined_at").defaultNow().notNull(),
}, (table) => ({
  channelIdIdx: index("channel_participants_channel_id_idx").on(table.channel_id),
  userIdIdx: index("channel_participants_user_id_idx").on(table.user_id),
}));

// Messages table (indexed for 1M+ scaling)
export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel_id: uuid("channel_id").references(() => chatChannelsTable.id).notNull(),
  sender_id: uuid("sender_id").references(() => profilesTable.id).notNull(),
  content: text("content").notNull(),
  message_type: text("message_type", { enum: ["text", "system"] }).default("text").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
  deleted_at: timestamp("deleted_at"), // Soft delete
}, (table) => ({
  channelIdIdx: index("messages_channel_id_idx").on(table.channel_id),
  channelCreatedIdx: index("messages_channel_created_idx").on(table.channel_id, table.created_at),
  senderIdIdx: index("messages_sender_id_idx").on(table.sender_id),
}));

// ============ BULLETIN BOARD SYSTEM ============

// Bulletin posts table
export const bulletinPostsTable = pgTable("bulletin_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  audience_type: text("audience_type", { enum: ["club", "roster", "team", "program", "event"] }).default("club"), // Telegram-style targeting
  team_id: uuid("team_id"), // Optional - for team/roster-specific posts
  program_id: uuid("program_id"), // Optional - for program-specific posts
  event_id: uuid("event_id"), // Optional - for event-specific posts
  author_id: uuid("author_id").references(() => profilesTable.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  is_pinned: boolean("is_pinned").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
}, (table) => ({
  clubIdIdx: index("bulletin_posts_club_id_idx").on(table.club_id),
  teamIdIdx: index("bulletin_posts_team_id_idx").on(table.team_id),
  eventIdIdx: index("bulletin_posts_event_id_idx").on(table.event_id),
  createdAtIdx: index("bulletin_posts_created_at_idx").on(table.created_at),
}));

// Bulletin reads table - tracks who has read each post
export const bulletinReadsTable = pgTable("bulletin_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  post_id: uuid("post_id").references(() => bulletinPostsTable.id).notNull(),
  user_id: uuid("user_id").references(() => profilesTable.id).notNull(),
  is_hidden: boolean("is_hidden").default(false).notNull(), // User can hide from their board
  read_at: timestamp("read_at").defaultNow().notNull(),
}, (table) => ({
  postIdIdx: index("bulletin_reads_post_id_idx").on(table.post_id),
  userIdIdx: index("bulletin_reads_user_id_idx").on(table.user_id),
  postUserIdx: index("bulletin_reads_post_user_idx").on(table.post_id, table.user_id),
}));

// ============ PUSH NOTIFICATIONS ============

// Push subscriptions table - stores FCM tokens
export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => profilesTable.id).notNull(),
  fcm_token: text("fcm_token").notNull(),
  device_type: text("device_type", { enum: ["web", "ios", "android"] }).default("web").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at"),
}, (table) => ({
  userIdIdx: index("push_subscriptions_user_id_idx").on(table.user_id),
  fcmTokenIdx: index("push_subscriptions_fcm_token_idx").on(table.fcm_token),
}));

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
  season_id: uuid("season_id").references(() => seasonsTable.id), // Track which season this signature applies to
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
  docuseal_template_id: text("docuseal_template_id"), // DocuSeal template ID for e-signatures
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

// Contract submissions table - tracks DocuSeal per-athlete submissions
export const contractSubmissionsTable = pgTable("contract_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  club_id: uuid("club_id").references(() => clubsTable.id).notNull(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  program_contract_id: uuid("program_contract_id").references(() => programContractsTable.id),
  program_id: uuid("program_id").references(() => programsTable.id),
  team_id: uuid("team_id"),
  docuseal_submission_id: text("docuseal_submission_id").notNull(),
  docuseal_signer_slug: text("docuseal_signer_slug"),
  signer_url: text("signer_url"),
  external_id: text("external_id").notNull(), // Unique identifier for webhook matching
  status: text("status", { enum: ["sent", "viewed", "signed"] }).default("sent").notNull(),
  signed_at: timestamp("signed_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  athleteIdx: index("contract_submissions_athlete_idx").on(table.athlete_id),
  submissionIdx: index("contract_submissions_submission_idx").on(table.docuseal_submission_id),
  externalIdIdx: index("contract_submissions_external_id_idx").on(table.external_id),
}));

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
  // Release status for club transfers
  is_released: boolean("is_released").default(false).notNull(),
  released_at: timestamp("released_at"),
  released_by: uuid("released_by").references(() => profilesTable.id),
  // Athlete login credentials (optional - set by parent)
  email: text("email").unique(),
  has_login: boolean("has_login").default(false).notNull(),
  user_id: uuid("user_id").references(() => profilesTable.id),
  // Membership numbers (for volleyball sports)
  volleyball_life_number: text("volleyball_life_number"),
  avp_number: text("avp_number"),
  bvca_number: text("bvca_number"),
  aau_number: text("aau_number"),
  bvne_number: text("bvne_number"),
  p1440_number: text("p1440_number"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Athlete team roster (dual-rostering support, team_id optional for program-only enrollment)
export const athleteTeamRostersTable = pgTable("athlete_team_rosters", {
  id: uuid("id").primaryKey().defaultRandom(),
  athlete_id: uuid("athlete_id").references(() => athletesTable.id).notNull(),
  team_id: uuid("team_id").references(() => teamsTable.id),
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
export type UserRole = 'admin' | 'coach' | 'parent' | 'athlete' | 'owner';

// Base types matching Supabase tables
export interface Club {
  id: string;
  name: string;
  sport?: SportType;
  logo_url?: string;
  address?: string;
  join_code: string;
  contract_pdf_url?: string;
  waiver_content?: string;
  waiver_version?: number;
  contract_version?: number;
  contract_url?: string;
  contract_instructions?: string;
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
  program_id?: string;
  team_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface ClubFormView {
  id: string;
  club_id: string;
  form_id: string;
  user_id: string;
  viewed_at: string;
}

export type ContractStatus = 'unsigned' | 'pending' | 'verified';
export type ContractMethod = 'digital' | 'paper';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  club_id: string;
  has_signed_documents: boolean;
  can_bill: boolean;
  contract_status?: ContractStatus;
  contract_method?: ContractMethod;
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
  docuseal_template_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface ContractSubmission {
  id: string;
  club_id: string;
  athlete_id: string;
  program_contract_id?: string;
  program_id?: string;
  team_id?: string;
  docuseal_submission_id: string;
  docuseal_signer_slug?: string;
  signer_url?: string;
  external_id: string;
  status: 'sent' | 'viewed' | 'signed';
  signed_at?: string;
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
  is_released: boolean;
  released_at?: string;
  released_by?: string;
  email?: string;
  has_login: boolean;
  user_id?: string;
  volleyball_life_number?: string;
  avp_number?: string;
  bvca_number?: string;
  aau_number?: string;
  bvne_number?: string;
  p1440_number?: string;
  created_at: string;
}

export interface AthleteTeamRoster {
  id: string;
  athlete_id: string;
  team_id: string | null;
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

// ============ MESSAGING SCHEMAS ============

export const createChatChannelSchema = z.object({
  name: z.string().optional(),
  channel_type: z.enum(["direct", "team", "program", "group", "event"]),
  team_id: z.string().optional(),
  program_id: z.string().optional(),
  participant_ids: z.array(z.string()).min(1, "At least one participant required"),
});

export const sendMessageSchema = z.object({
  channel_id: z.string().min(1, "Channel is required"),
  content: z.string().min(1, "Message cannot be empty"),
});

// ============ BULLETIN BOARD SCHEMAS ============

export const createBulletinPostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  team_id: z.string().optional(),
  program_id: z.string().optional(),
  is_pinned: z.boolean().optional(),
});

export const updateBulletinPostSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  is_pinned: z.boolean().optional(),
});

export const markBulletinReadSchema = z.object({
  post_id: z.string().min(1, "Post ID is required"),
  is_hidden: z.boolean().optional(),
});

// ============ PUSH NOTIFICATION SCHEMAS ============

export const registerPushTokenSchema = z.object({
  fcm_token: z.string().min(1, "FCM token is required"),
  device_type: z.enum(["web", "ios", "android"]).optional(),
});

// ============ COMMUNICATION SETTINGS SCHEMA ============

export const updateCommunicationSettingsSchema = z.object({
  include_director_in_chats: z.boolean(),
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

// Messaging types
export type ChatChannel = typeof chatChannelsTable.$inferSelect;
export type ChannelParticipant = typeof channelParticipantsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type CreateChatChannel = z.infer<typeof createChatChannelSchema>;
export type SendMessage = z.infer<typeof sendMessageSchema>;

// Bulletin board types
export type BulletinPost = typeof bulletinPostsTable.$inferSelect;
export type BulletinRead = typeof bulletinReadsTable.$inferSelect;
export type CreateBulletinPost = z.infer<typeof createBulletinPostSchema>;
export type UpdateBulletinPost = z.infer<typeof updateBulletinPostSchema>;
export type MarkBulletinRead = z.infer<typeof markBulletinReadSchema>;

// Push notification types
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
export type RegisterPushToken = z.infer<typeof registerPushTokenSchema>;

// Communication settings types
export type UpdateCommunicationSettings = z.infer<typeof updateCommunicationSettingsSchema>;

// Season types
export type Season = typeof seasonsTable.$inferSelect;
export const insertSeasonSchema = createInsertSchema(seasonsTable).omit({ id: true, created_at: true, chat_data_deleted: true });
export type InsertSeason = z.infer<typeof insertSeasonSchema>;

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
    // 3% surcharge for credit card
    return amount * 1.03;
  } else if (method === 'ach') {
    // $1.00 flat fee for ACH
    return amount + 1.00;
  }
  // No fee for cash
  return amount;
};

export const getConvenienceFeeAmount = (amount: number, method: 'credit_card' | 'ach' | 'cash'): number => {
  if (method === 'credit_card') {
    return amount * 0.03;
  } else if (method === 'ach') {
    return 1.00;
  }
  return 0;
};

// Platform fee calculations
export const PLATFORM_FEES = {
  monthly: 3.00,
  event: 1.00,
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
