import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";

// Types matching Supabase tables
export interface Club {
  id: string;
  name: string;
  logo_url?: string;
  join_code: string;
  contract_pdf_url?: string;
  waiver_content?: string;
  onboarding_complete: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'coach' | 'parent';
  club_id: string;
  has_signed_documents: boolean;
  created_at: string;
}

export interface ClubSignature {
  id: string;
  club_id: string;
  user_id: string;
  document_type: 'contract' | 'waiver';
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

// Platform fee constants
export const PLATFORM_FEES = {
  monthly: 1.00,
  clinic: 1.00,
  drop_in: 0.75,
} as const;

// Storage interface
export interface IStorage {
  // Auth & Clubs
  createClub(name: string, directorEmail: string, directorName: string, directorPassword: string): Promise<{ club: Club; user: User }>;
  getClubByJoinCode(joinCode: string): Promise<Club | undefined>;
  getClub(clubId: string): Promise<Club | undefined>;
  updateClubDocuments(clubId: string, contractPdfUrl: string | undefined, waiverContent: string): Promise<Club>;
  completeOnboarding(clubId: string): Promise<Club>;
  
  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(clubId: string, email: string, fullName: string, password: string, role: 'coach' | 'parent'): Promise<User>;
  updateUserSignedDocuments(userId: string): Promise<void>;
  
  // Signatures
  createSignature(clubId: string, userId: string, documentType: 'contract' | 'waiver', signedName: string, ipAddress?: string): Promise<ClubSignature>;
  getUserSignatures(clubId: string, userId: string): Promise<ClubSignature[]>;
  
  // Auth validation
  validateUserPassword(email: string, password: string): Promise<User | null>;

  // Programs
  getPrograms(clubId: string): Promise<Program[]>;
  getProgram(clubId: string, programId: string): Promise<Program | undefined>;
  createProgram(clubId: string, program: Omit<Program, 'id' | 'club_id' | 'created_at'>): Promise<Program>;
  deleteProgram(clubId: string, programId: string): Promise<void>;

  // Teams
  getTeams(clubId: string): Promise<Team[]>;
  getTeam(clubId: string, teamId: string): Promise<Team | undefined>;
  createTeam(clubId: string, team: Omit<Team, 'id' | 'club_id' | 'created_at'>): Promise<Team>;
  deleteTeam(clubId: string, teamId: string): Promise<void>;

  // Facilities
  getFacilities(clubId: string): Promise<Facility[]>;
  getFacility(clubId: string, facilityId: string): Promise<Facility | undefined>;
  createFacility(clubId: string, facility: Omit<Facility, 'id' | 'club_id' | 'created_at'>): Promise<Facility>;
  deleteFacility(clubId: string, facilityId: string): Promise<void>;

  // Athletes
  getAthletes(clubId: string): Promise<Athlete[]>;
  getAthlete(clubId: string, athleteId: string): Promise<Athlete | undefined>;
  getAthletesByParent(clubId: string, parentId: string): Promise<Athlete[]>;
  getUnassignedAthletes(clubId: string, programId: string): Promise<Athlete[]>;
  createAthlete(clubId: string, athlete: Omit<Athlete, 'id' | 'club_id' | 'is_locked' | 'created_at'>): Promise<Athlete>;
  updateAthletePaidThrough(clubId: string, athleteId: string, paidThroughDate: string): Promise<void>;

  // Roster
  assignAthleteToTeam(clubId: string, athleteId: string, teamId: string, programId: string): Promise<AthleteTeamRoster>;
  getTeamRoster(clubId: string, teamId: string): Promise<AthleteTeamRoster[]>;

