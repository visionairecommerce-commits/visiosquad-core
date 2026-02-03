import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('Starting test seed...');
  
  try {
    const testClubId = crypto.randomUUID();
    const testUserId = crypto.randomUUID();
    const testProgramId = crypto.randomUUID();
    const testTeamId = crypto.randomUUID();
    
    console.log('Creating test club...');
    const { error: clubError } = await supabase
      .from('clubs')
      .insert({
        id: testClubId,
        name: 'TEST Club - Demo Sports Academy',
        join_code: 'TEST' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        onboarding_complete: true,
        docuseal_onboarded: false,
      });
    
    if (clubError) {
      console.error('Error creating club:', clubError);
      return;
    }
    console.log('Created test club:', testClubId);
    
    console.log('Creating test admin user...');
    const { error: userError } = await supabase
      .from('profiles')
      .insert({
        id: testUserId,
        email: 'testadmin@example.com',
        full_name: 'Test Admin',
        role: 'admin',
        club_id: testClubId,
        has_signed_documents: true,
        can_bill: true,
        contract_status: 'verified',
      });
    
    if (userError) {
      console.error('Error creating user:', userError);
      return;
    }
    console.log('Created test admin user:', testUserId);
    
    console.log('Creating test program...');
    const { error: programError } = await supabase
      .from('programs')
      .insert({
        id: testProgramId,
        club_id: testClubId,
        name: 'Youth Development Program',
        description: 'Training program for youth athletes',
        monthly_fee: 150,
      });
    
    if (programError) {
      console.error('Error creating program:', programError);
      return;
    }
    console.log('Created test program:', testProgramId);
    
    console.log('Creating test team...');
    const { error: teamError } = await supabase
      .from('teams')
      .insert({
        id: testTeamId,
        club_id: testClubId,
        program_id: testProgramId,
        name: 'U14 Elite',
        coach_id: null,
      });
    
    if (teamError) {
      console.error('Error creating team:', teamError);
      return;
    }
    console.log('Created test team:', testTeamId);
    
    const parentId = crypto.randomUUID();
    console.log('Creating test parent...');
    const { error: parentError } = await supabase
      .from('profiles')
      .insert({
        id: parentId,
        email: 'testparent@example.com',
        full_name: 'Test Parent',
        role: 'parent',
        club_id: testClubId,
        has_signed_documents: true,
        can_bill: false,
        contract_status: 'verified',
      });
    
    if (parentError) {
      console.error('Error creating parent:', parentError);
      return;
    }
    console.log('Created test parent:', parentId);
    
    const athletes = [];
    for (let i = 1; i <= 5; i++) {
      const athleteId = crypto.randomUUID();
      athletes.push({
        id: athleteId,
        club_id: testClubId,
        parent_id: parentId,
        first_name: `Athlete${i}`,
        last_name: 'Test',
        date_of_birth: `${2010 + i}-01-15`,
        graduation_year: 2028 + i,
      });
    }
    
    console.log('Creating test athletes...');
    const { error: athleteError } = await supabase
      .from('athletes')
      .insert(athletes);
    
    if (athleteError) {
      console.error('Error creating athletes:', athleteError);
      return;
    }
    console.log('Created', athletes.length, 'test athletes');
    
    console.log('Creating roster assignments...');
    const rosterAssignments = athletes.map(athlete => ({
      id: crypto.randomUUID(),
      team_id: testTeamId,
      athlete_id: athlete.id,
      club_id: testClubId,
      program_id: testProgramId,
    }));
    
    const { error: rosterError } = await supabase
      .from('athlete_team_rosters')
      .insert(rosterAssignments);
    
    if (rosterError) {
      console.error('Error creating roster:', rosterError);
      return;
    }
    console.log('Created', rosterAssignments.length, 'roster assignments');
    
    console.log('\n=== Test Seed Complete ===');
    console.log('Club ID:', testClubId);
    console.log('Admin User ID:', testUserId);
    console.log('Admin Email: testadmin@example.com');
    console.log('Parent Email: testparent@example.com');
    console.log('Program ID:', testProgramId);
    console.log('Team ID:', testTeamId);
    console.log('Athletes created:', athletes.length);
    console.log('\nNote: This is a TEST club and will be excluded from billing.');
    
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed().then(() => {
  console.log('Seed completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
