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
- **Multi-tenant onboarding system** with club code-based registration
- Session-based auth context with persistent login state via localStorage
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

### Business Logic Patterns
- **Payment Access Control**: Athletes are "locked" if `current_date > (paid_through_date + 7 days)`
- **Scheduling Conflicts**: 15-minute buffer rule - soft warning for minor overlaps, hard block for major conflicts
- **Platform Ledger**: Automatic fee tracking ($1.00/month for athletes, $1.00 per clinic, $0.75 per drop-in)
- **Convenience Fees**: Credit card payments add 3% fee, ACH payments have no additional fee

## External Dependencies

### Third-Party Services
- **Supabase**: Primary database and authentication backend
  - Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  
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