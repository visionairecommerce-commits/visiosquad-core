# VisioSquad - Sports Management Platform

## Overview

VisioSquad is a multi-tenant SaaS platform designed for comprehensive management of athletic programs. It streamlines team management, scheduling, payment processing, and athlete registrations for Club Admins, Coaches, and Parents. The platform aims to centralize sports club operations, offering a robust solution for diverse athletic organizations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite
- **Routing**: Wouter with role-based separation
- **State Management**: React Context (Auth, Active Athlete), TanStack Query (server state)
- **UI Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS with custom CSS variables (light/dark mode)

### Backend
- **Runtime**: Node.js with Express.js
- **API Design**: RESTful, Zod schema validation
- **Build System**: esbuild (server), Vite (client)
- **Multi-tenancy**: `club_id` filtering for data isolation

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema**: `shared/schema.ts`
- **Database**: PostgreSQL (Supabase for persistence and real-time)

### Authentication & Authorization
- **Auth Provider**: Supabase Auth (JWT session tokens)
- **Multi-tenant Onboarding**: Club code-based registration
- **Role-Based Access**: Owner, Admin/Director, Coach, Parent, Athlete roles for UI and API protection (`X-User-Role`, `X-User-Id`, `X-Club-Id`, `X-Athlete-Id` headers)
- **Platform Owner**: Special 'owner' role for platform-level administration (visionairecommerce@gmail.com). Owner has `club_id = null` and can view all clubs and platform-wide metrics. Owner dashboard shows total clubs, athletes, payments, and estimated revenue.
- **Director Onboarding**: Club creation, waiver setup, club code generation.
- **Parent/Coach Join Flow**: Club code entry, waiver e-signature, account creation.
- **Athlete Login Capability**: Parents create athlete profiles first, then can optionally set up login credentials for athletes. Athletes with accounts:
  - Have their own dashboard showing their schedule and team info
  - Receive direct push notifications for team/program/event communications
  - Are included in channel participant lists via `user_id` field linking athlete to profile
- **E-Signatures**: Stored in `club_signatures` table, tracks waiver and contract signing status.
- **Contract Compliance**: Tracks and verifies parent contract signatures (digital/paper), with a dedicated verification page for directors/coaches.
- **Settings Dashboard (Directors Only)**: Manage club identity, join codes, waiver text, contract signing links, forms, and facilities.

### Core Features

- **Program Contracts & Pricing**: Directors define pricing tiers (monthly, paid-in-full, initiation fees) per program or team. Athletes enroll in contracts, which manage recurring billing and payment plans.
- **Athlete Management**: Roster management, payment status tracking, custom pricing overrides for individual athletes.
- **Payment Processing**: Integrates with Helcim, calculates convenience fees (3% for credit card, $1.00 flat fee for ACH). Requires billing card on file for clubs.
- **Platform Fees**: $3.00/player/month for regular athletes, $1.00/player for events, $0.75/player for drop-ins. Defined in `PLATFORM_FEES` constant in `shared/schema.ts`.
- **Scheduling Engine**: Manages practices, clinics, drop-ins, and standalone events. Features recurring sessions, facility-specific conflict detection (soft/hard blocks), and athlete registration gates based on program/team membership.
- **Event Management**: Dedicated system for standalone events (clinics, camps, tryouts) with separate rosters, pricing, and check-in.
- **Attendance Tracking**: Check-in/check-out for sessions and events, flags athletes with overdue payments.
- **SafeSport Communication Hub**: Real-time messaging (Supabase Realtime) and bulletin board with SafeSport compliance logic (e.g., parent inclusion in coach-athlete chats, director oversight option). Features Telegram-style audience targeting:
  - **Audience Types**: Individual (1-on-1 with parent), Roster (specific team roster), Team (all parents + coaches + athletes with accounts in team), Program (all users in program), Event (parents + athletes with accounts registered for an event + assigned coaches), Club (everyone in club for bulletins)
  - **Audience Resolution**: `getTeamAudienceUserIds`, `getProgramAudienceUserIds`, `getEventAudienceUserIds`, `getClubAudienceUserIds` methods resolve participants based on audience type
  - **SafeSport Compliance**: Parents are automatically included via audience resolution methods when targeting teams/programs/events
  - **Channel Types**: `direct` for individual, `group` for roster, `team` for team-wide, `program` for program-wide, `event` for event roster communications
- **Push Notifications**: Firebase Cloud Messaging (FCM) for new messages and bulletin posts. Batch sends to all users in selected audience.
- **Seasons & Data Retention**: Directors define club seasons with start/end dates. Automatic data cleanup:
  - **Event Chat Cleanup**: Messages in event-specific chats are automatically deleted 24 hours after the event ends
  - **Season-End Cleanup**: All chat data (except event chats) is automatically deleted when a season ends
  - **Scheduled Jobs**: Runs hourly for event cleanup, daily at 2 AM for season cleanup
  - **UI**: Directors manage seasons in Settings → Seasons section

## External Dependencies

### Third-Party Services
- **Supabase**: Database, authentication, and real-time features (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Helcim**: Payment gateway for credit card and ACH transactions (`HELCIM_API_TOKEN`, `HELCIM_ACCOUNT_ID`).
- **Resend**: Transactional email service for notifications (`RESEND_API_KEY`).
- **Firebase**: Push notifications (FCM) via Firebase Admin SDK (`FIREBASE_SERVICE_ACCOUNT`).
- **DocuSeal**: E-signature platform for per-athlete contract submissions (`DOCUSEAL_API_KEY`, `DOCUSEAL_WEBHOOK_SECRET`).
  - Directors configure `docuseal_template_id` on program contracts
  - API creates submissions with external_id for reliable webhook matching
  - Webhook verifies `X-DocuSeal-Secret` header and updates athlete contract status
  - `contract_submissions` table tracks submission status (sent, viewed, signed)
  - **Owner-Managed Onboarding**: Clubs must be onboarded to DocuSeal before using e-signatures
    - `docuseal_setup_requests` table tracks pending onboarding requests
    - When director sets template_id on non-onboarded club, system creates setup request and emails owner
    - Owner Dashboard → DocuSeal Onboarding page shows checklist and pending requests
    - Owner marks request as completed to enable DocuSeal for that club
    - `clubs.docuseal_onboarded` flag controls whether club can use DocuSeal
    - Environment: `OWNER_EMAIL` (defaults to visionairecommerce@gmail.com)

### Key NPM Packages
- `@supabase/supabase-js`: Supabase client SDK.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`, `drizzle-zod`: ORM and validation.
- `date-fns`: Date utilities.
- `zod`: Runtime type validation.
- `resend`: Email API client.

### Row Level Security (RLS)
- **Enabled on all 30 tables** for database-level access control
- **Multi-tenant isolation**: All tables filtered by `club_id`
- **Role-based policies**: Admins have full club access, coaches have limited write access, parents access own data
- **SafeSport compliance**: Parents can view channels/messages where their athletes participate
- **Webhook endpoints**: `/api/webhooks/payments` (Helcim payment notifications - path intentionally generic per Helcim requirements), `/api/webhooks/docuseal` (e-signature notifications)
  - Helcim webhooks use headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`
  - Signature verification: HMAC-SHA256 with base64-decoded verifier token, signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`
  - Idempotency: Uses `webhook-id` header as primary key for deduplication
  - Payload format: `{ type: "cardTransaction", data: { transactionId, status, amount, invoiceNumber, ... } }`