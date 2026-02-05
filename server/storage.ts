import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";

// Types matching Supabase tables
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
  billing_day?: number;
  billing_locked_at?: string;
  last_billed_at?: string;
  last_billed_period_start?: string;
  // Helcim subscription billing (Model A)
  helcim_subscription_id?: string;
  helcim_plan_id?: number;
  // DocuSeal onboarding status
  docuseal_onboarded: boolean;
  docuseal_team_name?: string;
  docuseal_onboarded_at?: string;
  docuseal_onboarded_by_user_id?: string;
  created_at: string;
}

export interface DocuSealSetupRequest {
  id: string;
  club_id: string;
  requested_by_user_id?: string | null;
  requested_by_email: string;
  requested_at: string;
  status: 'open' | 'in_progress' | 'completed' | 'rejected';
  notes?: string | null;
  payload?: {
    program_name?: string;
    team_name?: string;
    template_id?: string;
    contract_name?: string;
  } | null;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'coach' | 'parent' | 'athlete' | 'owner';
  club_id?: string | null;
  has_signed_documents: boolean;
  can_bill: boolean;
  contract_status?: 'unsigned' | 'pending' | 'verified';
  contract_method?: 'digital' | 'paper';
  athlete_id?: string;
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
  season_id?: string | null;
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
  graduation_year: number;
  tags: string[];
  paid_through_date?: string;
  is_locked: boolean;
  is_released: boolean;
  released_at?: string;
  released_by?: string;
  email?: string;
  has_login: boolean;
  user_id?: string; // Athlete's own user profile (when they have login)
  food_allergies?: string;
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
  payment_plan: 'monthly' | 'paid_in_full';
  signed_name?: string;
  signed_at?: string;
  initiation_fee_paid: boolean;
  status: 'active' | 'cancelled' | 'expired';
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
  fee_type: 'monthly' | 'clinic' | 'drop_in' | 'event';
  paid: boolean;
  platform_invoice_id: string | null;
  created_at: string;
}

export interface PlatformInvoice {
  id: string;
  club_id: string;
  period_start: string;
  period_end: string;
  subtotal_amount: number;
  fee_amount: number;
  total_amount: number;
  payment_method: 'credit_card' | 'ach';
  status: 'draft' | 'paid' | 'failed';
  helcim_transaction_id: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
}

// ============ MESSAGING TYPES ============

export interface ChatChannel {
  id: string;
  club_id: string;
  name?: string;
  channel_type: 'direct' | 'team' | 'program' | 'group';
  team_id?: string;
  program_id?: string;
  created_by: string;
  created_at: string;
}

export interface ChannelParticipant {
  id: string;
  channel_id: string;
  user_id: string;
  role: string;
  athlete_id?: string;
  is_director_auto_added: boolean;
  last_read_at?: string;
  joined_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system';
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

// ============ BULLETIN BOARD TYPES ============

export interface BulletinPost {
  id: string;
  club_id: string;
  team_id?: string;
  program_id?: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BulletinRead {
  id: string;
  post_id: string;
  user_id: string;
  is_hidden: boolean;
  read_at: string;
}

// ============ PUSH NOTIFICATION TYPES ============

export interface PushSubscription {
  id: string;
  user_id: string;
  fcm_token: string;
  device_type: 'web' | 'ios' | 'android';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// Platform fee constants
export const PLATFORM_FEES = {
  monthly: 3.00,
  event: 1.00,
  drop_in: 0.75,
} as const;

// Storage interface
export interface IStorage {
  // Auth & Clubs
  createClub(name: string, directorEmail: string, directorName: string, directorPassword: string): Promise<{ club: Club; user: User }>;
  createClubOnly(name: string, sport: string): Promise<Club>;
  deleteClub(clubId: string): Promise<void>;
  getClubByJoinCode(joinCode: string): Promise<Club | undefined>;
  getClub(clubId: string): Promise<Club | undefined>;
  getAllClubs(): Promise<Club[]>;
  updateClubSettings(clubId: string, settings: { name?: string; address?: string; logo_url?: string }): Promise<Club>;
  updateClubSport(clubId: string, sport: string): Promise<Club>;
  updateClubDocuments(clubId: string, contractPdfUrl: string | undefined, waiverContent: string): Promise<Club>;
  updateClubBillingCard(clubId: string, cardToken: string, lastFour: string, customerCode?: string): Promise<Club>;
  updateClubBillingBank(clubId: string, bankToken: string, lastFour: string): Promise<Club>;
  completeOnboarding(clubId: string): Promise<Club>;
  regenerateClubCode(clubId: string): Promise<Club>;
  
  // Club Contract Compliance Settings
  updateClubContractSettings(clubId: string, contractUrl: string | undefined, contractInstructions: string | undefined): Promise<Club>;
  
  // Club Billing Settings
  updateClubBillingDay(clubId: string, billingDay: number): Promise<Club>;
  lockClub(clubId: string): Promise<Club>;
  unlockClub(clubId: string): Promise<Club>;
  updateClubBillingStatus(clubId: string, lastBilledAt: Date, lastBilledPeriodStart: Date): Promise<Club>;
  
  // Platform Revenue Metrics (Parent-paid tech fees)
  getPlatformRevenueMetrics(startDate: Date, endDate: Date): Promise<{
    total_tech_fees: number;
    total_payments: number;
    payment_count: number;
    avg_fee_per_payment: number;
    by_payment_rail: {
      card_credit: { count: number; total: number };
      card_debit: { count: number; total: number };
      ach: { count: number; total: number };
    };
    by_payment_kind: {
      recurring: { count: number; total: number };
      one_time: { count: number; total: number };
    };
    trend_vs_previous: number;
  }>;
  getPlatformRevenuePayments(startDate: Date, endDate: Date, limit: number): Promise<Array<{
    id: string;
    amount: number;
    base_amount: number;
    tech_fee_amount: number;
    payment_rail: string;
    payment_kind: string;
    fee_version: string;
    status: string;
    created_at: string;
    club_name: string;
    athlete_name: string;
  }>>;
  getClubsDueToBill(dayOfMonth: number): Promise<Club[]>;
  getLockedClubs(): Promise<Club[]>;
  getClubsPastGracePeriod(gracePeriodDays: number): Promise<Club[]>;
  
