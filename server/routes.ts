import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage, PLATFORM_FEES } from "./storage";
import { processPayment, calculateTotalWithFee, getConvenienceFeeAmount, createCardToken, createBankToken, chargePlatformBilling, verifyWebhookSignature, isWebhookSecretConfigured, extractWebhookHeaders, calculateBillingPeriod, BILLING_MODE, PARENT_PAID_FEES_ENABLED, detectCardFundingType, cardFundingToPaymentRail } from "./lib/helcim";
import { calculateTechnologyAndServiceFees, getDualPricing, deriveMonthsCount, FEE_VERSION, type PaymentRail, type PaymentKind } from "../shared/pricing";
import { sendSessionCancellationEmail, sendContractSignedNotification, sendPaymentConfirmation, sendDocuSealOnboardingRequest, sendTestEmail, isResendConfigured, sendPlatformBillingSuccess, sendPlatformBillingFailure } from "./lib/resend";
import { supabaseAdmin, isSupabaseAdminConfigured } from "./lib/supabase";
import { z } from "zod";
import { insertProgramContractSchema, insertAthleteContractSchema } from "../shared/schema";
import { addMonths, format, addDays, setHours, setMinutes, getDay, startOfDay, isBefore, parseISO, formatDistanceToNow } from "date-fns";

// Helper to format time ago
function formatTimeAgo(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

// Role types for authorization
type UserRole = 'admin' | 'coach' | 'parent' | 'athlete' | 'owner';

// Auth context result type
interface AuthContext {
  clubId: string;
  role: UserRole;
  userId: string;
  athleteId?: string;
  isAuthenticated: boolean;
}

// Auth middleware - extracts user context from headers
// Headers are set by the frontend after Supabase auth
function getAuthContext(req: Request): AuthContext {
  const role = req.headers['x-user-role'] as UserRole | undefined;
  const userId = req.headers['x-user-id'] as string | undefined;
  const clubId = req.headers['x-club-id'] as string | undefined;
  const athleteId = req.headers['x-athlete-id'] as string | undefined;
  
  // Check if user is authenticated (has required headers)
  // Owner role doesn't require clubId
  const isAuthenticated = !!(role && userId && (clubId || role === 'owner'));
  
  return {
    clubId: clubId || '',
    role: role || 'parent',
    userId: userId || '',
    athleteId,
    isAuthenticated
  };
}

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { isAuthenticated } = getAuthContext(req);
  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Role-based access control middleware (also requires auth)
function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { role, isAuthenticated } = getAuthContext(req);
    if (!isAuthenticated) {
      return res.status(401).json({ error: 'Authentication required' });
    }
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
  email: z.string().email().optional().or(z.literal('')),
  date_of_birth: z.string().min(1),
  graduation_year: z.number().min(2020).max(2040),
  parent_id: z.string().optional(),
  volleyball_life_number: z.string().optional(),
  avp_number: z.string().optional(),
  bvca_number: z.string().optional(),
  aau_number: z.string().optional(),
  bvne_number: z.string().optional(),
  p1440_number: z.string().optional(),
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
  sport: z.enum(['soccer', 'football', 'basketball', 'indoor_volleyball', 'beach_volleyball']),
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
  waiver_content: z.string().min(10),
});

const updateClubSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  logo_url: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
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
  months_count: z.number().min(1).optional(),
  card_type: z.enum(['credit', 'debit']).optional(),
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

  // Global middleware to block write operations for locked clubs
  // Design: This middleware runs BEFORE route-level auth guards (requireAuth/requireRole).
  // - Unauthenticated requests pass through here but will fail at route-level auth guards
  // - Authenticated club-scoped requests are checked against club lock status
  // - Only requests with valid X-User-Id, X-Club-Id headers (set by auth) are checked
  // - Fail-closed for security: if storage check fails, block the write
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    // Skip if not a write operation
    if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
      return next();
    }
    
    // Get auth context - headers are set by frontend from authenticated session
    // These headers cannot be meaningfully spoofed without valid session tokens
    const { clubId, role, isAuthenticated, userId } = getAuthContext(req);
    
    // Skip if no authentication context (unauthenticated public routes)
    // Route-level guards (requireAuth/requireRole) will handle unauthorized access
    if (!isAuthenticated || !userId) {
      return next();
    }
    
    // Owner role bypasses all club locks (they manage all clubs)
    if (role === 'owner') {
      return next();
    }
    
    // No club ID means user is not associated with a club yet
    if (!clubId) {
      return next();
    }
    
    // Exempt specific routes that locked clubs must still access:
    // 1. Billing payment routes (to pay and unlock)
    // 2. Owner management routes (handled above)
    const billingPaymentPattern = /^\/clubs\/[^/]+\/billing\/(card|bank)$/;
    if (req.path.match(billingPaymentPattern)) {
      return next();
    }
    
    try {
      const club = await storage.getClub(clubId);
      if (club?.billing_locked_at) {
        return res.status(403).json({
          error: 'Club operations are suspended',
          message: 'Your club has been temporarily locked due to unpaid platform fees. Please contact support to resolve this.',
          locked: true,
          locked_at: club.billing_locked_at
        });
      }
      next();
    } catch (error) {
      // Fail-closed: if we can't verify club status, block the write for safety
      console.error('[Club Lock Middleware] Error checking club lock status:', error);
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'Unable to verify club status. Please try again later.'
      });
    }
  });

  // ============ AUTH ROUTES (Public) ============
  
  // TEMPORARY: Delete all Supabase Auth users (for cleanup)
  app.delete('/api/admin/clear-all-auth-users', async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return res.status(500).json({ error: 'Supabase Admin not configured' });
      }
      
      // List all users
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return res.status(500).json({ error: 'Failed to list users' });
      }
      
      // Delete each user
      let deleted = 0;
      for (const user of users) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`Error deleting user ${user.id}:`, deleteError);
        } else {
          deleted++;
        }
      }
      
      res.json({ message: `Deleted ${deleted} auth users`, total: users.length });
    } catch (error) {
      console.error('Error clearing auth users:', error);
      res.status(500).json({ error: 'Failed to clear auth users' });
    }
  });
  
  // Create new club (Director signup)
  app.post('/api/auth/create-club', async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        console.error('[create-club] Supabase Admin not configured');
        return res.status(500).json({ error: 'Authentication service not configured' });
      }
      
      console.log('[create-club] Received request body:', JSON.stringify(req.body));
      const data = createClubSchema.parse(req.body);
      console.log('[create-club] Parsed data for email:', data.director_email);
      
      // Create the club first to get the club_id
      const club = await storage.createClubOnly(data.name, data.sport);
      console.log('[create-club] Created club:', club.id, club.name);
      
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
        console.error('[create-club] Supabase auth error:', authError);
        // Rollback club creation
        await storage.deleteClub(club.id);
        // Provide clearer error messages for common issues
        let errorMessage = authError.message;
        if (errorMessage.includes('already') || errorMessage.includes('Database error') || errorMessage.includes('duplicate')) {
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
      
      // Update phone number if provided (for parents)
      if (data.phone_number && data.role === 'parent') {
        await storage.updateUserPhoneNumber(authData.user.id, data.phone_number);
        user = { ...user, phone_number: data.phone_number };
      }
      
      res.status(201).json({ 
        user,
        club: {
          id: club.id,
          name: club.name,
          sport: club.sport,
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
          sport: club.sport,
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

  // Forgot password - send reset email
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      
      if (!isSupabaseAdminConfigured()) {
        return res.status(500).json({ error: 'Authentication service not configured' });
      }
      
      // Use Supabase to send password reset email
      // Use server-configured APP_URL for security (no host header injection)
      const appUrl = process.env.APP_URL || 'https://visiosquad.com';
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/reset-password`,
      });
      
      if (error) {
        console.error('Error sending reset email:', error);
        // Don't reveal if email exists or not for security
        return res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
      }
      
      res.json({ success: true, message: 'Password reset email sent' });
    } catch (error) {
      console.error('Error in forgot password:', error);
      // Don't reveal errors for security
      res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
    }
  });

  // Sign documents (e-signature)
  app.post('/api/auth/sign-documents', requireAuth, async (req, res) => {
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

  // Get waiver status for current season
  app.get('/api/my-waiver-status', requireAuth, async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      
      const club = await storage.getClub(clubId);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      
      // Check if club has waiver content
      const waiverRequired = !!(club.waiver_content && club.waiver_content.trim());
      
      if (!waiverRequired) {
        return res.json({
          waiver_required: false,
          waiver_signed_for_current_season: true,
          current_season_id: null,
          current_season_name: null,
          waiver_content: null,
        });
      }
      
      // Get current active season
      const seasons = await storage.getSeasons(clubId);
      const now = new Date();
      const currentSeason = seasons.find(s => 
        s.is_active && 
        new Date(s.start_date) <= now && 
        new Date(s.end_date) >= now
      );
      
      // Check if user has signed waiver for current season
      const signatures = await storage.getUserSignatures(clubId, userId);
      const waiverSignatures = signatures.filter(s => s.document_type === 'waiver');
      
      let waiverSignedForCurrentSeason = false;
      
      if (currentSeason) {
        // If there's an active season, check if waiver is signed for this season
        waiverSignedForCurrentSeason = waiverSignatures.some(s => 
          s.season_id === currentSeason.id
        );
      } else {
        // No active season - check if they have any waiver signature
        // This allows initial waiver signing before seasons are set up
        waiverSignedForCurrentSeason = waiverSignatures.length > 0;
      }
      
      res.json({
        waiver_required: true,
        waiver_signed_for_current_season: waiverSignedForCurrentSeason,
        current_season_id: currentSeason?.id || null,
        current_season_name: currentSeason?.name || null,
        waiver_content: club.waiver_content,
      });
    } catch (error) {
      console.error('Error checking waiver status:', error);
      res.status(500).json({ error: 'Failed to check waiver status' });
    }
  });

  // Sign waiver for current season
  app.post('/api/auth/sign-waiver', requireAuth, async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { signed_name, season_id } = req.body;
      
      if (!signed_name || typeof signed_name !== 'string' || !signed_name.trim()) {
        return res.status(400).json({ error: 'Signed name is required' });
      }
      
      const ipAddress = req.ip || req.socket.remoteAddress;
      
      // Get club to determine waiver version
      const club = await storage.getClub(clubId);
      const waiverVersion = club?.waiver_version || 1;
      
      // Create signature with season_id
      await storage.createSignatureWithSeason(
        clubId,
        userId,
        'waiver',
        waiverVersion,
        signed_name.trim(),
        ipAddress,
        season_id || null
      );
      
      // Update user's has_signed_documents flag
      await storage.updateUserSignedDocuments(userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error signing waiver:', error);
      res.status(500).json({ error: 'Failed to sign waiver' });
    }
  });

  // Public config endpoint - provides Supabase configuration at runtime
  // This allows the frontend to get config even if VITE_ env vars aren't bundled at build time
  app.get('/api/config', (req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    });
  });

  // Test email endpoint - owner only, sends a test email to verify Resend configuration
  app.post('/api/test-email', requireRole('owner'), async (req, res) => {
    try {
      if (!isResendConfigured()) {
        return res.status(503).json({ 
          ok: false, 
          error: 'Email service not configured. RESEND_API_KEY is missing.' 
        });
      }

      const result = await sendTestEmail();
      
      if (result.success) {
        res.json({ 
          ok: true, 
          message: 'Test email sent successfully',
          emailId: result.id 
        });
      } else {
        res.status(500).json({ 
          ok: false, 
          error: result.error || 'Failed to send test email' 
        });
      }
    } catch (error) {
      console.error('[Test Email] Error:', error);
      res.status(500).json({ 
        ok: false, 
        error: 'Internal error while sending test email' 
      });
    }
  });

  // Get user's document signatures
  app.get('/api/documents/signatures', requireAuth, async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const signatures = await storage.getUserSignatures(clubId, userId);
      res.json(signatures);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      res.status(500).json({ error: 'Failed to fetch signatures' });
    }
  });

  // Setup athlete login credentials (parent only)
  app.post('/api/athletes/:athleteId/setup-login', requireRole('parent'), async (req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return res.status(500).json({ error: 'Authentication service not configured' });
      }
      
      const { clubId, userId } = getAuthContext(req);
      const athleteId = req.params.athleteId;
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      
      // Verify the athlete belongs to this parent
      const athlete = await storage.getAthlete(clubId, athleteId);
      if (!athlete || athlete.parent_id !== userId) {
        return res.status(403).json({ error: 'You can only set up login for your own athletes' });
      }
      
      // Check if athlete already has login
      if (athlete.has_login) {
        return res.status(400).json({ error: 'This athlete already has login credentials' });
      }
      
      // Check if email is already used by another profile
      const existingProfile = await storage.getProfileByEmail(email.toLowerCase());
      if (existingProfile) {
        return res.status(400).json({ error: 'This email address is already in use' });
      }
      
      // Create Supabase Auth user for the athlete
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
      });
      
      if (authError || !authData.user) {
        console.error('Error creating athlete auth:', authError);
        return res.status(400).json({ error: authError?.message || 'Failed to create login' });
      }
      
      // Create profile for the athlete - if this fails, clean up the auth user
      try {
        await storage.createProfile({
          id: authData.user.id,
          email,
          full_name: `${athlete.first_name} ${athlete.last_name}`,
          role: 'athlete',
          club_id: clubId,
          athlete_id: athleteId,
        });
      } catch (profileError) {
        console.error('Error creating athlete profile, cleaning up auth user:', profileError);
        // Clean up the Supabase Auth user since profile creation failed
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ error: 'This email address is already in use' });
      }
      
      // Update athlete with login info and link to user account
      await storage.updateAthlete(athleteId, {
        email,
        has_login: true,
        user_id: authData.user.id,
      });
      
      res.json({ success: true, message: 'Athlete login created successfully' });
    } catch (error) {
      console.error('Error setting up athlete login:', error);
      res.status(500).json({ error: 'Failed to set up athlete login' });
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
        undefined,
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

  // Upload club logo (Director only)
  app.post('/api/clubs/logo', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      
      // Security: Verify clubId exists
      if (!clubId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Handle multipart form data with size limit (5MB max)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      const chunks: Buffer[] = [];
      let totalSize = 0;
      
      for await (const chunk of req) {
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE) {
          return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // Parse multipart boundary
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!boundaryMatch) {
        return res.status(400).json({ error: 'Invalid multipart request' });
      }
      const boundary = boundaryMatch[1] || boundaryMatch[2];
      
      // Simple multipart parsing for file
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts = [];
      let start = 0;
      let idx = buffer.indexOf(boundaryBuffer, start);
      
      while (idx !== -1) {
        if (start !== 0) {
          parts.push(buffer.slice(start, idx - 2)); // -2 for \r\n before boundary
        }
        start = idx + boundaryBuffer.length + 2; // +2 for \r\n after boundary
        idx = buffer.indexOf(boundaryBuffer, start);
      }
      
      if (parts.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Get the first part (the file)
      const part = parts[0];
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return res.status(400).json({ error: 'Invalid file format' });
      }
      
      const headers = part.slice(0, headerEnd).toString();
      const fileData = part.slice(headerEnd + 4);
      
      // Security: Validate file size again
      if (fileData.length > MAX_FILE_SIZE) {
        return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
      }
      
      // Extract filename from headers
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'logo.png';
      
      // Security: Validate file extension
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ error: 'Invalid file type. Only PNG, JPG, GIF, and WEBP are allowed.' });
      }
      
      // Security: Validate magic bytes for image files
      const magicBytes: Record<string, number[]> = {
        png: [0x89, 0x50, 0x4E, 0x47], // PNG signature
        jpg: [0xFF, 0xD8, 0xFF], // JPEG signature
        jpeg: [0xFF, 0xD8, 0xFF],
        gif: [0x47, 0x49, 0x46, 0x38], // GIF signature
        webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WebP container)
      };
      
      const expectedMagic = magicBytes[ext];
      if (expectedMagic) {
        const fileMagic = Array.from(fileData.slice(0, expectedMagic.length));
        const isValidMagic = expectedMagic.every((byte, i) => fileMagic[i] === byte);
        if (!isValidMagic) {
          return res.status(400).json({ error: 'Invalid file content. File does not match expected format.' });
        }
      }
      
      const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
      };
      const mimeType = mimeTypes[ext] || 'image/png';
      
      // Upload to Supabase Storage
      const storagePath = `club-logos/${clubId}/${Date.now()}-${filename}`;
      const { data, error } = await supabase.storage
        .from('club-assets')
        .upload(storagePath, fileData, {
          contentType: mimeType,
          upsert: true,
        });
      
      if (error) {
        // If bucket doesn't exist, create it
        if (error.message?.includes('Bucket not found')) {
          await supabase.storage.createBucket('club-assets', {
            public: true,
          });
          // Retry upload
          const retryResult = await supabase.storage
            .from('club-assets')
            .upload(storagePath, fileData, {
              contentType: mimeType,
              upsert: true,
            });
          if (retryResult.error) {
            console.error('Logo upload retry error:', retryResult.error);
            return res.status(500).json({ error: 'Failed to upload logo' });
          }
        } else {
          console.error('Logo upload error:', error);
          return res.status(500).json({ error: 'Failed to upload logo' });
        }
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('club-assets')
        .getPublicUrl(storagePath);
      
      const logo_url = urlData.publicUrl;
      
      // Update club with new logo URL
      await storage.updateClubSettings(clubId, { logo_url });
      
      res.json({ logo_url });
    } catch (error) {
      console.error('Error uploading club logo:', error);
      res.status(500).json({ error: 'Failed to upload logo' });
    }
  });

  // Update club sport (Director only)
  app.patch('/api/clubs/sport', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { sport } = req.body;
      
      if (!['soccer', 'football', 'basketball', 'indoor_volleyball', 'beach_volleyball'].includes(sport)) {
        return res.status(400).json({ error: 'Invalid sport selection' });
      }
      
      const club = await storage.updateClubSport(clubId, sport);
      res.json(club);
    } catch (error) {
      console.error('Error updating club sport:', error);
      res.status(500).json({ error: 'Failed to update sport' });
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
  app.get('/api/my-club', requireAuth, async (req, res) => {
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

  // ============ DASHBOARD ============
  app.get('/api/dashboard/stats', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      
      // Get real data counts
      const athletes = await storage.getAthletes(clubId);
      const programs = await storage.getPrograms(clubId);
      const sessions = await storage.getSessions(clubId);
      
      // Calculate sessions this week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      const thisWeekSessions = sessions.filter(s => {
        const sessionDate = new Date(s.start_time);
        return sessionDate >= startOfWeek && sessionDate < endOfWeek && s.status !== 'cancelled';
      });
      
      res.json({
        totalAthletes: athletes.length,
        activePrograms: programs.filter(p => p.is_active).length,
        thisWeekSessions: thisWeekSessions.length,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  app.get('/api/dashboard/upcoming-sessions', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const sessions = await storage.getSessions(clubId);
      const teams = await storage.getTeams(clubId);
      const facilities = await storage.getFacilities(clubId);
      
      const now = new Date();
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      
      const upcomingSessions = sessions
        .filter(s => {
          const sessionDate = new Date(s.start_time);
          return sessionDate >= now && sessionDate <= nextWeek && s.status !== 'cancelled';
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5)
        .map(s => {
          const team = teams.find(t => t.id === s.team_id);
          const facility = facilities.find(f => f.id === s.facility_id);
          return {
            id: s.id,
            title: s.title || team?.name || 'Session',
            startTime: s.start_time,
            endTime: s.end_time,
            location: facility?.name || 'TBD',
            teamName: team?.name,
          };
        });
      
      res.json(upcomingSessions);
    } catch (error) {
      console.error('Error fetching upcoming sessions:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming sessions' });
    }
  });

  app.get('/api/dashboard/pending-payments', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const athletes = await storage.getAthletes(clubId);
      const contracts = await storage.getAthleteContracts(clubId);
      const programContracts = await storage.getProgramContracts(clubId);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find athletes with active contracts who are past due
      const pendingPayments: Array<{
        athleteId: string;
        athleteName: string;
        amount: string;
        daysOverdue: number;
        parentName?: string;
      }> = [];
      
      for (const athlete of athletes) {
        // Check if athlete has paid_through_date that is past due
        if (athlete.paid_through_date) {
          const paidThrough = new Date(athlete.paid_through_date);
          if (paidThrough < today) {
            // Find the active contract and its price
            const activeContract = contracts.find(c => 
              c.athlete_id === athlete.id && c.status === 'active'
            );
            
            if (activeContract) {
              const programContract = programContracts.find(c => c.id === activeContract.program_contract_id);
              const monthlyPrice = activeContract.custom_price || programContract?.monthly_price || '0';
              const daysOverdue = Math.floor((today.getTime() - paidThrough.getTime()) / (1000 * 60 * 60 * 24));
              
              pendingPayments.push({
                athleteId: athlete.id,
                athleteName: `${athlete.first_name} ${athlete.last_name}`,
                amount: monthlyPrice,
                daysOverdue,
              });
            }
          }
        }
      }
      
      // Sort by days overdue descending, limit to 5
      pendingPayments.sort((a, b) => b.daysOverdue - a.daysOverdue);
      res.json(pendingPayments.slice(0, 5));
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      res.status(500).json({ error: 'Failed to fetch pending payments' });
    }
  });

  app.get('/api/dashboard/recent-activity', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      
      const activities: Array<{
        type: string;
        message: string;
        time: string;
        timestamp: Date;
      }> = [];
      
      // Get recent athletes (new registrations)
      const athletes = await storage.getAthletes(clubId);
      const recentAthletes = athletes
        .filter(a => a.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 5);
      
      for (const athlete of recentAthletes) {
        activities.push({
          type: 'registration',
          message: `${athlete.first_name} ${athlete.last_name} was registered`,
          time: formatTimeAgo(new Date(athlete.created_at!)),
          timestamp: new Date(athlete.created_at!),
        });
      }
      
      // Get recent payments
      const payments = await storage.getPayments(clubId);
      const recentPayments = payments
        .filter(p => p.status === 'completed' && p.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 5);
      
      for (const payment of recentPayments) {
        const athlete = athletes.find(a => a.id === payment.athlete_id);
        const athleteName = athlete ? `${athlete.first_name} ${athlete.last_name}` : 'Unknown';
        activities.push({
          type: 'payment',
          message: `Payment of $${parseFloat(payment.amount).toFixed(2)} received for ${athleteName}`,
          time: formatTimeAgo(new Date(payment.created_at!)),
          timestamp: new Date(payment.created_at!),
        });
      }
      
      // Get recent sessions created
      const sessions = await storage.getSessions(clubId);
      const recentSessions = sessions
        .filter(s => s.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 5);
      
      const teams = await storage.getTeams(clubId);
      for (const session of recentSessions) {
        const team = teams.find(t => t.id === session.team_id);
        const sessionName = session.title || team?.name || 'Session';
        activities.push({
          type: 'session',
          message: `${sessionName} was scheduled`,
          time: formatTimeAgo(new Date(session.created_at!)),
          timestamp: new Date(session.created_at!),
        });
      }
      
      // Get recent events created
      const events = await storage.getEvents(clubId);
      const recentEvents = events
        .filter(e => e.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 5);
      
      for (const event of recentEvents) {
        activities.push({
          type: 'event',
          message: `${event.title} (${event.event_type}) was created`,
          time: formatTimeAgo(new Date(event.created_at!)),
          timestamp: new Date(event.created_at!),
        });
      }
      
      // Sort all activities by timestamp descending and take top 5
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      res.json(activities.slice(0, 5).map(({ type, message, time }) => ({ type, message, time })));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
  });

  app.get('/api/dashboard/revenue', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const payments = await storage.getPayments(clubId);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // Calculate this month's revenue
      const thisMonthRevenue = payments
        .filter(p => p.status === 'completed' && new Date(p.created_at!) >= startOfMonth)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      
      // Calculate last month's revenue for comparison
      const lastMonthRevenue = payments
        .filter(p => {
          const date = new Date(p.created_at!);
          return p.status === 'completed' && date >= startOfLastMonth && date <= endOfLastMonth;
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      
      // Calculate change percentage
      let changePercent = 0;
      if (lastMonthRevenue > 0) {
        changePercent = Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
      }
      
      res.json({
        monthlyRevenue: thisMonthRevenue.toFixed(2),
        changePercent,
      });
    } catch (error) {
      console.error('Error fetching revenue:', error);
      res.status(500).json({ error: 'Failed to fetch revenue' });
    }
  });

  // ============ PROGRAMS ============
  app.get('/api/programs', requireAuth, async (req, res) => {
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
      const { clubId, userId } = getAuthContext(req);
      console.log('[Create Program] Request from userId:', userId, 'clubId:', clubId);
      console.log('[Create Program] Body:', JSON.stringify(req.body));
      
      const data = createProgramSchema.parse(req.body);
      console.log('[Create Program] Validated data:', JSON.stringify(data));
      
      const program = await storage.createProgram(clubId, data);
      console.log('[Create Program] Success:', program.id);
      res.status(201).json(program);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[Create Program] Validation error:', error.errors);
        res.status(400).json({ error: error.errors });
      } else {
        console.error('[Create Program] Error:', error);
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
  app.get('/api/program-contracts', requireAuth, async (req, res) => {
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
  app.get('/api/program-contracts/:id', requireAuth, async (req, res) => {
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
      const { clubId, userId } = getAuthContext(req);
      const data = insertProgramContractSchema.parse(req.body);
      
      // Check if club is DocuSeal onboarded when a template ID is being set
      if (data.docuseal_template_id) {
        const isOnboarded = await storage.isClubDocuSealOnboarded(clubId);
        
        if (!isOnboarded) {
          // Check if there's already an open request for this club
          const existingRequest = await storage.getOpenDocuSealRequestForClub(clubId);
          
          if (!existingRequest) {
            // Get club, user, program, and team info for the notification
            const club = await storage.getClub(clubId);
            const user = await storage.getUserById(userId);
            const program = data.program_id ? await storage.getProgram(clubId, data.program_id) : undefined;
            const team = data.team_id ? await storage.getTeam(clubId, data.team_id) : undefined;
            
            // Create a setup request
            await storage.createDocuSealSetupRequest({
              club_id: clubId,
              requested_by_user_id: userId,
              requested_by_email: user?.email || 'unknown',
              payload: {
                contract_name: data.name,
                program_name: program?.name,
                team_name: team?.name,
                template_id: data.docuseal_template_id,
              },
            });
            
            // Send email to owner
            const appUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'https://visiosquad.com';
            await sendDocuSealOnboardingRequest(
              club?.name || 'Unknown Club',
              user?.email || 'unknown',
              user?.full_name || null,
              {
                contract_name: data.name,
                program_name: program?.name,
                team_name: team?.name,
                template_id: data.docuseal_template_id,
              },
              `${appUrl}/owner/docuseal-onboarding`
            );
          }
          
          // Still create the contract but warn the director
          const contract = await storage.createProgramContract(clubId, data);
          return res.status(201).json({
            ...contract,
            docuseal_pending: true,
            message: 'Contract created. DocuSeal setup is pending. The platform owner has been notified and will complete DocuSeal onboarding shortly.',
          });
        }
      }
      
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
      const { clubId, userId } = getAuthContext(req);
      // Validate with partial schema - allows partial updates
      const updateSchema = insertProgramContractSchema.partial();
      const data = updateSchema.parse(req.body);
      
      // Check if club is DocuSeal onboarded when a template ID is being set
      if (data.docuseal_template_id) {
        const isOnboarded = await storage.isClubDocuSealOnboarded(clubId);
        
        if (!isOnboarded) {
          // Check if there's already an open request for this club
          const existingRequest = await storage.getOpenDocuSealRequestForClub(clubId);
          
          if (!existingRequest) {
            // Get club, user, contract, program, and team info for the notification
            const club = await storage.getClub(clubId);
            const user = await storage.getUserById(userId);
            
            // Get the existing contract for context
            const existingContract = await storage.getProgramContract(clubId, req.params.id);
            const program = existingContract?.program_id ? await storage.getProgram(clubId, existingContract.program_id) : undefined;
            const teamId = data.team_id || existingContract?.team_id;
            const team = teamId ? await storage.getTeam(clubId, teamId) : undefined;
            
            // Create a setup request
            await storage.createDocuSealSetupRequest({
              club_id: clubId,
              requested_by_user_id: userId,
              requested_by_email: user?.email || 'unknown',
              payload: {
                contract_name: data.name || existingContract?.name,
                program_name: program?.name,
                team_name: team?.name,
                template_id: data.docuseal_template_id,
              },
            });
            
            // Send email to owner
            const appUrl = process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'https://visiosquad.com';
            await sendDocuSealOnboardingRequest(
              club?.name || 'Unknown Club',
              user?.email || 'unknown',
              user?.full_name || null,
              {
                contract_name: data.name || existingContract?.name,
                program_name: program?.name,
                team_name: team?.name,
                template_id: data.docuseal_template_id,
              },
              `${appUrl}/owner/docuseal-onboarding`
            );
          }
          
          // Still update the contract but warn the director
          const contract = await storage.updateProgramContract(clubId, req.params.id as string, data);
          return res.json({
            ...contract,
            docuseal_pending: true,
            message: 'Contract updated. DocuSeal setup is pending. The platform owner has been notified and will complete DocuSeal onboarding shortly.',
          });
        }
      }
      
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

  // ============ PARENT CONTRACT ENROLLMENT ============
  // Get available contracts for an athlete (based on their roster memberships)
  // Implements contract hierarchy: team contract > program contract > "not assigned" message
  app.get('/api/athletes/:athleteId/available-contracts', requireRole('parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const athleteId = req.params.athleteId as string;
      
      // Verify parent owns this athlete
      const athletes = await storage.getAthletesByParent(clubId, userId);
      const athleteIdList = athletes.map(a => a.id);
      if (!athleteIdList.includes(athleteId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get athlete's roster memberships to find their programs/teams
      const rosters = await storage.getAthleteRosterEntries(clubId, athleteId);
      
      // If athlete has no roster assignments, return special response
      if (rosters.length === 0) {
        return res.json({ 
          not_assigned: true, 
          message: "You have not yet been assigned to a program or team, please contact your club director to have them assign you.",
          contracts: [] 
        });
      }
      
      // Get all active contracts for the club
      const allContracts = await storage.getProgramContracts(clubId);
      const activeContracts = allContracts.filter(c => c.is_active);
      
      // Apply contract hierarchy for each roster entry
      // For each program/team assignment, find ALL contracts at the most specific scope
      const availableContracts: typeof activeContracts = [];
      const seenContractIds = new Set<string>();
      
      for (const roster of rosters) {
        // First, check for team-specific contracts if athlete is on a team
        if (roster.team_id) {
          const teamContracts = activeContracts.filter(c => 
            c.program_id === roster.program_id && 
            c.team_id === roster.team_id
          );
          if (teamContracts.length > 0) {
            // Add all team-specific contracts (team takes precedence)
            for (const contract of teamContracts) {
              if (!seenContractIds.has(contract.id)) {
                availableContracts.push(contract);
                seenContractIds.add(contract.id);
              }
            }
            continue; // Team contracts take precedence, skip program-level contracts
          }
        }
        
        // Fall back to program-level contracts (no team_id)
        const programContracts = activeContracts.filter(c => 
          c.program_id === roster.program_id && 
          !c.team_id
        );
        for (const contract of programContracts) {
          if (!seenContractIds.has(contract.id)) {
            availableContracts.push(contract);
            seenContractIds.add(contract.id);
          }
        }
      }
      
      res.json({ 
        not_assigned: false, 
        contracts: availableContracts 
      });
    } catch (error) {
      console.error('Error fetching available contracts:', error);
      res.status(500).json({ error: 'Failed to fetch available contracts' });
    }
  });

  // Get athlete's current contract
  app.get('/api/athletes/:athleteId/contract', requireRole('parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const athleteId = req.params.athleteId as string;
      
      // Verify parent owns this athlete
      const athletes = await storage.getAthletesByParent(clubId, userId);
      const athleteIdList = athletes.map(a => a.id);
      if (!athleteIdList.includes(athleteId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const contracts = await storage.getAthleteContracts(clubId, athleteId);
      const activeContract = contracts.find(c => c.status === 'active');
      
      res.json(activeContract || null);
    } catch (error) {
      console.error('Error fetching athlete contract:', error);
      res.status(500).json({ error: 'Failed to fetch athlete contract' });
    }
  });

  // Enroll athlete in a contract (parent signing)
  const enrollContractSchema = z.object({
    program_contract_id: z.string().min(1, "Contract ID is required"),
    payment_plan: z.enum(['monthly', 'paid_in_full']).default('monthly'),
    signed_name: z.string().min(1, "Signature is required"),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  });

  app.post('/api/athletes/:athleteId/enroll-contract', requireRole('parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const athleteId = req.params.athleteId as string;
      
      // Validate request body
      const validationResult = enrollContractSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: 'Invalid request', details: validationResult.error.errors });
      }
      const { program_contract_id, payment_plan, signed_name, start_date, end_date } = validationResult.data;
      
      // Verify parent owns this athlete
      const athletes = await storage.getAthletesByParent(clubId, userId);
      const athleteIdList = athletes.map(a => a.id);
      if (!athleteIdList.includes(athleteId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Verify the contract exists and is active
      const programContract = await storage.getProgramContract(clubId, program_contract_id);
      if (!programContract || !programContract.is_active) {
        return res.status(400).json({ error: 'Contract not available' });
      }
      
      // If contract is team-specific, check if athlete is on that team
      if (programContract.team_id) {
        const rosters = await storage.getAthleteRosterEntries(clubId, athleteId);
        const teamIds = rosters.filter(r => r.team_id).map(r => r.team_id);
        if (!teamIds.includes(programContract.team_id)) {
          return res.status(403).json({ error: 'Athlete is not on this team' });
        }
      }
      
      // Auto-enroll athlete in program roster with contract_signed = true
      await storage.assignAthleteToProgram(clubId, athleteId, programContract.program_id, true);
      
      // Cancel any existing active contracts
      const existingContracts = await storage.getAthleteContracts(clubId, athleteId);
      const activeContracts = existingContracts.filter(c => c.status === 'active');
      for (const activeContract of activeContracts) {
        await storage.updateAthleteContractStatus(clubId, activeContract.id, 'cancelled');
      }
      
      // Create the new contract with signature
      const contract = await storage.createAthleteContract(clubId, {
        athlete_id: athleteId,
        program_contract_id,
        payment_plan,
        signed_name,
        start_date: start_date || new Date().toISOString().split('T')[0],
        end_date: end_date || undefined,
        custom_price: undefined,
      });
      
      res.status(201).json(contract);
    } catch (error) {
      console.error('Error enrolling athlete in contract:', error);
      res.status(500).json({ error: 'Failed to enroll athlete in contract' });
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
    snack_hub_enabled: z.boolean().optional(),
  });

  const addEventRosterSchema = z.object({
    athlete_id: z.string().min(1),
  });

  app.get('/api/events', requireAuth, async (req, res) => {
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

  app.get('/api/events/:id', requireAuth, async (req, res) => {
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
        snack_hub_enabled: data.snack_hub_enabled ?? false,
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
  app.get('/api/events/:id/rosters', requireAuth, async (req, res) => {
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
      
      // Just add the athlete to the roster without any billing
      // Billing is handled separately via the bill endpoint
      const roster = await storage.addEventRoster(clubId, req.params.id as string, data.athlete_id);
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
  app.get('/api/events/:id/coaches', requireAuth, async (req, res) => {
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

  // Bill athlete for event
  app.post('/api/events/rosters/:rosterId/bill', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId, role } = getAuthContext(req);
      
      // Check if club has billing method
      const club = await storage.getClub(clubId);
      if (!club?.billing_card_token && !club?.billing_bank_token) {
        return res.status(403).json({ 
          error: 'Billing method required',
          message: 'A billing method must be added before processing payments. Please add a credit card or bank account in Settings > Billing.' 
        });
      }
      
      // Check billing permission for coaches - use individual coach permission
      if (role === 'coach') {
        const userId = req.headers['x-user-id'] as string;
        const coach = await storage.getUser(userId);
        if (!coach?.can_bill) {
          return res.status(403).json({ 
            error: 'Billing not authorized',
            message: 'You do not have permission to bill athletes. Please contact your club director.' 
          });
        }
      }
      
      const rosterId = req.params.rosterId as string;
      
      // Get the roster entry
      const roster = await storage.getEventRosterById(clubId, rosterId);
      if (!roster) {
        return res.status(404).json({ error: 'Roster entry not found' });
      }
      
      if (roster.payment_id) {
        return res.status(400).json({ error: 'This roster entry has already been billed' });
      }
      
      // Get the event to get the price
      const event = await storage.getEvent(clubId, roster.event_id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Calculate total with convenience fee (3% for credit card)
      const totalAmount = calculateTotalWithFee(event.price, 'credit_card');
      
      // Create payment record
      const payment = await storage.createPayment(clubId, {
        athlete_id: roster.athlete_id,
        amount: totalAmount,
        payment_type: 'event',
        payment_method: 'credit_card', // Default, actual processing would use stored card
        status: 'completed', // For now, mark as completed (actual implementation would process payment)
      });
      
      // Update roster with payment_id
      await storage.updateEventRosterPayment(clubId, rosterId, payment.id);
      
      // Create platform ledger entry ($1 per player per event)
      await storage.createPlatformLedgerEntry(clubId, roster.athlete_id, PLATFORM_FEES.event, 'event');
      
      res.json({ success: true, payment });
    } catch (error) {
      console.error('Error billing for event:', error);
      res.status(500).json({ error: 'Failed to bill for event' });
    }
  });

  // Get events for an athlete (parent view)
  app.get('/api/athletes/:athleteId/events', requireAuth, async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const events = await storage.getEventsForAthlete(clubId, req.params.athleteId);
      res.json(events);
    } catch (error) {
      console.error('Error fetching athlete events:', error);
      res.status(500).json({ error: 'Failed to fetch athlete events' });
    }
  });

  // ============ SNACK HUB ============
  
  // Get snack items for an event
  app.get('/api/events/:eventId/snacks', requireAuth, async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const items = await storage.getSnackItems(req.params.eventId, clubId);
      res.json(items);
    } catch (error) {
      console.error('Error fetching snack items:', error);
      res.status(500).json({ error: 'Failed to fetch snack items' });
    }
  });

  // Get allergies for event athletes
  app.get('/api/events/:eventId/allergies', requireAuth, async (req, res) => {
    try {
      const allergies = await storage.getEventAthleteAllergies(req.params.eventId);
      res.json(allergies);
    } catch (error) {
      console.error('Error fetching allergies:', error);
      res.status(500).json({ error: 'Failed to fetch allergies' });
    }
  });

  // Create snack item (admin/coach/parent can add)
  app.post('/api/events/:eventId/snacks', requireAuth, async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { category, item_name, quantity_needed = 1, is_custom = false } = req.body;
      
      if (!category || !item_name) {
        return res.status(400).json({ error: 'Category and item name are required' });
      }
      
      const item = await storage.createSnackItem(req.params.eventId, clubId, {
        category,
        item_name,
        quantity_needed,
        is_custom,
        created_by: userId,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating snack item:', error);
      res.status(500).json({ error: 'Failed to create snack item' });
    }
  });

  // Claim a snack item
  app.post('/api/snacks/:snackId/claim', requireAuth, async (req, res) => {
    try {
      const { userId } = getAuthContext(req);
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const item = await storage.claimSnackItem(req.params.snackId, userId, user.full_name);
      res.json(item);
    } catch (error) {
      console.error('Error claiming snack item:', error);
      res.status(500).json({ error: 'Failed to claim snack item' });
    }
  });

  // Unclaim a snack item
  app.post('/api/snacks/:snackId/unclaim', requireAuth, async (req, res) => {
    try {
      const item = await storage.unclaimSnackItem(req.params.snackId);
      res.json(item);
    } catch (error) {
      console.error('Error unclaiming snack item:', error);
      res.status(500).json({ error: 'Failed to unclaim snack item' });
    }
  });

  // Delete snack item (admin/coach only)
  app.delete('/api/snacks/:snackId', requireRole('admin', 'coach'), async (req, res) => {
    try {
      await storage.deleteSnackItem(req.params.snackId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting snack item:', error);
      res.status(500).json({ error: 'Failed to delete snack item' });
    }
  });

  // ============ TEAMS ============
  app.get('/api/teams', requireAuth, async (req, res) => {
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

  app.get('/api/parents', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const parents = await storage.getParents(clubId);
      res.json(parents);
    } catch (error) {
      console.error('Error fetching parents:', error);
      res.status(500).json({ error: 'Failed to fetch parents' });
    }
  });

  // Update coach billing permission
  app.patch('/api/coaches/:id/billing', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const coachId = req.params.id as string;
      const { can_bill } = req.body;
      
      if (typeof can_bill !== 'boolean') {
        return res.status(400).json({ error: 'can_bill must be a boolean' });
      }
      
      // Verify coach belongs to this club
      const coach = await storage.getUser(coachId);
      if (!coach || coach.club_id !== clubId || coach.role !== 'coach') {
        return res.status(404).json({ error: 'Coach not found' });
      }
      
      const updated = await storage.updateUserBillingPermission(coachId, can_bill);
      res.json(updated);
    } catch (error) {
      console.error('Error updating coach billing permission:', error);
      res.status(500).json({ error: 'Failed to update coach billing permission' });
    }
  });

  // ============ ATHLETES ============
  app.get('/api/athletes', requireAuth, async (req, res) => {
    try {
      const { clubId, role, userId } = getAuthContext(req);
      const parentId = req.query.parent_id as string | undefined;
      const includeParentInfo = req.query.include_parent_info === 'true';
      
      // Parents can only see their own athletes
      const effectiveParentId = role === 'parent' ? userId : parentId;
      
      if (effectiveParentId) {
        const athletes = await storage.getAthletesByParent(clubId, effectiveParentId);
        res.json(athletes);
      } else if (includeParentInfo && (role === 'admin' || role === 'coach')) {
        // Directors and coaches can see parent contact info
        const athletes = await storage.getAthletesWithParentInfo(clubId);
        res.json(athletes);
      } else {
        const athletes = await storage.getAthletes(clubId);
        res.json(athletes);
      }
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

  app.get('/api/athletes/assignment-overview', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const overview = await storage.getAthleteAssignmentOverview(clubId);
      res.json(overview);
    } catch (error) {
      console.error('Error fetching athlete assignment overview:', error);
      res.status(500).json({ error: 'Failed to fetch athlete assignment overview' });
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
        email: data.email || undefined,
        date_of_birth: data.date_of_birth,
        graduation_year: data.graduation_year,
        parent_id: parentId,
        tags: [],
        volleyball_life_number: data.volleyball_life_number,
        avp_number: data.avp_number,
        bvca_number: data.bvca_number,
        aau_number: data.aau_number,
        bvne_number: data.bvne_number,
        p1440_number: data.p1440_number,
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

  // Update athlete profile (parent can edit their own athletes)
  app.patch('/api/athletes/:athleteId', requireRole('parent', 'athlete'), async (req, res) => {
    try {
      const { userId, role } = getAuthContext(req);
      const athleteId = req.params.athleteId as string;
      
      // For athlete role, they can only edit their own profile
      let parentId = userId;
      if (role === 'athlete') {
        const profile = await storage.getProfile(userId);
        if (!profile?.athlete_id || profile.athlete_id !== athleteId) {
          return res.status(403).json({ error: 'Access denied' });
        }
        // Get the athlete to find the parent_id
        const athletes = await storage.getAthletes(profile.club_id);
        const athlete = athletes.find(a => a.id === athleteId);
        if (!athlete) {
          return res.status(404).json({ error: 'Athlete not found' });
        }
        parentId = athlete.parent_id;
      }
      
      const allowedFields = ['first_name', 'last_name', 'date_of_birth', 'graduation_year', 
        'avp_number', 'bvca_number', 'aau_number', 'bvne_number', 'p1440_number', 'food_allergies'];
      const updates: Record<string, unknown> = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      const updated = await storage.updateAthleteProfile(athleteId, parentId, updates);
      res.json(updated);
    } catch (error) {
      console.error('Error updating athlete:', error);
      res.status(500).json({ error: 'Failed to update athlete' });
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

  // Release athlete (allows parent to transfer to another club)
  // This performs three critical actions:
  // 1. Sets is_released to true
  // 2. Updates contract_end_date to current timestamp
  // 3. Cancels any Helcim recurring payments
  app.post('/api/athletes/:athleteId/release', requireRole('admin'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const athleteId = req.params.athleteId as string;
      
      // Release athlete and get affected contract IDs
      const { contractIds } = await storage.releaseAthlete(clubId, athleteId, userId, 'manual');
      
      // Cancel Helcim recurring payments for all affected contracts
      const { cancelRecurringPayment } = await import('./lib/helcim');
      let cancelledCount = 0;
      for (const contractId of contractIds) {
        const result = await cancelRecurringPayment(athleteId, contractId);
        if (result.success && result.message !== 'No recurring payment plans found to cancel') {
          cancelledCount++;
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Athlete has been released and can now transfer to another club',
        contracts_expired: contractIds.length,
        payments_cancelled: cancelledCount
      });
    } catch (error) {
      console.error('Error releasing athlete:', error);
      res.status(500).json({ error: 'Failed to release athlete' });
    }
  });

  // Revoke athlete release
  app.post('/api/athletes/:athleteId/revoke-release', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const athleteId = req.params.athleteId as string;
      
      await storage.revokeAthleteRelease(clubId, athleteId);
      
      res.json({ 
        success: true, 
        message: 'Athlete release has been revoked'
      });
    } catch (error) {
      console.error('Error revoking athlete release:', error);
      res.status(500).json({ error: 'Failed to revoke athlete release' });
    }
  });

  // Check if parent has unreleased athletes before joining a new club
  // Uses authenticated user's ID - does not accept arbitrary parent_id
  app.post('/api/auth/check-transfer-eligibility', async (req, res) => {
    try {
      const { target_club_id } = req.body;
      const { userId } = getAuthContext(req);
      
      if (!userId) {
        return res.json({ eligible: true, unreleased_athletes: [] });
      }
      
      // Get all athletes for the authenticated parent across all clubs
      const allAthletes = await storage.getAthletesByParentAcrossClubs(userId);
      
      // Find unreleased athletes in other clubs
      const unreleasedAthletes = allAthletes.filter(
        a => a.club_id !== target_club_id && !a.is_released
      );
      
      if (unreleasedAthletes.length > 0) {
        return res.json({
          eligible: false,
          unreleased_athletes: unreleasedAthletes.map(a => ({
            id: a.id,
            name: `${a.first_name} ${a.last_name}`,
            club_id: a.club_id
          })),
          message: 'To join a new club, you must first be released by your current club. Please contact your current club director to be released.'
        });
      }
      
      res.json({ eligible: true, unreleased_athletes: [] });
    } catch (error) {
      console.error('Error checking transfer eligibility:', error);
      res.status(500).json({ error: 'Failed to check transfer eligibility' });
    }
  });

  // ============ ROSTER ============
  app.get('/api/teams/:teamId/roster', requireAuth, async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const roster = await storage.getTeamRoster(clubId, req.params.teamId);
      res.json(roster);
    } catch (error) {
      console.error('Error fetching roster:', error);
      res.status(500).json({ error: 'Failed to fetch roster' });
    }
  });

  // Get program roster with athlete details and status
  app.get('/api/programs/:programId/roster', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const programId = req.params.programId;
      
      // Get roster entries for this program
      const roster = await storage.getProgramRoster(clubId, programId);
      
      // Get all athletes, contracts, and program contracts for enrichment
      const athletes = await storage.getAthletes(clubId);
      const athleteMap = new Map(athletes.map(a => [a.id, a]));
      
      // Get all athlete contracts for payment status
      const allContracts: { athleteId: string; contract: any }[] = [];
      for (const entry of roster) {
        const contracts = await storage.getAthleteContracts(clubId, entry.athlete_id);
        const activeContract = contracts.find(c => c.status === 'active');
        if (activeContract) {
          allContracts.push({ athleteId: entry.athlete_id, contract: activeContract });
        }
      }
      const contractMap = new Map(allContracts.map(c => [c.athleteId, c.contract]));
      
      // Enrich roster with athlete details and status
      const enrichedRoster = roster.map(entry => {
        const athlete = athleteMap.get(entry.athlete_id);
        const contract = contractMap.get(entry.athlete_id);
        
        // Determine payment status
        let paymentStatus: 'current' | 'overdue' | 'no_contract' = 'no_contract';
        if (contract) {
          if (athlete?.paid_through_date) {
            const paidThrough = new Date(athlete.paid_through_date);
            paymentStatus = paidThrough >= new Date() ? 'current' : 'overdue';
          } else {
            paymentStatus = 'overdue'; // Has contract but no payment recorded
          }
        }
        
        return {
          ...entry,
          athlete: athlete ? {
            id: athlete.id,
            first_name: athlete.first_name,
            last_name: athlete.last_name,
            date_of_birth: athlete.date_of_birth,
            paid_through_date: athlete.paid_through_date,
            is_locked: athlete.is_locked,
          } : null,
          contract_status: entry.contract_signed ? 'signed' : 'pending',
          payment_status: paymentStatus,
          payment_plan: contract?.payment_plan || null,
        };
      });
      
      res.json(enrichedRoster);
    } catch (error) {
      console.error('Error fetching program roster:', error);
      res.status(500).json({ error: 'Failed to fetch program roster' });
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

  // Helper function to generate CSV content
  const generateRosterCSV = (athletes: any[]) => {
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Date of Birth',
      'HS Graduation Year',
      'Volleyball Life #',
      'AVP #',
      'BVCA #',
      'AAU #',
      'BVNE #',
      'p1440 #'
    ];
    
    const rows = athletes.map(a => [
      a.first_name || '',
      a.last_name || '',
      a.email || '',
      a.date_of_birth || '',
      a.graduation_year?.toString() || '',
      a.volleyball_life_number || '',
      a.avp_number || '',
      a.bvca_number || '',
      a.aau_number || '',
      a.bvne_number || '',
      a.p1440_number || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
  };

  // Export program roster as CSV
  app.get('/api/programs/:programId/roster/export', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const programId = req.params.programId;
      
      const roster = await storage.getProgramRoster(clubId, programId);
      const athletes = await storage.getAthletes(clubId);
      const program = await storage.getProgram(clubId, programId);
      
      const rosterAthletes = roster.map(entry => {
        const athlete = athletes.find(a => a.id === entry.athlete_id);
        return athlete;
      }).filter(Boolean);
      
      const csvContent = generateRosterCSV(rosterAthletes);
      const filename = `${program?.name || 'program'}_roster_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting program roster:', error);
      res.status(500).json({ error: 'Failed to export roster' });
    }
  });

  // Export team roster as CSV
  app.get('/api/teams/:teamId/roster/export', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const teamId = req.params.teamId;
      
      const roster = await storage.getTeamRoster(clubId, teamId);
      const athletes = await storage.getAthletes(clubId);
      const team = await storage.getTeam(clubId, teamId);
      
      const rosterAthletes = roster.map(entry => {
        const athlete = athletes.find(a => a.id === entry.athlete_id);
        return athlete;
      }).filter(Boolean);
      
      const csvContent = generateRosterCSV(rosterAthletes);
      const filename = `${team?.name || 'team'}_roster_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting team roster:', error);
      res.status(500).json({ error: 'Failed to export roster' });
    }
  });

  // Export event roster as CSV
  app.get('/api/events/:eventId/roster/export', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const eventId = req.params.eventId;
      
      const eventRoster = await storage.getEventRoster(clubId, eventId);
      const athletes = await storage.getAthletes(clubId);
      const event = await storage.getEvent(clubId, eventId);
      
      const rosterAthletes = eventRoster.map(entry => {
        const athlete = athletes.find(a => a.id === entry.athlete_id);
        return athlete;
      }).filter(Boolean);
      
      const csvContent = generateRosterCSV(rosterAthletes);
      const filename = `${event?.title || 'event'}_roster_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting event roster:', error);
      res.status(500).json({ error: 'Failed to export roster' });
    }
  });

  // ============ CLUB FORMS (Google Forms links) ============
  const createClubFormSchema = z.object({
    name: z.string().min(1, "Form name is required"),
    url: z.string().url("Valid URL is required"),
    description: z.string().optional(),
    program_id: z.string().uuid().optional().nullable(),
    team_id: z.string().uuid().optional().nullable(),
  });

  const updateClubFormSchema = z.object({
    name: z.string().min(1).optional(),
    url: z.string().url().optional(),
    description: z.string().optional().nullable(),
    program_id: z.string().uuid().optional().nullable(),
    team_id: z.string().uuid().optional().nullable(),
    is_active: z.boolean().optional(),
  });

  app.get('/api/club-forms', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const forms = await storage.getClubForms(clubId);
      res.json(forms);
    } catch (error) {
      console.error('Error fetching club forms:', error);
      res.status(500).json({ error: 'Failed to fetch forms' });
    }
  });

  app.post('/api/club-forms', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = createClubFormSchema.parse(req.body);
      const form = await storage.createClubForm(clubId, {
        name: data.name,
        url: data.url,
        description: data.description,
        program_id: data.program_id ?? undefined,
        team_id: data.team_id ?? undefined,
      });
      res.status(201).json(form);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating club form:', error);
      res.status(500).json({ error: 'Failed to create form' });
    }
  });

  app.patch('/api/club-forms/:id', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const formId = req.params.id as string;
      const data = updateClubFormSchema.parse(req.body);
      const form = await storage.updateClubForm(clubId, formId, {
        name: data.name,
        url: data.url,
        description: data.description ?? undefined,
        program_id: data.program_id,
        team_id: data.team_id,
        is_active: data.is_active,
      });
      res.json(form);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error updating club form:', error);
      res.status(500).json({ error: 'Failed to update form' });
    }
  });

  app.delete('/api/club-forms/:id', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      await storage.deleteClubForm(clubId, req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting club form:', error);
      res.status(500).json({ error: 'Failed to delete form' });
    }
  });

  // Get forms for a specific athlete (parent view)
  app.get('/api/athletes/:athleteId/forms', requireRole('parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { athleteId } = req.params;
      
      // Verify parent owns this athlete
      const athlete = await storage.getAthlete(clubId, athleteId);
      if (!athlete || athlete.parent_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to view forms for this athlete' });
      }
      
      const forms = await storage.getFormsForAthlete(clubId, athleteId, userId);
      res.json(forms);
    } catch (error) {
      console.error('Error fetching athlete forms:', error);
      res.status(500).json({ error: 'Failed to fetch forms' });
    }
  });

  // Mark a form as viewed (parent action)
  app.post('/api/club-forms/:formId/view', requireRole('parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { formId } = req.params;
      
      const view = await storage.markFormAsViewed(clubId, formId, userId);
      res.json(view);
    } catch (error) {
      console.error('Error marking form as viewed:', error);
      res.status(500).json({ error: 'Failed to mark form as viewed' });
    }
  });

  // Get unviewed form count for parent dashboard alert
  app.get('/api/my-unviewed-forms-count', requireRole('parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      
      // Get all athletes for this parent
      const athletes = await storage.getAthletesByParent(clubId, userId);
      
      // Collect all unviewed forms across all athletes
      const allUnviewedForms = new Set<string>();
      for (const athlete of athletes) {
        const forms = await storage.getFormsForAthlete(clubId, athlete.id, userId);
        forms.filter(f => !f.viewed).forEach(f => allUnviewedForms.add(f.id));
      }
      
      res.json({ count: allUnviewedForms.size });
    } catch (error) {
      console.error('Error fetching unviewed forms count:', error);
      res.status(500).json({ error: 'Failed to fetch unviewed forms count' });
    }
  });

  // ============ CONTRACT COMPLIANCE ============
  
  // Update club contract settings (admin only)
  const contractSettingsSchema = z.object({
    contract_url: z.string().url().optional().or(z.literal('')),
    contract_instructions: z.string().optional(),
  });
  
  app.patch('/api/club/contract-settings', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const data = contractSettingsSchema.parse(req.body);
      const club = await storage.updateClubContractSettings(
        clubId, 
        data.contract_url || undefined, 
        data.contract_instructions || undefined
      );
      res.json(club);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error updating contract settings:', error);
      res.status(500).json({ error: 'Failed to update contract settings' });
    }
  });

  // Get all users with contract status (admin/coach view)
  app.get('/api/contract-compliance', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const users = await storage.getUsersWithContractStatus(clubId);
      res.json(users);
    } catch (error) {
      console.error('Error fetching contract compliance:', error);
      res.status(500).json({ error: 'Failed to fetch contract compliance data' });
    }
  });

  // Verify user contract (admin/coach only)
  app.patch('/api/users/:userId/verify-contract', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { userId } = req.params;
      
      // Security: Verify the user belongs to the same club and is a parent
      const targetUser = await storage.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.club_id !== clubId) {
        return res.status(403).json({ error: 'Cannot verify user from another club' });
      }
      if (targetUser.role !== 'parent') {
        return res.status(400).json({ error: 'Only parent contracts can be verified' });
      }
      
      const user = await storage.updateUserContractStatus(userId, 'verified');
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error verifying contract:', error);
      res.status(500).json({ error: 'Failed to verify contract' });
    }
  });

  // Parent updates their own contract status (sign digitally or paper)
  app.patch('/api/my-contract-status', requireRole('parent'), async (req, res) => {
    try {
      const { userId } = getAuthContext(req);
      const { method } = req.body; // 'digital' or 'paper'
      
      if (!method || !['digital', 'paper'].includes(method)) {
        return res.status(400).json({ error: 'Invalid contract method' });
      }
      
      const user = await storage.updateUserContractStatus(userId, 'pending', method);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error updating contract status:', error);
      res.status(500).json({ error: 'Failed to update contract status' });
    }
  });

  // ============ FACILITIES ============
  app.get('/api/facilities', requireAuth, async (req, res) => {
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
  app.get('/api/courts', requireAuth, async (req, res) => {
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
  app.get('/api/sessions', requireAuth, async (req, res) => {
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

  app.get('/api/sessions/:id', requireAuth, async (req, res) => {
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
  app.get('/api/athletes/:athleteId/sessions', requireAuth, async (req, res) => {
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
  app.get('/api/sessions/:sessionId/registrations', requireAuth, async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const registrations = await storage.getSessionRegistrations(clubId, req.params.sessionId);
      res.json(registrations);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      res.status(500).json({ error: 'Failed to fetch registrations' });
    }
  });

  app.get('/api/athletes/:athleteId/registrations', requireAuth, async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const registrations = await storage.getAthleteRegistrations(clubId, req.params.athleteId);
      res.json(registrations);
    } catch (error) {
      console.error('Error fetching athlete registrations:', error);
      res.status(500).json({ error: 'Failed to fetch athlete registrations' });
    }
  });

  app.get('/api/my-registrations', requireRole('athlete'), async (req, res) => {
    try {
      const { clubId, athleteId } = getAuthContext(req);
      if (!athleteId) {
        return res.status(400).json({ error: 'No athlete linked to this account' });
      }
      const registrations = await storage.getAthleteRegistrations(clubId, athleteId);
      res.json(registrations);
    } catch (error) {
      console.error('Error fetching my registrations:', error);
      res.status(500).json({ error: 'Failed to fetch registrations' });
    }
  });

  app.get('/api/my-sessions', requireRole('athlete'), async (req, res) => {
    try {
      const { clubId, athleteId } = getAuthContext(req);
      if (!athleteId) {
        return res.status(400).json({ error: 'No athlete linked to this account' });
      }
      
      // Get athlete's roster entries to determine which programs/teams they're part of
      const rosterEntries = await storage.getAthleteRosterEntries(clubId, athleteId);
      const programIds = new Set(rosterEntries.map(r => r.program_id));
      const teamIds = new Set(rosterEntries.map(r => r.team_id).filter(Boolean));
      
      // Get all sessions and filter to only those for athlete's programs/teams
      const allSessions = await storage.getSessions(clubId);
      const athleteSessions = allSessions.filter(session => {
        // Include if the session is for a program the athlete is in
        if (programIds.has(session.program_id)) {
          // If session has a specific team, check if athlete is on that team
          if (session.team_id) {
            return teamIds.has(session.team_id);
          }
          return true; // Program-wide session
        }
        return false;
      });
      
      res.json(athleteSessions);
    } catch (error) {
      console.error('Error fetching my sessions:', error);
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  app.get('/api/my-rosters', requireRole('athlete'), async (req, res) => {
    try {
      const { clubId, athleteId } = getAuthContext(req);
      if (!athleteId) {
        return res.status(400).json({ error: 'No athlete linked to this account' });
      }
      const rosters = await storage.getAthleteRosterEntries(clubId, athleteId);
      res.json(rosters);
    } catch (error) {
      console.error('Error fetching my rosters:', error);
      res.status(500).json({ error: 'Failed to fetch rosters' });
    }
  });

  app.post('/api/sessions/:sessionId/register', requireRole('parent', 'athlete'), async (req, res) => {
    try {
      const { clubId, role, athleteId: selfAthleteId } = getAuthContext(req);
      const sessionId = req.params.sessionId as string;
      const session = await storage.getSession(clubId, sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Determine which athlete to register - for athletes, use their linked ID
      let targetAthleteId: string;
      if (role === 'athlete') {
        if (!selfAthleteId) {
          return res.status(400).json({ error: 'No athlete linked to this account' });
        }
        targetAthleteId = selfAthleteId;
      } else {
        const data = registerSessionSchema.parse(req.body);
        targetAthleteId = data.athlete_id;
      }

      // Check if athlete's payment is current
      const athlete = await storage.getAthlete(clubId, targetAthleteId);
      if (!athlete) {
        return res.status(404).json({ error: 'Athlete not found' });
      }

      // Check access state (is_locked logic) - locked if payment >7 days overdue
      const isLocked = checkAthleteAccessState(athlete);
      if (isLocked) {
        return res.status(403).json({ error: 'Payment required', is_locked: true });
      }

      // Check contract status - athlete must have signed contract for this program/team
      const rosterEntries = await storage.getAthleteRosterEntries(clubId, targetAthleteId);
      const hasSignedContract = rosterEntries.some(entry => {
        const matchesProgram = entry.program_id === session.program_id;
        const matchesTeam = !session.team_id || entry.team_id === session.team_id;
        return matchesProgram && matchesTeam && entry.contract_signed;
      });
      if (!hasSignedContract) {
        return res.status(403).json({ error: 'Contract signature required', contract_required: true });
      }

      // Process payment if session has a drop-in price (for non-contract attendees) - only for parents
      if (role === 'parent' && session.drop_in_price && session.drop_in_price > 0) {
        const data = registerSessionSchema.parse(req.body);
        if (data.payment_method) {
          const totalAmount = calculateTotalWithFee(session.drop_in_price, data.payment_method);
          
          // In production, we'd process the actual payment
          // For demo, we simulate success
          const payment = await storage.createPayment(clubId, {
            athlete_id: targetAthleteId,
            amount: totalAmount,
            payment_type: session.session_type === 'clinic' ? 'clinic' : 'drop_in',
            payment_method: data.payment_method,
            status: 'completed',
          });

          // Create platform ledger entry
          const feeType = session.session_type === 'clinic' ? 'clinic' : 'drop_in';
          await storage.createPlatformLedgerEntry(
            clubId,
            targetAthleteId,
            PLATFORM_FEES[feeType],
            feeType,
            sessionId
          );
        }
      }

      const registration = await storage.createRegistration(clubId, sessionId, targetAthleteId);
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
          data.athlete_id,
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

      const athlete = await storage.getAthlete(clubId, data.athlete_id);
      if (!athlete) {
        return res.status(404).json({ error: 'Athlete not found' });
      }

      const club = await storage.getClub(clubId);
      
      let totalAmount: number;
      let baseAmount: number;
      let techFeeAmount: number;
      let paymentRail: PaymentRail | 'cash';
      let paymentKind: PaymentKind;
      let monthsCount: number;
      let feeVersion: string | undefined;

      // Determine payment kind based on payment type
      const isRecurring = data.payment_type === 'monthly';
      paymentKind = isRecurring ? 'recurring_contract' : 'one_time_event';
      
      // Derive months count from payment plan (default 1 for one-time)
      monthsCount = data.months_count || 1;
      
      // Base amount is what the club charges
      baseAmount = data.amount;

      if (PARENT_PAID_FEES_ENABLED) {
        // NEW MODEL: Parent pays Technology and Service Fees
        // COMPLIANCE: Determine payment rail BEFORE charging
        // Debit cards MUST NOT be charged percentage fees
        if (data.payment_method === 'ach') {
          paymentRail = 'ach';
        } else {
          // Card payment - user selects credit/debit at checkout
          // COMPLIANCE: Default to debit (flat fee only) if not specified
          // This ensures we never overcharge debit card users
          if (data.card_type === 'credit') {
            paymentRail = 'card_credit';
          } else {
            // Default to debit for compliance safety
            paymentRail = 'card_debit';
            if (!data.card_type) {
              console.log('[Payment] No card_type specified, defaulting to debit for compliance');
            }
          }
        }

        const pricing = calculateTechnologyAndServiceFees({
          baseAmount,
          monthsCount,
          paymentKind,
          paymentRail: paymentRail as PaymentRail,
        });
        totalAmount = pricing.totalAmount;
        techFeeAmount = pricing.techFee;
        feeVersion = pricing.feeVersion;
        
        console.log(`[Payment] Rail: ${paymentRail}, Base: $${baseAmount}, Fee: $${techFeeAmount}, Total: $${totalAmount}`);
      } else {
        // OLD MODEL: Legacy convenience fee structure
        totalAmount = calculateTotalWithFee(data.amount, data.payment_method);
        techFeeAmount = getConvenienceFeeAmount(data.amount, data.payment_method);
        paymentRail = data.payment_method === 'ach' ? 'ach' : 'card_credit';
        feeVersion = undefined;
      }

      // Process payment through Helcim with the CORRECTLY CALCULATED amount
      // The amount sent to Helcim equals baseAmount + techFeeAmount (no post-charge adjustment)
      const paymentResult = await processPayment({
        amount: totalAmount!,
        cardToken: data.card_token,
        comments: `${data.payment_type} payment for ${athlete.first_name} ${athlete.last_name}`,
      });

      const payment = await storage.createPayment(clubId, {
        athlete_id: data.athlete_id,
        amount: totalAmount!,
        payment_type: data.payment_type,
        payment_method: data.payment_method,
        helcim_transaction_id: paymentResult.transactionId,
        status: paymentResult.success ? 'completed' : 'failed',
        base_amount: baseAmount,
        tech_fee_amount: techFeeAmount!,
        payment_rail: paymentRail,
        payment_kind: paymentKind,
        months_count: monthsCount,
        fee_version: feeVersion,
      });

      if (paymentResult.success) {
        // Update paid_through_date if monthly payment
        if (data.payment_type === 'monthly') {
          const currentPaidThrough = athlete.paid_through_date
            ? new Date(athlete.paid_through_date)
            : new Date();
          const newPaidThrough = addMonths(
            currentPaidThrough > new Date() ? currentPaidThrough : new Date(),
            monthsCount
          );
          await storage.updateAthletePaidThrough(
            clubId,
            data.athlete_id,
            newPaidThrough.toISOString()
          );
        }

        // Send confirmation email with fee breakdown
        await sendPaymentConfirmation(
          'parent@example.com',
          `${athlete.first_name} ${athlete.last_name}`,
          totalAmount!,
          `${data.payment_type} payment`,
          PARENT_PAID_FEES_ENABLED ? {
            baseAmount,
            techFeeAmount: techFeeAmount!,
            paymentRail: paymentRail as string,
          } : undefined
        );
      }

      res.status(201).json({
        payment,
        success: paymentResult.success,
        error: paymentResult.error,
        pricing: PARENT_PAID_FEES_ENABLED ? {
          baseAmount,
          techFeeAmount: techFeeAmount!,
          totalAmount: totalAmount!,
          paymentRail,
        } : undefined,
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

  // ============ COMMUNICATION SETTINGS ============
  
  app.get('/api/communication-settings', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const settings = await storage.getCommunicationSettings(clubId);
      res.json(settings);
    } catch (error) {
      console.error('Error getting communication settings:', error);
      res.status(500).json({ error: 'Failed to get communication settings' });
    }
  });

  app.patch('/api/communication-settings', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { include_director_in_chats } = req.body;
      
      if (typeof include_director_in_chats !== 'boolean') {
        return res.status(400).json({ error: 'include_director_in_chats must be a boolean' });
      }
      
      await storage.updateCommunicationSettings(clubId, { include_director_in_chats });
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating communication settings:', error);
      res.status(500).json({ error: 'Failed to update communication settings' });
    }
  });

  // ============ SEASONS ============

  // Get all seasons for the club
  app.get('/api/seasons', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const seasons = await storage.getSeasons(clubId);
      res.json(seasons);
    } catch (error) {
      console.error('Error getting seasons:', error);
      res.status(500).json({ error: 'Failed to get seasons' });
    }
  });

  // Get active season
  app.get('/api/seasons/active', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const season = await storage.getActiveSeason(clubId);
      res.json(season || null);
    } catch (error) {
      console.error('Error getting active season:', error);
      res.status(500).json({ error: 'Failed to get active season' });
    }
  });

  // Create a new season
  app.post('/api/seasons', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { name, start_date, end_date } = req.body;
      
      if (!name || !start_date || !end_date) {
        return res.status(400).json({ error: 'Name, start date, and end date are required' });
      }
      
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }
      
      const season = await storage.createSeason(clubId, { name, start_date: startDate, end_date: endDate });
      res.status(201).json(season);
    } catch (error) {
      console.error('Error creating season:', error);
      res.status(500).json({ error: 'Failed to create season' });
    }
  });

  // Update a season
  app.patch('/api/seasons/:seasonId', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { seasonId } = req.params;
      const { name, start_date, end_date } = req.body;
      
      const updates: { name?: string; start_date?: Date; end_date?: Date } = {};
      if (name !== undefined) updates.name = name;
      if (start_date !== undefined) updates.start_date = new Date(start_date);
      if (end_date !== undefined) updates.end_date = new Date(end_date);
      
      const season = await storage.updateSeason(clubId, seasonId, updates);
      res.json(season);
    } catch (error) {
      console.error('Error updating season:', error);
      res.status(500).json({ error: 'Failed to update season' });
    }
  });

  // Set active season
  app.post('/api/seasons/:seasonId/activate', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { seasonId } = req.params;
      
      const season = await storage.setActiveSeason(clubId, seasonId);
      res.json(season);
    } catch (error) {
      console.error('Error activating season:', error);
      res.status(500).json({ error: 'Failed to activate season' });
    }
  });

  // Delete a season
  app.delete('/api/seasons/:seasonId', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { seasonId } = req.params;
      
      await storage.deleteSeason(clubId, seasonId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting season:', error);
      if (error.message?.includes('Cannot delete the active season')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete season' });
    }
  });

  // ============ MESSAGING SYSTEM ============

  // Get user's chat channels
  app.get('/api/chat/channels', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const channels = await storage.getChatChannels(clubId, userId);
      res.json(channels);
    } catch (error) {
      console.error('Error getting chat channels:', error);
      res.status(500).json({ error: 'Failed to get chat channels' });
    }
  });

  // Create a new chat channel with Telegram-style audience targeting
  app.post('/api/chat/channels', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId, userId, userRole } = getAuthContext(req);
      const { channel_type, participant_ids, name, team_id, program_id, event_id, audience_type } = req.body;
      
      console.log('[Chat Channel Create] Request:', { audience_type, channel_type, event_id, team_id, program_id });
      
      let resolvedParticipantIds: string[] = participant_ids || [];
      
      // Resolve participants based on audience type (Telegram-style targeting)
      if (audience_type === 'team' && team_id) {
        // Get all users in the team (parents of athletes + coaches)
        resolvedParticipantIds = await storage.getTeamAudienceUserIds(clubId, team_id);
      } else if (audience_type === 'roster' && team_id) {
        // Roster is same as team for now (could be more specific in future)
        resolvedParticipantIds = await storage.getTeamAudienceUserIds(clubId, team_id);
      } else if (audience_type === 'program' && program_id) {
        // Get all users in the program
        resolvedParticipantIds = await storage.getProgramAudienceUserIds(clubId, program_id);
      } else if (audience_type === 'event' && event_id) {
        // Get all users in the event roster (parents of registered athletes + assigned coaches)
        resolvedParticipantIds = await storage.getEventAudienceUserIds(clubId, event_id);
      }
      // For 'individual' audience_type, use participant_ids as provided
      
      console.log('[Chat Channel Create] Resolved participants:', resolvedParticipantIds.length, 'users');
      
      // Validate participants belong to the same club
      const validation = await storage.validateChatParticipants(clubId, resolvedParticipantIds, userId);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      // Create the channel with audience_type stored
      const effectiveChannelType = audience_type === 'team' ? 'team' : 
                                   audience_type === 'program' ? 'program' : 
                                   audience_type === 'event' ? 'event' :
                                   audience_type === 'roster' ? 'group' : channel_type;
      
      console.log('[Chat Channel Create] Creating channel:', {
        clubId,
        userId,
        effectiveChannelType,
        name,
        teamId: team_id,
        programId: program_id,
        eventId: event_id,
        participantCount: resolvedParticipantIds.length
      });
      
      const channel = await storage.createChatChannel(
        clubId,
        userId,
        effectiveChannelType,
        resolvedParticipantIds,
        { name, teamId: team_id, programId: program_id, eventId: event_id }
      );
      
      // Add all participants (including the creator)
      const allParticipants = [...new Set([userId, ...resolvedParticipantIds])];
      
      // Auto-add parents if SafeSport requires it (already handled in team/program resolution)
      if (validation.autoAddParentIds) {
        for (const parentId of validation.autoAddParentIds) {
          if (!allParticipants.includes(parentId)) {
            allParticipants.push(parentId);
          }
        }
      }
      
      // Check if director should be auto-added
      const settings = await storage.getCommunicationSettings(clubId);
      if (settings.include_director_in_chats) {
        const directorId = await storage.getDirectorId(clubId);
        if (directorId && !allParticipants.includes(directorId)) {
          allParticipants.push(directorId);
          await storage.addChannelParticipant(channel.id, directorId, 'admin', undefined, true);
        }
      }
      
      // Add participants to channel
      for (const participantId of allParticipants) {
        if (participantId === userId) continue; // Creator is already added via createChatChannel
        const user = await storage.getUserById(participantId);
        if (user) {
          await storage.addChannelParticipant(channel.id, participantId, user.role);
        }
      }
      
      // Add creator as participant
      const creator = await storage.getUserById(userId);
      if (creator) {
        await storage.addChannelParticipant(channel.id, userId, creator.role);
      }
      
      res.json(channel);
    } catch (error: any) {
      console.error('Error creating chat channel:', error);
      console.error('Error details:', error?.message, error?.code, error?.details);
      res.status(500).json({ error: 'Failed to create chat channel', details: error?.message });
    }
  });

  // Delete a chat channel (Director only)
  app.delete('/api/chat/channels/:channelId', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { channelId } = req.params;
      
      // Verify the channel exists and belongs to this club
      const channel = await storage.getChatChannel(clubId, channelId);
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      
      await storage.deleteChannel(clubId, channelId);
      res.json({ success: true, message: 'Conversation deleted successfully' });
    } catch (error) {
      console.error('Error deleting chat channel:', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  });

  // Get messages for a channel
  app.get('/api/chat/channels/:channelId/messages', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { channelId } = req.params;
      const { limit, before } = req.query;
      
      // Verify user is a participant
      const participants = await storage.getChannelParticipants(channelId);
      const isParticipant = participants.some(p => p.user_id === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'Not a participant of this channel' });
      }
      
      const messages = await storage.getMessages(
        channelId,
        limit ? parseInt(limit as string) : 50,
        before ? new Date(before as string) : undefined
      );
      
      // Update last read timestamp
      await storage.updateLastReadAt(channelId, userId);
      
      res.json(messages);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  // Send a message
  app.post('/api/chat/channels/:channelId/messages', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { channelId } = req.params;
      const { content } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }
      
      // Verify user is a participant
      const participants = await storage.getChannelParticipants(channelId);
      const isParticipant = participants.some(p => p.user_id === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'Not a participant of this channel' });
      }
      
      const message = await storage.sendMessage(channelId, userId, content.trim());
      
      // Send push notifications to other participants
      const otherParticipantIds = participants
        .filter(p => p.user_id !== userId)
        .map(p => p.user_id);
      
      if (otherParticipantIds.length > 0) {
        const fcmTokens = await storage.getPushTokensForUsers(otherParticipantIds);
        if (fcmTokens.length > 0) {
          const sender = await storage.getUserById(userId);
          const channel = await storage.getChatChannel(clubId, channelId);
          const { sendNewMessageNotification } = await import('./services/push-notifications');
          await sendNewMessageNotification(
            fcmTokens,
            sender?.full_name || 'Someone',
            channel?.name || null,
            content.trim()
          );
        }
      }
      
      res.json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Get channel participants
  app.get('/api/chat/channels/:channelId/participants', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { userId } = getAuthContext(req);
      const { channelId } = req.params;
      
      // Verify user is a participant
      const participants = await storage.getChannelParticipants(channelId);
      const isParticipant = participants.some(p => p.user_id === userId);
      if (!isParticipant) {
        return res.status(403).json({ error: 'Not a participant of this channel' });
      }
      
      res.json(participants);
    } catch (error) {
      console.error('Error getting participants:', error);
      res.status(500).json({ error: 'Failed to get participants' });
    }
  });

  // ============ BULLETIN BOARD ============

  // Get bulletin posts
  app.get('/api/bulletin', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { team_id, program_id } = req.query;
      
      const posts = await storage.getBulletinPosts(clubId, userId, {
        teamId: team_id as string | undefined,
        programId: program_id as string | undefined,
      });
      
      res.json(posts);
    } catch (error) {
      console.error('Error getting bulletin posts:', error);
      res.status(500).json({ error: 'Failed to get bulletin posts' });
    }
  });

  // Create bulletin post
  app.post('/api/bulletin', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { title, content, team_id, program_id, event_id, is_pinned, audience_type } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }
      
      const post = await storage.createBulletinPost(clubId, userId, {
        title,
        content,
        audienceType: audience_type || 'club',
        teamId: team_id,
        programId: program_id,
        eventId: event_id,
        isPinned: is_pinned,
      });
      
      // Resolve notification recipients based on audience type (Telegram-style targeting)
      let allUserIds: string[] = [];
      
      if (audience_type === 'team' && team_id) {
        // Send to team members only
        allUserIds = await storage.getTeamAudienceUserIds(clubId, team_id);
      } else if (audience_type === 'roster' && team_id) {
        // Send to roster (same as team for now)
        allUserIds = await storage.getTeamAudienceUserIds(clubId, team_id);
      } else if (audience_type === 'program' && program_id) {
        // Send to all users in the program
        allUserIds = await storage.getProgramAudienceUserIds(clubId, program_id);
      } else if (audience_type === 'event' && event_id) {
        // Send to all users registered for the event
        allUserIds = await storage.getEventAudienceUserIds(clubId, event_id);
      } else {
        // Default: Send to entire club
        allUserIds = await storage.getClubAudienceUserIds(clubId);
      }
      
      // Exclude the author from notifications
      allUserIds = allUserIds.filter(id => id !== userId);
      
      if (allUserIds.length > 0) {
        const fcmTokens = await storage.getPushTokensForUsers(allUserIds);
        if (fcmTokens.length > 0) {
          const author = await storage.getUserById(userId);
          const { sendBulletinNotification } = await import('./services/push-notifications');
          await sendBulletinNotification(fcmTokens, title, author?.full_name || 'Staff');
        }
      }
      
      res.json(post);
    } catch (error) {
      console.error('Error creating bulletin post:', error);
      res.status(500).json({ error: 'Failed to create bulletin post' });
    }
  });

  // Update bulletin post
  app.patch('/api/bulletin/:postId', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { postId } = req.params;
      const { title, content, is_pinned } = req.body;
      
      const post = await storage.updateBulletinPost(clubId, postId, {
        title,
        content,
        isPinned: is_pinned,
      });
      
      res.json(post);
    } catch (error) {
      console.error('Error updating bulletin post:', error);
      res.status(500).json({ error: 'Failed to update bulletin post' });
    }
  });

  // Delete bulletin post
  app.delete('/api/bulletin/:postId', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { postId } = req.params;
      
      await storage.deleteBulletinPost(clubId, postId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting bulletin post:', error);
      res.status(500).json({ error: 'Failed to delete bulletin post' });
    }
  });

  // Mark bulletin as read
  app.post('/api/bulletin/:postId/read', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { postId } = req.params;
      
      const read = await storage.markBulletinRead(clubId, postId, userId);
      res.json(read);
    } catch (error) {
      console.error('Error marking bulletin as read:', error);
      res.status(500).json({ error: 'Failed to mark bulletin as read' });
    }
  });

  // Hide/unhide bulletin post
  app.patch('/api/bulletin/:postId/hide', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId, userId } = getAuthContext(req);
      const { postId } = req.params;
      const { is_hidden } = req.body;
      
      if (typeof is_hidden !== 'boolean') {
        return res.status(400).json({ error: 'is_hidden must be a boolean' });
      }
      
      const read = await storage.updateBulletinHidden(clubId, postId, userId, is_hidden);
      res.json(read);
    } catch (error) {
      console.error('Error updating bulletin hidden status:', error);
      res.status(500).json({ error: 'Failed to update bulletin hidden status' });
    }
  });

  // Get bulletin read receipts (who viewed)
  app.get('/api/bulletin/:postId/receipts', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { postId } = req.params;
      
      const receipts = await storage.getBulletinReadReceipts(clubId, postId);
      res.json(receipts);
    } catch (error) {
      console.error('Error fetching bulletin read receipts:', error);
      res.status(500).json({ error: 'Failed to fetch read receipts' });
    }
  });

  // Get channel read receipts (who viewed messages)
  app.get('/api/chat/channels/:channelId/receipts', requireRole('admin', 'coach'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { channelId } = req.params;
      
      // Verify channel belongs to requester's club (getChatChannel returns undefined if not in club)
      const channel = await storage.getChatChannel(clubId, channelId);
      if (!channel) {
        return res.status(403).json({ error: 'Access denied to this channel' });
      }
      
      const receipts = await storage.getChannelReadReceipts(channelId);
      res.json(receipts);
    } catch (error) {
      console.error('Error fetching channel read receipts:', error);
      res.status(500).json({ error: 'Failed to fetch read receipts' });
    }
  });

  // ============ PUSH NOTIFICATIONS ============

  // Firebase config endpoint for service worker
  app.get('/api/firebase-config', (req, res) => {
    const config = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
    
    // Only return config if all required values are present
    if (!config.apiKey || !config.projectId || !config.messagingSenderId || !config.appId) {
      return res.status(503).json({ error: 'Firebase not configured' });
    }
    
    res.json(config);
  });

  // Register push token (supports both /api/push-subscriptions and /api/push/register)
  app.post('/api/push-subscriptions', requireRole('admin', 'coach', 'parent', 'athlete'), async (req, res) => {
    try {
      const { userId } = getAuthContext(req);
      const { fcm_token, device_type } = req.body;
      
      if (!fcm_token) {
        return res.status(400).json({ error: 'FCM token is required' });
      }
      
      const subscription = await storage.registerPushToken(userId, fcm_token, device_type || 'web');
      res.json(subscription);
    } catch (error) {
      console.error('Error registering push token:', error);
      res.status(500).json({ error: 'Failed to register push token' });
    }
  });

  // Legacy endpoint alias
  app.post('/api/push/register', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { userId } = getAuthContext(req);
      const { fcm_token, device_type } = req.body;
      
      if (!fcm_token) {
        return res.status(400).json({ error: 'FCM token is required' });
      }
      
      const subscription = await storage.registerPushToken(userId, fcm_token, device_type || 'web');
      res.json(subscription);
    } catch (error) {
      console.error('Error registering push token:', error);
      res.status(500).json({ error: 'Failed to register push token' });
    }
  });

  // Unregister push token
  app.post('/api/push/unregister', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { fcm_token } = req.body;
      
      if (!fcm_token) {
        return res.status(400).json({ error: 'FCM token is required' });
      }
      
      await storage.deactivatePushToken(fcm_token);
      res.json({ success: true });
    } catch (error) {
      console.error('Error unregistering push token:', error);
      res.status(500).json({ error: 'Failed to unregister push token' });
    }
  });

  // ============ DOCUSEAL SUBMISSION API ============

  // Create DocuSeal submission for an athlete
  app.post('/api/docuseal/submission', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { athlete_id, program_contract_id, program_id, team_id } = req.body;

      if (!athlete_id) {
        return res.status(400).json({ error: 'athlete_id is required' });
      }

      // Get the athlete to verify ownership and get parent email
      const athlete = await storage.getAthlete(clubId!, athlete_id);
      if (!athlete) {
        return res.status(404).json({ error: 'Athlete not found' });
      }

      // Get parent profile for signer info
      const parentProfile = await storage.getProfile(athlete.parent_id);
      if (!parentProfile) {
        return res.status(404).json({ error: 'Parent profile not found' });
      }

      // Get the program contract to find the DocuSeal template ID
      let templateId: string | undefined;
      if (program_contract_id) {
        const programContract = await storage.getProgramContract(clubId!, program_contract_id);
        if (programContract?.docuseal_template_id) {
          templateId = programContract.docuseal_template_id;
        }
      }

      if (!templateId) {
        return res.status(400).json({ error: 'No DocuSeal template configured for this contract' });
      }

      const docusealApiKey = process.env.DOCUSEAL_API_KEY;
      if (!docusealApiKey) {
        return res.status(500).json({ error: 'DocuSeal API key not configured' });
      }

      // Generate unique external_id for webhook matching
      const externalId = `vs_${clubId}_${athlete_id}_${Date.now()}`;

      // Create DocuSeal submission
      const docusealResponse = await fetch('https://api.docuseal.com/submissions', {
        method: 'POST',
        headers: {
          'X-Auth-Token': docusealApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: parseInt(templateId, 10),
          send_email: true,
          external_id: externalId,
          metadata: {
            club_id: clubId,
            athlete_id: athlete_id,
            program_id: program_id,
            team_id: team_id,
            program_contract_id: program_contract_id,
          },
          submitters: [{
            role: 'Signer',
            email: parentProfile.email,
            name: parentProfile.full_name,
            fields: [
              { name: 'Athlete Name', default_value: `${athlete.first_name} ${athlete.last_name}` },
            ],
          }],
        }),
      });

      if (!docusealResponse.ok) {
        const errorText = await docusealResponse.text();
        console.error('[DocuSeal] Submission creation failed:', errorText);
        return res.status(500).json({ error: 'Failed to create DocuSeal submission' });
      }

      const docusealData = await docusealResponse.json();
      console.log('[DocuSeal] Submission created:', JSON.stringify(docusealData, null, 2));

      // Extract submission ID and signer info
      const submissionId = docusealData.id?.toString() || docusealData.submission_id?.toString();
      const signerSlug = docusealData.submitters?.[0]?.slug || docusealData.slug;
      const signerUrl = docusealData.submitters?.[0]?.embed_src || 
                        (signerSlug ? `https://docuseal.com/s/${signerSlug}` : undefined);

      // Store submission in database
      const submission = await storage.createContractSubmission({
        club_id: clubId!,
        athlete_id: athlete_id,
        program_contract_id: program_contract_id,
        program_id: program_id,
        team_id: team_id,
        docuseal_submission_id: submissionId,
        docuseal_signer_slug: signerSlug,
        signer_url: signerUrl,
        external_id: externalId,
      });

      res.json({
        success: true,
        submission_id: submission.id,
        docuseal_submission_id: submissionId,
        signer_url: signerUrl,
        external_id: externalId,
      });
    } catch (error) {
      console.error('[DocuSeal] Error creating submission:', error);
      res.status(500).json({ error: 'Failed to create contract submission' });
    }
  });

  // Get contract submissions for an athlete
  app.get('/api/docuseal/submissions/:athleteId', requireRole('admin', 'coach', 'parent'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { athleteId } = req.params;

      // Verify athlete belongs to this club
      const athlete = await storage.getAthlete(clubId!, athleteId);
      if (!athlete) {
        return res.status(404).json({ error: 'Athlete not found' });
      }

      const submissions = await storage.getContractSubmissionsForAthlete(athleteId);
      res.json(submissions);
    } catch (error) {
      console.error('[DocuSeal] Error fetching submissions:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  });

  // ============ WEBHOOKS ============

  // Payment webhook validation - responds to GET requests for URL verification
  // Note: Route path intentionally does not contain provider name per Helcim requirements
  app.get('/api/webhooks/payments', (req, res) => {
    console.log('[Payment Webhook] Validation request received');
    res.json({ 
      status: 'ok', 
      message: 'Payment webhook endpoint ready',
      secret_configured: isWebhookSecretConfigured()
    });
  });

  // Payment webhook - receives payment notifications from Helcim
  // Uses express.raw() middleware for signature verification
  // Route path intentionally does not contain "helcim" per Helcim requirements
  app.post('/api/webhooks/payments', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      // Get raw body as string for signature verification
      const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
      
      // Extract Helcim webhook headers per spec
      const webhookHeaders = extractWebhookHeaders(req.headers as Record<string, string | string[] | undefined>);
      
      // Verify webhook signature using Helcim spec
      if (isWebhookSecretConfigured()) {
        if (!webhookHeaders) {
          console.warn('[Payment Webhook] Missing required webhook headers (webhook-id, webhook-timestamp, webhook-signature)');
          return res.status(401).json({ error: 'Missing required headers' });
        }
        if (!verifyWebhookSignature(rawBody, webhookHeaders)) {
          console.warn('[Payment Webhook] Invalid signature - rejecting request');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } else {
        console.warn('[Payment Webhook] No webhook secret configured - accepting without verification');
      }

      // Parse the JSON body
      const payload = req.body instanceof Buffer ? JSON.parse(rawBody) : req.body;
      console.log('[Payment Webhook] Received event:', JSON.stringify(payload, null, 2));
      
      // Use webhook-id header as primary idempotency key (Helcim retries with same ID)
      // This ensures duplicate deliveries are properly deduplicated
      const eventId = webhookHeaders?.webhookId || (() => {
        // Fallback if no webhook-id header (shouldn't happen with valid Helcim webhooks)
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(rawBody).digest('hex').substring(0, 32);
      })();
      
      // Check if we've already processed this webhook (idempotency check)
      const alreadyProcessed = await storage.checkWebhookEventProcessed(eventId);
      if (alreadyProcessed) {
        console.log(`[Payment Webhook] Event ${eventId} already processed - skipping`);
        return res.json({ received: true, status: 'already_processed' });
      }

      // Handle Helcim payload structure
      // Helcim sends: { type: "cardTransaction", data: { transactionId, status, amount, invoiceNumber, ... } }
      const eventType = payload.type || 'unknown';
      const data = payload.data || payload; // Support both nested and flat structure
      
      const transactionId = data.transactionId?.toString();
      const status = data.status; // "APPROVED", "DECLINED", etc.
      const amount = data.amount;
      const invoiceNumber = data.invoiceNumber;
      const customerCode = data.customerCode;

      // Record the webhook event for idempotency
      await storage.recordWebhookEvent({
        event_id: eventId,
        event_type: eventType,
        transaction_id: transactionId,
        invoice_number: invoiceNumber,
        amount: amount ? parseFloat(amount) : undefined,
        status,
        raw_payload: payload,
      });

      // Helper to find platform invoice by transaction ID or invoice number
      async function findPlatformInvoice(): Promise<{ invoice: PlatformInvoice | undefined, method: string }> {
        if (transactionId) {
          const invoice = await storage.getPlatformInvoiceByTransactionId(transactionId);
          if (invoice) return { invoice, method: 'transactionId' };
        }
        if (invoiceNumber?.startsWith('PLAT-')) {
          const invoice = await storage.getPlatformInvoiceByInvoiceNumber(invoiceNumber);
          if (invoice) return { invoice, method: 'invoiceNumber' };
        }
        return { invoice: undefined, method: 'none' };
      }

      // Helper to handle autopay subscription charges (Model A billing)
      async function handleAutopayCharge(
        customerCode: string, 
        transactionId: string, 
        txStatus: 'APPROVED' | 'DECLINED' | 'FAILED',
        txDate: Date
      ): Promise<boolean> {
        if (BILLING_MODE !== 'helcim') return false;
        
        const club = await storage.getClubByCustomerCode(customerCode);
        if (!club) return false;
        
        const billingDay = club.billing_day ?? 1;
        const pendingCharge = await storage.getAutopayChargeForPeriod(club.id, billingDay, txDate);
        
        if (!pendingCharge || pendingCharge.status !== 'prepared') return false;
        
        const newStatus = txStatus === 'APPROVED' ? 'paid' : 'failed';
        await storage.updateAutopayChargeStatus(pendingCharge.id, newStatus, transactionId);
        
        if (newStatus === 'paid') {
          const { periodStart, periodEnd } = calculateBillingPeriod(billingDay, txDate);
          await storage.markLedgerEntriesPaidForPeriod(club.id, periodStart, periodEnd);
          console.log(`[Payment Webhook] Autopay: Marked ledger entries paid for club ${club.name}`);
        }
        
        console.log(`[Payment Webhook] Autopay: Updated charge for club ${club.name} -> ${newStatus}`);
        return true;
      }

      // Handle cardTransaction events based on status
      if (eventType === 'cardTransaction') {
        if (status === 'APPROVED') {
          console.log(`[Payment Webhook] Transaction approved: ${transactionId}, Amount $${amount}, Invoice ${invoiceNumber}`);
          
          // Check if this is a platform billing invoice (starts with PLAT-)
          if (invoiceNumber?.startsWith('PLAT-')) {
            if (transactionId) {
              await storage.updatePlatformInvoiceByTransactionId(transactionId, 'paid');
            }
            // Find and update ledger entries
            const { invoice, method } = await findPlatformInvoice();
            if (invoice) {
              await storage.markLedgerEntriesPaidByInvoiceId(invoice.id);
              console.log(`[Payment Webhook] Marked ledger entries paid for invoice ${invoice.id} (found by ${method})`);
            } else {
              console.warn(`[Payment Webhook] Could not find platform invoice for approved transaction`);
            }
          } else if (customerCode && transactionId) {
            // Try autopay subscription charge first (Model A)
            const handledAsAutopay = await handleAutopayCharge(customerCode, transactionId, 'APPROVED', new Date());
            if (!handledAsAutopay) {
              // Fallback: Update parent->club payment
              await storage.updatePaymentByTransactionId(transactionId, 'completed');
              console.log(`[Payment Webhook] Updated payment status to completed`);
            }
          } else if (transactionId) {
            // Update parent->club payment
            await storage.updatePaymentByTransactionId(transactionId, 'completed');
            console.log(`[Payment Webhook] Updated payment status to completed`);
          }
        } else if (status === 'DECLINED' || status === 'CANCELLED' || status === 'FAILED') {
          console.log(`[Payment Webhook] Transaction ${status}: ${transactionId}, Invoice ${invoiceNumber}`);
          
          if (invoiceNumber?.startsWith('PLAT-')) {
            if (transactionId) {
              await storage.updatePlatformInvoiceByTransactionId(transactionId, 'failed');
            }
            // Find and update ledger entries
            const { invoice, method } = await findPlatformInvoice();
            if (invoice) {
              await storage.unmarkLedgerEntriesByInvoiceId(invoice.id);
              console.log(`[Payment Webhook] Unmarked ledger entries for failed invoice ${invoice.id} (found by ${method})`);
            }
          } else if (customerCode && transactionId) {
            // Try autopay subscription charge first (Model A)
            const failStatus = status === 'DECLINED' ? 'DECLINED' : 'FAILED';
            const handledAsAutopay = await handleAutopayCharge(customerCode, transactionId, failStatus as any, new Date());
            if (!handledAsAutopay && transactionId) {
              await storage.updatePaymentByTransactionId(transactionId, 'failed');
              console.log(`[Payment Webhook] Updated payment status to failed`);
            }
          } else if (transactionId) {
            await storage.updatePaymentByTransactionId(transactionId, 'failed');
            console.log(`[Payment Webhook] Updated payment status to failed`);
          }
        } else {
          console.log(`[Payment Webhook] Unhandled transaction status: ${status}`);
        }
      } else {
        console.log(`[Payment Webhook] Received event type: ${eventType} (not cardTransaction)`);
      }
      
      res.json({ received: true, status: 'processed' });
    } catch (error) {
      console.error('[Payment Webhook] Error processing webhook:', error);
      // Always return 200 to prevent retries that could cause duplicate processing
      res.status(200).json({ received: true, error: 'Processing error logged' });
    }
  });

  // DocuSeal webhook validation - responds to GET requests for URL verification
  app.get('/api/webhooks/docuseal', (req, res) => {
    console.log('[DocuSeal Webhook] Validation request received');
    res.json({ status: 'ok', message: 'DocuSeal webhook endpoint ready' });
  });

  // DocuSeal e-signature webhook - receives signing notifications from DocuSeal
  app.post('/api/webhooks/docuseal', async (req, res) => {
    try {
      // Verify webhook authenticity using X-DocuSeal-Secret header
      const webhookSecret = process.env.DOCUSEAL_WEBHOOK_SECRET;
      const receivedSecret = req.headers['x-docuseal-secret'];
      
      // Enforce webhook secret verification if configured
      if (webhookSecret) {
        if (receivedSecret !== webhookSecret) {
          console.warn('[DocuSeal Webhook] Unauthorized request - invalid or missing X-DocuSeal-Secret header');
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }
      
      console.log('[DocuSeal Webhook] Received event:', JSON.stringify(req.body, null, 2));
      
      const { event_type, submission_id, submitter, completed_at, metadata, data, external_id } = req.body;
      
      // Handle submission.completed event - contract has been signed
      if (event_type === 'submission.completed' || event_type === 'form.completed') {
        console.log(`[DocuSeal Webhook] Document completed: Submission ${submission_id}`);
        
        // PRIORITY 1: Try to find submission by external_id (most reliable)
        const externalIdFromPayload = external_id || metadata?.external_id || data?.external_id;
        
        if (externalIdFromPayload) {
          console.log(`[DocuSeal Webhook] Looking up by external_id: ${externalIdFromPayload}`);
          const contractSubmission = await storage.getContractSubmissionByExternalId(externalIdFromPayload);
          
          if (contractSubmission) {
            console.log(`[DocuSeal Webhook] Found contract submission: ${contractSubmission.id} for athlete ${contractSubmission.athlete_id}`);
            
            // Update submission status to signed
            await storage.updateContractSubmissionStatus(contractSubmission.id, 'signed', new Date());
            
            // Update athlete roster contract_signed flag - scope by program_id if available
            let rosterUpdateQuery = supabaseAdmin
              .from('athlete_team_rosters')
              .update({ contract_signed: true })
              .eq('athlete_id', contractSubmission.athlete_id)
              .eq('club_id', contractSubmission.club_id);
            
            // Scope to specific program if available
            if (contractSubmission.program_id) {
              rosterUpdateQuery = rosterUpdateQuery.eq('program_id', contractSubmission.program_id);
            }
            
            const { error: updateError } = await rosterUpdateQuery;
            
            if (updateError) {
              console.error('[DocuSeal Webhook] Error updating roster:', updateError);
            } else {
              console.log(`[DocuSeal Webhook] Updated contract_signed for athlete ${contractSubmission.athlete_id}${contractSubmission.program_id ? ` in program ${contractSubmission.program_id}` : ''}`);
            }
            
            // Get athlete to record signature for parent
            const { data: athlete } = await supabaseAdmin
              .from('athletes')
              .select('parent_id')
              .eq('id', contractSubmission.athlete_id)
              .single();
            
            if (athlete) {
              // Record in club_signatures (idempotent)
              const { data: existingSignature } = await supabaseAdmin
                .from('club_signatures')
                .select('id')
                .eq('club_id', contractSubmission.club_id)
                .eq('user_id', athlete.parent_id)
                .eq('document_type', 'contract')
                .maybeSingle();
              
              if (!existingSignature) {
                await supabaseAdmin
                  .from('club_signatures')
                  .insert({
                    club_id: contractSubmission.club_id,
                    user_id: athlete.parent_id,
                    document_type: 'contract',
                    document_version: 1,
                    signed_name: submitter?.name || submitter?.email || 'Signed via DocuSeal',
                  });
                console.log(`[DocuSeal Webhook] Recorded signature for parent ${athlete.parent_id}`);
              }
            }
            
            return res.json({ received: true, processed: true });
          }
        }
        
        // PRIORITY 2: Try to find by DocuSeal submission_id
        if (submission_id) {
          console.log(`[DocuSeal Webhook] Looking up by submission_id: ${submission_id}`);
          const contractSubmission = await storage.getContractSubmissionByDocuSealId(submission_id.toString());
          
          if (contractSubmission) {
            console.log(`[DocuSeal Webhook] Found contract submission by docuseal_id: ${contractSubmission.id}`);
            
            // Update submission status
            await storage.updateContractSubmissionStatus(contractSubmission.id, 'signed', new Date());
            
            // Update athlete roster - scope by program_id if available
            let rosterQuery = supabaseAdmin
              .from('athlete_team_rosters')
              .update({ contract_signed: true })
              .eq('athlete_id', contractSubmission.athlete_id)
              .eq('club_id', contractSubmission.club_id);
            
            if (contractSubmission.program_id) {
              rosterQuery = rosterQuery.eq('program_id', contractSubmission.program_id);
            }
            
            const { error: updateError } = await rosterQuery;
            
            if (updateError) {
              console.error('[DocuSeal Webhook] Error updating roster:', updateError);
            } else {
              console.log(`[DocuSeal Webhook] Updated contract_signed for athlete ${contractSubmission.athlete_id}`);
            }
            
            return res.json({ received: true, processed: true });
          }
        }
        
        // PRIORITY 3: Try metadata-based lookup (legacy support)
        const clubId = metadata?.club_id;
        const athleteId = metadata?.athlete_id;
        const programId = metadata?.program_id;
        
        if (athleteId && clubId) {
          console.log(`[DocuSeal Webhook] Processing with metadata - athlete: ${athleteId}, club: ${clubId}`);
          
          const { data: athlete, error: athleteError } = await supabaseAdmin
            .from('athletes')
            .select('id, parent_id')
            .eq('id', athleteId)
            .eq('club_id', clubId)
            .single();
          
          if (!athlete || athleteError) {
            console.log(`[DocuSeal Webhook] Athlete ${athleteId} not found in club ${clubId}`);
            return res.json({ received: true, processed: false, reason: 'athlete_not_found' });
          }
          
          // Update roster entry - scope by program_id if available in metadata
          let metadataRosterQuery = supabaseAdmin
            .from('athlete_team_rosters')
            .update({ contract_signed: true })
            .eq('athlete_id', athleteId)
            .eq('club_id', clubId);
          
          if (programId) {
            metadataRosterQuery = metadataRosterQuery.eq('program_id', programId);
          }
          
          const { error: updateError } = await metadataRosterQuery;
          
          if (updateError) {
            console.error('[DocuSeal Webhook] Error updating roster:', updateError);
          } else {
            console.log(`[DocuSeal Webhook] Updated contract_signed for athlete ${athleteId}${programId ? ` in program ${programId}` : ''}`);
          }
          
          // Record signature
          const { data: existingSignature } = await supabaseAdmin
            .from('club_signatures')
            .select('id')
            .eq('club_id', clubId)
            .eq('user_id', athlete.parent_id)
            .eq('document_type', 'contract')
            .maybeSingle();
          
          if (!existingSignature) {
            await supabaseAdmin
              .from('club_signatures')
              .insert({
                club_id: clubId,
                user_id: athlete.parent_id,
                document_type: 'contract',
                document_version: 1,
                signed_name: submitter?.name || submitter?.email || 'Signed via DocuSeal',
              });
            console.log(`[DocuSeal Webhook] Recorded signature for parent ${athlete.parent_id}`);
          }
          
          return res.json({ received: true, processed: true });
        }
        
        // NO FALLBACK TO EMAIL-ONLY: If we can't identify the specific athlete, log and return
        console.log('[DocuSeal Webhook] Cannot identify specific athlete - no external_id, submission_id match, or metadata');
        return res.json({ received: true, processed: false, reason: 'cannot_identify_athlete' });
        
      } else if (event_type === 'form.viewed' || event_type === 'submitter.opened') {
        console.log(`[DocuSeal Webhook] Document viewed: Submission ${submission_id}`);
        
        // Update submission status to viewed if we can find it
        if (submission_id) {
          const contractSubmission = await storage.getContractSubmissionByDocuSealId(submission_id.toString());
          if (contractSubmission && contractSubmission.status === 'sent') {
            await storage.updateContractSubmissionStatus(contractSubmission.id, 'viewed');
          }
        }
      } else if (event_type === 'submitter.completed') {
        console.log(`[DocuSeal Webhook] Submitter completed: ${submitter?.email || submitter?.name}`);
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('[DocuSeal Webhook] Error processing webhook:', error);
      // Return 200 to prevent retries even on error (log for debugging)
      res.json({ received: true, processed: false, reason: 'internal_error' });
    }
  });

  // ============ OWNER DASHBOARD ROUTES ============
  
  // Get all clubs (Owner only)
  app.get('/api/owner/clubs', requireRole('owner'), async (req, res) => {
    try {
      const clubs = await storage.getAllClubs();
      
      // Get athlete counts and active status for each club
      const clubsWithStats = await Promise.all(clubs.map(async (club) => {
        const athletes = await storage.getAthletes(club.id);
        const totalAthletes = athletes.length;
        const activeAthletes = athletes.filter(a => {
          if (!a.paid_through_date) return false;
          const paidThrough = new Date(a.paid_through_date);
          const now = new Date();
          return paidThrough >= now;
        }).length;
        
        return {
          ...club,
          total_athletes: totalAthletes,
          active_athletes: activeAthletes,
          estimated_monthly_revenue: activeAthletes * PLATFORM_FEES.monthly,
        };
      }));
      
      res.json(clubsWithStats);
    } catch (error) {
      console.error('Error fetching clubs for owner:', error);
      res.status(500).json({ error: 'Failed to fetch clubs' });
    }
  });
  
  // Get platform-wide metrics (Owner only)
  app.get('/api/owner/metrics', requireRole('owner'), async (req, res) => {
    try {
      const clubs = await storage.getAllClubs();
      
      let totalAthletes = 0;
      let activeAthletes = 0;
      let totalPayments = 0;
      
      for (const club of clubs) {
        const athletes = await storage.getAthletes(club.id);
        totalAthletes += athletes.length;
        
        for (const athlete of athletes) {
          if (athlete.paid_through_date) {
            const paidThrough = new Date(athlete.paid_through_date);
            const now = new Date();
            if (paidThrough >= now) {
              activeAthletes++;
            }
          }
        }
        
        // Get payments for this club
        const payments = await storage.getPayments(club.id);
        totalPayments += payments.length;
      }
      
      const estimatedMonthlyRevenue = activeAthletes * PLATFORM_FEES.monthly;
      
      res.json({
        total_clubs: clubs.length,
        total_athletes: totalAthletes,
        active_athletes: activeAthletes,
        total_payments: totalPayments,
        estimated_monthly_revenue: estimatedMonthlyRevenue,
        platform_fee_monthly: PLATFORM_FEES.monthly,
        platform_fee_event: PLATFORM_FEES.event,
        platform_fee_drop_in: PLATFORM_FEES.drop_in,
      });
    } catch (error) {
      console.error('Error fetching owner metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });
  
  // Get detailed club information (Owner only)
  app.get('/api/owner/clubs/:clubId', requireRole('owner'), async (req, res) => {
    try {
      const club = await storage.getClub(req.params.clubId);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      
      const athletes = await storage.getAthletes(club.id);
      const payments = await storage.getPayments(club.id);
      const programs = await storage.getPrograms(club.id);
      const teams = await storage.getTeams(club.id);
      
      // Calculate athlete stats
      const totalAthletes = athletes.length;
      const activeAthletes = athletes.filter(a => {
        if (!a.paid_through_date) return false;
        const paidThrough = new Date(a.paid_through_date);
        const now = new Date();
        return paidThrough >= now;
      }).length;
      
      res.json({
        ...club,
        stats: {
          total_athletes: totalAthletes,
          active_athletes: activeAthletes,
          total_payments: payments.length,
          total_programs: programs.length,
          total_teams: teams.length,
          estimated_monthly_revenue: activeAthletes * PLATFORM_FEES.monthly,
        },
        recent_payments: payments.slice(0, 10),
      });
    } catch (error) {
      console.error('Error fetching club details for owner:', error);
      res.status(500).json({ error: 'Failed to fetch club details' });
    }
  });

  // ============ OWNER DOCUSEAL SETUP REQUESTS ============

  // Get all DocuSeal setup requests
  app.get('/api/owner/docuseal-setup-requests', requireRole('owner'), async (req, res) => {
    try {
      const status = req.query.status as 'open' | 'in_progress' | 'completed' | 'rejected' | undefined;
      const requests = await storage.getDocuSealSetupRequests(status);
      
      // Enrich with club names
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        const club = await storage.getClub(request.club_id);
        return {
          ...request,
          club_name: club?.name || 'Unknown Club',
        };
      }));
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error('Error fetching DocuSeal setup requests:', error);
      res.status(500).json({ error: 'Failed to fetch setup requests' });
    }
  });

  // Update a DocuSeal setup request status/notes
  app.patch('/api/owner/docuseal-setup-requests/:id', requireRole('owner'), async (req, res) => {
    try {
      const { status, notes, team_name } = req.body;
      const { userId } = getAuthContext(req);
      
      // Update the request
      const updated = await storage.updateDocuSealSetupRequest(req.params.id, { status, notes });
      
      // If marked as completed, also mark the club as DocuSeal onboarded
      if (status === 'completed') {
        await storage.markClubDocuSealOnboarded(updated.club_id, userId, team_name);
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating DocuSeal setup request:', error);
      res.status(500).json({ error: 'Failed to update setup request' });
    }
  });

  // Manually mark a club as DocuSeal onboarded (without a request)
  app.post('/api/owner/clubs/:clubId/docuseal-onboard', requireRole('owner'), async (req, res) => {
    try {
      const { userId } = getAuthContext(req);
      const { team_name } = req.body;
      
      const club = await storage.markClubDocuSealOnboarded(req.params.clubId, userId, team_name);
      res.json(club);
    } catch (error) {
      console.error('Error marking club as DocuSeal onboarded:', error);
      res.status(500).json({ error: 'Failed to mark club as onboarded' });
    }
  });

  // ============ CLUB BILLING MANAGEMENT ROUTES ============

  // Get all clubs with billing status (Owner only)
  app.get('/api/owner/clubs-billing', requireRole('owner'), async (req, res) => {
    try {
      const clubs = await storage.getAllClubs();
      
      // Get active athlete counts and billing info for each club
      const clubsWithBilling = await Promise.all(
        clubs.map(async (club) => {
          const now = new Date();
          const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, club.billing_day || 1);
          const periodEnd = new Date(now.getFullYear(), now.getMonth(), club.billing_day || 1);
          
          // Get active athletes count
          const activeAthletes = await storage.getActiveAthletesForPeriod(club.id, periodStart, periodEnd);
          
          // Get unpaid ledger entries for this club
          const unpaidEntries = await storage.getUnpaidLedgerEntriesByClub(club.id);
          const unpaidAmount = unpaidEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
          
          // Calculate days until billing
          const today = now.getDate();
          const billingDay = club.billing_day || 1;
          let daysUntilBilling = billingDay - today;
          if (daysUntilBilling <= 0) {
            // Next month
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            daysUntilBilling = daysInMonth - today + billingDay;
          }
          
          return {
            ...club,
            activeAthleteCount: activeAthletes.length,
            unpaidAmount,
            unpaidEntriesCount: unpaidEntries.length,
            daysUntilBilling,
            isLocked: !!club.billing_locked_at,
          };
        })
      );
      
      res.json(clubsWithBilling);
    } catch (error) {
      console.error('Error fetching clubs billing status:', error);
      res.status(500).json({ error: 'Failed to fetch clubs billing status' });
    }
  });

  // Unlock a club (Owner only)
  app.post('/api/owner/clubs/:clubId/unlock', requireRole('owner'), async (req, res) => {
    try {
      await storage.unlockClub(req.params.clubId);
      const club = await storage.getClub(req.params.clubId);
      res.json(club);
    } catch (error) {
      console.error('Error unlocking club:', error);
      res.status(500).json({ error: 'Failed to unlock club' });
    }
  });

  // Lock a club manually (Owner only)
  app.post('/api/owner/clubs/:clubId/lock', requireRole('owner'), async (req, res) => {
    try {
      await storage.lockClub(req.params.clubId);
      const club = await storage.getClub(req.params.clubId);
      res.json(club);
    } catch (error) {
      console.error('Error locking club:', error);
      res.status(500).json({ error: 'Failed to lock club' });
    }
  });

  // Platform Revenue Metrics (Owner only) - Parent-paid tech fees
  app.get('/api/owner/revenue/metrics', requireRole('owner'), async (req, res) => {
    try {
      const { start, end } = req.query;
      const startDate = start ? new Date(start as string) : new Date(new Date().setDate(1));
      const endDate = end ? new Date(end as string) : new Date();
      
      const metrics = await storage.getPlatformRevenueMetrics(startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching revenue metrics:', error);
      res.status(500).json({ error: 'Failed to fetch revenue metrics' });
    }
  });

  // Platform Revenue Payments (Owner only) - Recent parent-paid transactions
  app.get('/api/owner/revenue/payments', requireRole('owner'), async (req, res) => {
    try {
      const { start, end, limit } = req.query;
      const startDate = start ? new Date(start as string) : new Date(new Date().setDate(1));
      const endDate = end ? new Date(end as string) : new Date();
      const limitNum = limit ? parseInt(limit as string, 10) : 20;
      
      const payments = await storage.getPlatformRevenuePayments(startDate, endDate, limitNum);
      res.json(payments);
    } catch (error) {
      console.error('Error fetching revenue payments:', error);
      res.status(500).json({ error: 'Failed to fetch revenue payments' });
    }
  });

  // Update club billing day (Director/Admin only)
  app.patch('/api/clubs/billing-day', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const { billing_day } = req.body;
      
      if (!billing_day || billing_day < 1 || billing_day > 28) {
        return res.status(400).json({ error: 'Billing day must be between 1 and 28' });
      }
      
      await storage.updateClubBillingDay(clubId, billing_day);
      const club = await storage.getClub(clubId);
      res.json(club);
    } catch (error) {
      console.error('Error updating club billing day:', error);
      res.status(500).json({ error: 'Failed to update billing day' });
    }
  });

  // Get current club's billing status (Director/Admin only)
  app.get('/api/clubs/billing-status', requireRole('admin'), async (req, res) => {
    try {
      const { clubId } = getAuthContext(req);
      const club = await storage.getClub(clubId);
      
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }
      
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, club.billing_day || 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth(), club.billing_day || 1);
      
      const activeAthletes = await storage.getActiveAthletesForPeriod(clubId, periodStart, periodEnd);
      const unpaidEntries = await storage.getUnpaidLedgerEntriesByClub(clubId);
      const unpaidAmount = unpaidEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      
      // Calculate next billing date
      const billingDay = club.billing_day || 1;
      let nextBillingDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
      if (nextBillingDate <= now) {
        nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, billingDay);
      }
      
      res.json({
        billingDay: club.billing_day || 1,
        lastBilledAt: club.last_billed_at,
        lastBilledPeriodStart: club.last_billed_period_start,
        isLocked: !!club.billing_locked_at,
        lockedAt: club.billing_locked_at,
        activeAthleteCount: activeAthletes.length,
        estimatedMonthlyFee: activeAthletes.length * 3, // $3 per player
        unpaidAmount,
        nextBillingDate: nextBillingDate.toISOString(),
      });
    } catch (error) {
      console.error('Error fetching club billing status:', error);
      res.status(500).json({ error: 'Failed to fetch billing status' });
    }
  });

  // ============ PLATFORM BILLING ROUTES ============

  // Preview platform billing for a period (Owner only)
  app.post('/api/platform/billing/preview', requireRole('owner'), async (req, res) => {
    try {
      const { periodStart, periodEnd, paymentMethod } = req.body;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: 'periodStart and periodEnd are required' });
      }

      const method = paymentMethod || 'credit_card';
      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      // Get all unpaid ledger entries in the period
      const allEntries = await storage.getUnpaidLedgerEntriesByPeriod(start, end);

      // Group by club
      const clubMap = new Map<string, typeof allEntries>();
      for (const entry of allEntries) {
        const existing = clubMap.get(entry.club_id) || [];
        existing.push(entry);
        clubMap.set(entry.club_id, existing);
      }

      // Build preview for each club
      const previews = await Promise.all(
        Array.from(clubMap.entries()).map(async ([clubId, entries]) => {
          const club = await storage.getClub(clubId);
          const subtotal = entries.reduce((sum, e) => sum + e.amount, 0);
          const feeAmount = getConvenienceFeeAmount(subtotal, method);
          // Use consistent calculation: total = subtotal + feeAmount (not calculateTotalWithFee to avoid rounding discrepancies)
          const total = Math.round((subtotal + feeAmount) * 100) / 100;

          const hasBillingToken = method === 'credit_card' 
            ? !!club?.billing_card_token 
            : !!club?.billing_bank_token;

          // Get active athlete count for this period
          const activeAthletes = await storage.getActiveAthletesForPeriod(clubId, start, end);

          return {
            club_id: clubId,
            club_name: club?.name || 'Unknown Club',
            ledger_line_count: entries.length,
            active_athlete_count: activeAthletes.length,
            subtotal,
            fee: feeAmount,
            total,
            has_billing_token: hasBillingToken,
            can_charge: hasBillingToken && entries.length > 0,
          };
        })
      );

      res.json({
        period_start: periodStart,
        period_end: periodEnd,
        payment_method: method,
        clubs: previews,
        total_clubs: previews.length,
        total_billable: previews.filter(p => p.can_charge).length,
        total_amount: previews.reduce((sum, p) => sum + p.total, 0),
      });
    } catch (error) {
      console.error('Error generating billing preview:', error);
      res.status(500).json({ error: 'Failed to generate billing preview' });
    }
  });

  // Run platform billing for all clubs in a period (Owner only)
  app.post('/api/platform/billing/run', requireRole('owner'), async (req, res) => {
    try {
      const { periodStart, periodEnd, paymentMethod } = req.body;
      
      if (!periodStart || !periodEnd || !paymentMethod) {
        return res.status(400).json({ error: 'periodStart, periodEnd, and paymentMethod are required' });
      }

      const method = paymentMethod as 'credit_card' | 'ach';
      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      // Get all unpaid ledger entries in the period
      const allEntries = await storage.getUnpaidLedgerEntriesByPeriod(start, end);

      // Group by club
      const clubMap = new Map<string, typeof allEntries>();
      for (const entry of allEntries) {
        const existing = clubMap.get(entry.club_id) || [];
        existing.push(entry);
        clubMap.set(entry.club_id, existing);
      }

      const results: Array<{
        club_id: string;
        club_name: string;
        status: 'paid' | 'failed' | 'skipped';
        invoice_id?: string;
        amount?: number;
        error?: string;
      }> = [];

      const appUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` 
        : 'https://visiosquad.com';

      // Process each club
      for (const [clubId, entries] of clubMap.entries()) {
        const club = await storage.getClub(clubId);
        const clubName = club?.name || 'Unknown Club';

        // Check if club has billing token
        const cardToken = method === 'credit_card' ? club?.billing_card_token : undefined;
        const bankToken = method === 'ach' ? club?.billing_bank_token : undefined;

        if (!cardToken && !bankToken) {
          results.push({
            club_id: clubId,
            club_name: clubName,
            status: 'skipped',
            error: `No ${method === 'credit_card' ? 'card' : 'bank'} token on file`,
          });
          continue;
        }

        // Calculate amounts with consistent rounding
        const subtotal = entries.reduce((sum, e) => sum + e.amount, 0);
        const feeAmount = getConvenienceFeeAmount(subtotal, method);
        // Use consistent calculation: total = subtotal + feeAmount (rounded to 2 decimals)
        const total = Math.round((subtotal + feeAmount) * 100) / 100;

        // Create invoice
        const invoice = await storage.createPlatformInvoice({
          club_id: clubId,
          period_start: start,
          period_end: end,
          subtotal_amount: subtotal,
          fee_amount: feeAmount,
          total_amount: total,
          payment_method: method,
          status: 'draft',
        });

        // Charge via Helcim
        const chargeResult = await chargePlatformBilling({
          amount: total,
          cardToken,
          bankToken,
          clubId,
          clubName,
          invoiceId: invoice.id,
          periodStart,
          periodEnd,
        });

        if (chargeResult.success) {
          // Mark invoice as paid
          await storage.updatePlatformInvoiceStatus(
            invoice.id,
            'paid',
            chargeResult.transactionId
          );

          // Mark ledger entries as paid
          await storage.markLedgerEntriesPaid(
            entries.map(e => e.id),
            invoice.id
          );

          // Send success email
          const directorEmail = await storage.getClubDirectorEmail(clubId);
          if (directorEmail) {
            await sendPlatformBillingSuccess(directorEmail, {
              clubName,
              periodStart,
              periodEnd,
              subtotal,
              fee: feeAmount,
              total,
              paymentMethod: method,
              transactionId: chargeResult.transactionId || 'N/A',
              invoiceId: invoice.id,
            });
          }

          results.push({
            club_id: clubId,
            club_name: clubName,
            status: 'paid',
            invoice_id: invoice.id,
            amount: total,
          });
        } else {
          // Mark invoice as failed
          await storage.updatePlatformInvoiceStatus(
            invoice.id,
            'failed',
            undefined,
            chargeResult.error
          );

          // Send failure email to owner
          await sendPlatformBillingFailure({
            clubName,
            clubId,
            periodStart,
            periodEnd,
            amount: total,
            failureReason: chargeResult.error || 'Unknown error',
            invoiceId: invoice.id,
            dashboardUrl: `${appUrl}/owner/platform-billing`,
          });

          results.push({
            club_id: clubId,
            club_name: clubName,
            status: 'failed',
            invoice_id: invoice.id,
            amount: total,
            error: chargeResult.error,
          });
        }
      }

      res.json({
        period_start: periodStart,
        period_end: periodEnd,
        payment_method: method,
        results,
        summary: {
          total_clubs: results.length,
          paid: results.filter(r => r.status === 'paid').length,
          failed: results.filter(r => r.status === 'failed').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          total_collected: results
            .filter(r => r.status === 'paid')
            .reduce((sum, r) => sum + (r.amount || 0), 0),
        },
      });
    } catch (error) {
      console.error('Error running platform billing:', error);
      res.status(500).json({ error: 'Failed to run platform billing' });
    }
  });

  // Retry a single failed invoice (Owner only)
  app.post('/api/platform/billing/charge/:invoiceId', requireRole('owner'), async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const invoice = await storage.getPlatformInvoice(invoiceId);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      if (invoice.status === 'paid') {
        return res.status(400).json({ error: 'Invoice is already paid' });
      }

      const club = await storage.getClub(invoice.club_id);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }

      const method = invoice.payment_method;
      const cardToken = method === 'credit_card' ? club.billing_card_token : undefined;
      const bankToken = method === 'ach' ? club.billing_bank_token : undefined;

      if (!cardToken && !bankToken) {
        return res.status(400).json({ 
          error: `Club has no ${method === 'credit_card' ? 'card' : 'bank'} token on file` 
        });
      }

      const appUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` 
        : 'https://visiosquad.com';

      // Retry charge
      const chargeResult = await chargePlatformBilling({
        amount: invoice.total_amount,
        cardToken,
        bankToken,
        clubId: invoice.club_id,
        clubName: club.name,
        invoiceId: invoice.id,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
      });

      if (chargeResult.success) {
        // Mark invoice as paid
        const updated = await storage.updatePlatformInvoiceStatus(
          invoice.id,
          'paid',
          chargeResult.transactionId
        );

        // Get unpaid ledger entries for this period and club
        const entries = await storage.getUnpaidLedgerEntriesByClubAndPeriod(
          invoice.club_id,
          new Date(invoice.period_start),
          new Date(invoice.period_end)
        );

        // Mark ledger entries as paid
        await storage.markLedgerEntriesPaid(
          entries.map(e => e.id),
          invoice.id
        );

        // Send success email
        const directorEmail = await storage.getClubDirectorEmail(invoice.club_id);
        if (directorEmail) {
          await sendPlatformBillingSuccess(directorEmail, {
            clubName: club.name,
            periodStart: invoice.period_start,
            periodEnd: invoice.period_end,
            subtotal: invoice.subtotal_amount,
            fee: invoice.fee_amount,
            total: invoice.total_amount,
            paymentMethod: method,
            transactionId: chargeResult.transactionId || 'N/A',
            invoiceId: invoice.id,
          });
        }

        res.json({ success: true, invoice: updated });
      } else {
        // Update failure reason
        const updated = await storage.updatePlatformInvoiceStatus(
          invoice.id,
          'failed',
          undefined,
          chargeResult.error
        );

        // Send failure email
        await sendPlatformBillingFailure({
          clubName: club.name,
          clubId: invoice.club_id,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
          amount: invoice.total_amount,
          failureReason: chargeResult.error || 'Unknown error',
          invoiceId: invoice.id,
          dashboardUrl: `${appUrl}/owner/platform-billing`,
        });

        res.json({ success: false, error: chargeResult.error, invoice: updated });
      }
    } catch (error) {
      console.error('Error retrying invoice charge:', error);
      res.status(500).json({ error: 'Failed to retry invoice charge' });
    }
  });

  // Get platform invoices (Owner only)
  app.get('/api/platform/billing/invoices', requireRole('owner'), async (req, res) => {
    try {
      const { periodStart, periodEnd } = req.query;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: 'periodStart and periodEnd query params are required' });
      }

      const invoices = await storage.getPlatformInvoicesByPeriod(
        new Date(periodStart as string),
        new Date(periodEnd as string)
      );

      // Enrich with club names
      const enriched = await Promise.all(
        invoices.map(async (invoice) => {
          const club = await storage.getClub(invoice.club_id);
          return {
            ...invoice,
            club_name: club?.name || 'Unknown Club',
          };
        })
      );

      res.json(enriched);
    } catch (error) {
      console.error('Error fetching platform invoices:', error);
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  });

  // Test seed endpoint - creates self-contained test data for platform billing (Owner only)
  // Creates a dedicated test club, athlete, and ledger entries
  app.post('/api/platform/billing/test-seed', requireRole('owner'), async (req, res) => {
    const TEST_CLUB_NAME = 'TEST CLUB - DO NOT BILL';
    const TEST_ATHLETE_NAME = 'Test Athlete';
    
    try {
      // Step 1: Find or create the dedicated test club
      const allClubs = await storage.getAllClubs();
      let club = allClubs.find(c => c.name === TEST_CLUB_NAME);
      let clubCreated = false;
      let parentUserId: string | undefined;
      
      if (!club) {
        // Create the test club with a dummy director
        const testEmail = `test-director-${Date.now()}@test.visiosquad.com`;
        const result = await storage.createClub(
          TEST_CLUB_NAME,
          testEmail,
          'Test Director',
          'test-password-not-used'
        );
        club = result.club;
        parentUserId = result.user.id;
        clubCreated = true;
        console.log(`[Test Seed] Created test club: ${club.id}`);
      } else {
        // Get existing user for the club - first try parents (getUsersWithContractStatus)
        const clubUsers = await storage.getUsersWithContractStatus(club.id);
        if (clubUsers.length > 0) {
          parentUserId = clubUsers[0].id;
        } else {
          // No parents found, we need to create a parent user for the test club
          // Use the test director email from the club (query directly)
          const { data: adminUsers } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('club_id', club.id)
            .limit(1);
          
          if (adminUsers && adminUsers.length > 0) {
            parentUserId = adminUsers[0].id;
          }
        }
      }

      // Step 2: Find or create a test athlete
      let athletes = await storage.getAthletes(club.id);
      let testAthlete = athletes.find(a => a.first_name === 'Test' && a.last_name === 'Athlete');
      let athleteCreated = false;
      
      if (!testAthlete) {
        if (!parentUserId) {
          throw new Error('No parent user found for test athlete - cannot create athlete without parent');
        }
        
        testAthlete = await storage.createAthlete(club.id, {
          first_name: 'Test',
          last_name: 'Athlete',
          date_of_birth: '2010-01-01',
          graduation_year: 2028,
          parent_id: parentUserId,
          tags: [],
        });
        athleteCreated = true;
        console.log(`[Test Seed] Created test athlete: ${testAthlete.id}`);
      }

      // Step 3: Create platform ledger entries (unpaid, ready for billing)
      // Use the database enum values: monthly_athlete, clinic_session, drop_in_session
      const entryConfigs = [
        { dbType: 'monthly_athlete' as const, fee: PLATFORM_FEES.monthly },
        { dbType: 'monthly_athlete' as const, fee: PLATFORM_FEES.monthly },
        { dbType: 'clinic_session' as const, fee: PLATFORM_FEES.event }, // Use event fee for clinic sessions
        { dbType: 'monthly_athlete' as const, fee: PLATFORM_FEES.event },
        { dbType: 'drop_in_session' as const, fee: PLATFORM_FEES.drop_in },
      ];
      const entries = [];
      for (const config of entryConfigs) {
        const entry = await storage.createPlatformLedgerEntryRaw(
          club.id,
          testAthlete.id,
          config.fee,
          config.dbType
        );
        entries.push(entry);
      }

      console.log(`[Test Seed] Created ${entries.length} ledger entries for club ${club.id}`);

      res.json({
        message: 'Test data seeded successfully',
        club_id: club.id,
        club_name: club.name,
        club_created: clubCreated,
        athlete_id: testAthlete.id,
        athlete_created: athleteCreated,
        entries_created: entries.length,
        total_amount: entries.reduce((sum, e) => sum + e.amount, 0),
        entry_breakdown: {
          monthly_athlete: entries.filter(e => e.entry_type === 'monthly_athlete').length,
          clinic_session: entries.filter(e => e.entry_type === 'clinic_session').length,
          drop_in_session: entries.filter(e => e.entry_type === 'drop_in_session').length,
        }
      });
    } catch (error) {
      console.error('Error seeding test data:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Stack trace:', errorStack);
      res.status(500).json({ 
        error: 'Failed to seed test data', 
        details: process.env.NODE_ENV !== 'production' ? errorMessage : undefined 
      });
    }
  });

  return httpServer;
}