  // Sessions
  getSessions(clubId: string): Promise<Session[]>;
  getSession(clubId: string, sessionId: string): Promise<Session | undefined>;
  getSessionsForAthlete(clubId: string, athleteId: string): Promise<Session[]>;
  createSession(clubId: string, session: Omit<Session, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<Session>;
  cancelSession(clubId: string, sessionId: string, reason: string): Promise<void>;
  checkSessionConflict(clubId: string, startTime: string, endTime: string, facilityId?: string, excludeId?: string): Promise<{ conflict: boolean; overlapMinutes: number; conflictingSession?: Session }>;
  
  // Athlete access checking
  getAthleteRosterEntries(clubId: string, athleteId: string): Promise<AthleteTeamRoster[]>;
  isAthleteRegisteredForProgram(clubId: string, athleteId: string, programId: string): Promise<boolean>;

  // Registrations
  getSessionRegistrations(clubId: string, sessionId: string): Promise<(Registration & { athlete: Athlete })[]>;
  createRegistration(clubId: string, sessionId: string, athleteId: string): Promise<Registration>;
  bulkCreateRegistrations(clubId: string, sessionId: string, athleteIds: string[]): Promise<Registration[]>;
  updateCheckIn(clubId: string, registrationId: string, checkedIn: boolean): Promise<void>;

  // Payments
  getPayments(clubId: string): Promise<Payment[]>;
  createPayment(clubId: string, payment: Omit<Payment, 'id' | 'club_id' | 'created_at'>): Promise<Payment>;
  createPlatformLedgerEntry(clubId: string, paymentId: string, amount: number, feeType: 'monthly' | 'clinic' | 'drop_in'): Promise<PlatformLedger>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private clubs: Map<string, Club> = new Map();
  private users: Map<string, User & { password: string }> = new Map();
  private signatures: Map<string, ClubSignature> = new Map();
  private programs: Map<string, Program> = new Map();
  private teams: Map<string, Team> = new Map();
  private facilities: Map<string, Facility> = new Map();
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
      { id: 'team-1', club_id: clubId, program_id: 'prog-1', name: 'Team Alpha', created_at: new Date().toISOString() },
      { id: 'team-2', club_id: clubId, program_id: 'prog-1', name: 'Team Beta', created_at: new Date().toISOString() },
      { id: 'team-3', club_id: clubId, program_id: 'prog-2', name: 'Elite Squad', created_at: new Date().toISOString() },
    ];
    teams.forEach(t => this.teams.set(t.id, t));

    // Seed athletes
    const athletes: Athlete[] = [
      { id: 'ath-1', club_id: clubId, parent_id: 'demo-parent-1', first_name: 'Emma', last_name: 'Wilson', date_of_birth: '2015-03-15', tags: ['U10', 'Soccer'], paid_through_date: '2026-02-15', is_locked: false, created_at: new Date().toISOString() },
      { id: 'ath-2', club_id: clubId, parent_id: 'demo-parent-1', first_name: 'Jake', last_name: 'Wilson', date_of_birth: '2017-07-22', tags: ['U8', 'Beginners'], paid_through_date: '2026-01-10', is_locked: false, created_at: new Date().toISOString() },
      { id: 'ath-3', club_id: clubId, parent_id: 'demo-parent-2', first_name: 'Sophia', last_name: 'Garcia', date_of_birth: '2014-11-08', tags: ['U12', 'Soccer'], paid_through_date: '2026-02-20', is_locked: false, created_at: new Date().toISOString() },
      { id: 'ath-4', club_id: clubId, parent_id: 'demo-parent-2', first_name: 'Liam', last_name: 'Martinez', date_of_birth: '2016-05-30', tags: ['U10', 'Soccer'], paid_through_date: '2026-01-05', is_locked: false, created_at: new Date().toISOString() },
    ];
    athletes.forEach(a => this.athletes.set(a.id, a));

