import { eq, and } from 'drizzle-orm';
import { db } from './lib/db';
import {
  clubsTable, profilesTable, clubSignaturesTable, programsTable,
  teamsTable, athletesTable, athleteTeamRostersTable, facilitiesTable, courtsTable,
  sessionsTable, registrationsTable, paymentsTable, platformLedgerTable,
  programContractsTable, athleteContractsTable
} from '../shared/schema';
import type {
  Club, User, ClubSignature, Program, Team, Athlete, AthleteTeamRoster,
  Facility, Court, Session, Registration, Payment, PlatformLedger,
  ProgramContract, AthleteContract
} from './storage';
import type { IStorage } from './storage';
import { randomUUID } from 'crypto';

export class DatabaseStorage implements IStorage {
  
  private generateClubCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Club operations
  async getClub(clubId: string): Promise<Club | undefined> {
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId));
    if (!club) return undefined;
    return this.mapClub(club);
  }

  async getClubByJoinCode(joinCode: string): Promise<Club | undefined> {
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.join_code, joinCode.toUpperCase()));
    if (!club) return undefined;
    return this.mapClub(club);
  }

  async createClub(name: string, directorEmail: string, directorName: string, directorPassword: string): Promise<{ club: Club; user: User }> {
    const [club] = await db.insert(clubsTable).values({
      name,
      join_code: this.generateClubCode(),
      onboarding_complete: false,
    }).returning();

    const userId = randomUUID();
    const [user] = await db.insert(profilesTable).values({
      id: userId,
      email: directorEmail.toLowerCase(),
      full_name: directorName,
      role: 'admin',
      club_id: club.id,
      has_signed_documents: false,
    }).returning();

    return { club: this.mapClub(club), user: this.mapUser(user) };
  }

  async updateClubSettings(clubId: string, settings: { name?: string; address?: string; logo_url?: string }): Promise<Club> {
    const updateData: any = {};
    if (settings.name !== undefined) updateData.name = settings.name;
    if (settings.logo_url !== undefined) updateData.logo_url = settings.logo_url;
    if (settings.address !== undefined) updateData.address = settings.address;

    const [club] = await db.update(clubsTable)
      .set(updateData)
      .where(eq(clubsTable.id, clubId))
      .returning();
    return this.mapClub(club);
  }

  async updateClubDocuments(clubId: string, contractPdfUrl: string | undefined, waiverContent: string): Promise<Club> {
    const club = await this.getClub(clubId);
    const [updated] = await db.update(clubsTable)
      .set({
        contract_pdf_url: contractPdfUrl,
        waiver_content: waiverContent,
        waiver_version: (club?.waiver_version || 0) + 1,
      })
      .where(eq(clubsTable.id, clubId))
      .returning();
    return this.mapClub(updated);
  }

  async updateClubBillingCard(clubId: string, cardToken: string, lastFour: string, customerCode?: string): Promise<Club> {
    const [club] = await db.update(clubsTable)
      .set({
        billing_card_token: cardToken,
        billing_card_last_four: lastFour,
        billing_customer_code: customerCode,
      })
      .where(eq(clubsTable.id, clubId))
      .returning();
    return this.mapClub(club);
  }

  async completeOnboarding(clubId: string): Promise<Club> {
    const [club] = await db.update(clubsTable)
      .set({ onboarding_complete: true })
      .where(eq(clubsTable.id, clubId))
      .returning();
    return this.mapClub(club);
  }

  async regenerateClubCode(clubId: string): Promise<Club> {
    const newCode = this.generateClubCode();
    const [club] = await db.update(clubsTable)
      .set({ join_code: newCode })
      .where(eq(clubsTable.id, clubId))
      .returning();
    return this.mapClub(club);
  }

  async createClubOnly(name: string): Promise<Club> {
    const [club] = await db.insert(clubsTable).values({
      name,
      join_code: this.generateClubCode(),
      onboarding_complete: false,
    }).returning();
    return this.mapClub(club);
  }

  async deleteClub(clubId: string): Promise<void> {
    await db.delete(clubsTable).where(eq(clubsTable.id, clubId));
  }

  // User operations
  async getUser(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
    if (!user) return undefined;
    return this.mapUser(user);
  }

  async getUserById(userId: string): Promise<User | undefined> {
    return this.getUser(userId);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(profilesTable).where(eq(profilesTable.email, email.toLowerCase()));
    if (!user) return undefined;
    return this.mapUser(user);
  }

  async getCoaches(clubId: string): Promise<User[]> {
    const users = await db.select().from(profilesTable)
      .where(and(eq(profilesTable.club_id, clubId), eq(profilesTable.role, 'coach')));
    return users.map(u => this.mapUser(u));
  }

  async createUser(clubId: string, email: string, fullName: string, password: string, role: 'coach' | 'parent'): Promise<User> {
    const userId = randomUUID();
    const [user] = await db.insert(profilesTable).values({
      id: userId,
      email: email.toLowerCase(),
      full_name: fullName,
      role,
      club_id: clubId,
      has_signed_documents: false,
    }).returning();
    return this.mapUser(user);
  }

  async updateUserSignedDocuments(userId: string): Promise<void> {
    await db.update(profilesTable)
      .set({ has_signed_documents: true })
      .where(eq(profilesTable.id, userId));
  }

  // Signatures
  async createSignature(clubId: string, userId: string, documentType: 'contract' | 'waiver', documentVersion: number, signedName: string, ipAddress?: string): Promise<ClubSignature> {
    const [sig] = await db.insert(clubSignaturesTable).values({
      club_id: clubId,
      user_id: userId,
      document_type: documentType,
      document_version: documentVersion,
      signed_name: signedName,
      ip_address: ipAddress,
    }).returning();
    return this.mapSignature(sig);
  }

  async getUserSignatures(clubId: string, userId: string): Promise<ClubSignature[]> {
    const sigs = await db.select().from(clubSignaturesTable)
      .where(and(eq(clubSignaturesTable.club_id, clubId), eq(clubSignaturesTable.user_id, userId)));
    return sigs.map(s => this.mapSignature(s));
  }

  async hasSignedCurrentDocuments(clubId: string, userId: string): Promise<boolean> {
    const club = await this.getClub(clubId);
    if (!club) return false;
    
    const signatures = await this.getUserSignatures(clubId, userId);
    const waiverVersion = club.waiver_version || 1;
    
    return signatures.some(s => s.document_type === 'waiver' && s.document_version >= waiverVersion);
  }

  async validateUserPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    return user || null;
  }

  // Programs
  async getPrograms(clubId: string): Promise<Program[]> {
    const programs = await db.select().from(programsTable).where(eq(programsTable.club_id, clubId));
    return programs.map(p => this.mapProgram(p));
  }

  async getProgram(clubId: string, programId: string): Promise<Program | undefined> {
    const [program] = await db.select().from(programsTable)
      .where(and(eq(programsTable.club_id, clubId), eq(programsTable.id, programId)));
    if (!program) return undefined;
    return this.mapProgram(program);
  }

  async createProgram(clubId: string, program: Omit<Program, 'id' | 'club_id' | 'created_at'>): Promise<Program> {
    const [p] = await db.insert(programsTable).values({
      club_id: clubId,
      name: program.name,
      description: program.description,
      monthly_fee: String(program.monthly_fee),
    }).returning();
    return this.mapProgram(p);
  }

  async deleteProgram(clubId: string, programId: string): Promise<void> {
    await db.delete(programsTable)
      .where(and(eq(programsTable.club_id, clubId), eq(programsTable.id, programId)));
  }

  // Teams
  async getTeams(clubId: string): Promise<Team[]> {
    const teams = await db.select().from(teamsTable).where(eq(teamsTable.club_id, clubId));
    return teams.map(t => this.mapTeam(t));
  }

  async getTeamsByCoach(clubId: string, coachId: string): Promise<Team[]> {
    const teams = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.club_id, clubId), eq(teamsTable.coach_id, coachId)));
    return teams.map(t => this.mapTeam(t));
  }

  async getTeam(clubId: string, teamId: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teamsTable)
      .where(and(eq(teamsTable.club_id, clubId), eq(teamsTable.id, teamId)));
    if (!team) return undefined;
    return this.mapTeam(team);
  }

  async createTeam(clubId: string, team: Omit<Team, 'id' | 'club_id' | 'created_at'>): Promise<Team> {
    const [t] = await db.insert(teamsTable).values({
      club_id: clubId,
      program_id: team.program_id,
      coach_id: team.coach_id,
      name: team.name,
    }).returning();
    return this.mapTeam(t);
  }

  async updateTeam(clubId: string, teamId: string, data: { name?: string; coach_id?: string | null }): Promise<Team> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.coach_id !== undefined) updateData.coach_id = data.coach_id;
    
    const [team] = await db.update(teamsTable)
      .set(updateData)
      .where(and(eq(teamsTable.club_id, clubId), eq(teamsTable.id, teamId)))
      .returning();
    return this.mapTeam(team);
  }

  async deleteTeam(clubId: string, teamId: string): Promise<void> {
    await db.delete(teamsTable)
      .where(and(eq(teamsTable.club_id, clubId), eq(teamsTable.id, teamId)));
  }

  // Facilities
  async getFacilities(clubId: string): Promise<Facility[]> {
    const facilities = await db.select().from(facilitiesTable).where(eq(facilitiesTable.club_id, clubId));
    return facilities.map(f => this.mapFacility(f));
  }

  async getFacility(clubId: string, facilityId: string): Promise<Facility | undefined> {
    const [facility] = await db.select().from(facilitiesTable)
      .where(and(eq(facilitiesTable.club_id, clubId), eq(facilitiesTable.id, facilityId)));
    if (!facility) return undefined;
    return this.mapFacility(facility);
  }

  async createFacility(clubId: string, facility: Omit<Facility, 'id' | 'club_id' | 'created_at'>): Promise<Facility> {
    const [f] = await db.insert(facilitiesTable).values({
      club_id: clubId,
      name: facility.name,
      description: facility.description,
    }).returning();
    return this.mapFacility(f);
  }

  async updateFacility(clubId: string, facilityId: string, data: { name?: string; description?: string }): Promise<Facility> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const [facility] = await db.update(facilitiesTable)
      .set(updateData)
      .where(and(eq(facilitiesTable.club_id, clubId), eq(facilitiesTable.id, facilityId)))
      .returning();
    return this.mapFacility(facility);
  }

  async deleteFacility(clubId: string, facilityId: string): Promise<void> {
    await db.delete(facilitiesTable)
      .where(and(eq(facilitiesTable.club_id, clubId), eq(facilitiesTable.id, facilityId)));
  }

  // Courts
  async getCourts(clubId: string, facilityId?: string): Promise<Court[]> {
    if (facilityId) {
      const courts = await db.select().from(courtsTable)
        .where(and(eq(courtsTable.club_id, clubId), eq(courtsTable.facility_id, facilityId)));
      return courts.map(c => this.mapCourt(c));
    }
    const courts = await db.select().from(courtsTable).where(eq(courtsTable.club_id, clubId));
    return courts.map(c => this.mapCourt(c));
  }

  async getCourt(clubId: string, courtId: string): Promise<Court | undefined> {
    const [court] = await db.select().from(courtsTable)
      .where(and(eq(courtsTable.club_id, clubId), eq(courtsTable.id, courtId)));
    if (!court) return undefined;
    return this.mapCourt(court);
  }

  async createCourt(clubId: string, court: Omit<Court, 'id' | 'club_id' | 'created_at'>): Promise<Court> {
    const [c] = await db.insert(courtsTable).values({
      club_id: clubId,
      facility_id: court.facility_id,
      name: court.name,
      description: court.description,
    }).returning();
    return this.mapCourt(c);
  }

  async updateCourt(clubId: string, courtId: string, data: { name?: string; description?: string }): Promise<Court> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    const [court] = await db.update(courtsTable)
      .set(updateData)
      .where(and(eq(courtsTable.club_id, clubId), eq(courtsTable.id, courtId)))
      .returning();
    return this.mapCourt(court);
  }

  async deleteCourt(clubId: string, courtId: string): Promise<void> {
    await db.delete(courtsTable)
      .where(and(eq(courtsTable.club_id, clubId), eq(courtsTable.id, courtId)));
  }

  // Athletes
  async getAthletes(clubId: string): Promise<Athlete[]> {
    const athletes = await db.select().from(athletesTable).where(eq(athletesTable.club_id, clubId));
    return athletes.map(a => this.mapAthlete(a));
  }

  async getAthlete(clubId: string, athleteId: string): Promise<Athlete | undefined> {
    const [athlete] = await db.select().from(athletesTable)
      .where(and(eq(athletesTable.club_id, clubId), eq(athletesTable.id, athleteId)));
    if (!athlete) return undefined;
    return this.mapAthlete(athlete);
  }

  async getAthletesByParent(clubId: string, parentId: string): Promise<Athlete[]> {
    const athletes = await db.select().from(athletesTable)
      .where(and(eq(athletesTable.club_id, clubId), eq(athletesTable.parent_id, parentId)));
    return athletes.map(a => this.mapAthlete(a));
  }

  async getUnassignedAthletes(clubId: string, programId: string): Promise<Athlete[]> {
    const allAthletes = await this.getAthletes(clubId);
    const roster = await this.getRoster(clubId);
    const assignedIds = new Set(roster.filter(r => r.program_id === programId).map(r => r.athlete_id));
    return allAthletes.filter(a => !assignedIds.has(a.id));
  }

  async createAthlete(clubId: string, athlete: Omit<Athlete, 'id' | 'club_id' | 'is_locked' | 'created_at'>): Promise<Athlete> {
    const [a] = await db.insert(athletesTable).values({
      club_id: clubId,
      parent_id: athlete.parent_id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      date_of_birth: athlete.date_of_birth,
      graduation_year: athlete.graduation_year,
      tags: athlete.tags || [],
      paid_through_date: athlete.paid_through_date,
      is_locked: false,
    }).returning();
    return this.mapAthlete(a);
  }

  async updateAthletePaidThrough(clubId: string, athleteId: string, paidThroughDate: string): Promise<void> {
    await db.update(athletesTable)
      .set({ paid_through_date: paidThroughDate, is_locked: false })
      .where(and(eq(athletesTable.club_id, clubId), eq(athletesTable.id, athleteId)));
  }

  // Roster
  async assignAthleteToTeam(clubId: string, athleteId: string, teamId: string, programId: string): Promise<AthleteTeamRoster> {
    const [roster] = await db.insert(athleteTeamRostersTable).values({
      club_id: clubId,
      athlete_id: athleteId,
      team_id: teamId,
      program_id: programId,
      contract_signed: false,
    }).returning();
    return this.mapRoster(roster);
  }

  async getTeamRoster(clubId: string, teamId: string): Promise<AthleteTeamRoster[]> {
    const roster = await db.select().from(athleteTeamRostersTable)
      .where(and(eq(athleteTeamRostersTable.club_id, clubId), eq(athleteTeamRostersTable.team_id, teamId)));
    return roster.map(r => this.mapRoster(r));
  }

  async getRoster(clubId: string): Promise<AthleteTeamRoster[]> {
    const roster = await db.select().from(athleteTeamRostersTable)
      .where(eq(athleteTeamRostersTable.club_id, clubId));
    return roster.map(r => this.mapRoster(r));
  }

  async updateRosterContractStatus(clubId: string, rosterId: string, contractSigned: boolean): Promise<AthleteTeamRoster> {
    const [roster] = await db.update(athleteTeamRostersTable)
      .set({ contract_signed: contractSigned })
      .where(and(eq(athleteTeamRostersTable.club_id, clubId), eq(athleteTeamRostersTable.id, rosterId)))
      .returning();
    return this.mapRoster(roster);
  }

  async removeFromRoster(clubId: string, rosterId: string): Promise<void> {
    await db.delete(athleteTeamRostersTable)
      .where(and(eq(athleteTeamRostersTable.club_id, clubId), eq(athleteTeamRostersTable.id, rosterId)));
  }

  async getAthleteRosterEntries(clubId: string, athleteId: string): Promise<AthleteTeamRoster[]> {
    const roster = await db.select().from(athleteTeamRostersTable)
      .where(and(eq(athleteTeamRostersTable.club_id, clubId), eq(athleteTeamRostersTable.athlete_id, athleteId)));
    return roster.map(r => this.mapRoster(r));
  }

  async isAthleteRegisteredForProgram(clubId: string, athleteId: string, programId: string): Promise<boolean> {
    const entries = await this.getAthleteRosterEntries(clubId, athleteId);
    return entries.some(e => e.program_id === programId && e.contract_signed);
  }

  // Sessions
  async getSessions(clubId: string): Promise<Session[]> {
    const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.club_id, clubId));
    return sessions.map(s => this.mapSession(s));
  }

  async getSession(clubId: string, sessionId: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessionsTable)
      .where(and(eq(sessionsTable.club_id, clubId), eq(sessionsTable.id, sessionId)));
    if (!session) return undefined;
    return this.mapSession(session);
  }

  async getSessionsForAthlete(clubId: string, athleteId: string): Promise<Session[]> {
    const rosterEntries = await this.getAthleteRosterEntries(clubId, athleteId);
    const signedEntries = rosterEntries.filter(r => r.contract_signed);
    
    if (signedEntries.length === 0) return [];
    
    const programIds = Array.from(new Set(signedEntries.map(r => r.program_id)));
    const teamIds = Array.from(new Set(signedEntries.map(r => r.team_id)));
    
    const allSessions = await this.getSessions(clubId);
    
    return allSessions.filter(session => {
      if (session.status === 'cancelled') return false;
      if (!programIds.includes(session.program_id)) return false;
      if (session.team_id && !teamIds.includes(session.team_id)) return false;
      return true;
    });
  }

  async createSession(clubId: string, session: Omit<Session, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<Session> {
    const [s] = await db.insert(sessionsTable).values({
      club_id: clubId,
      team_id: session.team_id || null,
      program_id: session.program_id,
      facility_id: session.facility_id || null,
      court_id: session.court_id || null,
      title: session.title,
      description: session.description,
      session_type: session.session_type,
      start_time: new Date(session.start_time),
      end_time: new Date(session.end_time),
      location: session.location,
      capacity: session.capacity,
      drop_in_price: session.drop_in_price ? String(session.drop_in_price) : null,
      status: 'scheduled',
      recurrence_group_id: session.recurrence_group_id || null,
    }).returning();
    return this.mapSession(s);
  }

  async cancelSession(clubId: string, sessionId: string, reason: string): Promise<void> {
    await db.update(sessionsTable)
      .set({ status: 'cancelled', cancellation_reason: reason })
      .where(and(eq(sessionsTable.club_id, clubId), eq(sessionsTable.id, sessionId)));
  }

  async deleteSession(clubId: string, sessionId: string): Promise<void> {
    await db.delete(sessionsTable)
      .where(and(eq(sessionsTable.club_id, clubId), eq(sessionsTable.id, sessionId)));
  }

  async checkSessionConflict(clubId: string, startTime: string, endTime: string, facilityId?: string, courtId?: string, excludeId?: string): Promise<{ conflict: boolean; overlapMinutes: number; conflictingSession?: Session }> {
    const sessions = await this.getSessions(clubId);
    const start = new Date(startTime);
    const end = new Date(endTime);

    for (const session of sessions) {
      if (excludeId && session.id === excludeId) continue;
      if (session.status === 'cancelled') continue;
      
      // If court_id is specified, only check conflicts with sessions on the same court
      if (courtId) {
        if (session.court_id !== courtId) continue;
      } else if (facilityId) {
        // If only facility_id is specified, check conflicts with sessions at the same facility (any court or no court)
        if (session.facility_id !== facilityId) continue;
      } else {
        // No facility or court specified - skip conflict check
        continue;
      }

      const sessionStart = new Date(session.start_time);
      const sessionEnd = new Date(session.end_time);

      if (start < sessionEnd && end > sessionStart) {
        const overlapStart = Math.max(start.getTime(), sessionStart.getTime());
        const overlapEnd = Math.min(end.getTime(), sessionEnd.getTime());
        const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

        return { conflict: true, overlapMinutes, conflictingSession: session };
      }
    }

    return { conflict: false, overlapMinutes: 0 };
  }

  // Registrations
  async getSessionRegistrations(clubId: string, sessionId: string): Promise<(Registration & { athlete: Athlete })[]> {
    const registrations = await db.select().from(registrationsTable)
      .where(and(eq(registrationsTable.club_id, clubId), eq(registrationsTable.session_id, sessionId)));
    
    const result: (Registration & { athlete: Athlete })[] = [];
    for (const reg of registrations) {
      const athlete = await this.getAthlete(clubId, reg.athlete_id);
      if (athlete) {
        result.push({ ...this.mapRegistration(reg), athlete });
      }
    }
    return result;
  }

  async getAthleteRegistrations(clubId: string, athleteId: string): Promise<(Registration & { session: Session })[]> {
    const registrations = await db.select().from(registrationsTable)
      .where(and(eq(registrationsTable.club_id, clubId), eq(registrationsTable.athlete_id, athleteId)));
    
    const result: (Registration & { session: Session })[] = [];
    for (const reg of registrations) {
      const session = await this.getSession(clubId, reg.session_id);
      if (session) {
        result.push({ ...this.mapRegistration(reg), session });
      }
    }
    return result;
  }

  async createRegistration(clubId: string, sessionId: string, athleteId: string): Promise<Registration> {
    const [reg] = await db.insert(registrationsTable).values({
      club_id: clubId,
      session_id: sessionId,
      athlete_id: athleteId,
      checked_in: false,
    }).returning();
    return this.mapRegistration(reg);
  }

  async bulkCreateRegistrations(clubId: string, sessionId: string, athleteIds: string[]): Promise<Registration[]> {
    const values = athleteIds.map(athleteId => ({
      club_id: clubId,
      session_id: sessionId,
      athlete_id: athleteId,
      checked_in: false,
    }));
    const regs = await db.insert(registrationsTable).values(values).returning();
    return regs.map(r => this.mapRegistration(r));
  }

  async updateCheckIn(clubId: string, registrationId: string, checkedIn: boolean): Promise<void> {
    await db.update(registrationsTable)
      .set({ checked_in: checkedIn, check_in_time: checkedIn ? new Date() : null })
      .where(and(eq(registrationsTable.club_id, clubId), eq(registrationsTable.id, registrationId)));
  }

  // Payments
  async getPayments(clubId: string): Promise<Payment[]> {
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.club_id, clubId));
    return payments.map(p => this.mapPayment(p));
  }

  async createPayment(clubId: string, payment: Omit<Payment, 'id' | 'club_id' | 'created_at'>): Promise<Payment> {
    const [p] = await db.insert(paymentsTable).values({
      club_id: clubId,
      athlete_id: payment.athlete_id,
      amount: String(payment.amount),
      payment_type: payment.payment_type,
      payment_method: payment.payment_method,
      helcim_transaction_id: payment.helcim_transaction_id,
      months_paid: payment.months_paid,
      status: payment.status,
    }).returning();
    return this.mapPayment(p);
  }

  async createPlatformLedgerEntry(clubId: string, paymentId: string, amount: number, feeType: 'monthly' | 'clinic' | 'drop_in'): Promise<PlatformLedger> {
    const [entry] = await db.insert(platformLedgerTable).values({
      club_id: clubId,
      payment_id: paymentId,
      amount: String(amount),
      fee_type: feeType,
    }).returning();
    return this.mapLedger(entry);
  }

  // Mapping helpers
  private mapClub(c: any): Club {
    return {
      id: c.id,
      name: c.name,
      logo_url: c.logo_url ?? undefined,
      address: c.address ?? undefined,
      join_code: c.join_code,
      contract_pdf_url: c.contract_pdf_url ?? undefined,
      waiver_content: c.waiver_content ?? undefined,
      waiver_version: c.waiver_version ?? undefined,
      contract_version: c.contract_version ?? undefined,
      onboarding_complete: c.onboarding_complete,
      billing_card_token: c.billing_card_token ?? undefined,
      billing_card_last_four: c.billing_card_last_four ?? undefined,
      billing_customer_code: c.billing_customer_code ?? undefined,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
    };
  }

  private mapUser(u: any): User {
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      club_id: u.club_id,
      has_signed_documents: u.has_signed_documents,
      created_at: u.created_at?.toISOString?.() ?? u.created_at,
    };
  }

  private mapSignature(s: any): ClubSignature {
    return {
      id: s.id,
      club_id: s.club_id,
      user_id: s.user_id,
      document_type: s.document_type,
      document_version: s.document_version,
      signed_name: s.signed_name,
      signed_at: s.signed_at?.toISOString?.() ?? s.signed_at,
      ip_address: s.ip_address ?? undefined,
      created_at: s.created_at?.toISOString?.() ?? s.created_at,
    };
  }

  private mapProgram(p: any): Program {
    return {
      id: p.id,
      club_id: p.club_id,
      name: p.name,
      description: p.description ?? undefined,
      monthly_fee: parseFloat(p.monthly_fee),
      created_at: p.created_at?.toISOString?.() ?? p.created_at,
    };
  }

  private mapTeam(t: any): Team {
    return {
      id: t.id,
      club_id: t.club_id,
      program_id: t.program_id,
      coach_id: t.coach_id ?? null,
      name: t.name,
      created_at: t.created_at?.toISOString?.() ?? t.created_at,
    };
  }

  private mapAthlete(a: any): Athlete {
    return {
      id: a.id,
      club_id: a.club_id,
      parent_id: a.parent_id,
      first_name: a.first_name,
      last_name: a.last_name,
      date_of_birth: a.date_of_birth,
      graduation_year: a.graduation_year,
      tags: a.tags || [],
      paid_through_date: a.paid_through_date ?? undefined,
      is_locked: a.is_locked,
      created_at: a.created_at?.toISOString?.() ?? a.created_at,
    };
  }

  private mapRoster(r: any): AthleteTeamRoster {
    return {
      id: r.id,
      athlete_id: r.athlete_id,
      team_id: r.team_id,
      program_id: r.program_id,
      club_id: r.club_id,
      contract_signed: r.contract_signed,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    };
  }

  private mapFacility(f: any): Facility {
    return {
      id: f.id,
      club_id: f.club_id,
      name: f.name,
      description: f.description ?? undefined,
      created_at: f.created_at?.toISOString?.() ?? f.created_at,
    };
  }

  private mapCourt(c: any): Court {
    return {
      id: c.id,
      club_id: c.club_id,
      facility_id: c.facility_id,
      name: c.name,
      description: c.description ?? undefined,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
    };
  }

  private mapSession(s: any): Session {
    return {
      id: s.id,
      club_id: s.club_id,
      team_id: s.team_id ?? undefined,
      program_id: s.program_id,
      facility_id: s.facility_id ?? undefined,
      court_id: s.court_id ?? undefined,
      title: s.title,
      description: s.description ?? undefined,
      session_type: s.session_type,
      start_time: s.start_time?.toISOString?.() ?? s.start_time,
      end_time: s.end_time?.toISOString?.() ?? s.end_time,
      location: s.location ?? undefined,
      capacity: s.capacity ?? undefined,
      drop_in_price: s.drop_in_price ? parseFloat(s.drop_in_price) : undefined,
      status: s.status,
      cancellation_reason: s.cancellation_reason ?? undefined,
      recurrence_group_id: s.recurrence_group_id ?? undefined,
      created_at: s.created_at?.toISOString?.() ?? s.created_at,
    };
  }

  private mapRegistration(r: any): Registration {
    return {
      id: r.id,
      club_id: r.club_id,
      session_id: r.session_id,
      athlete_id: r.athlete_id,
      checked_in: r.checked_in,
      check_in_time: r.check_in_time?.toISOString?.() ?? r.check_in_time ?? undefined,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    };
  }

  private mapPayment(p: any): Payment {
    return {
      id: p.id,
      club_id: p.club_id,
      athlete_id: p.athlete_id,
      amount: parseFloat(p.amount),
      payment_type: p.payment_type,
      payment_method: p.payment_method,
      helcim_transaction_id: p.helcim_transaction_id ?? undefined,
      months_paid: p.months_paid ?? undefined,
      status: p.status,
      created_at: p.created_at?.toISOString?.() ?? p.created_at,
    };
  }

  private mapLedger(l: any): PlatformLedger {
    return {
      id: l.id,
      club_id: l.club_id,
      payment_id: l.payment_id,
      amount: parseFloat(l.amount),
      fee_type: l.fee_type,
      created_at: l.created_at?.toISOString?.() ?? l.created_at,
    };
  }

  // Program Contracts
  async getProgramContracts(clubId: string, programId?: string): Promise<ProgramContract[]> {
    if (programId) {
      const contracts = await db.select().from(programContractsTable)
        .where(and(eq(programContractsTable.club_id, clubId), eq(programContractsTable.program_id, programId)));
      return contracts.map(c => this.mapProgramContract(c));
    }
    const contracts = await db.select().from(programContractsTable)
      .where(eq(programContractsTable.club_id, clubId));
    return contracts.map(c => this.mapProgramContract(c));
  }

  async getProgramContract(clubId: string, contractId: string): Promise<ProgramContract | undefined> {
    const [contract] = await db.select().from(programContractsTable)
      .where(and(eq(programContractsTable.club_id, clubId), eq(programContractsTable.id, contractId)));
    if (!contract) return undefined;
    return this.mapProgramContract(contract);
  }

  async createProgramContract(clubId: string, contract: Omit<ProgramContract, 'id' | 'club_id' | 'is_active' | 'created_at'>): Promise<ProgramContract> {
    const [c] = await db.insert(programContractsTable).values({
      club_id: clubId,
      program_id: contract.program_id,
      name: contract.name,
      description: contract.description,
      monthly_price: String(contract.monthly_price),
      sessions_per_week: contract.sessions_per_week,
      is_active: true,
    }).returning();
    return this.mapProgramContract(c);
  }

  async updateProgramContract(clubId: string, contractId: string, data: { name?: string; description?: string; monthly_price?: number; sessions_per_week?: number; is_active?: boolean }): Promise<ProgramContract> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.monthly_price !== undefined) updateData.monthly_price = String(data.monthly_price);
    if (data.sessions_per_week !== undefined) updateData.sessions_per_week = data.sessions_per_week;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const [c] = await db.update(programContractsTable)
      .set(updateData)
      .where(and(eq(programContractsTable.club_id, clubId), eq(programContractsTable.id, contractId)))
      .returning();
    return this.mapProgramContract(c);
  }

  async deleteProgramContract(clubId: string, contractId: string): Promise<void> {
    await db.delete(programContractsTable)
      .where(and(eq(programContractsTable.club_id, clubId), eq(programContractsTable.id, contractId)));
  }

  // Athlete Contracts
  async getAthleteContracts(clubId: string, athleteId?: string): Promise<AthleteContract[]> {
    if (athleteId) {
      const contracts = await db.select().from(athleteContractsTable)
        .where(and(eq(athleteContractsTable.club_id, clubId), eq(athleteContractsTable.athlete_id, athleteId)));
      return contracts.map(c => this.mapAthleteContract(c));
    }
    const contracts = await db.select().from(athleteContractsTable)
      .where(eq(athleteContractsTable.club_id, clubId));
    return contracts.map(c => this.mapAthleteContract(c));
  }

  async getAthleteContract(clubId: string, contractId: string): Promise<AthleteContract | undefined> {
    const [contract] = await db.select().from(athleteContractsTable)
      .where(and(eq(athleteContractsTable.club_id, clubId), eq(athleteContractsTable.id, contractId)));
    if (!contract) return undefined;
    return this.mapAthleteContract(contract);
  }

  async createAthleteContract(clubId: string, contract: Omit<AthleteContract, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<AthleteContract> {
    const [c] = await db.insert(athleteContractsTable).values({
      club_id: clubId,
      athlete_id: contract.athlete_id,
      program_contract_id: contract.program_contract_id,
      start_date: contract.start_date,
      end_date: contract.end_date,
      status: 'active',
    }).returning();
    return this.mapAthleteContract(c);
  }

  async updateAthleteContractStatus(clubId: string, contractId: string, status: 'active' | 'cancelled' | 'expired'): Promise<AthleteContract> {
    const [c] = await db.update(athleteContractsTable)
      .set({ status })
      .where(and(eq(athleteContractsTable.club_id, clubId), eq(athleteContractsTable.id, contractId)))
      .returning();
    return this.mapAthleteContract(c);
  }

  private mapProgramContract(c: any): ProgramContract {
    return {
      id: c.id,
      club_id: c.club_id,
      program_id: c.program_id,
      name: c.name,
      description: c.description ?? undefined,
      monthly_price: parseFloat(c.monthly_price),
      sessions_per_week: c.sessions_per_week,
      is_active: c.is_active,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
    };
  }

  private mapAthleteContract(c: any): AthleteContract {
    return {
      id: c.id,
      club_id: c.club_id,
      athlete_id: c.athlete_id,
      program_contract_id: c.program_contract_id,
      start_date: c.start_date,
      end_date: c.end_date ?? undefined,
      status: c.status,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
    };
  }
}

export const dbStorage = new DatabaseStorage();