  // Users
  getUserById(userId: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getCoaches(clubId: string): Promise<User[]>;
  getParents(clubId: string): Promise<User[]>;
  getUser(userId: string): Promise<User | null>;
  createUser(clubId: string, email: string, fullName: string, password: string, role: 'coach' | 'parent'): Promise<User>;
  createProfile(profile: { id: string; email: string; full_name: string; role: 'athlete'; club_id: string; athlete_id: string }): Promise<void>;
  updateUserSignedDocuments(userId: string): Promise<void>;
  updateUserBillingPermission(userId: string, canBill: boolean): Promise<User | null>;
  updateUserContractStatus(userId: string, status: 'unsigned' | 'pending' | 'verified', method?: 'digital' | 'paper'): Promise<User | null>;
  getUsersWithContractStatus(clubId: string): Promise<User[]>;
  
  // Signatures
  createSignature(clubId: string, userId: string, documentType: 'contract' | 'waiver', documentVersion: number, signedName: string, ipAddress?: string): Promise<ClubSignature>;
  createSignatureWithSeason(clubId: string, userId: string, documentType: 'contract' | 'waiver', documentVersion: number, signedName: string, ipAddress: string | undefined, seasonId: string | null): Promise<ClubSignature>;
  getUserSignatures(clubId: string, userId: string): Promise<ClubSignature[]>;
  hasSignedCurrentDocuments(clubId: string, userId: string): Promise<boolean>;
  
  // Auth validation
  validateUserPassword(email: string, password: string): Promise<User | null>;

  // Programs
  getPrograms(clubId: string): Promise<Program[]>;
  getProgram(clubId: string, programId: string): Promise<Program | undefined>;
  createProgram(clubId: string, program: Omit<Program, 'id' | 'club_id' | 'created_at'>): Promise<Program>;
  deleteProgram(clubId: string, programId: string): Promise<void>;

  // Teams
  getTeams(clubId: string): Promise<Team[]>;
  getTeamsByCoach(clubId: string, coachId: string): Promise<Team[]>;
  getTeam(clubId: string, teamId: string): Promise<Team | undefined>;
  createTeam(clubId: string, team: Omit<Team, 'id' | 'club_id' | 'created_at'>): Promise<Team>;
  updateTeam(clubId: string, teamId: string, data: { name?: string; coach_id?: string | null }): Promise<Team>;
  deleteTeam(clubId: string, teamId: string): Promise<void>;

  // Club Forms (Google Forms links)
  getClubForms(clubId: string): Promise<ClubForm[]>;
  getClubForm(clubId: string, formId: string): Promise<ClubForm | undefined>;
  createClubForm(clubId: string, form: Omit<ClubForm, 'id' | 'club_id' | 'is_active' | 'created_at'>): Promise<ClubForm>;
  updateClubForm(clubId: string, formId: string, data: { name?: string; url?: string; description?: string; program_id?: string | null; team_id?: string | null; is_active?: boolean }): Promise<ClubForm>;
  deleteClubForm(clubId: string, formId: string): Promise<void>;
  
  // Club Form Views (tracking when users click on forms)
  getFormViewsByUser(clubId: string, userId: string): Promise<ClubFormView[]>;
  markFormAsViewed(clubId: string, formId: string, userId: string): Promise<ClubFormView>;
  getFormsForAthlete(clubId: string, athleteId: string, userId: string): Promise<(ClubForm & { viewed: boolean })[]>;

  // Facilities
  getFacilities(clubId: string): Promise<Facility[]>;
  getFacility(clubId: string, facilityId: string): Promise<Facility | undefined>;
  createFacility(clubId: string, facility: Omit<Facility, 'id' | 'club_id' | 'created_at'>): Promise<Facility>;
  updateFacility(clubId: string, facilityId: string, data: { name?: string; description?: string }): Promise<Facility>;
  deleteFacility(clubId: string, facilityId: string): Promise<void>;

  // Courts
  getCourts(clubId: string, facilityId?: string): Promise<Court[]>;
  getCourt(clubId: string, courtId: string): Promise<Court | undefined>;
  createCourt(clubId: string, court: Omit<Court, 'id' | 'club_id' | 'created_at'>): Promise<Court>;
  updateCourt(clubId: string, courtId: string, data: { name?: string; description?: string }): Promise<Court>;
  deleteCourt(clubId: string, courtId: string): Promise<void>;

  // Athletes
  getAthletes(clubId: string): Promise<Athlete[]>;
  getAthlete(clubId: string, athleteId: string): Promise<Athlete | undefined>;
  getAthletesByParent(clubId: string, parentId: string): Promise<Athlete[]>;
  getAthletesByParentAcrossClubs(parentId: string): Promise<Athlete[]>;
  getUnassignedAthletes(clubId: string, programId: string): Promise<Athlete[]>;
  getAthleteAssignmentOverview(clubId: string): Promise<{
    totalAthletes: number;
    assignedCount: number;
    unassignedCount: number;
    unassignedAthletes: Array<{ id: string; first_name: string; last_name: string; parent_name: string }>;
    assignmentsByProgram: Array<{ program_id: string; program_name: string; athlete_count: number }>;
  }>;
  createAthlete(clubId: string, athlete: Omit<Athlete, 'id' | 'club_id' | 'is_locked' | 'is_released' | 'has_login' | 'created_at'>): Promise<Athlete>;
  updateAthlete(athleteId: string, updates: Partial<Pick<Athlete, 'email' | 'has_login' | 'user_id'>>): Promise<void>;
  updateAthletePaidThrough(clubId: string, athleteId: string, paidThroughDate: string): Promise<void>;
  releaseAthlete(clubId: string, athleteId: string, releasedBy: string | null, releaseType?: 'manual' | 'automated'): Promise<{ contractIds: string[] }>;
  revokeAthleteRelease(clubId: string, athleteId: string): Promise<void>;

  // Roster
  assignAthleteToTeam(clubId: string, athleteId: string, teamId: string, programId: string): Promise<AthleteTeamRoster>;
  assignAthleteToProgram(clubId: string, athleteId: string, programId: string, contractSigned?: boolean): Promise<AthleteTeamRoster>;
  getTeamRoster(clubId: string, teamId: string): Promise<AthleteTeamRoster[]>;
  getProgramRoster(clubId: string, programId: string): Promise<AthleteTeamRoster[]>;
  getRoster(clubId: string): Promise<AthleteTeamRoster[]>;
  updateRosterContractStatus(clubId: string, rosterId: string, contractSigned: boolean): Promise<AthleteTeamRoster>;
  removeFromRoster(clubId: string, rosterId: string): Promise<void>;

  // Sessions
  getSessions(clubId: string): Promise<Session[]>;
  getSession(clubId: string, sessionId: string): Promise<Session | undefined>;
  getSessionsForAthlete(clubId: string, athleteId: string): Promise<Session[]>;
  createSession(clubId: string, session: Omit<Session, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<Session>;
  cancelSession(clubId: string, sessionId: string, reason: string): Promise<void>;
  deleteSession(clubId: string, sessionId: string): Promise<void>;
  checkSessionConflict(clubId: string, startTime: string, endTime: string, facilityId?: string, courtId?: string, excludeId?: string): Promise<{ conflict: boolean; overlapMinutes: number; conflictingSession?: Session }>;
  
  // Athlete access checking
  getAthleteRosterEntries(clubId: string, athleteId: string): Promise<AthleteTeamRoster[]>;
  isAthleteRegisteredForProgram(clubId: string, athleteId: string, programId: string): Promise<boolean>;

  // Registrations
  getSessionRegistrations(clubId: string, sessionId: string): Promise<(Registration & { athlete: Athlete })[]>;
  getAthleteRegistrations(clubId: string, athleteId: string): Promise<(Registration & { session: Session })[]>;
  createRegistration(clubId: string, sessionId: string, athleteId: string): Promise<Registration>;
  bulkCreateRegistrations(clubId: string, sessionId: string, athleteIds: string[]): Promise<Registration[]>;
  updateCheckIn(clubId: string, registrationId: string, checkedIn: boolean): Promise<void>;

  // Payments
  getPayments(clubId: string): Promise<Payment[]>;
  createPayment(clubId: string, payment: Omit<Payment, 'id' | 'club_id' | 'created_at'>): Promise<Payment>;
  createPlatformLedgerEntry(clubId: string, athleteId: string, amount: number, feeType: 'monthly' | 'clinic' | 'drop_in' | 'event', sessionId?: string): Promise<PlatformLedger>;
  createPlatformLedgerEntryRaw(clubId: string, athleteId: string, amount: number, entryType: 'monthly_athlete' | 'clinic_session' | 'drop_in_session', sessionId?: string): Promise<PlatformLedger>;
  getUnpaidLedgerEntriesByPeriod(periodStart: Date, periodEnd: Date): Promise<PlatformLedger[]>;
  getUnpaidLedgerEntriesByClubAndPeriod(clubId: string, periodStart: Date, periodEnd: Date): Promise<PlatformLedger[]>;
  getUnpaidLedgerEntriesByClub(clubId: string): Promise<PlatformLedger[]>;
  markLedgerEntriesPaid(ids: string[], invoiceId: string): Promise<void>;

  // Platform Invoices
  createPlatformInvoice(invoice: {
    club_id: string;
    period_start: Date;
    period_end: Date;
    subtotal_amount: number;
    fee_amount: number;
    total_amount: number;
    payment_method: 'credit_card' | 'ach';
    status: 'draft' | 'paid' | 'failed';
    helcim_transaction_id?: string;
    failure_reason?: string;
  }): Promise<PlatformInvoice>;
  getPlatformInvoice(invoiceId: string): Promise<PlatformInvoice | undefined>;
  getPlatformInvoicesByPeriod(periodStart: Date, periodEnd: Date): Promise<PlatformInvoice[]>;
  updatePlatformInvoiceStatus(invoiceId: string, status: 'paid' | 'failed', transactionId?: string, failureReason?: string): Promise<PlatformInvoice>;
  getClubDirectorEmail(clubId: string): Promise<string | null>;

  // Helcim Webhook Events (for idempotency)
  checkWebhookEventProcessed(eventId: string): Promise<boolean>;
  recordWebhookEvent(event: {
    event_id: string;
    event_type: string;
    transaction_id?: string;
    invoice_number?: string;
    amount?: number;
    status?: string;
    raw_payload?: any;
  }): Promise<void>;

  // Payment updates from webhooks
  updatePaymentByTransactionId(transactionId: string, status: 'completed' | 'failed'): Promise<void>;
  updatePlatformInvoiceByTransactionId(transactionId: string, status: 'paid' | 'failed'): Promise<void>;
  getPlatformInvoiceByTransactionId(transactionId: string): Promise<PlatformInvoice | undefined>;
  getPlatformInvoiceByInvoiceNumber(invoiceNumber: string): Promise<PlatformInvoice | undefined>;
  markLedgerEntriesPaidByInvoiceId(invoiceId: string): Promise<void>;
  unmarkLedgerEntriesByInvoiceId(invoiceId: string): Promise<void>;

  // Active athlete tracking for automatic monthly billing
  getActiveAthletesForPeriod(clubId: string, periodStart: Date, periodEnd: Date): Promise<Athlete[]>;
  getActiveAthleteCountByClub(periodStart: Date, periodEnd: Date): Promise<Array<{ clubId: string; clubName: string; activeAthleteCount: number }>>;
  hasMonthlyLedgerEntryForAthlete(clubId: string, athleteId: string, periodStart: Date, periodEnd: Date): Promise<boolean>;
  createAutoBillingLedgerEntry(clubId: string, athleteId: string, amount: number, feeType: 'monthly' | 'clinic' | 'drop_in' | 'event', billingPeriodStart: string): Promise<PlatformLedger>;

  // Program Contracts
  getProgramContracts(clubId: string, programId?: string): Promise<ProgramContract[]>;
  getProgramContract(clubId: string, contractId: string): Promise<ProgramContract | undefined>;
  createProgramContract(clubId: string, contract: Omit<ProgramContract, 'id' | 'club_id' | 'is_active' | 'created_at'>): Promise<ProgramContract>;
  updateProgramContract(clubId: string, contractId: string, data: { name?: string; description?: string; monthly_price?: number; paid_in_full_price?: number | null; initiation_fee?: number | null; sessions_per_week?: number; team_id?: string | null; contract_document_url?: string | null; is_active?: boolean }): Promise<ProgramContract>;
  deleteProgramContract(clubId: string, contractId: string): Promise<void>;

  // Athlete Contracts
  getAthleteContracts(clubId: string, athleteId?: string): Promise<AthleteContract[]>;
  getAthleteContract(clubId: string, contractId: string): Promise<AthleteContract | undefined>;
  createAthleteContract(clubId: string, contract: Omit<AthleteContract, 'id' | 'club_id' | 'status' | 'created_at' | 'initiation_fee_paid'>): Promise<AthleteContract>;
  updateAthleteContractStatus(clubId: string, contractId: string, status: 'active' | 'cancelled' | 'expired'): Promise<AthleteContract>;

  // Contract Submissions (DocuSeal)
  createContractSubmission(data: {
    club_id: string;
    athlete_id: string;
    program_contract_id?: string;
    program_id?: string;
    team_id?: string;
    docuseal_submission_id: string;
    docuseal_signer_slug?: string;
    signer_url?: string;
    external_id: string;
  }): Promise<ContractSubmission>;
  getContractSubmission(submissionId: string): Promise<ContractSubmission | undefined>;
  getContractSubmissionByExternalId(externalId: string): Promise<ContractSubmission | undefined>;
  getContractSubmissionByDocuSealId(docusealSubmissionId: string): Promise<ContractSubmission | undefined>;
  getContractSubmissionsForAthlete(athleteId: string): Promise<ContractSubmission[]>;
  updateContractSubmissionStatus(id: string, status: 'sent' | 'viewed' | 'signed', signedAt?: Date): Promise<ContractSubmission>;

  // Events
  getEvents(clubId: string, filters?: { programId?: string; teamId?: string }): Promise<Event[]>;
  getEvent(clubId: string, eventId: string): Promise<Event | undefined>;
  getEventsByCoach(clubId: string, coachId: string): Promise<Event[]>;
  getEventsForAthlete(clubId: string, athleteId: string): Promise<Event[]>;
  createEvent(clubId: string, event: Omit<Event, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<Event>;
  updateEvent(clubId: string, eventId: string, data: Partial<Omit<Event, 'id' | 'club_id' | 'created_at'>>): Promise<Event>;
  deleteEvent(clubId: string, eventId: string): Promise<void>;

  // Event Rosters
  getEventRosters(clubId: string, eventId: string): Promise<(EventRoster & { athlete: Athlete })[]>;
  getEventRosterById(clubId: string, rosterId: string): Promise<EventRoster | null>;
  addEventRoster(clubId: string, eventId: string, athleteId: string, paymentId?: string): Promise<EventRoster>;
  removeEventRoster(clubId: string, rosterId: string): Promise<void>;
  updateEventRosterCheckIn(clubId: string, rosterId: string, checkedIn: boolean): Promise<void>;
  updateEventRosterPayment(clubId: string, rosterId: string, paymentId: string): Promise<void>;

  // Event Coaches
  getEventCoaches(clubId: string, eventId: string): Promise<(EventCoach & { coach: User })[]>;
  setEventCoaches(clubId: string, eventId: string, coachIds: string[]): Promise<void>;

  // ============ MESSAGING SYSTEM ============
  
  // Communication Settings
  updateCommunicationSettings(clubId: string, settings: { include_director_in_chats: boolean }): Promise<Club>;
  getCommunicationSettings(clubId: string): Promise<{ include_director_in_chats: boolean }>;
  
  // Chat Channels
  createChatChannel(
    clubId: string, 
    createdBy: string, 
    channelType: 'direct' | 'team' | 'program' | 'group' | 'event',
    participantIds: string[],
    options?: { name?: string; teamId?: string; programId?: string; eventId?: string }
  ): Promise<ChatChannel>;
  getChatChannels(clubId: string, userId: string): Promise<ChatChannel[]>;
  getChatChannel(clubId: string, channelId: string): Promise<ChatChannel | undefined>;
  getChannelParticipants(channelId: string): Promise<ChannelParticipant[]>;
  addChannelParticipant(channelId: string, userId: string, role: string, athleteId?: string, isDirectorAutoAdded?: boolean): Promise<ChannelParticipant>;
  deleteChannel(clubId: string, channelId: string): Promise<void>;
  
  // Messages
  sendMessage(channelId: string, senderId: string, content: string, messageType?: 'text' | 'system'): Promise<Message>;
  getMessages(channelId: string, limit?: number, before?: Date): Promise<Message[]>;
  updateLastReadAt(channelId: string, userId: string): Promise<void>;
  
  // SafeSport validation
  validateChatParticipants(clubId: string, participantIds: string[], initiatorId: string): Promise<{ valid: boolean; error?: string; autoAddParentIds?: string[] }>;
  getDirectorId(clubId: string): Promise<string | undefined>;
  
  // Audience resolution for Telegram-style targeting
  getTeamAudienceUserIds(clubId: string, teamId: string): Promise<string[]>;
  getProgramAudienceUserIds(clubId: string, programId: string): Promise<string[]>;
  getEventAudienceUserIds(clubId: string, eventId: string): Promise<string[]>;
  getClubAudienceUserIds(clubId: string): Promise<string[]>;

  // ============ BULLETIN BOARD ============
  
  createBulletinPost(clubId: string, authorId: string, post: { title: string; content: string; audienceType?: 'club' | 'roster' | 'team' | 'program' | 'event'; teamId?: string; programId?: string; eventId?: string; isPinned?: boolean }): Promise<BulletinPost>;
  getBulletinPosts(clubId: string, userId: string, filters?: { teamId?: string; programId?: string }): Promise<(BulletinPost & { isRead: boolean; isHidden: boolean; author: User })[]>;
  getBulletinPost(clubId: string, postId: string): Promise<BulletinPost | undefined>;
  updateBulletinPost(clubId: string, postId: string, data: { title?: string; content?: string; isPinned?: boolean }): Promise<BulletinPost>;
  deleteBulletinPost(clubId: string, postId: string): Promise<void>;
  markBulletinRead(clubId: string, postId: string, userId: string, isHidden?: boolean): Promise<BulletinRead>;
  updateBulletinHidden(clubId: string, postId: string, userId: string, isHidden: boolean): Promise<BulletinRead>;
  getBulletinReadReceipts(clubId: string, postId: string): Promise<{ user_id: string; full_name: string; read_at: string }[]>;
  getChannelReadReceipts(channelId: string): Promise<{ user_id: string; full_name: string; last_read_at: string | null }[]>;
  
  // ============ PUSH NOTIFICATIONS ============
  
  registerPushToken(userId: string, fcmToken: string, deviceType?: 'web' | 'ios' | 'android'): Promise<PushSubscription>;
  getPushTokensForUsers(userIds: string[]): Promise<string[]>;
  deactivatePushToken(fcmToken: string): Promise<void>;
  
  // ============ SEASONS ============
  
  getSeasons(clubId: string): Promise<Season[]>;
  getSeason(clubId: string, seasonId: string): Promise<Season | undefined>;
  getActiveSeason(clubId: string): Promise<Season | undefined>;
  createSeason(clubId: string, season: { name: string; start_date: Date; end_date: Date }): Promise<Season>;
  updateSeason(clubId: string, seasonId: string, data: { name?: string; start_date?: Date; end_date?: Date }): Promise<Season>;
  setActiveSeason(clubId: string, seasonId: string): Promise<Season>;
  deleteSeason(clubId: string, seasonId: string): Promise<void>;
  
  // ============ DOCUSEAL SETUP REQUESTS ============
  
  getDocuSealSetupRequests(status?: 'open' | 'in_progress' | 'completed' | 'rejected'): Promise<DocuSealSetupRequest[]>;
  getDocuSealSetupRequest(requestId: string): Promise<DocuSealSetupRequest | undefined>;
  getOpenDocuSealRequestForClub(clubId: string): Promise<DocuSealSetupRequest | undefined>;
  createDocuSealSetupRequest(request: { club_id: string; requested_by_user_id?: string; requested_by_email: string; payload?: { program_name?: string; team_name?: string; template_id?: string; contract_name?: string } }): Promise<DocuSealSetupRequest>;
  updateDocuSealSetupRequest(requestId: string, data: { status?: 'open' | 'in_progress' | 'completed' | 'rejected'; notes?: string }): Promise<DocuSealSetupRequest>;
  markClubDocuSealOnboarded(clubId: string, onboardedByUserId?: string, teamName?: string): Promise<Club>;
  isClubDocuSealOnboarded(clubId: string): Promise<boolean>;

  // ============ HELCIM MODEL A - AUTOPAY ============
  
  // Get clubs with active Helcim subscriptions for autopay prep
  getClubsWithHelcimSubscriptions(): Promise<Club[]>;
  
  // Get club by Helcim customer code for reconciliation matching
  getClubByCustomerCode(customerCode: string): Promise<Club | undefined>;
  
  // Platform ledger summary for calculating billing amounts
  getPlatformLedgerSummary(clubId: string, periodStart: Date, periodEnd: Date): Promise<{ totalAmount: number; entryCount: number }>;
  
  // Autopay charge management
  upsertAutopayCharge(charge: {
    club_id: string;
    period_start: string;
    period_end: string;
    amount: string;
    convenience_fee: string;
    status: 'prepared' | 'billed' | 'paid' | 'failed';
    helcim_subscription_id?: string | null;
    helcim_transaction_id?: string | null;
  }): Promise<PlatformAutopayCharge>;
  
  getAutopayChargeForPeriod(clubId: string, billingDay: number, referenceDate: Date): Promise<PlatformAutopayCharge | undefined>;
  getAutopayChargeByTransactionId(transactionId: string): Promise<PlatformAutopayCharge | undefined>;
  updateAutopayChargeStatus(chargeId: string, status: 'prepared' | 'billed' | 'paid' | 'failed', transactionId?: string): Promise<PlatformAutopayCharge>;
  
  // Mark ledger entries as paid for a period (for reconciliation)
  markLedgerEntriesPaidForPeriod(clubId: string, periodStart: Date, periodEnd: Date): Promise<void>;
  
  // Update club's Helcim subscription info
  updateClubHelcimSubscription(clubId: string, subscriptionId: string, planId: number): Promise<Club>;
  
  // Snack Hub - collaborative snack management for events
  getSnackItems(eventId: string, clubId: string): Promise<SnackItem[]>;
  createSnackItem(eventId: string, clubId: string, data: { category: string; item_name: string; quantity_needed: number; is_custom: boolean; created_by: string }): Promise<SnackItem>;
  claimSnackItem(snackItemId: string, userId: string, userName: string): Promise<SnackItem>;
  unclaimSnackItem(snackItemId: string): Promise<SnackItem>;
  deleteSnackItem(snackItemId: string): Promise<void>;
  
  // Athlete allergies for snack hub
  getEventAthleteAllergies(eventId: string): Promise<string[]>;
}

// Season interface
export interface Season {
  id: string;
  club_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  chat_data_deleted: boolean;
  created_at: string;
}

// Platform Autopay Charge interface (Helcim Model A)
export interface PlatformAutopayCharge {
  id: string;
  club_id: string;
  period_start: string;
  period_end: string;
  amount: string;
  convenience_fee: string;
  status: 'prepared' | 'billed' | 'paid' | 'failed';
  helcim_subscription_id?: string;
  helcim_transaction_id?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface SnackItem {
  id: string;
  event_id: string;
  club_id: string;
  category: 'infrastructure' | 'hydration' | 'protein' | 'fruit_veg' | 'snacks' | 'other';
  item_name: string;
  quantity_needed: number;
  claimed_by?: string | null;
  claimed_by_name?: string | null;
  is_custom: boolean;
  created_by: string;
  created_at: string;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private clubs: Map<string, Club> = new Map();
  private users: Map<string, User & { password: string }> = new Map();
  private signatures: Map<string, ClubSignature> = new Map();
  private programs: Map<string, Program> = new Map();
  private teams: Map<string, Team> = new Map();
  private facilities: Map<string, Facility> = new Map();
  private courts: Map<string, Court> = new Map();
  private athletes: Map<string, Athlete> = new Map();
  private roster: Map<string, AthleteTeamRoster> = new Map();
  private sessions: Map<string, Session> = new Map();
  private registrations: Map<string, Registration> = new Map();
  private payments: Map<string, Payment> = new Map();
  private ledger: Map<string, PlatformLedger> = new Map();

  constructor() {
    this.seedData();
  }

  private generateClubCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private seedData() {
    const clubId = 'demo-club-1';
    
    // Seed demo club
    const demoClub: Club = {
      id: clubId,
      name: 'Demo Sports Club',
      join_code: 'DEMO01',
      waiver_content: 'This is a sample waiver agreement for Demo Sports Club. By signing, you acknowledge the risks associated with athletic activities.',
      onboarding_complete: true,
      created_at: new Date().toISOString(),
    };
    this.clubs.set(demoClub.id, demoClub);
    
    // Seed demo users
    const demoAdmin: User & { password: string } = {
      id: 'demo-admin-1',
      email: 'admin@demo.com',
      full_name: 'Demo Admin',
      role: 'admin',
      club_id: clubId,
      has_signed_documents: true,
      password: 'demo123',
      created_at: new Date().toISOString(),
    };
    this.users.set(demoAdmin.id, demoAdmin);
    
    const demoCoach: User & { password: string } = {
      id: 'demo-coach-1',
      email: 'coach@demo.com',
      full_name: 'Demo Coach',
      role: 'coach',
      club_id: clubId,
      has_signed_documents: true,
      password: 'demo123',
      created_at: new Date().toISOString(),
    };
    this.users.set(demoCoach.id, demoCoach);
    
    const demoParent: User & { password: string } = {
      id: 'demo-parent-1',
      email: 'parent@demo.com',
      full_name: 'Demo Parent',
      role: 'parent',
      club_id: clubId,
      has_signed_documents: true,
      password: 'demo123',
      created_at: new Date().toISOString(),
    };
    this.users.set(demoParent.id, demoParent);

    // Seed programs
    const programs: Program[] = [
      { id: 'prog-1', club_id: clubId, name: 'Youth Soccer', description: 'Ages 6-12 soccer training', monthly_fee: 150, created_at: new Date().toISOString() },
      { id: 'prog-2', club_id: clubId, name: 'Elite Training', description: 'Advanced competitive training', monthly_fee: 250, created_at: new Date().toISOString() },
      { id: 'prog-3', club_id: clubId, name: 'Summer Camp', description: 'Intensive summer sessions', monthly_fee: 400, created_at: new Date().toISOString() },
    ];
    programs.forEach(p => this.programs.set(p.id, p));

    // Seed teams
    const teams: Team[] = [
      { id: 'team-1', club_id: clubId, program_id: 'prog-1', coach_id: 'demo-coach-1', name: 'Team Alpha', created_at: new Date().toISOString() },
      { id: 'team-2', club_id: clubId, program_id: 'prog-1', coach_id: null, name: 'Team Beta', created_at: new Date().toISOString() },
      { id: 'team-3', club_id: clubId, program_id: 'prog-2', coach_id: 'demo-coach-1', name: 'Elite Squad', created_at: new Date().toISOString() },
    ];
    teams.forEach(t => this.teams.set(t.id, t));

    // Seed athletes with graduation years
    const athletes: Athlete[] = [
      { id: 'ath-1', club_id: clubId, parent_id: 'demo-parent-1', first_name: 'Emma', last_name: 'Wilson', date_of_birth: '2015-03-15', graduation_year: 2033, tags: ['U10', 'Soccer'], paid_through_date: '2026-02-15', is_locked: false, created_at: new Date().toISOString() },
      { id: 'ath-2', club_id: clubId, parent_id: 'demo-parent-1', first_name: 'Jake', last_name: 'Wilson', date_of_birth: '2017-07-22', graduation_year: 2035, tags: ['U8', 'Beginners'], paid_through_date: '2026-01-10', is_locked: false, created_at: new Date().toISOString() },
      { id: 'ath-3', club_id: clubId, parent_id: 'demo-parent-2', first_name: 'Sophia', last_name: 'Garcia', date_of_birth: '2014-11-08', graduation_year: 2032, tags: ['U12', 'Soccer'], paid_through_date: '2026-02-20', is_locked: false, created_at: new Date().toISOString() },
      { id: 'ath-4', club_id: clubId, parent_id: 'demo-parent-2', first_name: 'Liam', last_name: 'Martinez', date_of_birth: '2016-05-30', graduation_year: 2034, tags: ['U10', 'Soccer'], paid_through_date: '2026-01-05', is_locked: false, created_at: new Date().toISOString() },
    ];
    athletes.forEach(a => this.athletes.set(a.id, a));

    // Seed roster assignments with contract_signed
    const rosterItems: AthleteTeamRoster[] = [
      { id: 'roster-1', athlete_id: 'ath-1', team_id: 'team-1', program_id: 'prog-1', club_id: clubId, contract_signed: true, created_at: new Date().toISOString() },
      { id: 'roster-2', athlete_id: 'ath-3', team_id: 'team-1', program_id: 'prog-1', club_id: clubId, contract_signed: false, created_at: new Date().toISOString() },
      { id: 'roster-3', athlete_id: 'ath-1', team_id: 'team-3', program_id: 'prog-2', club_id: clubId, contract_signed: true, created_at: new Date().toISOString() },
    ];
    rosterItems.forEach(r => this.roster.set(r.id, r));
  }

  // Auth & Clubs
  async createClub(name: string, directorEmail: string, directorName: string, directorPassword: string): Promise<{ club: Club; user: User }> {
    const clubId = randomUUID();
    const club: Club = {
      id: clubId,
      name,
      join_code: this.generateClubCode(),
      onboarding_complete: false,
      created_at: new Date().toISOString(),
    };
    this.clubs.set(club.id, club);

    const userId = randomUUID();
    const user: User & { password: string } = {
      id: userId,
      email: directorEmail,
      full_name: directorName,
      role: 'admin',
      club_id: clubId,
      has_signed_documents: true,
      password: directorPassword,
      created_at: new Date().toISOString(),
    };
    this.users.set(user.id, user);

    const { password, ...userWithoutPassword } = user;
    return { club, user: userWithoutPassword };
  }

  async createClubOnly(name: string, sport: string): Promise<Club> {
    const clubId = randomUUID();
    const club: Club = {
      id: clubId,
      name,
      sport: sport as any,
      join_code: this.generateClubCode(),
      onboarding_complete: false,
      created_at: new Date().toISOString(),
    };
    this.clubs.set(club.id, club);
    return club;
  }

  async deleteClub(clubId: string): Promise<void> {
    this.clubs.delete(clubId);
  }

  async getUserById(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getClubByJoinCode(joinCode: string): Promise<Club | undefined> {
    return Array.from(this.clubs.values()).find(c => c.join_code === joinCode.toUpperCase());
  }

  async getClub(clubId: string): Promise<Club | undefined> {
    return this.clubs.get(clubId);
  }

  async getAllClubs(): Promise<Club[]> {
    return Array.from(this.clubs.values());
  }

  async updateClubSettings(clubId: string, settings: { name?: string; address?: string; logo_url?: string }): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    if (settings.name !== undefined) club.name = settings.name;
    if (settings.address !== undefined) club.address = settings.address;
    if (settings.logo_url !== undefined) club.logo_url = settings.logo_url;
    this.clubs.set(clubId, club);
    return club;
  }

  async updateClubSport(clubId: string, sport: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    (club as any).sport = sport;
    this.clubs.set(clubId, club);
    return club;
  }

  async updateClubDocuments(clubId: string, contractPdfUrl: string | undefined, waiverContent: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.contract_pdf_url = contractPdfUrl;
    club.waiver_content = waiverContent;
    club.waiver_version = (club.waiver_version || 0) + 1;
    if (contractPdfUrl) {
      club.contract_version = (club.contract_version || 0) + 1;
    }
    this.clubs.set(clubId, club);
    return club;
  }

  async updateClubBillingCard(clubId: string, cardToken: string, lastFour: string, customerCode?: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.billing_card_token = cardToken;
    club.billing_card_last_four = lastFour;
    club.billing_method = 'card';
    if (customerCode) {
      club.billing_customer_code = customerCode;
    }
    this.clubs.set(clubId, club);
    return club;
  }

  async updateClubBillingBank(clubId: string, bankToken: string, lastFour: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.billing_bank_token = bankToken;
    club.billing_bank_last_four = lastFour;
    club.billing_method = 'bank';
    this.clubs.set(clubId, club);
    return club;
  }

  async updateClubContractSettings(clubId: string, contractUrl: string | undefined, contractInstructions: string | undefined): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.contract_url = contractUrl;
    club.contract_instructions = contractInstructions;
    this.clubs.set(clubId, club);
    return club;
  }

  async updateClubBillingDay(clubId: string, billingDay: number): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.billing_day = billingDay;
    this.clubs.set(clubId, club);
    return club;
  }

  async lockClub(clubId: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.billing_locked_at = new Date().toISOString();
    this.clubs.set(clubId, club);
    return club;
  }

  async unlockClub(clubId: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.billing_locked_at = undefined;
    this.clubs.set(clubId, club);
    return club;
  }

  async updateClubBillingStatus(clubId: string, lastBilledAt: Date, lastBilledPeriodStart: Date): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.last_billed_at = lastBilledAt.toISOString();
    club.last_billed_period_start = lastBilledPeriodStart.toISOString();
    this.clubs.set(clubId, club);
    return club;
  }

  async getPlatformRevenueMetrics(startDate: Date, endDate: Date) {
    const payments = Array.from(this.payments.values()).filter(p => {
      const createdAt = new Date(p.created_at);
      return createdAt >= startDate && createdAt <= endDate && 
             p.status === 'completed' && 
             p.fee_version?.startsWith('v1_2026');
    });

    const total_tech_fees = payments.reduce((sum, p) => sum + (p.tech_fee_amount || 0), 0);
    const total_payments = payments.reduce((sum, p) => sum + p.amount, 0);
    const payment_count = payments.length;
    const avg_fee_per_payment = payment_count > 0 ? total_tech_fees / payment_count : 0;

    const by_payment_rail = {
      card_credit: { count: 0, total: 0 },
      card_debit: { count: 0, total: 0 },
      ach: { count: 0, total: 0 },
    };

    payments.forEach(p => {
      const rail = p.payment_rail as keyof typeof by_payment_rail;
      if (by_payment_rail[rail]) {
        by_payment_rail[rail].count++;
        by_payment_rail[rail].total += p.tech_fee_amount || 0;
      }
    });

    const by_payment_kind = {
      recurring: { count: 0, total: 0 },
      one_time: { count: 0, total: 0 },
    };

    payments.forEach(p => {
      const kind = p.payment_kind as keyof typeof by_payment_kind;
      if (by_payment_kind[kind]) {
        by_payment_kind[kind].count++;
        by_payment_kind[kind].total += p.tech_fee_amount || 0;
      }
    });

    return {
      total_tech_fees,
      total_payments,
      payment_count,
      avg_fee_per_payment,
      by_payment_rail,
      by_payment_kind,
      trend_vs_previous: 0,
    };
  }

  async getPlatformRevenuePayments(startDate: Date, endDate: Date, limit: number) {
    const payments = Array.from(this.payments.values())
      .filter(p => {
        const createdAt = new Date(p.created_at);
        return createdAt >= startDate && createdAt <= endDate && 
               p.status === 'completed' && 
               p.fee_version?.startsWith('v1_2026');
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return payments.map(p => {
      const athlete = this.athletes.get(p.athlete_id);
      const club = this.clubs.get(p.club_id);
      return {
        id: p.id,
        amount: p.amount,
        base_amount: p.base_amount || p.amount,
        tech_fee_amount: p.tech_fee_amount || 0,
        payment_rail: p.payment_rail || 'card_credit',
        payment_kind: p.payment_kind || 'recurring',
        fee_version: p.fee_version || '',
        status: p.status,
        created_at: p.created_at,
        club_name: club?.name || 'Unknown',
        athlete_name: athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Unknown',
      };
    });
  }

  async getClubsDueToBill(dayOfMonth: number): Promise<Club[]> {
    return Array.from(this.clubs.values()).filter(club => 
      (club.billing_day ?? 1) === dayOfMonth && !club.billing_locked_at
    );
  }

  async getLockedClubs(): Promise<Club[]> {
    return Array.from(this.clubs.values()).filter(club => !!club.billing_locked_at);
  }

  async getClubsPastGracePeriod(gracePeriodDays: number): Promise<Club[]> {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);
    return Array.from(this.clubs.values()).filter(club => {
      if (!club.last_billed_at || club.billing_locked_at) return false;
      // Check if there's an unpaid invoice past grace period
      // This is a simplified check - real implementation would check invoice status
      return false;
    });
  }

  async regenerateClubCode(clubId: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.join_code = this.generateClubCode();
    this.clubs.set(clubId, club);
    return club;
  }
  
  async completeOnboarding(clubId: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.onboarding_complete = true;
    this.clubs.set(clubId, club);
    return club;
  }

  // Users
  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(u => u.email === email);
    if (!user) return undefined;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getCoaches(clubId: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.club_id === clubId && u.role === 'coach')
      .map(({ password, ...user }) => user);
  }

  async getParents(clubId: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.club_id === clubId && u.role === 'parent')
      .map(({ password, ...user }) => user);
  }