    // Seed roster assignments
    const rosterItems: AthleteTeamRoster[] = [
      { id: 'roster-1', athlete_id: 'ath-1', team_id: 'team-1', program_id: 'prog-1', club_id: clubId, created_at: new Date().toISOString() },
      { id: 'roster-2', athlete_id: 'ath-3', team_id: 'team-1', program_id: 'prog-1', club_id: clubId, created_at: new Date().toISOString() },
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

  async getClubByJoinCode(joinCode: string): Promise<Club | undefined> {
    return Array.from(this.clubs.values()).find(c => c.join_code === joinCode.toUpperCase());
  }

  async getClub(clubId: string): Promise<Club | undefined> {
    return this.clubs.get(clubId);
  }

  async updateClubDocuments(clubId: string, contractPdfUrl: string | undefined, waiverContent: string): Promise<Club> {
    const club = this.clubs.get(clubId);
    if (!club) throw new Error('Club not found');
    club.contract_pdf_url = contractPdfUrl;
    club.waiver_content = waiverContent;
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

  async createUser(clubId: string, email: string, fullName: string, password: string, role: 'coach' | 'parent'): Promise<User> {
    const userId = randomUUID();
    const user: User & { password: string } = {
      id: userId,
      email,
      full_name: fullName,
      role,
      club_id: clubId,
      has_signed_documents: false,
      password,
      created_at: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    const { password: pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUserSignedDocuments(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.has_signed_documents = true;
      this.users.set(userId, user);
    }
  }

  // Signatures
  async createSignature(clubId: string, userId: string, documentType: 'contract' | 'waiver', signedName: string, ipAddress?: string): Promise<ClubSignature> {
    const signature: ClubSignature = {
      id: randomUUID(),
      club_id: clubId,
      user_id: userId,
      document_type: documentType,
      signed_name: signedName,
      signed_at: new Date().toISOString(),
      ip_address: ipAddress,
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

  async deleteTeam(clubId: string, teamId: string): Promise<void> {
    const team = this.teams.get(teamId);
    if (team?.club_id === clubId) {
      this.teams.delete(teamId);
    }
  }

  // Facilities
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

  async deleteFacility(clubId: string, facilityId: string): Promise<void> {
    const facility = this.facilities.get(facilityId);
    if (facility?.club_id === clubId) {
      this.facilities.delete(facilityId);
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

  async createAthlete(clubId: string, athlete: Omit<Athlete, 'id' | 'club_id' | 'is_locked' | 'created_at'>): Promise<Athlete> {
    const newAthlete: Athlete = {
      ...athlete,
      id: randomUUID(),
      club_id: clubId,
      is_locked: false,
      created_at: new Date().toISOString(),
    };
    this.athletes.set(newAthlete.id, newAthlete);
    return newAthlete;
  }

  async updateAthletePaidThrough(clubId: string, athleteId: string, paidThroughDate: string): Promise<void> {
    const athlete = this.athletes.get(athleteId);
    if (athlete?.club_id === clubId) {
      athlete.paid_through_date = paidThroughDate;
      athlete.is_locked = false;
      this.athletes.set(athleteId, athlete);
    }
  }

  // Roster
  async assignAthleteToTeam(clubId: string, athleteId: string, teamId: string, programId: string): Promise<AthleteTeamRoster> {
    const newRoster: AthleteTeamRoster = {
      id: randomUUID(),
      athlete_id: athleteId,
      team_id: teamId,
      program_id: programId,
      club_id: clubId,
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

  async checkSessionConflict(clubId: string, startTime: string, endTime: string, facilityId?: string, excludeId?: string): Promise<{ conflict: boolean; overlapMinutes: number; conflictingSession?: Session }> {
    const newStart = new Date(startTime).getTime();
    const newEnd = new Date(endTime).getTime();

    for (const session of this.sessions.values()) {
      if (session.club_id !== clubId || session.status === 'cancelled' || session.id === excludeId) {
        continue;
      }

      if (facilityId && session.facility_id !== facilityId) {
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
    const athleteTeamIds = new Set(rosterEntries.map(r => r.team_id));
    const athleteProgramIds = new Set(rosterEntries.map(r => r.program_id));

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

  async createPlatformLedgerEntry(clubId: string, paymentId: string, amount: number, feeType: 'monthly' | 'clinic' | 'drop_in'): Promise<PlatformLedger> {
    const entry: PlatformLedger = {
      id: randomUUID(),
      club_id: clubId,
      payment_id: paymentId,
      amount,
      fee_type: feeType,
      created_at: new Date().toISOString(),
    };
    this.ledger.set(entry.id, entry);
    return entry;
  }
}

export const storage = new MemStorage();
