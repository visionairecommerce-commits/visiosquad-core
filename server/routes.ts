import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage, PLATFORM_FEES } from "./storage";
import { processPayment, calculateTotalWithFee, createCardToken, createBankToken } from "./lib/helcim";
import { sendSessionCancellationEmail, sendContractSignedNotification, sendPaymentConfirmation } from "./lib/resend";
import { supabaseAdmin, isSupabaseAdminConfigured } from "./lib/supabase";
import { z } from "zod";
import { insertProgramContractSchema, insertAthleteContractSchema } from "../shared/schema";
import { addMonths, format, addDays, setHours, setMinutes, getDay, startOfDay, isBefore, parseISO } from "date-fns";

// Demo club ID for tenant isolation
const DEMO_CLUB_ID = 'demo-club-1';

// Role types for authorization
type UserRole = 'admin' | 'coach' | 'parent';

// Demo auth middleware - extracts role from header for demo mode
// In production, this would validate JWT/session and extract user info
function getAuthContext(req: Request): { clubId: string; role: UserRole; userId: string } {
  const role = (req.headers['x-user-role'] as UserRole) || 'admin';
  const userId = (req.headers['x-user-id'] as string) || 'demo-admin';
  const clubId = (req.headers['x-club-id'] as string) || DEMO_CLUB_ID;
  return { clubId, role, userId };
}

// Role-based access control middleware
function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { role } = getAuthContext(req);
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Access denied', required: allowedRoles });
    }
    next();
  };
}

// Centralized athlete access state check - locked if payment >7 days overdue
function checkAthleteAccessState(athlete: { paid_through_date?: string | null }): boolean {
  if (!athlete.paid_through_date) return false;
  const paidThrough = new Date(athlete.paid_through_date);
  const gracePeriod = new Date();
  gracePeriod.setDate(gracePeriod.getDate() - 7);
  return paidThrough < gracePeriod;
}

// Request validation schemas
const createProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  monthly_fee: z.coerce.number().min(0),
});

const createTeamSchema = z.object({
  name: z.string().min(1),
  program_id: z.string().min(1),
  coach_id: z.string().nullable().optional().default(null),
});

const createAthleteSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  date_of_birth: z.string().min(1),
  graduation_year: z.number().min(2020).max(2040),
  parent_id: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const createFacilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const createCourtSchema = z.object({
  facility_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

const createSessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  session_type: z.enum(['practice', 'clinic', 'drop_in']),
  program_id: z.string().min(1),
  team_id: z.string().optional(),
  facility_id: z.string().optional(),
  court_id: z.string().optional(),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  location: z.string().optional(),
  drop_in_price: z.coerce.number().optional(),
  capacity: z.number().optional(),
  forceCreate: z.boolean().optional(),
});

const dayOfWeekSchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

const timeBlockSchema = z.object({
  days: z.array(dayOfWeekSchema).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const createRecurringSessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  session_type: z.enum(['practice', 'clinic', 'drop_in']),
  program_id: z.string().min(1),
  team_id: z.string().optional(),
  facility_id: z.string().optional(),
  court_id: z.string().optional(),
  location: z.string().optional(),
  capacity: z.number().optional(),
  drop_in_price: z.number().optional(),
  recurrence: z.object({
    timeBlocks: z.array(timeBlockSchema).min(1),
    repeatUntil: z.string().min(1),
    startDate: z.string().optional(),
  }),
  forceCreate: z.boolean().optional(),
});

const cancelSessionSchema = z.object({
  reason: z.string().min(1),
});

const assignRosterSchema = z.object({
  athlete_id: z.string().min(1),
  team_id: z.string().min(1),
  program_id: z.string().min(1),
});

const checkInSchema = z.object({
  checked_in: z.boolean(),
});

const cashPaymentSchema = z.object({
  athlete_id: z.string().min(1),
  months: z.number().min(1).max(12),
});

// Auth schemas
const createClubSchema = z.object({
  name: z.string().min(2),
  director_name: z.string().min(2),
  director_email: z.string().email(),
  director_password: z.string().min(8),
});

const registerUserSchema = z.object({
  join_code: z.string().length(6),
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['coach', 'parent']),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signDocumentSchema = z.object({
  signed_name: z.string().min(2),
  document_type: z.enum(['contract', 'waiver']),
});

const updateDocumentsSchema = z.object({
  contract_pdf_url: z.string().optional(),
  waiver_content: z.string().min(10),
});

const updateClubSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  logo_url: z.string().optional(),
});

const updateFacilitySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

const validateCodeSchema = z.object({
  join_code: z.string().length(6),
});

const paymentSchema = z.object({
  athlete_id: z.string().min(1),
  amount: z.number().min(0),
  payment_type: z.enum(['monthly', 'clinic', 'drop_in']),
  payment_method: z.enum(['credit_card', 'ach']),
  card_token: z.string().optional(),
}).refine((data) => {
  // Require card_token for credit card payments (unless in demo mode)
  if (data.payment_method === 'credit_card' && !data.card_token) {
    // In demo mode, allow processing without token for testing
    return true;
  }
  return true;
}, { message: 'Card token required for credit card payments' });

