/**
 * Database Seed Fixtures for Billing V2 E2E Tests
 * 
 * Creates minimal required relational rows in the test database:
 * - Club
 * - Director user (admin)
 * - Parent user
 * - Athlete linked to parent and club
 * 
 * Uses raw SQL to avoid schema/DB column mismatches.
 */

import { db } from '../../server/lib/db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface TestFixtures {
  club: {
    id: string;
    name: string;
    join_code: string;
  };
  director: {
    id: string;
    email: string;
    role: 'admin';
  };
  parent: {
    id: string;
    email: string;
    role: 'parent';
  };
  athlete: {
    id: string;
    first_name: string;
    last_name: string;
  };
  program: {
    id: string;
    name: string;
  };
  event: {
    id: string;
    title: string;
    price: string;
  };
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Seed test fixtures for billing E2E tests
 * Creates isolated test data with unique IDs using raw SQL
 */
export async function seedBillingFixtures(): Promise<TestFixtures> {
  const testId = Date.now().toString(36);
  
  const clubId = uuidv4();
  const directorId = uuidv4();
  const parentId = uuidv4();
  const athleteId = uuidv4();
  const programId = uuidv4();
  const eventId = uuidv4();
  const joinCode = generateJoinCode();

  await db.execute(sql`
    INSERT INTO clubs (id, name, join_code, onboarding_complete, billing_day)
    VALUES (${clubId}, ${'Test Club ' + testId}, ${joinCode}, true, 1)
  `);

  await db.execute(sql`
    INSERT INTO profiles (id, email, full_name, role, club_id)
    VALUES (${directorId}, ${'director-' + testId + '@test.visiosquad.com'}, ${'Director ' + testId}, 'admin', ${clubId})
  `);

  await db.execute(sql`
    INSERT INTO profiles (id, email, full_name, role, club_id)
    VALUES (${parentId}, ${'parent-' + testId + '@test.visiosquad.com'}, ${'Parent ' + testId}, 'parent', ${clubId})
  `);

  await db.execute(sql`
    INSERT INTO programs (id, club_id, name, monthly_fee)
    VALUES (${programId}, ${clubId}, ${'Test Program ' + testId}, 150.00)
  `);

  await db.execute(sql`
    INSERT INTO athletes (id, club_id, parent_id, first_name, last_name, date_of_birth, graduation_year)
    VALUES (${athleteId}, ${clubId}, ${parentId}, 'TestAthlete', ${testId}, '2010-01-01', 2028)
  `);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);

  await db.execute(sql`
    INSERT INTO events (id, club_id, title, event_type, start_time, end_time, price, status)
    VALUES (${eventId}, ${clubId}, ${'Test Clinic ' + testId}, 'clinic', ${tomorrow.toISOString()}, ${dayAfter.toISOString()}, 50.00, 'scheduled')
  `);

  return {
    club: {
      id: clubId,
      name: `Test Club ${testId}`,
      join_code: joinCode,
    },
    director: {
      id: directorId,
      email: `director-${testId}@test.visiosquad.com`,
      role: 'admin',
    },
    parent: {
      id: parentId,
      email: `parent-${testId}@test.visiosquad.com`,
      role: 'parent',
    },
    athlete: {
      id: athleteId,
      first_name: 'TestAthlete',
      last_name: testId,
    },
    program: {
      id: programId,
      name: `Test Program ${testId}`,
    },
    event: {
      id: eventId,
      title: `Test Clinic ${testId}`,
      price: '50.00',
    },
  };
}

/**
 * Clean up test fixtures (optional - can leave for manual inspection)
 */
export async function cleanupBillingFixtures(fixtures: TestFixtures): Promise<void> {
  await db.execute(sql`DELETE FROM payments WHERE athlete_id = ${fixtures.athlete.id}`);
  await db.execute(sql`DELETE FROM athletes WHERE id = ${fixtures.athlete.id}`);
  await db.execute(sql`DELETE FROM events WHERE id = ${fixtures.event.id}`);
  await db.execute(sql`DELETE FROM programs WHERE id = ${fixtures.program.id}`);
  await db.execute(sql`DELETE FROM profiles WHERE id = ${fixtures.parent.id}`);
  await db.execute(sql`DELETE FROM profiles WHERE id = ${fixtures.director.id}`);
  await db.execute(sql`DELETE FROM clubs WHERE id = ${fixtures.club.id}`);
}
