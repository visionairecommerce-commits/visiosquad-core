# VisioSport - Sports Management Platform

## Overview

VisioSport is a multi-tenant sports SaaS platform designed for managing athletic programs, teams, scheduling, payments, and athlete registrations. The application serves three user roles: Club Admins, Coaches, and Parents, each with their own dashboard and feature set.

Key capabilities include:
- Program and team management with contract templates
- Conflict-aware scheduling engine for practices, clinics, and drop-in sessions
- Payment processing with convenience fee calculation (Credit Card: 3%, ACH: none)
- Athlete roster management with payment status tracking
- Session cancellation with automated email notifications
- Multi-athlete family views with athlete switching

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing with role-based route separation
- **State Management**: React Context for Auth and Active Athlete state, TanStack Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **API Design**: RESTful endpoints under `/api` prefix with Zod schema validation
- **Build System**: esbuild for server bundling, Vite for client bundling
- **Multi-tenancy**: All database queries filtered by `club_id` for tenant isolation

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains type definitions shared between client and server
- **Database**: PostgreSQL (configured via `DATABASE_URL` environment variable)
- **Primary Database**: Supabase for data persistence and real-time features

### Authentication & Authorization
- **Supabase Auth**: User authentication via Supabase Auth (users visible in Supabase Dashboard > Authentication)
  - Users created via `supabaseAdmin.auth.admin.createUser()` with service role key
  - Login via `supabaseAdmin.auth.signInWithPassword()` returning JWT session tokens
  - Database trigger `handle_new_user()` auto-creates profile record on signup
  - Environment variables: `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- **Multi-tenant onboarding system** with club code-based registration
- Session-based auth context with persistent login state via localStorage + Supabase session
- Role-based UI rendering and route protection (Admin/Director, Coach, Parent)
- Backend role-based access control via `X-User-Role`, `X-User-Id`, and `X-Club-Id` headers
- Role middleware pattern: `requireRole('admin', 'coach')` applied to protected endpoints

#### Director (Admin) Onboarding Flow
1. Director creates account and new club at `/create-club`
2. System generates unique 6-character club code (excludes ambiguous characters O/0, I/1)
3. Director sets up waiver document at `/onboarding` (required before accessing dashboard)
4. After completing onboarding, Director can share club code via invite link or SMS
5. Dashboard includes "Share Club Access" section with copy link and text invite buttons

#### Parent/Coach Join Flow
1. Parent or Coach navigates to `/join` (optionally with `?code=XXXXXX`)
2. Enters club code to find their club
3. Reviews and e-signs club waiver (checkbox + typed signature)
4. Creates account with email/password
5. Account is automatically bound to club via `club_id`

#### E-Signatures
- Stored in `club_signatures` table with: signed name, document type, timestamp, IP address
- User's `has_signed_documents` flag tracks signature status
- Clubs can require waiver signature before granting access
- **Parent Documents Page** (`/documents`): Parents can view and sign waivers and contracts at any time
  - Shows signature status (Signed/Pending/Not Required) for both waiver and contract
  - Displays waiver content inline with agreement checkbox and typed signature
  - Links to contract PDF for review before signing
  - Alerts shown when required documents are unsigned

#### Settings Dashboard (Directors Only)
- **Club Join Code**: Display, copy, and regenerate 6-character club codes with shareable join links
- **Club Identity**: Manage club name, address, and logo URL with live preview
- **Document Vault**: Version-tracked waiver content and contract PDF URLs with signature tracking
- **Facilities Manager**: CRUD operations for physical locations used in scheduling conflict detection
- Route: `/settings` (admin-only access)

### Event Calendar & Attendance
- **Calendar View** (`/calendar`): Directors and coaches see all scheduled sessions in a month calendar
  - Month navigation with previous/next buttons
  - Sessions shown as dots on calendar days
  - Click day to see sessions scheduled for that date
  - Filter by program (admin only)
- **Session Details Modal**: Click a session card to see registered athletes
  - Shows athlete name, check-in status, and payment status
  - Check In/Check Out buttons for each athlete
  - Athletes with overdue payments are flagged and blocked from check-in
  - Attendance count displayed (e.g., "3/5 checked in")
- **API**: Uses `GET /api/sessions/:id/registrations` and `PATCH /api/registrations/:id/checkin`

### Contract-Based Pricing Model
- **Program Contracts**: Directors can create pricing tiers (contracts) for each program
  - Each contract defines: name, description, monthly price, and sessions per week allowed
  - Example: "4 Days/Week Premium" at $500/month, "3 Days/Week Standard" at $350/month
  - Route: `/contracts` (admin-only access)
- **Athlete Contracts**: Athletes can subscribe to program contracts for recurring billing
  - Contract status: active, cancelled, expired
  - Stored in `athlete_contracts` table linking athlete_id to program_contract_id
  - System automatically cancels previous active contracts when assigning a new one
- **Drop-in Pricing**: Sessions have a `drop_in_price` field for non-contract attendees
- **API Endpoints**: Full CRUD for program contracts at `/api/program-contracts`

### Business Logic Patterns
- **Billing Card Requirement**: Directors must add a credit card in Settings > Billing before processing any client payments
  - Card is tokenized via Helcim and stored as `billing_card_token` on the clubs table
  - Dashboard shows alert banner if no billing card on file
  - Payment processing endpoint returns 403 error if billing card not configured
- **Payment Access Control**: Athletes are "locked" if `current_date > (paid_through_date + 7 days)`
- **Platform Ledger**: Automatic fee tracking ($1.00/month per athlete, $1.00 per player per clinic, $0.75 per drop-in)
- **Convenience Fees**: Credit card payments add 3% fee, ACH payments have no additional fee

### Advanced Scheduling Engine
- **Facilities**: Physical locations (fields, courts, gyms) used for facility-specific conflict detection
- **Session Targeting**: Sessions can target entire programs (team_id=null) or specific teams (team_id set)
- **Recurring Sessions**: Create multiple sessions at once with time blocks supporting different times per day
  - Example: Mon/Wed @ 5 PM, Tue/Thu @ 6 PM using separate time blocks
  - Sessions share a `recurrence_group_id` for grouped management
- **Conflict Detection**: 
  - Facility-specific: Only sessions at the same facility are checked for conflicts
  - Soft warning (≤15 min overlap): Yellow alert, allows proceeding with forceCreate
  - Hard block (>15 min overlap): Red error, prevents session creation
- **Registration Access Gate**: `getSessionsForAthlete` filters sessions based on athlete's program/team roster membership

### Standalone Events System
- **Events**: Separate from sessions, used for clinics, camps, tryouts, tournaments, and other standalone events
  - Event types: `clinic`, `camp`, `tryout`, `tournament`, `other`
  - Each event has its own roster (event_rosters table), pricing, and coach assignments
  - Optional program/team association for filtering
- **Event Management UI**: Route `/events` (admin-only)
  - Create, edit, delete events with date/time, location, price, and capacity
  - Upcoming vs Past events distinction
- **Event Calendar Integration**: 
  - Calendar view (`/calendar`) shows both sessions and events
  - Sessions displayed as blue dots, events as orange dots
  - Filter tabs: All, Sessions, Events
  - Program filter applies to both sessions and events
- **Event Rosters & Check-in**: Click event cards to view/manage registered athletes
  - Check-in/check-out tracking with attendance counts
  - Payment status blocking for overdue athletes
- **Platform Fees**: $1.00 per player per event (same as clinics)
- **API Endpoints**:
  - Full CRUD: GET/POST/PATCH/DELETE `/api/events`
  - Roster management: GET/POST `/api/events/:id/rosters`, DELETE `/api/events/:id/rosters/:rosterId`
  - Check-in: PATCH `/api/events/rosters/:rosterId/checkin`
  - Coach assignment: GET/PUT `/api/events/:id/coaches`
- **Payment Blocking**: Requires billing card or bank account before processing event payments

## External Dependencies

### Third-Party Services
- **Supabase**: Primary database and authentication backend
  - Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Uses database trigger `handle_new_user()` to sync auth.users → profiles table
  
- **Helcim**: Payment processing for credit card and ACH transactions
  - Environment variables: `HELCIM_API_TOKEN`, `HELCIM_ACCOUNT_ID`
  
- **Resend**: Transactional email service for notifications
  - Environment variables: `RESEND_API_KEY`
  - Used for session cancellations, contract signing alerts, payment confirmations

### Key NPM Dependencies
- `@supabase/supabase-js`: Supabase client SDK
- `@tanstack/react-query`: Server state management
- `drizzle-orm` / `drizzle-zod`: Database ORM and validation
- `date-fns`: Date manipulation utilities
- `zod`: Runtime type validation
- `resend`: Email API client

### Development Tools
- `tsx`: TypeScript execution for development
- `drizzle-kit`: Database migration tooling
- Replit-specific Vite plugins for development experience