const registerSessionSchema = z.object({
  athlete_id: z.string().min(1),
  payment_method: z.enum(['credit_card', 'ach']).optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============ AUTH ROUTES (Public) ============
  
  // Create new club (Director signup)
  app.post('/api/auth/create-club', async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return res.status(500).json({ error: 'Authentication service not configured' });
      }
      
      const data = createClubSchema.parse(req.body);
      
      // Create the club first to get the club_id
      const club = await storage.createClubOnly(data.name);
      
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.director_email,
        password: data.director_password,
        email_confirm: true,
        user_metadata: {
          full_name: data.director_name,
          club_id: club.id,
          role: 'admin'
        }
      });
      
      if (authError) {
        // Rollback club creation
        await storage.deleteClub(club.id);
        // Provide clearer error messages for common issues
        let errorMessage = authError.message;
        if (errorMessage.includes('already') || errorMessage.includes('Database error')) {
          errorMessage = 'An account with this email already exists. Please use a different email or login instead.';
        }
        return res.status(400).json({ error: errorMessage });
      }
      
      // Get the profile created by the trigger - retry a few times for trigger timing
      let user = null;
      for (let i = 0; i < 3; i++) {
        user = await storage.getUserById(authData.user.id);
        if (user) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!user) {
        // Rollback: delete auth user and club
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        await storage.deleteClub(club.id);
        return res.status(500).json({ error: 'Failed to create user profile' });
      }
      
      res.status(201).json({ club, user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating club:', error);
        res.status(500).json({ error: 'Failed to create club' });
      }
    }
  });

  // Validate club code
  app.post('/api/auth/validate-code', async (req, res) => {
    try {
      const data = validateCodeSchema.parse(req.body);
      const club = await storage.getClubByJoinCode(data.join_code);
      
      if (!club) {
        return res.status(404).json({ error: 'Invalid club code' });
      }
      
      if (!club.onboarding_complete) {
        return res.status(400).json({ error: 'Club setup is not complete yet' });
      }
      
      res.json({ 
        valid: true, 
        club_name: club.name,
        club_id: club.id,
        has_waiver: !!club.waiver_content,
        has_contract: !!club.contract_pdf_url
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error validating code:', error);
        res.status(500).json({ error: 'Failed to validate code' });
      }
    }
  });

  // Register new user (Parent/Coach)
  app.post('/api/auth/register', async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return res.status(500).json({ error: 'Authentication service not configured' });
      }
      
      const data = registerUserSchema.parse(req.body);
      
      // Validate club code
      const club = await storage.getClubByJoinCode(data.join_code);
      if (!club) {
        return res.status(404).json({ error: 'Invalid club code' });
      }
      
      if (!club.onboarding_complete) {
        return res.status(400).json({ error: 'Club setup is not complete yet' });
      }
      
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          club_id: club.id,
          role: data.role
        }
      });
      
      if (authError) {
        // Provide clearer error messages for common issues
        let errorMessage = authError.message;
        if (errorMessage.includes('already') || errorMessage.includes('Database error')) {
          errorMessage = 'An account with this email already exists. Please use a different email or login instead.';
        }
        return res.status(400).json({ error: errorMessage });
      }
      
      // Get the profile created by the trigger - retry a few times for trigger timing
      let user = null;
      for (let i = 0; i < 3; i++) {
        user = await storage.getUserById(authData.user.id);
        if (user) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!user) {
        // Rollback: delete auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(500).json({ error: 'Failed to create user profile' });
      }
      
      res.status(201).json({ 
        user,
        club: {
          id: club.id,
          name: club.name,
          waiver_content: club.waiver_content,
          contract_pdf_url: club.contract_pdf_url
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
      }
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return res.status(500).json({ error: 'Authentication service not configured' });
      }
      
      const data = loginSchema.parse(req.body);
      
      // Authenticate via Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });
      
      if (authError || !authData.user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Get user profile from database
      const user = await storage.getUserById(authData.user.id);
      if (!user) {
        return res.status(401).json({ error: 'User profile not found' });
      }
      
      const club = await storage.getClub(user.club_id);
      
      res.json({ 
        user,
        club: club ? {
          id: club.id,
          name: club.name,
          join_code: club.join_code,
          onboarding_complete: club.onboarding_complete,
          waiver_content: club.waiver_content,
          contract_pdf_url: club.contract_pdf_url
        } : null,
        session: authData.session
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
      }
    }
  });

  // Sign documents (e-signature)
  app.post('/api/auth/sign-documents', async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const data = signDocumentSchema.parse(req.body);
      
      const ipAddress = req.ip || req.socket.remoteAddress;
      
      // Get club to determine document version
      const club = await storage.getClub(clubId);
      const documentVersion = data.document_type === 'waiver' 
        ? (club?.waiver_version || 1) 
        : (club?.contract_version || 1);
      
      await storage.createSignature(
        clubId,
        userId,
        data.document_type,
        documentVersion,
        data.signed_name,
        ipAddress
      );
      
      // Check if both documents are signed using version-aware check
      const hasSignedAll = await storage.hasSignedCurrentDocuments(clubId, userId);
      
      // If all required documents are signed
      if (hasSignedAll) {
        await storage.updateUserSignedDocuments(userId);
      }
      
      const signatures = await storage.getUserSignatures(clubId, userId);
      const hasWaiverSig = signatures.some(s => s.document_type === 'waiver');
      const hasContractSig = signatures.some(s => s.document_type === 'contract');
      
      res.json({ 
        success: true,
        all_signed: hasSignedAll,
        signatures: { waiver: hasWaiverSig, contract: hasContractSig }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error signing document:', error);
        res.status(500).json({ error: 'Failed to sign document' });
      }
    }
  });

  // Get user's document signatures
  app.get('/api/documents/signatures', async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const signatures = await storage.getUserSignatures(clubId, userId);
      res.json(signatures);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      res.status(500).json({ error: 'Failed to fetch signatures' });
    }
  });

  // Get club info (for e-signing page)
  app.get('/api/clubs/:clubId', async (req, res) => {
    try {
      const club = await storage.getClub(req.params.clubId);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      res.json({
        id: club.id,
        name: club.name,
        waiver_content: club.waiver_content,
        contract_pdf_url: club.contract_pdf_url,
        onboarding_complete: club.onboarding_complete
      });
    } catch (error) {
      console.error('Error fetching club:', error);
      res.status(500).json({ error: 'Failed to fetch club' });
    }
  });

  // Update club documents (Director only)
  app.put('/api/clubs/:clubId/documents', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      if (clubId !== req.params.clubId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const data = updateDocumentsSchema.parse(req.body);
      const club = await storage.updateClubDocuments(
        clubId,
        data.contract_pdf_url,
        data.waiver_content
      );
      
      res.json(club);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error updating documents:', error);
        res.status(500).json({ error: 'Failed to update documents' });
      }
    }
  });

  // Update club settings (Director only)
  app.put('/api/clubs/:clubId/settings', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      if (clubId !== req.params.clubId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const data = updateClubSettingsSchema.parse(req.body);
      const club = await storage.updateClubSettings(clubId, data);
      res.json(club);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error updating club settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
      }
    }
  });

  // Regenerate club join code (Director only)
  app.post('/api/clubs/:clubId/regenerate-code', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      if (clubId !== req.params.clubId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const club = await storage.regenerateClubCode(clubId);
      res.json(club);
    } catch (error) {
      console.error('Error regenerating club code:', error);
      res.status(500).json({ error: 'Failed to regenerate club code' });
    }
  });

  // Complete onboarding (Director only)
  app.post('/api/clubs/:clubId/complete-onboarding', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      if (clubId !== req.params.clubId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const club = await storage.completeOnboarding(clubId);
      res.json(club);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  });

  // Get billing status (Director only)
  app.get('/api/clubs/:clubId/billing', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      if (clubId !== req.params.clubId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const club = await storage.getClub(clubId);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      
      const hasBillingMethod = !!club.billing_card_token || !!club.billing_bank_token;
      res.json({
        has_billing_method: hasBillingMethod,
        billing_method: club.billing_method || null,
        card_last_four: club.billing_card_last_four || null,
        bank_last_four: club.billing_bank_last_four || null,
      });
    } catch (error) {
      console.error('Error fetching billing status:', error);
      res.status(500).json({ error: 'Failed to fetch billing status' });
    }
  });

  // Add/Update billing card (Director only)
  const billingCardSchema = z.object({
    card_number: z.string().min(13).max(19),
    expiry: z.string().regex(/^\d{4}$/, 'Expiry must be in MMYY format'),
    cvv: z.string().min(3).max(4),
  });

  app.post('/api/clubs/:clubId/billing/card', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      if (clubId !== req.params.clubId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const data = billingCardSchema.parse(req.body);
      
      // Tokenize the card using Helcim
      const tokenResult = await createCardToken(data.card_number, data.expiry, data.cvv);
      
      if (tokenResult.error || !tokenResult.token) {
        return res.status(400).json({ error: tokenResult.error || 'Failed to tokenize card' });
      }
      
      // Get the last 4 digits of the card
      const lastFour = data.card_number.slice(-4);
      
      // Update the club with the billing card info
      const club = await storage.updateClubBillingCard(clubId, tokenResult.token, lastFour);
      
      res.json({
        success: true,
        card_last_four: lastFour,
        billing_method: 'card',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error adding billing card:', error);
        res.status(500).json({ error: 'Failed to add billing card' });
      }
    }
  });

  // Add/Update billing bank account (Director only)
  const billingBankSchema = z.object({
    routing_number: z.string().length(9, 'Routing number must be 9 digits'),
    account_number: z.string().min(4).max(17),
    account_type: z.enum(['checking', 'savings']),
  });

  app.post('/api/clubs/:clubId/billing/bank', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      if (clubId !== req.params.clubId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const data = billingBankSchema.parse(req.body);
      
      // Tokenize the bank account using Helcim
      const tokenResult = await createBankToken(data.routing_number, data.account_number, data.account_type);
      
      if (tokenResult.error || !tokenResult.token) {
        return res.status(400).json({ error: tokenResult.error || 'Failed to tokenize bank account' });
      }
      
      // Get the last 4 digits of the account number
      const lastFour = data.account_number.slice(-4);
      
      // Update the club with the billing bank info
      const club = await storage.updateClubBillingBank(clubId, tokenResult.token, lastFour);
      
      res.json({
        success: true,
        bank_last_four: lastFour,
        billing_method: 'bank',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error adding billing bank:', error);
        res.status(500).json({ error: 'Failed to add bank account' });
      }
    }
  });

  // Get current user's club info (for Share section)
  app.get('/api/my-club', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const club = await storage.getClub(clubId);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      res.json(club);
    } catch (error) {
      console.error('Error fetching my club:', error);
      res.status(500).json({ error: 'Failed to fetch club' });
    }
  });

  // ============ PROGRAMS ============
  app.get('/api/programs', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const programs = await storage.getPrograms(clubId);
      res.json(programs);
    } catch (error) {
      console.error('Error fetching programs:', error);
      res.status(500).json({ error: 'Failed to fetch programs' });
    }
  });

  app.post('/api/programs', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createProgramSchema.parse(req.body);
      const program = await storage.createProgram(clubId, data);
      res.status(201).json(program);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating program:', error);
        res.status(500).json({ error: 'Failed to create program' });
      }
    }
  });

  app.delete('/api/programs/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.deleteProgram(clubId, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting program:', error);
      res.status(500).json({ error: 'Failed to delete program' });
    }
  });

  // ============ PROGRAM CONTRACTS ============
  // Get all contracts for a program (or all program contracts)
  app.get('/api/program-contracts', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const programId = req.query.program_id as string | undefined;
      const contracts = await storage.getProgramContracts(clubId, programId);
      res.json(contracts);
    } catch (error) {
      console.error('Error fetching program contracts:', error);
      res.status(500).json({ error: 'Failed to fetch program contracts' });
    }
  });

  // Get a specific program contract
  app.get('/api/program-contracts/:id', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const contract = await storage.getProgramContract(clubId, req.params.id as string);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      res.json(contract);
    } catch (error) {
      console.error('Error fetching program contract:', error);
      res.status(500).json({ error: 'Failed to fetch program contract' });
    }
  });

  // Create a new program contract
  app.post('/api/program-contracts', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = insertProgramContractSchema.parse(req.body);
      const contract = await storage.createProgramContract(clubId, data);
      res.status(201).json(contract);
    } catch (error) {
      console.error('Error creating program contract:', error);
      res.status(500).json({ error: 'Failed to create program contract' });
    }
  });

  // Update a program contract
  app.patch('/api/program-contracts/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = req.body;
      const contract = await storage.updateProgramContract(clubId, req.params.id as string, data);
      res.json(contract);
    } catch (error) {
      console.error('Error updating program contract:', error);
      res.status(500).json({ error: 'Failed to update program contract' });
    }
  });

  // Delete a program contract
  app.delete('/api/program-contracts/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.deleteProgramContract(clubId, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting program contract:', error);
      res.status(500).json({ error: 'Failed to delete program contract' });
    }
  });

  // ============ ATHLETE CONTRACTS ============
  // Get athlete contracts - admin only for listing all, parents can only see their own athletes
  app.get('/api/athlete-contracts', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const athleteId = req.query.athlete_id as string | undefined;
      const contracts = await storage.getAthleteContracts(clubId, athleteId);
      res.json(contracts);
    } catch (error) {
      console.error('Error fetching athlete contracts:', error);
      res.status(500).json({ error: 'Failed to fetch athlete contracts' });
    }
  });

  // Assign a contract to an athlete - automatically cancels existing active contracts
  app.post('/api/athlete-contracts', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = insertAthleteContractSchema.parse(req.body);
      
      // First, cancel any existing active contracts for this athlete
      const existingContracts = await storage.getAthleteContracts(clubId, data.athlete_id);
      const activeContracts = existingContracts.filter(c => c.status === 'active');
      for (const activeContract of activeContracts) {
        await storage.updateAthleteContractStatus(clubId, activeContract.id, 'cancelled');
      }
      
      // Create the new contract
      const contract = await storage.createAthleteContract(clubId, data);
      res.status(201).json(contract);
    } catch (error) {
      console.error('Error creating athlete contract:', error);
      res.status(500).json({ error: 'Failed to assign contract to athlete' });
    }
  });

  // Update athlete contract status (cancel/expire)
  app.patch('/api/athlete-contracts/:id/status', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { status } = req.body;
      if (!['active', 'cancelled', 'expired'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      const contract = await storage.updateAthleteContractStatus(clubId, req.params.id as string, status);
      res.json(contract);
    } catch (error) {
      console.error('Error updating athlete contract status:', error);
      res.status(500).json({ error: 'Failed to update athlete contract status' });
    }
  });

  // ============ EVENTS ============
  const createEventSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    event_type: z.enum(['clinic', 'camp', 'tryout', 'tournament', 'other']),
    program_id: z.string().optional(),
    team_id: z.string().optional(),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    location: z.string().optional(),
    capacity: z.number().optional(),
    price: z.number().min(0),
  });

  const addEventRosterSchema = z.object({
    athlete_id: z.string().min(1),
  });

  app.get('/api/events', async (req, res) => {
    try {
      const { clubId, role, userId } = getAuthContext(req);
      const programId = req.query.program_id as string | undefined;
      const teamId = req.query.team_id as string | undefined;
      
      let events;
      if (role === 'coach') {
        events = await storage.getEventsByCoach(clubId, userId);
      } else {
        events = await storage.getEvents(clubId, { programId, teamId });
      }
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const event = await storage.getEvent(clubId, req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      res.json(event);
    } catch (error) {
      console.error('Error fetching event:', error);
      res.status(500).json({ error: 'Failed to fetch event' });
    }
  });

  app.post('/api/events', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createEventSchema.parse(req.body);
      const event = await storage.createEvent(clubId, {
        title: data.title,
        description: data.description,
        event_type: data.event_type,
        program_id: data.program_id,
        team_id: data.team_id,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location,
        capacity: data.capacity,
        price: data.price,
      });
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating event:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  });

  app.patch('/api/events/:id', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const event = await storage.updateEvent(clubId, req.params.id as string, req.body);
      res.json(event);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  });

  app.delete('/api/events/:id', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.deleteEvent(clubId, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  // Event rosters
  app.get('/api/events/:id/rosters', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const rosters = await storage.getEventRosters(clubId, req.params.id as string);
      res.json(rosters);
    } catch (error) {
      console.error('Error fetching event rosters:', error);
      res.status(500).json({ error: 'Failed to fetch event rosters' });
    }
  });

  app.post('/api/events/:id/rosters', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = addEventRosterSchema.parse(req.body);
      
      // Get the event to check price
      const event = await storage.getEvent(clubId, req.params.id as string);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if club has billing method before processing payment
      const club = await storage.getClub(clubId);
      if (!club?.billing_card_token && !club?.billing_bank_token) {
        return res.status(403).json({ 
          error: 'Billing method required',
          message: 'A billing method must be added before processing payments. Please add a credit card or bank account in Settings > Billing.' 
        });
      }

      // Create payment record for the event fee
      let paymentId: string | undefined;
      if (event.price > 0) {
        const payment = await storage.createPayment(clubId, {
          athlete_id: data.athlete_id,
          amount: event.price,
          payment_type: 'event',
          payment_method: 'credit_card',
          status: 'pending',
        });
        paymentId = payment.id;

        // Create platform ledger entry ($1 per player per event)
        await storage.createPlatformLedgerEntry(clubId, payment.id, PLATFORM_FEES.event, 'event');
      }

      const roster = await storage.addEventRoster(clubId, req.params.id as string, data.athlete_id, paymentId);
      res.status(201).json(roster);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error adding athlete to event:', error);
      res.status(500).json({ error: 'Failed to add athlete to event' });
    }
  });

  app.delete('/api/events/:id/rosters/:rosterId', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.removeEventRoster(clubId, req.params.rosterId as string);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing athlete from event:', error);
      res.status(500).json({ error: 'Failed to remove athlete from event' });
    }
  });

  app.patch('/api/events/rosters/:rosterId/checkin', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { checked_in } = req.body;
      await storage.updateEventRosterCheckIn(clubId, req.params.rosterId as string, checked_in);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating event roster check-in:', error);
      res.status(500).json({ error: 'Failed to update check-in status' });
    }
  });

  // Event coaches
  app.get('/api/events/:id/coaches', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const coaches = await storage.getEventCoaches(clubId, req.params.id as string);
      res.json(coaches);
    } catch (error) {
      console.error('Error fetching event coaches:', error);
      res.status(500).json({ error: 'Failed to fetch event coaches' });
    }
  });

  app.put('/api/events/:id/coaches', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { coach_ids } = req.body;
      if (!Array.isArray(coach_ids)) {
        return res.status(400).json({ error: 'coach_ids must be an array' });
      }
      await storage.setEventCoaches(clubId, req.params.id as string, coach_ids);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting event coaches:', error);
      res.status(500).json({ error: 'Failed to set event coaches' });
    }
  });

  // Get events for an athlete (parent view)
  app.get('/api/athletes/:athleteId/events', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const events = await storage.getEventsForAthlete(clubId, req.params.athleteId);
      res.json(events);
    } catch (error) {
      console.error('Error fetching athlete events:', error);
      res.status(500).json({ error: 'Failed to fetch athlete events' });
    }
  });

  // ============ TEAMS ============
  app.get('/api/teams', async (req, res) => {
    try {
      const { clubId, role, userId } = getAuthContext(req);
      let teams;
      if (role === 'coach') {
        teams = await storage.getTeamsByCoach(clubId, userId);
      } else {
        teams = await storage.getTeams(clubId);
      }
      res.json(teams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  });

  app.post('/api/teams', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createTeamSchema.parse(req.body);
      const team = await storage.createTeam(clubId, data);
      res.status(201).json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating team:', error);
        res.status(500).json({ error: 'Failed to create team' });
      }
    }
  });

  app.put('/api/teams/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = req.body;
      const team = await storage.updateTeam(clubId, req.params.id as string, data);
      res.json(team);
    } catch (error) {
      console.error('Error updating team:', error);
      res.status(500).json({ error: 'Failed to update team' });
    }
  });

  app.delete('/api/teams/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.deleteTeam(clubId, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({ error: 'Failed to delete team' });
    }
  });

  app.get('/api/coaches', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const coaches = await storage.getCoaches(clubId);
      res.json(coaches);
    } catch (error) {
      console.error('Error fetching coaches:', error);
      res.status(500).json({ error: 'Failed to fetch coaches' });
    }
  });

  // ============ ATHLETES ============
  app.get('/api/athletes', async (req, res) => {
    try {
      const { clubId, role, userId } = getAuthContext(req);
      const parentId = req.query.parent_id as string | undefined;
      // Parents can only see their own athletes
      const effectiveParentId = role === 'parent' ? userId : parentId;
      const athletes = effectiveParentId
        ? await storage.getAthletesByParent(clubId, effectiveParentId)
        : await storage.getAthletes(clubId);
      res.json(athletes);
    } catch (error) {
      console.error('Error fetching athletes:', error);
      res.status(500).json({ error: 'Failed to fetch athletes' });
    }
  });

  app.get('/api/athletes/unassigned', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const programId = req.query.program_id as string;
      if (!programId) {
        return res.status(400).json({ error: 'program_id is required' });
      }
      const athletes = await storage.getUnassignedAthletes(clubId, programId);
      res.json(athletes);
    } catch (error) {
      console.error('Error fetching unassigned athletes:', error);
      res.status(500).json({ error: 'Failed to fetch unassigned athletes' });
    }
  });

  app.post('/api/athletes', requireRole('admin', 'parent'), async (req, res) => {
    try {
      const { clubId, role, userId } = getAuthContext(req);
      const data = createAthleteSchema.parse(req.body);
      const parentId = role === 'parent' ? userId : (data.parent_id || userId);
      const athlete = await storage.createAthlete(clubId, {
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth,
        graduation_year: data.graduation_year,
        parent_id: parentId,
        tags: [],
      });
      res.status(201).json(athlete);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating athlete:', error);
        res.status(500).json({ error: 'Failed to create athlete' });
      }
    }
  });

  // Grant test access (extend paid_through_date for testing)
  app.post('/api/athletes/:athleteId/grant-access', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const athleteId = req.params.athleteId as string;
      const { days = 30 } = req.body;
      
      // Set paid_through_date to specified days from now
      const newPaidThrough = new Date();
      newPaidThrough.setDate(newPaidThrough.getDate() + days);
      
      await storage.updateAthletePaidThrough(
        clubId,
        athleteId,
        newPaidThrough.toISOString()
      );
      
      res.json({ 
        success: true, 
        paid_through_date: newPaidThrough.toISOString(),
        message: `Access granted for ${days} days`
      });
    } catch (error) {
      console.error('Error granting test access:', error);
      res.status(500).json({ error: 'Failed to grant access' });
    }
  });

  // ============ ROSTER ============
  app.get('/api/teams/:teamId/roster', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const roster = await storage.getTeamRoster(clubId, req.params.teamId);
      res.json(roster);
    } catch (error) {
      console.error('Error fetching roster:', error);
      res.status(500).json({ error: 'Failed to fetch roster' });
    }
  });

  app.post('/api/roster/assign', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = assignRosterSchema.parse(req.body);
      const roster = await storage.assignAthleteToTeam(
        clubId,
        data.athlete_id,
        data.team_id,
        data.program_id
      );
      res.status(201).json(roster);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error assigning athlete:', error);
        res.status(500).json({ error: 'Failed to assign athlete' });
      }
    }
  });

  app.get('/api/roster', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const roster = await storage.getRoster(clubId);
      const athletes = await storage.getAthletes(clubId);
      const teams = await storage.getTeams(clubId);
      
      const enrichedRoster = roster.map(entry => {
        const athlete = athletes.find(a => a.id === entry.athlete_id);
        const team = teams.find(t => t.id === entry.team_id);
        return {
          ...entry,
          athlete_name: athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Unknown',
          graduation_year: athlete?.graduation_year || 0,
          team_name: team?.name || 'Unknown',
        };
      });
      res.json(enrichedRoster);
    } catch (error) {
      console.error('Error fetching master roster:', error);
      res.status(500).json({ error: 'Failed to fetch roster' });
    }
  });

  app.patch('/api/roster/:id/contract', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { contract_signed } = req.body;
      if (typeof contract_signed !== 'boolean') {
        return res.status(400).json({ error: 'contract_signed must be a boolean' });
      }
      const roster = await storage.updateRosterContractStatus(clubId, req.params.id as string, contract_signed);
      res.json(roster);
    } catch (error) {
      console.error('Error updating contract status:', error);
      res.status(500).json({ error: 'Failed to update contract status' });
    }
  });

  app.delete('/api/roster/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.removeFromRoster(clubId, req.params.id as string);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing from roster:', error);
      res.status(500).json({ error: 'Failed to remove from roster' });
    }
  });

  // ============ FACILITIES ============
  app.get('/api/facilities', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const facilities = await storage.getFacilities(clubId);
      res.json(facilities);
    } catch (error) {
      console.error('Error fetching facilities:', error);
      res.status(500).json({ error: 'Failed to fetch facilities' });
    }
  });

  app.post('/api/facilities', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createFacilitySchema.parse(req.body);
      const facility = await storage.createFacility(clubId, data);
      res.status(201).json(facility);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating facility:', error);
        res.status(500).json({ error: 'Failed to create facility' });
      }
    }
  });

  app.put('/api/facilities/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = updateFacilitySchema.parse(req.body);
      const facility = await storage.updateFacility(clubId, req.params.id as string, data);
      res.json(facility);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error updating facility:', error);
        res.status(500).json({ error: 'Failed to update facility' });
      }
    }
  });

  app.delete('/api/facilities/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.deleteFacility(clubId, req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting facility:', error);
      res.status(500).json({ error: 'Failed to delete facility' });
    }
  });

  // ============ COURTS ============
  app.get('/api/courts', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const facilityId = req.query.facility_id as string | undefined;
      const courts = await storage.getCourts(clubId, facilityId);
      res.json(courts);
    } catch (error) {
      console.error('Error fetching courts:', error);
      res.status(500).json({ error: 'Failed to fetch courts' });
    }
  });

  app.post('/api/courts', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createCourtSchema.parse(req.body);
      const court = await storage.createCourt(clubId, data);
      res.status(201).json(court);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating court:', error);
        res.status(500).json({ error: 'Failed to create court' });
      }
    }
  });

  app.put('/api/courts/:id', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createCourtSchema.partial().parse(req.body);
      const court = await storage.updateCourt(clubId, req.params.id as string, data);
      res.json(court);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error updating court:', error);
        res.status(500).json({ error: 'Failed to update court' });
      }
    }
  });

  app.delete('/api/courts/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.deleteCourt(clubId, req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting court:', error);
      res.status(500).json({ error: 'Failed to delete court' });
    }
  });

  // ============ SESSIONS ============
  app.get('/api/sessions', async (req, res) => {
    try {
      const { clubId, role, userId } = getAuthContext(req);
      let sessions = await storage.getSessions(clubId);
      if (role === 'coach') {
        const coachTeams = await storage.getTeamsByCoach(clubId, userId);
        const coachTeamIds = coachTeams.map(t => t.id);
        sessions = sessions.filter(s => s.team_id && coachTeamIds.includes(s.team_id));
      }
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.get('/api/sessions/:id', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const session = await storage.getSession(clubId, req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      console.error('Error fetching session:', error);
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  app.post('/api/sessions', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createSessionSchema.parse(req.body);

      // Check for scheduling conflicts (15-minute buffer logic) - court or facility-specific
      const { conflict, overlapMinutes, conflictingSession } = await storage.checkSessionConflict(
        clubId,
        data.start_time,
        data.end_time,
        data.facility_id,
        data.court_id
      );

      // Hard block for >15 minute overlaps
      if (conflict && overlapMinutes > 15) {
        return res.status(409).json({
          error: 'Schedule conflict',
          conflictType: 'hard',
          message: `Conflict: The facility is booked by "${conflictingSession?.title}". Please adjust the time.`,
          conflictingSession,
        });
      }

      // Soft warning for ≤15 minute overlaps - require forceCreate to proceed
      if (conflict && overlapMinutes <= 15 && !data.forceCreate) {
        return res.status(200).json({
          requiresConfirmation: true,
          conflictType: 'soft',
          message: `Note: This overlaps with "${conflictingSession?.title}" by ${Math.round(overlapMinutes)} minutes. Proceed?`,
          overlapMinutes: Math.round(overlapMinutes),
          conflictingSession,
        });
      }

      const session = await storage.createSession(clubId, {
        title: data.title,
        description: data.description,
        session_type: data.session_type,
        program_id: data.program_id,
        team_id: data.team_id,
        facility_id: data.facility_id,
        court_id: data.court_id,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location,
        capacity: data.capacity,
        drop_in_price: data.drop_in_price,
      });

      // If team is selected, auto-register all team members
      if (data.team_id) {
        const roster = await storage.getTeamRoster(clubId, data.team_id);
        const athleteIds = roster.map(r => r.athlete_id);
        if (athleteIds.length > 0) {
          await storage.bulkCreateRegistrations(clubId, session.id, athleteIds);
        }
      }

      res.status(201).json({
        session,
        warning: conflict && overlapMinutes <= 15
          ? `Minor overlap (${Math.round(overlapMinutes)} min) with "${conflictingSession?.title}"`
          : undefined,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
      }
    }
  });

  app.post('/api/sessions/:id/cancel', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = cancelSessionSchema.parse(req.body);
      const sessionId = req.params.id as string;
      const session = await storage.getSession(clubId, sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Cancel the session
      await storage.cancelSession(clubId, sessionId, data.reason);

      // Get registrations to notify parents
      const registrations = await storage.getSessionRegistrations(clubId, sessionId);
      
      // In production, we'd fetch actual parent emails
      // For demo, we'll simulate the notification
      const parentEmails = registrations.map(r => `parent-${r.athlete_id}@example.com`);

      if (parentEmails.length > 0) {
        await sendSessionCancellationEmail(
          parentEmails,
          session.title,
          data.reason,
          format(new Date(session.start_time), 'EEEE, MMMM d, yyyy h:mm a')
        );
      }

      res.json({
        success: true,
        notified: parentEmails.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error cancelling session:', error);
        res.status(500).json({ error: 'Failed to cancel session' });
      }
    }
  });

  // Delete session
  app.delete('/api/sessions/:id', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const sessionId = req.params.id as string;
      const session = await storage.getSession(clubId, sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      await storage.deleteSession(clubId, sessionId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  });

  // Create recurring sessions
  app.post('/api/sessions/recurring', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createRecurringSessionSchema.parse(req.body);
      
      const dayMapping: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      const recurrenceGroupId = randomUUID();
      const startDate = data.recurrence.startDate ? parseISO(data.recurrence.startDate) : new Date();
      const repeatUntil = parseISO(data.recurrence.repeatUntil);
      const createdSessions: any[] = [];
      const conflicts: any[] = [];
      
      // Generate all session instances
      for (const timeBlock of data.recurrence.timeBlocks) {
        for (const day of timeBlock.days) {
          const targetDayNumber = dayMapping[day];
          let currentDate = startOfDay(startDate);
          
          // Find first occurrence of this day on or after startDate
          while (getDay(currentDate) !== targetDayNumber) {
            currentDate = addDays(currentDate, 1);
          }
          
          // Generate sessions for each occurrence until repeatUntil (inclusive)
          while (isBefore(currentDate, repeatUntil) || format(currentDate, 'yyyy-MM-dd') === format(repeatUntil, 'yyyy-MM-dd')) {
            const [startHour, startMin] = timeBlock.startTime.split(':').map(Number);
            const [endHour, endMin] = timeBlock.endTime.split(':').map(Number);
            
            // Apply time to the current date using local time, then convert to ISO
            const startTime = setMinutes(setHours(currentDate, startHour), startMin);
            const endTime = setMinutes(setHours(currentDate, endHour), endMin);
            
            // Check for conflicts
            const { conflict, overlapMinutes, conflictingSession } = await storage.checkSessionConflict(
              clubId,
              startTime.toISOString(),
              endTime.toISOString(),
              data.facility_id,
              data.court_id
            );
            
            if (conflict && overlapMinutes > 15 && !data.forceCreate) {
              conflicts.push({
                date: format(currentDate, 'yyyy-MM-dd'),
                day,
                startTime: timeBlock.startTime,
                endTime: timeBlock.endTime,
                overlapMinutes: Math.round(overlapMinutes),
                conflictingSession: conflictingSession?.title,
                conflictType: 'hard',
              });
            } else {
              // Create the session
              const session = await storage.createSession(clubId, {
                title: data.title,
                description: data.description,
                session_type: data.session_type,
                program_id: data.program_id,
                team_id: data.team_id,
                facility_id: data.facility_id,
                court_id: data.court_id,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                location: data.location,
                capacity: data.capacity,
                drop_in_price: data.drop_in_price,
                recurrence_group_id: recurrenceGroupId,
              });
              
              // If team is selected, auto-register all team members
              if (data.team_id) {
                const roster = await storage.getTeamRoster(clubId, data.team_id);
                const athleteIds = roster.map(r => r.athlete_id);
                if (athleteIds.length > 0) {
                  await storage.bulkCreateRegistrations(clubId, session.id, athleteIds);
                }
              }
              
              createdSessions.push(session);
              
              // Track soft conflicts
              if (conflict && overlapMinutes <= 15) {
                conflicts.push({
                  date: format(currentDate, 'yyyy-MM-dd'),
                  day,
                  startTime: timeBlock.startTime,
                  endTime: timeBlock.endTime,
                  overlapMinutes: Math.round(overlapMinutes),
                  conflictingSession: conflictingSession?.title,
                  conflictType: 'soft',
                  sessionCreated: true,
                });
              }
            }
            
            currentDate = addDays(currentDate, 7); // Move to next week
          }
        }
      }
      
      if (conflicts.length > 0 && createdSessions.length === 0 && !data.forceCreate) {
        return res.status(409).json({
          error: 'Schedule conflicts detected',
          conflicts,
          message: 'Some or all sessions could not be created due to scheduling conflicts.',
        });
      }
      
      res.status(201).json({
        sessions: createdSessions,
        conflicts: conflicts.filter(c => c.conflictType === 'hard'),
        warnings: conflicts.filter(c => c.conflictType === 'soft'),
        recurrenceGroupId,
        totalCreated: createdSessions.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error creating recurring sessions:', error);
        res.status(500).json({ error: 'Failed to create recurring sessions' });
      }
    }
  });

  // Get sessions for a specific athlete (access-controlled by program/team registration)
  app.get('/api/athletes/:athleteId/sessions', async (req, res) => {
    try {
      const { clubId, role, userId } = getAuthContext(req);
      const { athleteId } = req.params;
      
      // Parents can only view sessions for their own athletes
      if (role === 'parent') {
        const athlete = await storage.getAthlete(clubId, athleteId);
        if (!athlete || athlete.parent_id !== userId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      const sessions = await storage.getSessionsForAthlete(clubId, athleteId);
      res.json(sessions);
    } catch (error) {
      console.error('Error fetching athlete sessions:', error);
      res.status(500).json({ error: 'Failed to fetch athlete sessions' });
    }
  });

  // ============ REGISTRATIONS ============
  app.get('/api/sessions/:sessionId/registrations', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const registrations = await storage.getSessionRegistrations(clubId, req.params.sessionId);
      res.json(registrations);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      res.status(500).json({ error: 'Failed to fetch registrations' });
    }
  });

  app.get('/api/athletes/:athleteId/registrations', async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const registrations = await storage.getAthleteRegistrations(clubId, req.params.athleteId);
      res.json(registrations);
    } catch (error) {
      console.error('Error fetching athlete registrations:', error);
      res.status(500).json({ error: 'Failed to fetch athlete registrations' });
    }
  });

  app.post('/api/sessions/:sessionId/register', requireRole('parent'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = registerSessionSchema.parse(req.body);
      const sessionId = req.params.sessionId as string;
      const session = await storage.getSession(clubId, sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if athlete's payment is current
      const athlete = await storage.getAthlete(clubId, data.athlete_id);
      if (!athlete) {
        return res.status(404).json({ error: 'Athlete not found' });
      }

      // Check access state (is_locked logic) - locked if payment >7 days overdue
      const isLocked = checkAthleteAccessState(athlete);
      if (isLocked) {
        return res.status(403).json({ error: 'Payment required', is_locked: true });
      }

      // Check contract status - athlete must have signed contract for this program/team
      const rosterEntries = await storage.getAthleteRosterEntries(clubId, data.athlete_id);
      const hasSignedContract = rosterEntries.some(entry => {
        const matchesProgram = entry.program_id === session.program_id;
        const matchesTeam = !session.team_id || entry.team_id === session.team_id;
        return matchesProgram && matchesTeam && entry.contract_signed;
      });
      if (!hasSignedContract) {
        return res.status(403).json({ error: 'Contract signature required', contract_required: true });
      }

      // Process payment if session has a drop-in price (for non-contract attendees)
      if (session.drop_in_price && session.drop_in_price > 0 && data.payment_method) {
        const totalAmount = calculateTotalWithFee(session.drop_in_price, data.payment_method);
        
        // In production, we'd process the actual payment
        // For demo, we simulate success
        const payment = await storage.createPayment(clubId, {
          athlete_id: data.athlete_id,
          amount: totalAmount,
          payment_type: session.session_type === 'clinic' ? 'clinic' : 'drop_in',
          payment_method: data.payment_method,
          status: 'completed',
        });

        // Create platform ledger entry
        const feeType = session.session_type === 'clinic' ? 'clinic' : 'drop_in';
        await storage.createPlatformLedgerEntry(
          clubId,
          payment.id,
          PLATFORM_FEES[feeType],
          feeType
        );
      }

      const registration = await storage.createRegistration(clubId, sessionId, data.athlete_id);
      res.status(201).json(registration);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error registering for session:', error);
        res.status(500).json({ error: 'Failed to register for session' });
      }
    }
  });

  app.patch('/api/registrations/:id/checkin', requireRole('coach', 'admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = checkInSchema.parse(req.body);
      await storage.updateCheckIn(clubId, req.params.id as string, data.checked_in);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error updating check-in:', error);
        res.status(500).json({ error: 'Failed to update check-in' });
      }
    }
  });

  // ============ PAYMENTS ============
  app.get('/api/payments', requireRole('admin', 'parent'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const payments = await storage.getPayments(clubId);
      res.json(payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  app.post('/api/payments/cash', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = cashPaymentSchema.parse(req.body);

      const athlete = await storage.getAthlete(clubId, data.athlete_id);
      if (!athlete) {
        return res.status(404).json({ error: 'Athlete not found' });
      }

      // Calculate new paid_through_date
      const currentPaidThrough = athlete.paid_through_date
        ? new Date(athlete.paid_through_date)
        : new Date();
      const newPaidThrough = addMonths(
        currentPaidThrough > new Date() ? currentPaidThrough : new Date(),
        data.months
      );

      // Create payment record
      const payment = await storage.createPayment(clubId, {
        athlete_id: data.athlete_id,
        amount: 150 * data.months, // Example monthly rate
        payment_type: 'cash',
        payment_method: 'cash',
        months_paid: data.months,
        status: 'completed',
      });

      // Create platform ledger entries ($1/month)
      for (let i = 0; i < data.months; i++) {
        await storage.createPlatformLedgerEntry(
          clubId,
          payment.id,
          PLATFORM_FEES.monthly,
          'monthly'
        );
      }

      // Update athlete's paid_through_date
      await storage.updateAthletePaidThrough(
        clubId,
        data.athlete_id,
        newPaidThrough.toISOString()
      );

      res.status(201).json({
        payment,
        paid_through_date: newPaidThrough.toISOString(),
        platform_fee: PLATFORM_FEES.monthly * data.months,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error processing cash payment:', error);
        res.status(500).json({ error: 'Failed to process cash payment' });
      }
    }
  });

  app.post('/api/payments/process', requireRole('admin', 'parent'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = paymentSchema.parse(req.body);

      // Check if the club has a billing method on file before allowing payments
      const club = await storage.getClub(clubId);
      if (!club?.billing_card_token && !club?.billing_bank_token) {
        return res.status(403).json({ 
          error: 'Billing method required',
          message: 'A billing method must be added before processing payments. Please add a credit card or bank account in Settings > Billing.' 
        });
      }

      const athlete = await storage.getAthlete(clubId, data.athlete_id);
      if (!athlete) {
        return res.status(404).json({ error: 'Athlete not found' });
      }

      const totalAmount = calculateTotalWithFee(data.amount, data.payment_method);

      // Process payment through Helcim
      const paymentResult = await processPayment({
        amount: totalAmount,
        cardToken: data.card_token,
        comments: `${data.payment_type} payment for ${athlete.first_name} ${athlete.last_name}`,
      });

      const payment = await storage.createPayment(clubId, {
        athlete_id: data.athlete_id,
        amount: totalAmount,
        payment_type: data.payment_type,
        payment_method: data.payment_method,
        helcim_transaction_id: paymentResult.transactionId,
        status: paymentResult.success ? 'completed' : 'failed',
      });

      if (paymentResult.success) {
        // Create platform ledger entry
        await storage.createPlatformLedgerEntry(
          clubId,
          payment.id,
          PLATFORM_FEES[data.payment_type],
          data.payment_type
        );

        // Update paid_through_date if monthly payment
        if (data.payment_type === 'monthly') {
          const currentPaidThrough = athlete.paid_through_date
            ? new Date(athlete.paid_through_date)
            : new Date();
          const newPaidThrough = addMonths(
            currentPaidThrough > new Date() ? currentPaidThrough : new Date(),
            1
          );
          await storage.updateAthletePaidThrough(
            clubId,
            data.athlete_id,
            newPaidThrough.toISOString()
          );
        }

        // Send confirmation email (simulated)
        await sendPaymentConfirmation(
          'parent@example.com',
          `${athlete.first_name} ${athlete.last_name}`,
          totalAmount,
          `${data.payment_type} payment`
        );
      }

      res.status(201).json({
        payment,
        success: paymentResult.success,
        error: paymentResult.error,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Failed to process payment' });
      }
    }
  });

  // ============ CONTRACTS ============
  app.post('/api/contracts/sign', requireRole('parent'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { athlete_id, program_id } = req.body;

      const athlete = await storage.getAthlete(clubId, athlete_id);
      const program = await storage.getProgram(clubId, program_id);

      if (!athlete || !program) {
        return res.status(404).json({ error: 'Athlete or program not found' });
      }

      // Send notification to admins and coaches
      await sendContractSignedNotification(
        ['admin@club.com'],
        ['coach@club.com'],
        `${athlete.first_name} ${athlete.last_name}`,
        program.name
      );

      res.json({
        success: true,
        message: 'Contract signed and notifications sent',
      });
    } catch (error) {
      console.error('Error signing contract:', error);
      res.status(500).json({ error: 'Failed to sign contract' });
    }
  });

  return httpServer;
}
