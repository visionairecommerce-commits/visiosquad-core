import { eq, and, isNull } from 'drizzle-orm';
import { db } from './lib/db';
import { supabase } from './lib/supabase';
import {
  clubsTable, profilesTable, clubSignaturesTable, programsTable,
  teamsTable, athletesTable, athleteTeamRostersTable, facilitiesTable, courtsTable,
  sessionsTable, registrationsTable, paymentsTable, platformLedgerTable,
  programContractsTable, athleteContractsTable, eventsTable, eventRostersTable, eventCoachesTable,
  clubFormsTable, clubFormViewsTable,
  chatChannelsTable, channelParticipantsTable, messagesTable,
  bulletinPostsTable, bulletinReadsTable, pushSubscriptionsTable
} from '../shared/schema';
import type {
  Club, User, ClubSignature, Program, Team, Athlete, AthleteTeamRoster,
  Facility, Court, Session, Registration, Payment, PlatformLedger,
  ProgramContract, AthleteContract, Event, EventRoster, EventCoach, ClubForm, ClubFormView,
  ChatChannel, ChannelParticipant, Message, BulletinPost, BulletinRead,
  PushSubscription as PushSub
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
        billing_method: 'card',
      })
      .where(eq(clubsTable.id, clubId))
      .returning();
    return this.mapClub(club);
  }

  async updateClubBillingBank(clubId: string, bankToken: string, lastFour: string): Promise<Club> {
    const [club] = await db.update(clubsTable)
      .set({
        billing_bank_token: bankToken,
        billing_bank_last_four: lastFour,
        billing_method: 'bank',
      })
      .where(eq(clubsTable.id, clubId))
      .returning();
    return this.mapClub(club);
  }

  async updateClubContractSettings(clubId: string, contractUrl: string | undefined, contractInstructions: string | undefined): Promise<Club> {
    const [club] = await db.update(clubsTable)
      .set({
        contract_url: contractUrl,
        contract_instructions: contractInstructions,
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

  async getParents(clubId: string): Promise<User[]> {
    const users = await db.select().from(profilesTable)
      .where(and(eq(profilesTable.club_id, clubId), eq(profilesTable.role, 'parent')));
    return users.map(u => this.mapUser(u));
  }

  async getUser(userId: string): Promise<User | null> {
    const [user] = await db.select().from(profilesTable)
      .where(eq(profilesTable.id, userId));
    if (!user) return null;
    return this.mapUser(user);
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

  async createProfile(profile: { id: string; email: string; full_name: string; role: 'athlete'; club_id: string; athlete_id: string }): Promise<void> {
    await db.insert(profilesTable).values({
      id: profile.id,
      email: profile.email.toLowerCase(),
      full_name: profile.full_name,
      role: profile.role,
      club_id: profile.club_id,
      athlete_id: profile.athlete_id,
      has_signed_documents: true, // Athletes don't need to sign docs
    });
  }

  async updateUserSignedDocuments(userId: string): Promise<void> {
    await db.update(profilesTable)
      .set({ has_signed_documents: true })
      .where(eq(profilesTable.id, userId));
  }

  async updateUserBillingPermission(userId: string, canBill: boolean): Promise<User | null> {
    const [updated] = await db.update(profilesTable)
      .set({ can_bill: canBill })
      .where(eq(profilesTable.id, userId))
      .returning();
    if (!updated) return null;
    return this.mapUser(updated);
  }

  async updateUserContractStatus(userId: string, status: 'unsigned' | 'pending' | 'verified', method?: 'digital' | 'paper'): Promise<User | null> {
    const updateData: any = { contract_status: status };
    if (method) updateData.contract_method = method;
    
    const [updated] = await db.update(profilesTable)
      .set(updateData)
      .where(eq(profilesTable.id, userId))
      .returning();
    if (!updated) return null;
    return this.mapUser(updated);
  }

  async getUsersWithContractStatus(clubId: string): Promise<User[]> {
    const users = await db.select().from(profilesTable)
      .where(and(eq(profilesTable.club_id, clubId), eq(profilesTable.role, 'parent')));
    return users.map(u => this.mapUser(u));
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

  // Club Forms (Google Forms links)
  async getClubForms(clubId: string): Promise<ClubForm[]> {
    const forms = await db.select().from(clubFormsTable).where(eq(clubFormsTable.club_id, clubId));
    return forms.map(f => this.mapClubForm(f));
  }

  async getClubForm(clubId: string, formId: string): Promise<ClubForm | undefined> {
    const [form] = await db.select().from(clubFormsTable)
      .where(and(eq(clubFormsTable.club_id, clubId), eq(clubFormsTable.id, formId)));
    if (!form) return undefined;
    return this.mapClubForm(form);
  }

  async createClubForm(clubId: string, form: Omit<ClubForm, 'id' | 'club_id' | 'is_active' | 'created_at'>): Promise<ClubForm> {
    const [f] = await db.insert(clubFormsTable).values({
      club_id: clubId,
      name: form.name,
      url: form.url,
      description: form.description,
      program_id: form.program_id || null,
      team_id: form.team_id || null,
      is_active: true,
    }).returning();
    return this.mapClubForm(f);
  }

  async updateClubForm(clubId: string, formId: string, data: { name?: string; url?: string; description?: string; program_id?: string | null; team_id?: string | null; is_active?: boolean }): Promise<ClubForm> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.program_id !== undefined) updateData.program_id = data.program_id;
    if (data.team_id !== undefined) updateData.team_id = data.team_id;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const [form] = await db.update(clubFormsTable)
      .set(updateData)
      .where(and(eq(clubFormsTable.club_id, clubId), eq(clubFormsTable.id, formId)))
      .returning();
    return this.mapClubForm(form);
  }

  async deleteClubForm(clubId: string, formId: string): Promise<void> {
    // First delete any form views associated with this form
    await db.delete(clubFormViewsTable)
      .where(and(eq(clubFormViewsTable.club_id, clubId), eq(clubFormViewsTable.form_id, formId)));
    await db.delete(clubFormsTable)
      .where(and(eq(clubFormsTable.club_id, clubId), eq(clubFormsTable.id, formId)));
  }

  private mapClubForm(f: any): ClubForm {
    return {
      id: f.id,
      club_id: f.club_id,
      name: f.name,
      url: f.url,
      description: f.description ?? undefined,
      program_id: f.program_id ?? undefined,
      team_id: f.team_id ?? undefined,
      is_active: f.is_active,
      created_at: f.created_at?.toISOString?.() ?? f.created_at,
    };
  }

  // Club Form Views
  async getFormViewsByUser(clubId: string, userId: string): Promise<ClubFormView[]> {
    const views = await db.select().from(clubFormViewsTable)
      .where(and(eq(clubFormViewsTable.club_id, clubId), eq(clubFormViewsTable.user_id, userId)));
    return views.map(v => ({
      id: v.id,
      club_id: v.club_id,
      form_id: v.form_id,
      user_id: v.user_id,
      viewed_at: v.viewed_at?.toISOString?.() ?? v.viewed_at as any,
    }));
  }

  async markFormAsViewed(clubId: string, formId: string, userId: string): Promise<ClubFormView> {
    // Check if already viewed
    const [existing] = await db.select().from(clubFormViewsTable)
      .where(and(
        eq(clubFormViewsTable.club_id, clubId),
        eq(clubFormViewsTable.form_id, formId),
        eq(clubFormViewsTable.user_id, userId)
      ));
    
    if (existing) {
      return {
        id: existing.id,
        club_id: existing.club_id,
        form_id: existing.form_id,
        user_id: existing.user_id,
        viewed_at: existing.viewed_at?.toISOString?.() ?? existing.viewed_at as any,
      };
    }

    const [view] = await db.insert(clubFormViewsTable).values({
      club_id: clubId,
      form_id: formId,
      user_id: userId,
    }).returning();
    
    return {
      id: view.id,
      club_id: view.club_id,
      form_id: view.form_id,
      user_id: view.user_id,
      viewed_at: view.viewed_at?.toISOString?.() ?? view.viewed_at as any,
    };
  }

  async getFormsForAthlete(clubId: string, athleteId: string, userId: string): Promise<(ClubForm & { viewed: boolean })[]> {
    // Get athlete's roster memberships to determine which programs/teams they're in
    const rosters = await db.select().from(athleteTeamRostersTable)
      .where(and(eq(athleteTeamRostersTable.club_id, clubId), eq(athleteTeamRostersTable.athlete_id, athleteId)));
    
    const programIds = [...new Set(rosters.map(r => r.program_id))];
    const teamIds = [...new Set(rosters.filter(r => r.team_id).map(r => r.team_id))];
    
    // Get all active forms for this club
    const allForms = await db.select().from(clubFormsTable)
      .where(and(eq(clubFormsTable.club_id, clubId), eq(clubFormsTable.is_active, true)));
    
    // Get user's form views
    const views = await db.select().from(clubFormViewsTable)
      .where(and(eq(clubFormViewsTable.club_id, clubId), eq(clubFormViewsTable.user_id, userId)));
    const viewedFormIds = new Set(views.map(v => v.form_id));
    
    // Filter forms based on program/team targeting
    const relevantForms = allForms.filter(form => {
      // If no program or team specified, form is visible to everyone
      if (!form.program_id && !form.team_id) return true;
      
      // If team is specified, check if athlete is on that team
      if (form.team_id && teamIds.includes(form.team_id)) return true;
      
      // If only program is specified (no team), check if athlete is in that program
      if (form.program_id && !form.team_id && programIds.includes(form.program_id)) return true;
      
      return false;
    });
    
    return relevantForms.map(f => ({
      ...this.mapClubForm(f),
      viewed: viewedFormIds.has(f.id),
    }));
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

  async createAthlete(clubId: string, athlete: Omit<Athlete, 'id' | 'club_id' | 'is_locked' | 'is_released' | 'has_login' | 'created_at'>): Promise<Athlete> {
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
      is_released: false,
      has_login: false,
    }).returning();
    return this.mapAthlete(a);
  }

  async updateAthlete(athleteId: string, updates: Partial<Pick<Athlete, 'email' | 'has_login'>>): Promise<void> {
    await db.update(athletesTable)
      .set(updates)
      .where(eq(athletesTable.id, athleteId));
  }

  async updateAthletePaidThrough(clubId: string, athleteId: string, paidThroughDate: string): Promise<void> {
    await db.update(athletesTable)
      .set({ paid_through_date: paidThroughDate, is_locked: false })
      .where(and(eq(athletesTable.club_id, clubId), eq(athletesTable.id, athleteId)));
  }

  async releaseAthlete(clubId: string, athleteId: string, releasedBy: string | null, releaseType: 'manual' | 'automated' = 'manual'): Promise<{ contractIds: string[] }> {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Update athlete release status
    await db.update(athletesTable)
      .set({ 
        is_released: true, 
        released_at: new Date(),
        released_by: releasedBy 
      })
      .where(and(eq(athletesTable.club_id, clubId), eq(athletesTable.id, athleteId)));
    
    // 2. Get all active contracts for this athlete
    const activeContracts = await db.select({ id: athleteContractsTable.id })
      .from(athleteContractsTable)
      .where(and(
        eq(athleteContractsTable.athlete_id, athleteId),
        eq(athleteContractsTable.status, 'active')
      ));
    
    const contractIds = activeContracts.map(c => c.id);
    
    // 3. Update all active contracts: set end_date to today and status to expired
    if (contractIds.length > 0) {
      await db.update(athleteContractsTable)
        .set({ 
          end_date: today,
          status: 'expired'
        })
        .where(and(
          eq(athleteContractsTable.athlete_id, athleteId),
          eq(athleteContractsTable.status, 'active')
        ));
    }
    
    return { contractIds };
  }

  async revokeAthleteRelease(clubId: string, athleteId: string): Promise<void> {
    await db.update(athletesTable)
      .set({ 
        is_released: false, 
        released_at: null,
        released_by: null 
      })
      .where(and(eq(athletesTable.club_id, clubId), eq(athletesTable.id, athleteId)));
  }

  async getAthletesByParentAcrossClubs(parentId: string): Promise<Athlete[]> {
    const athletes = await db.select().from(athletesTable)
      .where(eq(athletesTable.parent_id, parentId));
    return athletes.map(a => this.mapAthlete(a));
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

  async assignAthleteToProgram(clubId: string, athleteId: string, programId: string, contractSigned: boolean = false): Promise<AthleteTeamRoster> {
    // Check if already enrolled in program (without a team)
    const existing = await db.select().from(athleteTeamRostersTable)
      .where(and(
        eq(athleteTeamRostersTable.club_id, clubId),
        eq(athleteTeamRostersTable.athlete_id, athleteId),
        eq(athleteTeamRostersTable.program_id, programId),
        isNull(athleteTeamRostersTable.team_id)
      ));
    
    if (existing.length > 0) {
      // Update contract_signed status if needed
      if (contractSigned && !existing[0].contract_signed) {
        const [updated] = await db.update(athleteTeamRostersTable)
          .set({ contract_signed: true })
          .where(eq(athleteTeamRostersTable.id, existing[0].id))
          .returning();
        return this.mapRoster(updated);
      }
      return this.mapRoster(existing[0]);
    }
    
    const [roster] = await db.insert(athleteTeamRostersTable).values({
      club_id: clubId,
      athlete_id: athleteId,
      team_id: null,
      program_id: programId,
      contract_signed: contractSigned,
    }).returning();
    return this.mapRoster(roster);
  }

  async getTeamRoster(clubId: string, teamId: string): Promise<AthleteTeamRoster[]> {
    const roster = await db.select().from(athleteTeamRostersTable)
      .where(and(eq(athleteTeamRostersTable.club_id, clubId), eq(athleteTeamRostersTable.team_id, teamId)));
    return roster.map(r => this.mapRoster(r));
  }

  async getProgramRoster(clubId: string, programId: string): Promise<AthleteTeamRoster[]> {
    const roster = await db.select().from(athleteTeamRostersTable)
      .where(and(eq(athleteTeamRostersTable.club_id, clubId), eq(athleteTeamRostersTable.program_id, programId)));
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
      contract_url: c.contract_url ?? undefined,
      contract_instructions: c.contract_instructions ?? undefined,
      onboarding_complete: c.onboarding_complete,
      billing_card_token: c.billing_card_token ?? undefined,
      billing_card_last_four: c.billing_card_last_four ?? undefined,
      billing_customer_code: c.billing_customer_code ?? undefined,
      billing_bank_token: c.billing_bank_token ?? undefined,
      billing_bank_last_four: c.billing_bank_last_four ?? undefined,
      billing_method: c.billing_method ?? undefined,
      coaches_can_bill: c.coaches_can_bill ?? false,
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
      can_bill: u.can_bill ?? false,
      contract_status: u.contract_status ?? 'unsigned',
      contract_method: u.contract_method ?? undefined,
      athlete_id: u.athlete_id ?? undefined,
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
      is_released: a.is_released ?? false,
      released_at: a.released_at?.toISOString?.() ?? a.released_at ?? undefined,
      released_by: a.released_by ?? undefined,
      email: a.email ?? undefined,
      has_login: a.has_login ?? false,
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
      team_id: contract.team_id || null,
      name: contract.name,
      description: contract.description,
      monthly_price: String(contract.monthly_price),
      paid_in_full_price: contract.paid_in_full_price ? String(contract.paid_in_full_price) : null,
      initiation_fee: contract.initiation_fee ? String(contract.initiation_fee) : null,
      sessions_per_week: contract.sessions_per_week,
      contract_document_url: contract.contract_document_url || null,
      is_active: true,
    }).returning();
    return this.mapProgramContract(c);
  }

  async updateProgramContract(clubId: string, contractId: string, data: { name?: string; description?: string; monthly_price?: number; paid_in_full_price?: number | null; initiation_fee?: number | null; sessions_per_week?: number; team_id?: string | null; contract_document_url?: string | null; is_active?: boolean }): Promise<ProgramContract> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.monthly_price !== undefined) updateData.monthly_price = String(data.monthly_price);
    if (data.paid_in_full_price !== undefined) updateData.paid_in_full_price = data.paid_in_full_price ? String(data.paid_in_full_price) : null;
    if (data.initiation_fee !== undefined) updateData.initiation_fee = data.initiation_fee ? String(data.initiation_fee) : null;
    if (data.sessions_per_week !== undefined) updateData.sessions_per_week = data.sessions_per_week;
    if (data.team_id !== undefined) updateData.team_id = data.team_id;
    if (data.contract_document_url !== undefined) updateData.contract_document_url = data.contract_document_url;
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

  async createAthleteContract(clubId: string, contract: Omit<AthleteContract, 'id' | 'club_id' | 'status' | 'created_at' | 'initiation_fee_paid'>): Promise<AthleteContract> {
    const [c] = await db.insert(athleteContractsTable).values({
      club_id: clubId,
      athlete_id: contract.athlete_id,
      program_contract_id: contract.program_contract_id,
      start_date: contract.start_date,
      end_date: contract.end_date,
      custom_price: contract.custom_price ? String(contract.custom_price) : null,
      payment_plan: contract.payment_plan || 'monthly',
      signed_name: contract.signed_name || null,
      signed_at: contract.signed_name ? new Date() : null,
      initiation_fee_paid: false,
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
      team_id: c.team_id ?? undefined,
      name: c.name,
      description: c.description ?? undefined,
      monthly_price: parseFloat(c.monthly_price),
      paid_in_full_price: c.paid_in_full_price ? parseFloat(c.paid_in_full_price) : undefined,
      initiation_fee: c.initiation_fee ? parseFloat(c.initiation_fee) : undefined,
      sessions_per_week: c.sessions_per_week,
      contract_document_url: c.contract_document_url ?? undefined,
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
      custom_price: c.custom_price ? parseFloat(c.custom_price) : undefined,
      payment_plan: c.payment_plan || 'monthly',
      signed_name: c.signed_name ?? undefined,
      signed_at: c.signed_at?.toISOString?.() ?? c.signed_at ?? undefined,
      initiation_fee_paid: c.initiation_fee_paid ?? false,
      status: c.status,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
    };
  }

  // Event methods
  async getEvents(clubId: string, filters?: { programId?: string; teamId?: string }): Promise<Event[]> {
    let query = db.select().from(eventsTable).where(eq(eventsTable.club_id, clubId));
    const events = await query;
    let result = events.map(e => this.mapEvent(e));
    if (filters?.programId) {
      result = result.filter(e => e.program_id === filters.programId);
    }
    if (filters?.teamId) {
      result = result.filter(e => e.team_id === filters.teamId);
    }
    return result;
  }

  async getEvent(clubId: string, eventId: string): Promise<Event | undefined> {
    const [event] = await db.select().from(eventsTable)
      .where(and(eq(eventsTable.club_id, clubId), eq(eventsTable.id, eventId)));
    if (!event) return undefined;
    return this.mapEvent(event);
  }

  async getEventsByCoach(clubId: string, coachId: string): Promise<Event[]> {
    const coachAssignments = await db.select().from(eventCoachesTable)
      .where(and(eq(eventCoachesTable.club_id, clubId), eq(eventCoachesTable.coach_id, coachId)));
    const eventIds = coachAssignments.map(a => a.event_id);
    if (eventIds.length === 0) return [];
    const events = await db.select().from(eventsTable).where(eq(eventsTable.club_id, clubId));
    return events.filter(e => eventIds.includes(e.id)).map(e => this.mapEvent(e));
  }

  async getEventsForAthlete(clubId: string, athleteId: string): Promise<Event[]> {
    const rosters = await db.select().from(eventRostersTable)
      .where(and(eq(eventRostersTable.club_id, clubId), eq(eventRostersTable.athlete_id, athleteId)));
    const eventIds = rosters.map(r => r.event_id);
    if (eventIds.length === 0) return [];
    const events = await db.select().from(eventsTable).where(eq(eventsTable.club_id, clubId));
    return events.filter(e => eventIds.includes(e.id)).map(e => this.mapEvent(e));
  }

  async createEvent(clubId: string, event: Omit<Event, 'id' | 'club_id' | 'status' | 'created_at'>): Promise<Event> {
    const [e] = await db.insert(eventsTable).values({
      club_id: clubId,
      program_id: event.program_id ?? null,
      team_id: event.team_id ?? null,
      title: event.title,
      description: event.description ?? null,
      event_type: event.event_type,
      start_time: new Date(event.start_time),
      end_time: new Date(event.end_time),
      location: event.location ?? null,
      capacity: event.capacity ?? null,
      price: event.price.toString(),
      status: 'scheduled',
    }).returning();
    return this.mapEvent(e);
  }

  async updateEvent(clubId: string, eventId: string, data: Partial<Omit<Event, 'id' | 'club_id' | 'created_at'>>): Promise<Event> {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.event_type !== undefined) updateData.event_type = data.event_type;
    if (data.program_id !== undefined) updateData.program_id = data.program_id;
    if (data.team_id !== undefined) updateData.team_id = data.team_id;
    if (data.start_time !== undefined) updateData.start_time = new Date(data.start_time);
    if (data.end_time !== undefined) updateData.end_time = new Date(data.end_time);
    if (data.location !== undefined) updateData.location = data.location;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.price !== undefined) updateData.price = data.price.toString();
    if (data.status !== undefined) updateData.status = data.status;
    
    const [e] = await db.update(eventsTable)
      .set(updateData)
      .where(and(eq(eventsTable.club_id, clubId), eq(eventsTable.id, eventId)))
      .returning();
    return this.mapEvent(e);
  }

  async deleteEvent(clubId: string, eventId: string): Promise<void> {
    await db.delete(eventRostersTable).where(and(eq(eventRostersTable.club_id, clubId), eq(eventRostersTable.event_id, eventId)));
    await db.delete(eventCoachesTable).where(and(eq(eventCoachesTable.club_id, clubId), eq(eventCoachesTable.event_id, eventId)));
    await db.delete(eventsTable).where(and(eq(eventsTable.club_id, clubId), eq(eventsTable.id, eventId)));
  }

  // Event Roster methods
  async getEventRosters(clubId: string, eventId: string): Promise<(EventRoster & { athlete: Athlete })[]> {
    const rosters = await db.select().from(eventRostersTable)
      .where(and(eq(eventRostersTable.club_id, clubId), eq(eventRostersTable.event_id, eventId)));
    const athletes = await db.select().from(athletesTable).where(eq(athletesTable.club_id, clubId));
    const athleteMap = new Map(athletes.map(a => [a.id, this.mapAthlete(a)]));
    return rosters.map(r => ({
      ...this.mapEventRoster(r),
      athlete: athleteMap.get(r.athlete_id)!,
    })).filter(r => r.athlete);
  }

  async addEventRoster(clubId: string, eventId: string, athleteId: string, paymentId?: string): Promise<EventRoster> {
    const [r] = await db.insert(eventRostersTable).values({
      event_id: eventId,
      athlete_id: athleteId,
      club_id: clubId,
      payment_id: paymentId ?? null,
      checked_in: false,
    }).returning();
    return this.mapEventRoster(r);
  }

  async removeEventRoster(clubId: string, rosterId: string): Promise<void> {
    await db.delete(eventRostersTable).where(and(eq(eventRostersTable.club_id, clubId), eq(eventRostersTable.id, rosterId)));
  }

  async updateEventRosterCheckIn(clubId: string, rosterId: string, checkedIn: boolean): Promise<void> {
    await db.update(eventRostersTable)
      .set({ 
        checked_in: checkedIn, 
        check_in_time: checkedIn ? new Date() : null 
      })
      .where(and(eq(eventRostersTable.club_id, clubId), eq(eventRostersTable.id, rosterId)));
  }

  async getEventRosterById(clubId: string, rosterId: string): Promise<EventRoster | null> {
    const [roster] = await db.select().from(eventRostersTable)
      .where(and(eq(eventRostersTable.club_id, clubId), eq(eventRostersTable.id, rosterId)));
    return roster ? this.mapEventRoster(roster) : null;
  }

  async updateEventRosterPayment(clubId: string, rosterId: string, paymentId: string): Promise<void> {
    await db.update(eventRostersTable)
      .set({ payment_id: paymentId })
      .where(and(eq(eventRostersTable.club_id, clubId), eq(eventRostersTable.id, rosterId)));
  }

  // Event Coach methods
  async getEventCoaches(clubId: string, eventId: string): Promise<(EventCoach & { coach: User })[]> {
    const coaches = await db.select().from(eventCoachesTable)
      .where(and(eq(eventCoachesTable.club_id, clubId), eq(eventCoachesTable.event_id, eventId)));
    const users = await db.select().from(profilesTable).where(eq(profilesTable.club_id, clubId));
    const userMap = new Map(users.map(u => [u.id, this.mapUser(u)]));
    return coaches.map(c => ({
      ...this.mapEventCoach(c),
      coach: userMap.get(c.coach_id)!,
    })).filter(c => c.coach);
  }

  async setEventCoaches(clubId: string, eventId: string, coachIds: string[]): Promise<void> {
    await db.delete(eventCoachesTable).where(and(eq(eventCoachesTable.club_id, clubId), eq(eventCoachesTable.event_id, eventId)));
    if (coachIds.length > 0) {
      await db.insert(eventCoachesTable).values(
        coachIds.map(coachId => ({
          event_id: eventId,
          coach_id: coachId,
          club_id: clubId,
        }))
      );
    }
  }

  private mapEvent(e: any): Event {
    return {
      id: e.id,
      club_id: e.club_id,
      program_id: e.program_id ?? undefined,
      team_id: e.team_id ?? undefined,
      title: e.title,
      description: e.description ?? undefined,
      event_type: e.event_type,
      start_time: e.start_time?.toISOString?.() ?? e.start_time,
      end_time: e.end_time?.toISOString?.() ?? e.end_time,
      location: e.location ?? undefined,
      capacity: e.capacity ?? undefined,
      price: parseFloat(e.price),
      status: e.status,
      created_at: e.created_at?.toISOString?.() ?? e.created_at,
    };
  }

  private mapEventRoster(r: any): EventRoster {
    return {
      id: r.id,
      event_id: r.event_id,
      athlete_id: r.athlete_id,
      club_id: r.club_id,
      payment_id: r.payment_id ?? undefined,
      checked_in: r.checked_in,
      check_in_time: r.check_in_time?.toISOString?.() ?? r.check_in_time ?? undefined,
      created_at: r.created_at?.toISOString?.() ?? r.created_at,
    };
  }

  private mapEventCoach(c: any): EventCoach {
    return {
      id: c.id,
      event_id: c.event_id,
      coach_id: c.coach_id,
      club_id: c.club_id,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
    };
  }

  // ============ COMMUNICATION SETTINGS ============

  async updateCommunicationSettings(clubId: string, settings: { include_director_in_chats: boolean }): Promise<Club> {
    const { data, error } = await supabase
      .from('clubs')
      .update({ communication_settings: settings })
      .eq('id', clubId)
      .select()
      .single();
    if (error) throw error;
    return this.mapClub(data);
  }

  async getCommunicationSettings(clubId: string): Promise<{ include_director_in_chats: boolean }> {
    const { data, error } = await supabase
      .from('clubs')
      .select('communication_settings')
      .eq('id', clubId)
      .single();
    if (error) throw error;
    return data?.communication_settings || { include_director_in_chats: false };
  }

  // ============ MESSAGING SYSTEM ============

  async createChatChannel(
    clubId: string,
    createdBy: string,
    channelType: 'direct' | 'team' | 'program' | 'group' | 'event',
    participantIds: string[],
    options?: { name?: string; teamId?: string; programId?: string; eventId?: string }
  ): Promise<ChatChannel> {
    const { data, error } = await supabase
      .from('chat_channels')
      .insert({
        club_id: clubId,
        created_by: createdBy,
        channel_type: channelType,
        name: options?.name,
        team_id: options?.teamId,
        program_id: options?.programId,
        event_id: options?.eventId,
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapChatChannel(data);
  }

  async getChatChannels(clubId: string, userId: string): Promise<ChatChannel[]> {
    const { data, error } = await supabase
      .from('channel_participants')
      .select('channel_id, chat_channels(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return (data || [])
      .filter((p: any) => p.chat_channels?.club_id === clubId)
      .map((p: any) => this.mapChatChannel(p.chat_channels));
  }

  async getChatChannel(clubId: string, channelId: string): Promise<ChatChannel | undefined> {
    const { data, error } = await supabase
      .from('chat_channels')
      .select('*')
      .eq('id', channelId)
      .eq('club_id', clubId)
      .single();
    if (error) return undefined;
    return this.mapChatChannel(data);
  }

  async getChannelParticipants(channelId: string): Promise<ChannelParticipant[]> {
    const { data, error } = await supabase
      .from('channel_participants')
      .select('*')
      .eq('channel_id', channelId);
    if (error) throw error;
    return (data || []).map((p: any) => this.mapChannelParticipant(p));
  }

  async addChannelParticipant(
    channelId: string,
    userId: string,
    role: string,
    athleteId?: string,
    isDirectorAutoAdded?: boolean
  ): Promise<ChannelParticipant> {
    const { data, error } = await supabase
      .from('channel_participants')
      .insert({
        channel_id: channelId,
        user_id: userId,
        role,
        athlete_id: athleteId,
        is_director_auto_added: isDirectorAutoAdded || false,
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapChannelParticipant(data);
  }

  async sendMessage(channelId: string, senderId: string, content: string, messageType: 'text' | 'system' = 'text'): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        sender_id: senderId,
        content,
        message_type: messageType,
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapMessage(data);
  }

  async getMessages(channelId: string, limit: number = 50, before?: Date): Promise<Message[]> {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (before) {
      query = query.lt('created_at', before.toISOString());
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((m: any) => this.mapMessage(m)).reverse();
  }

  async updateLastReadAt(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('channel_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', channelId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  async validateChatParticipants(
    clubId: string,
    participantIds: string[],
    initiatorId: string
  ): Promise<{ valid: boolean; error?: string; autoAddParentIds?: string[] }> {
    // Get all participant profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .in('id', participantIds)
      .eq('club_id', clubId);
    
    if (error) return { valid: false, error: 'Failed to fetch participants' };
    
    const parentIds: string[] = [];
    
    // Check for athlete participants (minors)
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, parent_id, first_name, last_name')
      .eq('club_id', clubId);
    
    const athleteMap = new Map((athletes || []).map((a: any) => [a.id, a]));
    
    // For any athlete in the chat, we need to auto-add their parent
    for (const profile of profiles || []) {
      // Check if this user has athletes (is a parent)
      const { data: userAthletes } = await supabase
        .from('athletes')
        .select('id, parent_id')
        .eq('parent_id', profile.id);
      
      // If coach is chatting with an athlete's profile, parent must be included
      if (profile.role === 'parent' && userAthletes && userAthletes.length > 0) {
        // This is already a parent, good
      }
    }
    
    // SafeSport rule: Block 1-on-1 adult-minor messaging
    // If only 2 people in chat and one is a coach and one is related to a minor, block it
    if (participantIds.length === 2) {
      const roles = (profiles || []).map((p: any) => p.role);
      const hasCoach = roles.includes('coach');
      const hasOnlyParent = roles.filter((r: string) => r === 'parent').length === 1 && roles.length === 2;
      
      // Coaches can message parents directly (about their athletes)
      // But we should ensure any coach-athlete discussion includes the parent
    }
    
    return { valid: true, autoAddParentIds: parentIds };
  }

  async getDirectorId(clubId: string): Promise<string | undefined> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('club_id', clubId)
      .eq('role', 'admin')
      .limit(1)
      .single();
    if (error) return undefined;
    return data?.id;
  }

  // Get all user IDs for a team (parents of athletes + coaches)
  async getTeamAudienceUserIds(clubId: string, teamId: string): Promise<string[]> {
    const userIds = new Set<string>();
    
    // Get all athletes in this team's roster
    const { data: roster } = await supabase
      .from('athlete_team_rosters')
      .select('athlete_id')
      .eq('club_id', clubId)
      .eq('team_id', teamId);
    
    if (roster && roster.length > 0) {
      const athleteIds = roster.map((r: any) => r.athlete_id);
      
      // Get parent IDs for these athletes
      const { data: athletes } = await supabase
        .from('athletes')
        .select('parent_id')
        .in('id', athleteIds);
      
      (athletes || []).forEach((a: any) => userIds.add(a.parent_id));
    }
    
    // Get team's assigned coaches
    const { data: team } = await supabase
      .from('teams')
      .select('coach_id')
      .eq('id', teamId)
      .single();
    
    if (team?.coach_id) {
      userIds.add(team.coach_id);
    }
    
    // Add all coaches in the club (they should see team communications)
    const { data: coaches } = await supabase
      .from('profiles')
      .select('id')
      .eq('club_id', clubId)
      .eq('role', 'coach');
    
    (coaches || []).forEach((c: any) => userIds.add(c.id));
    
    // Add director
    const directorId = await this.getDirectorId(clubId);
    if (directorId) userIds.add(directorId);
    
    return Array.from(userIds);
  }

  // Get all user IDs for a program (all parents of athletes in any team in the program + coaches)
  async getProgramAudienceUserIds(clubId: string, programId: string): Promise<string[]> {
    const userIds = new Set<string>();
    
    // Get all athletes enrolled in this program (via roster with program_id)
    const { data: roster } = await supabase
      .from('athlete_team_rosters')
      .select('athlete_id')
      .eq('club_id', clubId)
      .eq('program_id', programId);
    
    if (roster && roster.length > 0) {
      const athleteIds = roster.map((r: any) => r.athlete_id);
      
      // Get parent IDs for these athletes
      const { data: athletes } = await supabase
        .from('athletes')
        .select('parent_id')
        .in('id', athleteIds);
      
      (athletes || []).forEach((a: any) => userIds.add(a.parent_id));
    }
    
    // Add all coaches in the club
    const { data: coaches } = await supabase
      .from('profiles')
      .select('id')
      .eq('club_id', clubId)
      .eq('role', 'coach');
    
    (coaches || []).forEach((c: any) => userIds.add(c.id));
    
    // Add director
    const directorId = await this.getDirectorId(clubId);
    if (directorId) userIds.add(directorId);
    
    return Array.from(userIds);
  }

  // Get all user IDs for an event roster (parents of athletes registered for the event + assigned coaches)
  async getEventAudienceUserIds(clubId: string, eventId: string): Promise<string[]> {
    const userIds = new Set<string>();
    
    // Get all athletes registered for this event
    const { data: eventRoster } = await supabase
      .from('event_rosters')
      .select('athlete_id')
      .eq('club_id', clubId)
      .eq('event_id', eventId);
    
    if (eventRoster && eventRoster.length > 0) {
      const athleteIds = eventRoster.map((r: any) => r.athlete_id);
      
      // Get parent IDs for these athletes
      const { data: athletes } = await supabase
        .from('athletes')
        .select('parent_id')
        .in('id', athleteIds);
      
      (athletes || []).forEach((a: any) => userIds.add(a.parent_id));
    }
    
    // Get coaches assigned to this event
    const { data: eventCoaches } = await supabase
      .from('event_coaches')
      .select('coach_id')
      .eq('club_id', clubId)
      .eq('event_id', eventId);
    
    (eventCoaches || []).forEach((c: any) => userIds.add(c.coach_id));
    
    // Add all coaches in the club (they should see event communications)
    const { data: coaches } = await supabase
      .from('profiles')
      .select('id')
      .eq('club_id', clubId)
      .eq('role', 'coach');
    
    (coaches || []).forEach((c: any) => userIds.add(c.id));
    
    // Add director
    const directorId = await this.getDirectorId(clubId);
    if (directorId) userIds.add(directorId);
    
    return Array.from(userIds);
  }

  // Get all user IDs in a club (for club-wide posts)
  async getClubAudienceUserIds(clubId: string): Promise<string[]> {
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .eq('club_id', clubId);
    
    return (users || []).map((u: any) => u.id);
  }

  // ============ BULLETIN BOARD ============

  async createBulletinPost(
    clubId: string,
    authorId: string,
    post: { title: string; content: string; audienceType?: 'club' | 'roster' | 'team' | 'program' | 'event'; teamId?: string; programId?: string; eventId?: string; isPinned?: boolean }
  ): Promise<BulletinPost> {
    const { data, error } = await supabase
      .from('bulletin_posts')
      .insert({
        club_id: clubId,
        author_id: authorId,
        title: post.title,
        content: post.content,
        audience_type: post.audienceType || 'club',
        team_id: post.teamId,
        program_id: post.programId,
        event_id: post.eventId,
        is_pinned: post.isPinned || false,
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapBulletinPost(data);
  }

  async getBulletinPosts(
    clubId: string,
    userId: string,
    filters?: { teamId?: string; programId?: string }
  ): Promise<(BulletinPost & { isRead: boolean; isHidden: boolean; author: User })[]> {
    let query = supabase
      .from('bulletin_posts')
      .select('*, profiles!bulletin_posts_author_id_fkey(*), bulletin_reads(*)')
      .eq('club_id', clubId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (filters?.teamId) {
      query = query.eq('team_id', filters.teamId);
    }
    if (filters?.programId) {
      query = query.eq('program_id', filters.programId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return (data || []).map((p: any) => {
      const userRead = (p.bulletin_reads || []).find((r: any) => r.user_id === userId);
      return {
        ...this.mapBulletinPost(p),
        isRead: !!userRead,
        isHidden: userRead?.is_hidden || false,
        author: this.mapUser(p.profiles),
      };
    });
  }

  async getBulletinPost(clubId: string, postId: string): Promise<BulletinPost | undefined> {
    const { data, error } = await supabase
      .from('bulletin_posts')
      .select('*')
      .eq('id', postId)
      .eq('club_id', clubId)
      .single();
    if (error) return undefined;
    return this.mapBulletinPost(data);
  }

  async updateBulletinPost(
    clubId: string,
    postId: string,
    data: { title?: string; content?: string; isPinned?: boolean }
  ): Promise<BulletinPost> {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.isPinned !== undefined) updateData.is_pinned = data.isPinned;
    
    const { data: result, error } = await supabase
      .from('bulletin_posts')
      .update(updateData)
      .eq('id', postId)
      .eq('club_id', clubId)
      .select()
      .single();
    if (error) throw error;
    return this.mapBulletinPost(result);
  }

  async deleteBulletinPost(clubId: string, postId: string): Promise<void> {
    // First delete all reads for this post
    await supabase
      .from('bulletin_reads')
      .delete()
      .eq('post_id', postId);
    
    // Then delete the post
    const { error } = await supabase
      .from('bulletin_posts')
      .delete()
      .eq('id', postId)
      .eq('club_id', clubId);
    if (error) throw error;
  }

  async markBulletinRead(clubId: string, postId: string, userId: string, isHidden?: boolean): Promise<BulletinRead> {
    // Upsert - update if exists, insert if not
    const { data: existing } = await supabase
      .from('bulletin_reads')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();
    
    if (existing) {
      const updateData: any = {};
      if (isHidden !== undefined) updateData.is_hidden = isHidden;
      
      const { data, error } = await supabase
        .from('bulletin_reads')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return this.mapBulletinRead(data);
    }
    
    const { data, error } = await supabase
      .from('bulletin_reads')
      .insert({
        post_id: postId,
        user_id: userId,
        is_hidden: isHidden || false,
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapBulletinRead(data);
  }

  async updateBulletinHidden(clubId: string, postId: string, userId: string, isHidden: boolean): Promise<BulletinRead> {
    return this.markBulletinRead(clubId, postId, userId, isHidden);
  }

  async getBulletinReadReceipts(clubId: string, postId: string): Promise<{ user_id: string; full_name: string; read_at: string }[]> {
    const { data: reads, error } = await supabase
      .from('bulletin_reads')
      .select(`
        user_id,
        read_at,
        profiles!bulletin_reads_user_id_fkey(full_name)
      `)
      .eq('post_id', postId);
    
    if (error) throw error;
    
    return (reads || []).map((r: any) => ({
      user_id: r.user_id,
      full_name: r.profiles?.full_name || 'Unknown User',
      read_at: r.read_at,
    }));
  }

  async getChannelReadReceipts(channelId: string): Promise<{ user_id: string; full_name: string; last_read_at: string | null }[]> {
    const { data: participants, error } = await supabase
      .from('channel_participants')
      .select(`
        user_id,
        last_read_at,
        profiles!channel_participants_user_id_fkey(full_name)
      `)
      .eq('channel_id', channelId);
    
    if (error) throw error;
    
    return (participants || []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.profiles?.full_name || 'Unknown User',
      last_read_at: p.last_read_at,
    }));
  }

  // ============ PUSH NOTIFICATIONS ============

  async registerPushToken(userId: string, fcmToken: string, deviceType: 'web' | 'ios' | 'android' = 'web'): Promise<PushSub> {
    // First, check if this token already exists
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('fcm_token', fcmToken)
      .single();
    
    if (existing) {
      // Update the existing subscription
      const { data, error } = await supabase
        .from('push_subscriptions')
        .update({
          user_id: userId,
          device_type: deviceType,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return this.mapPushSubscription(data);
    }
    
    const { data, error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        fcm_token: fcmToken,
        device_type: deviceType,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return this.mapPushSubscription(data);
  }

  async getPushTokensForUsers(userIds: string[]): Promise<string[]> {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('fcm_token')
      .in('user_id', userIds)
      .eq('is_active', true);
    if (error) throw error;
    return (data || []).map((s: any) => s.fcm_token);
  }

  async deactivatePushToken(fcmToken: string): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('fcm_token', fcmToken);
    if (error) throw error;
  }

  // ============ MAPPING HELPERS ============

  private mapChatChannel(c: any): ChatChannel {
    return {
      id: c.id,
      club_id: c.club_id,
      name: c.name ?? undefined,
      channel_type: c.channel_type,
      team_id: c.team_id ?? undefined,
      program_id: c.program_id ?? undefined,
      created_by: c.created_by,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
    };
  }

  private mapChannelParticipant(p: any): ChannelParticipant {
    return {
      id: p.id,
      channel_id: p.channel_id,
      user_id: p.user_id,
      role: p.role,
      athlete_id: p.athlete_id ?? undefined,
      is_director_auto_added: p.is_director_auto_added,
      last_read_at: p.last_read_at?.toISOString?.() ?? p.last_read_at ?? undefined,
      joined_at: p.joined_at?.toISOString?.() ?? p.joined_at,
    };
  }

  private mapMessage(m: any): Message {
    return {
      id: m.id,
      channel_id: m.channel_id,
      sender_id: m.sender_id,
      content: m.content,
      message_type: m.message_type,
      created_at: m.created_at?.toISOString?.() ?? m.created_at,
      updated_at: m.updated_at?.toISOString?.() ?? m.updated_at ?? undefined,
      deleted_at: m.deleted_at?.toISOString?.() ?? m.deleted_at ?? undefined,
    };
  }

  private mapBulletinPost(p: any): BulletinPost {
    return {
      id: p.id,
      club_id: p.club_id,
      team_id: p.team_id ?? undefined,
      program_id: p.program_id ?? undefined,
      author_id: p.author_id,
      title: p.title,
      content: p.content,
      is_pinned: p.is_pinned,
      created_at: p.created_at?.toISOString?.() ?? p.created_at,
      updated_at: p.updated_at?.toISOString?.() ?? p.updated_at ?? undefined,
    };
  }

  private mapBulletinRead(r: any): BulletinRead {
    return {
      id: r.id,
      post_id: r.post_id,
      user_id: r.user_id,
      is_hidden: r.is_hidden,
      read_at: r.read_at?.toISOString?.() ?? r.read_at,
    };
  }

  private mapPushSubscription(s: any): PushSub {
    return {
      id: s.id,
      user_id: s.user_id,
      fcm_token: s.fcm_token,
      device_type: s.device_type,
      is_active: s.is_active,
      created_at: s.created_at?.toISOString?.() ?? s.created_at,
      updated_at: s.updated_at?.toISOString?.() ?? s.updated_at ?? undefined,
    };
  }
}

export const dbStorage = new DatabaseStorage();