  async getUser(userId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async createUser(clubId: string, email: string, fullName: string, password: string, role: 'coach' | 'parent'): Promise<User> {
    const userId = randomUUID();
    const user: User & { password: string } = {
      id: userId,
      email,
      full_name: fullName,
      role,
      club_id: clubId,
      has_signed_documents: false,
      can_bill: false,
      password,
      created_at: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    const { password: pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async createProfile(profile: { id: string; email: string; full_name: string; role: 'athlete'; club_id: string; athlete_id: string }): Promise<void> {
    const user: User & { password: string } = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: profile.role,
      club_id: profile.club_id,
      has_signed_documents: true, // Athletes don't need to sign docs
      can_bill: false,
      password: '', // No password stored in memory, handled by Supabase Auth
      created_at: new Date().toISOString(),
    };
    this.users.set(user.id, user);
  }

  async updateUserSignedDocuments(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.has_signed_documents = true;
      this.users.set(userId, user);
    }
  }

  async updateUserBillingPermission(userId: string, canBill: boolean): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.can_bill = canBill;
    this.users.set(userId, user);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUserContractStatus(userId: string, status: 'unsigned' | 'pending' | 'verified', method?: 'digital' | 'paper'): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.contract_status = status;
    if (method) user.contract_method = method;
    this.users.set(userId, user);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getUsersWithContractStatus(clubId: string): Promise<User[]> {
    const users: User[] = [];
    for (const user of this.users.values()) {
      if (user.club_id === clubId && user.role === 'parent') {
        const { password, ...userWithoutPassword } = user;
        users.push(userWithoutPassword);
      }
    }
    return users;
  }

  // Signatures
  async createSignature(clubId: string, userId: string, documentType: 'contract' | 'waiver', documentVersion: number, signedName: string, ipAddress?: string): Promise<ClubSignature> {
    const signature: ClubSignature = {
      id: randomUUID(),
      club_id: clubId,
      user_id: userId,
      document_type: documentType,
      document_version: documentVersion,
      signed_name: signedName,
      signed_at: new Date().toISOString(),
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    };
    this.signatures.set(signature.id, signature);
    return signature;
  }

  async createSignatureWithSeason(clubId: string, userId: string, documentType: 'contract' | 'waiver', documentVersion: number, signedName: string, ipAddress: string | undefined, seasonId: string | null): Promise<ClubSignature> {
    const signature: ClubSignature = {
      id: randomUUID(),
      club_id: clubId,
      user_id: userId,
      document_type: documentType,
      document_version: documentVersion,
      signed_name: signedName,
      signed_at: new Date().toISOString(),
      ip_address: ipAddress,
      season_id: seasonId,
      created_at: new Date().toISOString(),
    };
    this.signatures.set(signature.id, signature);
    return signature;
  }

  async getUserSignatures(clubId: string, userId: string): Promise<ClubSignature[]> {
    return Array.from(this.signatures.values()).filter(
      s => s.club_id === clubId && s.user_id === userId
    );
  }

  async hasSignedCurrentDocuments(clubId: string, userId: string): Promise<boolean> {
    const club = await this.getClub(clubId);
    if (!club) return false;
    
    const signatures = await this.getUserSignatures(clubId, userId);
    const waiverVersion = club.waiver_version || 1;
    const contractVersion = club.contract_version || 1;
    
    const hasSignedWaiver = signatures.some(
      s => s.document_type === 'waiver' && s.document_version >= waiverVersion
    );
    const hasSignedContract = !club.contract_pdf_url || signatures.some(
      s => s.document_type === 'contract' && s.document_version >= contractVersion
    );
    
    return hasSignedWaiver && hasSignedContract;
  }

  // Validate user password (for login)
  async validateUserPassword(email: string, password: string): Promise<User | null> {
    const user = Array.from(this.users.values()).find(
      u => u.email === email && u.password === password
    );
    if (!user) return null;
    const { password: pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Programs
  async getPrograms(clubId: string): Promise<Program[]> {
    return Array.from(this.programs.values()).filter(p => p.club_id === clubId);
  }

  async getProgram(clubId: string, programId: string): Promise<Program | undefined> {
    const program = this.programs.get(programId);
    return program?.club_id === clubId ? program : undefined;
  }

  async createProgram(clubId: string, program: Omit<Program, 'id' | 'club_id' | 'created_at'>): Promise<Program> {
    const newProgram: Program = {
      ...program,
      id: randomUUID(),
      club_id: clubId,
      created_at: new Date().toISOString(),
    };
    this.programs.set(newProgram.id, newProgram);
    return newProgram;
  }

  async deleteProgram(clubId: string, programId: string): Promise<void> {
    const program = this.programs.get(programId);
    if (program?.club_id === clubId) {
      this.programs.delete(programId);
    }
  }

  // Teams
  async getTeams(clubId: string): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(t => t.club_id === clubId);
  }

  async getTeamsByCoach(clubId: string, coachId: string): Promise<Team[]> {
    return Array.from(this.teams.values()).filter(t => t.club_id === clubId && t.coach_id === coachId);
  }

  async getTeam(clubId: string, teamId: string): Promise<Team | undefined> {
    const team = this.teams.get(teamId);
    return team?.club_id === clubId ? team : undefined;
  }

  async createTeam(clubId: string, team: Omit<Team, 'id' | 'club_id' | 'created_at'>): Promise<Team> {
    const newTeam: Team = {
      ...team,
      id: randomUUID(),
      club_id: clubId,
      created_at: new Date().toISOString(),
    };
    this.teams.set(newTeam.id, newTeam);
    return newTeam;
  }

  async updateTeam(clubId: string, teamId: string, data: { name?: string; coach_id?: string | null }): Promise<Team> {
    const team = this.teams.get(teamId);
    if (!team || team.club_id !== clubId) {
      throw new Error('Team not found');
    }
    if (data.name !== undefined) team.name = data.name;
    if (data.coach_id !== undefined) team.coach_id = data.coach_id;
    this.teams.set(teamId, team);
    return team;
  }

  async deleteTeam(clubId: string, teamId: string): Promise<void> {
    const team = this.teams.get(teamId);
    if (team?.club_id === clubId) {
      this.teams.delete(teamId);
    }
  }

  // Facilities
  // Club Forms (stub implementations - using database storage)
  async getClubForms(clubId: string): Promise<ClubForm[]> {
    return [];
  }

  async getClubForm(clubId: string, formId: string): Promise<ClubForm | undefined> {
    return undefined;
  }

  async createClubForm(clubId: string, form: Omit<ClubForm, 'id' | 'club_id' | 'is_active' | 'created_at'>): Promise<ClubForm> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateClubForm(clubId: string, formId: string, data: { name?: string; url?: string; description?: string; is_active?: boolean }): Promise<ClubForm> {
    throw new Error('Not implemented in MemStorage');
  }

  async deleteClubForm(clubId: string, formId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async getFacilities(clubId: string): Promise<Facility[]> {
    return Array.from(this.facilities.values()).filter(f => f.club_id === clubId);
  }

  async getFacility(clubId: string, facilityId: string): Promise<Facility | undefined> {
    const facility = this.facilities.get(facilityId);
    return facility?.club_id === clubId ? facility : undefined;
  }

  async createFacility(clubId: string, facility: Omit<Facility, 'id' | 'club_id' | 'created_at'>): Promise<Facility> {
    const newFacility: Facility = {
      ...facility,
      id: randomUUID(),
      club_id: clubId,
      created_at: new Date().toISOString(),
    };
    this.facilities.set(newFacility.id, newFacility);
    return newFacility;
  }

  async updateFacility(clubId: string, facilityId: string, data: { name?: string; description?: string }): Promise<Facility> {
    const facility = this.facilities.get(facilityId);
    if (!facility || facility.club_id !== clubId) {
      throw new Error('Facility not found');
    }
    if (data.name !== undefined) facility.name = data.name;
    if (data.description !== undefined) facility.description = data.description;
    this.facilities.set(facilityId, facility);
    return facility;
  }

  async deleteFacility(clubId: string, facilityId: string): Promise<void> {
    const facility = this.facilities.get(facilityId);
    if (facility?.club_id === clubId) {
      this.facilities.delete(facilityId);
    }
  }

  // Courts
  async getCourts(clubId: string, facilityId?: string): Promise<Court[]> {
    const courts = Array.from(this.courts.values()).filter(c => c.club_id === clubId);
    if (facilityId) {
      return courts.filter(c => c.facility_id === facilityId);
    }
    return courts;
  }

  async getCourt(clubId: string, courtId: string): Promise<Court | undefined> {
    const court = this.courts.get(courtId);
    return court?.club_id === clubId ? court : undefined;
  }

  async createCourt(clubId: string, court: Omit<Court, 'id' | 'club_id' | 'created_at'>): Promise<Court> {
    const newCourt: Court = {
      ...court,
      id: randomUUID(),
      club_id: clubId,
      created_at: new Date().toISOString(),
    };
    this.courts.set(newCourt.id, newCourt);
    return newCourt;
  }

  async updateCourt(clubId: string, courtId: string, data: { name?: string; description?: string }): Promise<Court> {
    const court = this.courts.get(courtId);
    if (!court || court.club_id !== clubId) {
      throw new Error('Court not found');
    }
    if (data.name !== undefined) court.name = data.name;
    if (data.description !== undefined) court.description = data.description;
    this.courts.set(courtId, court);
    return court;
  }

  async deleteCourt(clubId: string, courtId: string): Promise<void> {
    const court = this.courts.get(courtId);
    if (court?.club_id === clubId) {
      this.courts.delete(courtId);
    }
  }

  // Athletes
  async getAthletes(clubId: string): Promise<Athlete[]> {
    return Array.from(this.athletes.values()).filter(a => a.club_id === clubId);
  }

  async getAthlete(clubId: string, athleteId: string): Promise<Athlete | undefined> {
    const athlete = this.athletes.get(athleteId);
    return athlete?.club_id === clubId ? athlete : undefined;
  }

  async getAthletesByParent(clubId: string, parentId: string): Promise<Athlete[]> {
    return Array.from(this.athletes.values()).filter(
      a => a.club_id === clubId && a.parent_id === parentId
    );
  }

  async getUnassignedAthletes(clubId: string, programId: string): Promise<Athlete[]> {
    const assignedAthleteIds = new Set(
      Array.from(this.roster.values())
        .filter(r => r.club_id === clubId && r.program_id === programId)
        .map(r => r.athlete_id)
    );
    return Array.from(this.athletes.values()).filter(
      a => a.club_id === clubId && !assignedAthleteIds.has(a.id)
    );
  }

  async getAthleteAssignmentOverview(clubId: string): Promise<{
    totalAthletes: number;
    assignedCount: number;
    unassignedCount: number;
    unassignedAthletes: Array<{ id: string; first_name: string; last_name: string; parent_name: string }>;
    assignmentsByProgram: Array<{ program_id: string; program_name: string; athlete_count: number }>;
  }> {
    const allAthletes = await this.getAthletes(clubId);
    const roster = await this.getRoster(clubId);
    const programs = await this.getPrograms(clubId);
    const profiles = Array.from(this.users.values());
    
    const assignedAthleteIds = new Set(roster.map(r => r.athlete_id));
    const unassignedAthletes = allAthletes
      .filter(a => !assignedAthleteIds.has(a.id))
      .map(a => {
        const parent = profiles.find(p => p.id === a.parent_id);
        return {
          id: a.id,
          first_name: a.first_name,
          last_name: a.last_name,
          parent_name: parent?.full_name || 'Unknown',
        };
      });
    
    const assignmentsByProgram = programs.map(p => {
      const athleteCount = roster.filter(r => r.program_id === p.id).length;
      return {
        program_id: p.id,
        program_name: p.name,
        athlete_count: athleteCount,
      };
    }).filter(p => p.athlete_count > 0);
    
    return {
      totalAthletes: allAthletes.length,
      assignedCount: assignedAthleteIds.size,
      unassignedCount: unassignedAthletes.length,
      unassignedAthletes,
      assignmentsByProgram,
    };
  }

  async createAthlete(clubId: string, athlete: Omit<Athlete, 'id' | 'club_id' | 'is_locked' | 'is_released' | 'has_login' | 'created_at'>): Promise<Athlete> {
    const newAthlete: Athlete = {
      ...athlete,
      id: randomUUID(),
      club_id: clubId,
      is_locked: false,
      is_released: false,
      has_login: false,
      created_at: new Date().toISOString(),
    };
    this.athletes.set(newAthlete.id, newAthlete);
    return newAthlete;
  }

  async updateAthlete(athleteId: string, updates: Partial<Pick<Athlete, 'email' | 'has_login' | 'user_id'>>): Promise<void> {
    const athlete = this.athletes.get(athleteId);
    if (athlete) {
      if (updates.email !== undefined) athlete.email = updates.email;
      if (updates.has_login !== undefined) athlete.has_login = updates.has_login;
      if (updates.user_id !== undefined) athlete.user_id = updates.user_id;
      this.athletes.set(athleteId, athlete);
    }
  }

  async updateAthletePaidThrough(clubId: string, athleteId: string, paidThroughDate: string): Promise<void> {
    const athlete = this.athletes.get(athleteId);
    if (athlete?.club_id === clubId) {
      athlete.paid_through_date = paidThroughDate;
      athlete.is_locked = false;
      this.athletes.set(athleteId, athlete);
    }
  }

  async releaseAthlete(clubId: string, athleteId: string, releasedBy: string | null, releaseType: 'manual' | 'automated' = 'manual'): Promise<{ contractIds: string[] }> {
    const athlete = this.athletes.get(athleteId);
    if (athlete?.club_id === clubId) {
      athlete.is_released = true;
      athlete.released_at = new Date().toISOString();
      athlete.released_by = releasedBy ?? undefined;
      this.athletes.set(athleteId, athlete);
    }
    return { contractIds: [] };
  }

  async revokeAthleteRelease(clubId: string, athleteId: string): Promise<void> {
    const athlete = this.athletes.get(athleteId);
    if (athlete?.club_id === clubId) {
      athlete.is_released = false;
      athlete.released_at = undefined;
      athlete.released_by = undefined;
      this.athletes.set(athleteId, athlete);
    }
  }

  async getAthletesByParentAcrossClubs(parentId: string): Promise<Athlete[]> {
    return Array.from(this.athletes.values()).filter(a => a.parent_id === parentId);
  }

  // Roster
  async assignAthleteToTeam(clubId: string, athleteId: string, teamId: string, programId: string): Promise<AthleteTeamRoster> {
    const existing = Array.from(this.roster.values()).find(
      r => r.club_id === clubId && r.athlete_id === athleteId && r.team_id === teamId
    );
    if (existing) {
      return existing;
    }
    const newRoster: AthleteTeamRoster = {
      id: randomUUID(),
      athlete_id: athleteId,
      team_id: teamId,
      program_id: programId,
      club_id: clubId,
      contract_signed: false,
      created_at: new Date().toISOString(),
    };
    this.roster.set(newRoster.id, newRoster);
    return newRoster;
  }

  async assignAthleteToProgram(clubId: string, athleteId: string, programId: string, contractSigned: boolean = false): Promise<AthleteTeamRoster> {
    // Check if already enrolled in program (without a team)
    const existing = Array.from(this.roster.values()).find(
      r => r.club_id === clubId && r.athlete_id === athleteId && r.program_id === programId && r.team_id === null
    );
    if (existing) {
      // Update contract_signed status if needed
      if (contractSigned && !existing.contract_signed) {
        existing.contract_signed = true;
        this.roster.set(existing.id, existing);
      }
      return existing;
    }
    const newRoster: AthleteTeamRoster = {
      id: randomUUID(),
      athlete_id: athleteId,
      team_id: null,
      program_id: programId,
      club_id: clubId,
      contract_signed: contractSigned,
      created_at: new Date().toISOString(),
    };
    this.roster.set(newRoster.id, newRoster);
    return newRoster;
  }

  async getTeamRoster(clubId: string, teamId: string): Promise<AthleteTeamRoster[]> {
    return Array.from(this.roster.values()).filter(
      r => r.club_id === clubId && r.team_id === teamId
    );
  }

  async getProgramRoster(clubId: string, programId: string): Promise<AthleteTeamRoster[]> {
    return Array.from(this.roster.values()).filter(
      r => r.club_id === clubId && r.program_id === programId
    );
  }

  async getRoster(clubId: string): Promise<AthleteTeamRoster[]> {
    return Array.from(this.roster.values()).filter(r => r.club_id === clubId);
  }

  async updateRosterContractStatus(clubId: string, rosterId: string, contractSigned: boolean): Promise<AthleteTeamRoster> {
    const entry = this.roster.get(rosterId);
    if (!entry || entry.club_id !== clubId) {
      throw new Error('Roster entry not found');
    }
    entry.contract_signed = contractSigned;
    this.roster.set(rosterId, entry);
    return entry;
  }

  async removeFromRoster(clubId: string, rosterId: string): Promise<void> {
    const entry = this.roster.get(rosterId);
    if (entry?.club_id === clubId) {
      this.roster.delete(rosterId);
    }
  }

  // Sessions
  async getSessions(clubId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(s => s.club_id === clubId);
  }

  async getSession(clubId: string, sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    return session?.club_id === clubId ? session : undefined;
  }

  async createSession(clubId: string, session: Omit<Session, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<Session> {
    const newSession: Session = {
      ...session,
      id: randomUUID(),
      club_id: clubId,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };
    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  async cancelSession(clubId: string, sessionId: string, reason: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.club_id === clubId) {
      session.status = 'cancelled';
      session.cancellation_reason = reason;
      this.sessions.set(sessionId, session);
    }
  }

  async deleteSession(clubId: string, sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session?.club_id === clubId) {
      this.sessions.delete(sessionId);
    }
  }

  async checkSessionConflict(clubId: string, startTime: string, endTime: string, facilityId?: string, courtId?: string, excludeId?: string): Promise<{ conflict: boolean; overlapMinutes: number; conflictingSession?: Session }> {
    const newStart = new Date(startTime).getTime();
    const newEnd = new Date(endTime).getTime();

    const sessions = Array.from(this.sessions.values());
    for (const session of sessions) {
      if (session.club_id !== clubId || session.status === 'cancelled' || session.id === excludeId) {
        continue;
      }

      // If court_id is specified, only check conflicts with sessions on the same court
      if (courtId) {
        if (session.court_id !== courtId) continue;
      } else if (facilityId) {
        // If only facility_id is specified, check conflicts with sessions at the same facility
        if (session.facility_id !== facilityId) continue;
      } else {
        // No facility or court specified - skip conflict check
        continue;
      }

      const existingStart = new Date(session.start_time).getTime();
      const existingEnd = new Date(session.end_time).getTime();

      const overlapStart = Math.max(newStart, existingStart);
      const overlapEnd = Math.min(newEnd, existingEnd);
      const overlapMinutes = Math.max(0, (overlapEnd - overlapStart) / (1000 * 60));

      if (overlapMinutes > 0) {
        return { conflict: true, overlapMinutes, conflictingSession: session };
      }
    }

    return { conflict: false, overlapMinutes: 0 };
  }

  async getSessionsForAthlete(clubId: string, athleteId: string): Promise<Session[]> {
    const rosterEntries = await this.getAthleteRosterEntries(clubId, athleteId);
    const signedRosterEntries = rosterEntries.filter(r => r.contract_signed);
    const athleteTeamIds = new Set(signedRosterEntries.map(r => r.team_id));
    const athleteProgramIds = new Set(signedRosterEntries.map(r => r.program_id));

    return Array.from(this.sessions.values()).filter(session => {
      if (session.club_id !== clubId || session.status === 'cancelled') return false;
      
      if (session.team_id) {
        return athleteTeamIds.has(session.team_id);
      } else {
        return athleteProgramIds.has(session.program_id);
      }
    });
  }

  async getAthleteRosterEntries(clubId: string, athleteId: string): Promise<AthleteTeamRoster[]> {
    return Array.from(this.roster.values()).filter(
      r => r.club_id === clubId && r.athlete_id === athleteId
    );
  }

  async isAthleteRegisteredForProgram(clubId: string, athleteId: string, programId: string): Promise<boolean> {
    const rosterEntries = await this.getAthleteRosterEntries(clubId, athleteId);
    return rosterEntries.some(r => r.program_id === programId);
  }

  // Registrations
  async getSessionRegistrations(clubId: string, sessionId: string): Promise<(Registration & { athlete: Athlete })[]> {
    const registrations = Array.from(this.registrations.values()).filter(
      r => r.club_id === clubId && r.session_id === sessionId
    );
    return registrations.map(r => ({
      ...r,
      athlete: this.athletes.get(r.athlete_id)!,
    })).filter(r => r.athlete);
  }

  async getAthleteRegistrations(clubId: string, athleteId: string): Promise<(Registration & { session: Session })[]> {
    const registrations = Array.from(this.registrations.values()).filter(
      r => r.club_id === clubId && r.athlete_id === athleteId
    );
    return registrations.map(r => ({
      ...r,
      session: this.sessions.get(r.session_id)!,
    })).filter(r => r.session);
  }

  async createRegistration(clubId: string, sessionId: string, athleteId: string): Promise<Registration> {
    const newReg: Registration = {
      id: randomUUID(),
      club_id: clubId,
      session_id: sessionId,
      athlete_id: athleteId,
      checked_in: false,
      created_at: new Date().toISOString(),
    };
    this.registrations.set(newReg.id, newReg);
    return newReg;
  }

  async bulkCreateRegistrations(clubId: string, sessionId: string, athleteIds: string[]): Promise<Registration[]> {
    const registrations: Registration[] = [];
    for (const athleteId of athleteIds) {
      const reg = await this.createRegistration(clubId, sessionId, athleteId);
      registrations.push(reg);
    }
    return registrations;
  }

  async updateCheckIn(clubId: string, registrationId: string, checkedIn: boolean): Promise<void> {
    const reg = this.registrations.get(registrationId);
    if (reg?.club_id === clubId) {
      reg.checked_in = checkedIn;
      reg.check_in_time = checkedIn ? new Date().toISOString() : undefined;
      this.registrations.set(registrationId, reg);
    }
  }

  // Payments
  async getPayments(clubId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(p => p.club_id === clubId);
  }

  async createPayment(clubId: string, payment: Omit<Payment, 'id' | 'club_id' | 'created_at'>): Promise<Payment> {
    const newPayment: Payment = {
      ...payment,
      id: randomUUID(),
      club_id: clubId,
      created_at: new Date().toISOString(),
    };
    this.payments.set(newPayment.id, newPayment);
    return newPayment;
  }

  async createPlatformLedgerEntry(clubId: string, athleteId: string, amount: number, feeType: 'monthly' | 'clinic' | 'drop_in' | 'event', sessionId?: string): Promise<PlatformLedger> {
    throw new Error('Not implemented in MemStorage - use dbStorage');
  }

  async createPlatformLedgerEntryRaw(clubId: string, athleteId: string, amount: number, entryType: 'monthly_athlete' | 'clinic_session' | 'drop_in_session', sessionId?: string): Promise<PlatformLedger> {
    throw new Error('Not implemented in MemStorage - use dbStorage');
  }

  // Program Contracts (stub implementations - using database storage)
  async getProgramContracts(clubId: string, programId?: string): Promise<ProgramContract[]> {
    return [];
  }

  async getProgramContract(clubId: string, contractId: string): Promise<ProgramContract | undefined> {
    return undefined;
  }

  async createProgramContract(clubId: string, contract: Omit<ProgramContract, 'id' | 'club_id' | 'is_active' | 'created_at'>): Promise<ProgramContract> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateProgramContract(clubId: string, contractId: string, data: { name?: string; description?: string; monthly_price?: number; paid_in_full_price?: number | null; initiation_fee?: number | null; sessions_per_week?: number; team_id?: string | null; contract_document_url?: string | null; is_active?: boolean }): Promise<ProgramContract> {
    throw new Error('Not implemented in MemStorage');
  }

  async deleteProgramContract(clubId: string, contractId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  // Athlete Contracts (stub implementations - using database storage)
  async getAthleteContracts(clubId: string, athleteId?: string): Promise<AthleteContract[]> {
    return [];
  }

  async getAthleteContract(clubId: string, contractId: string): Promise<AthleteContract | undefined> {
    return undefined;
  }

  async createAthleteContract(clubId: string, contract: Omit<AthleteContract, 'id' | 'club_id' | 'status' | 'created_at' | 'initiation_fee_paid'>): Promise<AthleteContract> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateAthleteContractStatus(clubId: string, contractId: string, status: 'active' | 'cancelled' | 'expired'): Promise<AthleteContract> {
    throw new Error('Not implemented in MemStorage');
  }

  // Contract Submissions (DocuSeal) - using database storage
  async createContractSubmission(data: {
    club_id: string;
    athlete_id: string;
    program_contract_id?: string;
    program_id?: string;
    team_id?: string;
    docuseal_submission_id: string;
    docuseal_signer_slug?: string;
    signer_url?: string;
    external_id: string;
  }): Promise<ContractSubmission> {
    const { data: submission, error } = await supabase
      .from('contract_submissions')
      .insert({
        club_id: data.club_id,
        athlete_id: data.athlete_id,
        program_contract_id: data.program_contract_id,
        program_id: data.program_id,
        team_id: data.team_id,
        docuseal_submission_id: data.docuseal_submission_id,
        docuseal_signer_slug: data.docuseal_signer_slug,
        signer_url: data.signer_url,
        external_id: data.external_id,
        status: 'sent',
      })
      .select()
      .single();

    if (error) throw error;
    return submission as ContractSubmission;
  }

  async getContractSubmission(submissionId: string): Promise<ContractSubmission | undefined> {
    const { data, error } = await supabase
      .from('contract_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (error) return undefined;
    return data as ContractSubmission;
  }

  async getContractSubmissionByExternalId(externalId: string): Promise<ContractSubmission | undefined> {
    const { data, error } = await supabase
      .from('contract_submissions')
      .select('*')
      .eq('external_id', externalId)
      .single();

    if (error) return undefined;
    return data as ContractSubmission;
  }

  async getContractSubmissionByDocuSealId(docusealSubmissionId: string): Promise<ContractSubmission | undefined> {
    const { data, error } = await supabase
      .from('contract_submissions')
      .select('*')
      .eq('docuseal_submission_id', docusealSubmissionId)
      .single();

    if (error) return undefined;
    return data as ContractSubmission;
  }

  async getContractSubmissionsForAthlete(athleteId: string): Promise<ContractSubmission[]> {
    const { data, error } = await supabase
      .from('contract_submissions')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data as ContractSubmission[];
  }

  async updateContractSubmissionStatus(id: string, status: 'sent' | 'viewed' | 'signed', signedAt?: Date): Promise<ContractSubmission> {
    const updateData: any = { status };
    if (signedAt) {
      updateData.signed_at = signedAt.toISOString();
    }

    const { data, error } = await supabase
      .from('contract_submissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ContractSubmission;
  }

  // Events (stub implementations - using database storage)
  async getEvents(clubId: string, filters?: { programId?: string; teamId?: string }): Promise<Event[]> {
    return [];
  }

  async getEvent(clubId: string, eventId: string): Promise<Event | undefined> {
    return undefined;
  }

  async getEventsByCoach(clubId: string, coachId: string): Promise<Event[]> {
    return [];
  }

  async getEventsForAthlete(clubId: string, athleteId: string): Promise<Event[]> {
    return [];
  }

  async createEvent(clubId: string, event: Omit<Event, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<Event> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateEvent(clubId: string, eventId: string, data: Partial<Omit<Event, 'id' | 'club_id' | 'created_at'>>): Promise<Event> {
    throw new Error('Not implemented in MemStorage');
  }

  async deleteEvent(clubId: string, eventId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  // Event Rosters (stub implementations)
  async getEventRosters(clubId: string, eventId: string): Promise<(EventRoster & { athlete: Athlete })[]> {
    return [];
  }

  async getEventRosterById(clubId: string, rosterId: string): Promise<EventRoster | null> {
    return null;
  }

  async addEventRoster(clubId: string, eventId: string, athleteId: string, paymentId?: string): Promise<EventRoster> {
    throw new Error('Not implemented in MemStorage');
  }

  async removeEventRoster(clubId: string, rosterId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateEventRosterCheckIn(clubId: string, rosterId: string, checkedIn: boolean): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateEventRosterPayment(clubId: string, rosterId: string, paymentId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  // Event Coaches (stub implementations)
  async getEventCoaches(clubId: string, eventId: string): Promise<(EventCoach & { coach: User })[]> {
    return [];
  }

  async setEventCoaches(clubId: string, eventId: string, coachIds: string[]): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  // DocuSeal Setup Requests (stub implementations)
  async getDocuSealSetupRequests(status?: 'open' | 'in_progress' | 'completed' | 'rejected'): Promise<DocuSealSetupRequest[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getDocuSealSetupRequest(requestId: string): Promise<DocuSealSetupRequest | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async getOpenDocuSealRequestForClub(clubId: string): Promise<DocuSealSetupRequest | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async createDocuSealSetupRequest(request: { club_id: string; requested_by_user_id?: string; requested_by_email: string; payload?: { program_name?: string; team_name?: string; template_id?: string; contract_name?: string } }): Promise<DocuSealSetupRequest> {
    throw new Error('Not implemented in MemStorage');
  }

  async updateDocuSealSetupRequest(requestId: string, data: { status?: 'open' | 'in_progress' | 'completed' | 'rejected'; notes?: string }): Promise<DocuSealSetupRequest> {
    throw new Error('Not implemented in MemStorage');
  }

  async markClubDocuSealOnboarded(clubId: string, onboardedByUserId?: string, teamName?: string): Promise<Club> {
    throw new Error('Not implemented in MemStorage');
  }

  async isClubDocuSealOnboarded(clubId: string): Promise<boolean> {
    throw new Error('Not implemented in MemStorage');
  }

  async getUnpaidLedgerEntriesByPeriod(periodStart: Date, periodEnd: Date): Promise<PlatformLedger[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getUnpaidLedgerEntriesByClubAndPeriod(clubId: string, periodStart: Date, periodEnd: Date): Promise<PlatformLedger[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getUnpaidLedgerEntriesByClub(clubId: string): Promise<PlatformLedger[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async markLedgerEntriesPaid(ids: string[], invoiceId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async createPlatformInvoice(invoice: {
    club_id: string;
    period_start: Date;
    period_end: Date;
    subtotal_amount: number;
    fee_amount: number;
    total_amount: number;
    payment_method: 'credit_card' | 'ach';
    status: 'draft' | 'paid' | 'failed';
    helcim_transaction_id?: string;
    failure_reason?: string;
  }): Promise<PlatformInvoice> {
    throw new Error('Not implemented in MemStorage');
  }

  async getPlatformInvoice(invoiceId: string): Promise<PlatformInvoice | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async getPlatformInvoicesByPeriod(periodStart: Date, periodEnd: Date): Promise<PlatformInvoice[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async updatePlatformInvoiceStatus(invoiceId: string, status: 'paid' | 'failed', transactionId?: string, failureReason?: string): Promise<PlatformInvoice> {
    throw new Error('Not implemented in MemStorage');
  }

  async getClubDirectorEmail(clubId: string): Promise<string | null> {
    throw new Error('Not implemented in MemStorage');
  }

  async checkWebhookEventProcessed(eventId: string): Promise<boolean> {
    throw new Error('Not implemented in MemStorage');
  }

  async recordWebhookEvent(event: {
    event_id: string;
    event_type: string;
    transaction_id?: string;
    invoice_number?: string;
    amount?: number;
    status?: string;
    raw_payload?: any;
  }): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async updatePaymentByTransactionId(transactionId: string, status: 'completed' | 'failed'): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async updatePlatformInvoiceByTransactionId(transactionId: string, status: 'paid' | 'failed'): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async getPlatformInvoiceByTransactionId(transactionId: string): Promise<PlatformInvoice | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async getPlatformInvoiceByInvoiceNumber(invoiceNumber: string): Promise<PlatformInvoice | undefined> {
    throw new Error('Not implemented in MemStorage');
  }

  async markLedgerEntriesPaidByInvoiceId(invoiceId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async unmarkLedgerEntriesByInvoiceId(invoiceId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }

  async getActiveAthletesForPeriod(clubId: string, periodStart: Date, periodEnd: Date): Promise<Athlete[]> {
    throw new Error('Not implemented in MemStorage');
  }

  async getActiveAthleteCountByClub(periodStart: Date, periodEnd: Date): Promise<Array<{ clubId: string; clubName: string; activeAthleteCount: number }>> {
    throw new Error('Not implemented in MemStorage');
  }

  async hasMonthlyLedgerEntryForAthlete(clubId: string, athleteId: string, periodStart: Date, periodEnd: Date): Promise<boolean> {
    throw new Error('Not implemented in MemStorage');
  }

  async createAutoBillingLedgerEntry(clubId: string, athleteId: string, amount: number, feeType: 'monthly' | 'clinic' | 'drop_in' | 'event', billingPeriodStart: string): Promise<PlatformLedger> {
    throw new Error('Not implemented in MemStorage');
  }

  // ============ HELCIM MODEL A - AUTOPAY (MemStorage stubs) ============
  
  async getClubsWithHelcimSubscriptions(): Promise<Club[]> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async getClubByCustomerCode(customerCode: string): Promise<Club | undefined> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async getPlatformLedgerSummary(clubId: string, periodStart: Date, periodEnd: Date): Promise<{ totalAmount: number; entryCount: number }> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async upsertAutopayCharge(charge: {
    club_id: string;
    period_start: string;
    period_end: string;
    amount: string;
    convenience_fee: string;
    status: 'prepared' | 'billed' | 'paid' | 'failed';
    helcim_subscription_id?: string | null;
    helcim_transaction_id?: string | null;
  }): Promise<PlatformAutopayCharge> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async getAutopayChargeForPeriod(clubId: string, billingDay: number, referenceDate: Date): Promise<PlatformAutopayCharge | undefined> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async getAutopayChargeByTransactionId(transactionId: string): Promise<PlatformAutopayCharge | undefined> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async updateAutopayChargeStatus(chargeId: string, status: 'prepared' | 'billed' | 'paid' | 'failed', transactionId?: string): Promise<PlatformAutopayCharge> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async markLedgerEntriesPaidForPeriod(clubId: string, periodStart: Date, periodEnd: Date): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async updateClubHelcimSubscription(clubId: string, subscriptionId: string, planId: number): Promise<Club> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async getSnackItems(eventId: string, clubId: string): Promise<SnackItem[]> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async createSnackItem(eventId: string, clubId: string, data: { category: string; item_name: string; quantity_needed: number; is_custom: boolean; created_by: string }): Promise<SnackItem> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async claimSnackItem(snackItemId: string, userId: string, userName: string): Promise<SnackItem> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async unclaimSnackItem(snackItemId: string): Promise<SnackItem> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async deleteSnackItem(snackItemId: string): Promise<void> {
    throw new Error('Not implemented in MemStorage');
  }
  
  async getEventAthleteAllergies(eventId: string): Promise<string[]> {
    throw new Error('Not implemented in MemStorage');
  }
}

import { dbStorage } from './db-storage';

// Use database storage instead of in-memory storage
export const storage: IStorage = dbStorage;
