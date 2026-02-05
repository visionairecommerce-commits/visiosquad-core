# VisioSquad - Sports Management Platform

## Overview

VisioSquad is a multi-tenant SaaS platform designed for comprehensive management of athletic programs. It centralizes team management, scheduling, payment processing, and athlete registrations, offering a robust solution for Club Admins, Coaches, and Parents to streamline sports club operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite
- **Routing**: Wouter with role-based separation
- **State Management**: React Context, TanStack Query
- **UI Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS with custom CSS variables for light/dark mode

### Backend
- **Runtime**: Node.js with Express.js
- **API Design**: RESTful with Zod schema validation
- **Build System**: esbuild (server), Vite (client)
- **Multi-tenancy**: Achieved via `club_id` filtering for data isolation

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Database**: PostgreSQL (leveraging Supabase for persistence and real-time capabilities)

### Authentication & Authorization
- **Auth Provider**: Supabase Auth (JWT session tokens)
- **Multi-tenant Onboarding**: Club code-based registration
- **Role-Based Access**: Owner, Admin/Director, Coach, Parent, Athlete roles for UI and API protection.
- **E-Signatures**: Tracks waiver and contract signing status, with a dedicated verification page.
- **Athlete Login Capability**: Parents can set up login credentials for athletes, providing them with a dedicated dashboard and push notifications.

### Core Features

- **Program Contracts & Pricing**: Directors define pricing tiers and athletes enroll in contracts for recurring billing.
- **Athlete Management**: Roster management, payment status tracking, and custom pricing overrides. For beach volleyball clubs, athletes can have sport-specific membership IDs (AVP, BVCA, BVNE, AAU, p1440).
- **Payment Processing**: Integration with Helcim for credit card and ACH transactions.
- **Technology and Service Fees**: Implements a parent-paid fee model (`v2_2026_02_zero_loss_discounts`) with dynamic fee calculation based on payment rail (credit, ACH, debit) and discounts.
- **Scheduling Engine**: Manages practices, clinics, drop-ins, and events, including recurring sessions and facility conflict detection.
- **Event Management**: Dedicated system for standalone events with separate rosters and pricing.
- **Snack Hub**: An optional, per-event feature for coordinating snacks, including category organization, quick-add suggestions, claim/unclaim functionality, and allergy alerts.
- **Attendance Tracking**: Check-in/check-out for sessions/events, with flags for overdue payments.
- **SafeSport Communication Hub**: Real-time messaging and bulletin board with SafeSport compliance logic (e.g., parent inclusion in coach-athlete chats). Supports various audience types (individual, roster, team, program, event, club).
- **Push Notifications**: Utilizes Firebase Cloud Messaging (FCM) for new messages and bulletin posts.
  - **Backend**: Firebase Admin SDK sends notifications when messages/bulletin posts are created
  - **Frontend**: Firebase SDK initialized on login, requests permission and registers FCM token
  - **Service Worker**: `client/public/firebase-messaging-sw.js` handles background notifications
  - **Foreground**: In-app toast notifications via `onMessage` handler
  - **Token Storage**: `push_subscriptions` table stores FCM tokens per user/device
  - **Endpoints**: `POST /api/push-subscriptions` registers tokens, `GET /api/firebase-config` provides config to service worker
  - **Environment Variables**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_PUBLIC_VAPID_KEY`, `FIREBASE_SERVICE_ACCOUNT`
- **Seasons & Data Retention**: Directors define club seasons, with automated chat data cleanup at event and season ends.
- **Daily Club Billing System (Legacy)**: Calculates and bills platform fees based on active player count (deprecated when parent-paid fees are enabled). Includes Helcim subscription billing for automated recurring charges.

## External Dependencies

### Third-Party Services
- **Supabase**: Database, authentication, and real-time features.
- **Helcim**: Payment gateway for credit card and ACH transactions.
- **Resend**: Transactional email service.
- **Firebase**: Push notifications (FCM) via Firebase Admin SDK.
- **DocuSeal**: E-signature platform for per-athlete contract submissions, with owner-managed club onboarding.

### Key NPM Packages
- `@supabase/supabase-js`: Supabase client SDK.
- `@tanstack/react-query`: Server state management.
- `drizzle-orm`, `drizzle-zod`: ORM and validation.
- `date-fns`: Date utilities.
- `zod`: Runtime type validation.
- `resend`: Email API client.

### Other
- **Row Level Security (RLS)**: Enabled on all tables for database-level access control, ensuring multi-tenant isolation and role-based policies.
- **Webhooks**: Integrations for Helcim payment notifications and DocuSeal e-signature updates, with robust signature verification and idempotency.
- **E2E Test Infrastructure**: Comprehensive HTTP-level end-to-end tests for billing and payment processes, utilizing raw SQL seeding and mocked services.