# VisioSport Design Guidelines

## Design Approach
**System-Based with Modern SaaS Enhancement**: Material Design foundation enhanced with patterns from Linear (data clarity), Notion (information hierarchy), and Stripe (professional restraint). Focus on data density without overwhelming users.

## Typography System
- **Primary Font**: Inter (Google Fonts) - UI elements, body text
- **Display Font**: Inter (weights 600-700) - headings, emphasis
- **Hierarchy**:
  - Page Titles: text-3xl/4xl font-semibold
  - Section Headers: text-xl/2xl font-semibold  
  - Card Titles: text-lg font-medium
  - Body/Labels: text-sm/base font-normal
  - Metadata: text-xs/sm text-gray-600

## Layout & Spacing System
**Spacing Units**: Tailwind 2, 3, 4, 6, 8, 12, 16, 20 (consistent rhythm)

**Grid Structure**:
- Dashboard layouts: Sidebar (64px collapsed / 256px expanded) + main content area
- Content max-width: max-w-7xl with px-6/8 padding
- Card spacing: gap-4 for tight grids, gap-6 for breathing room
- Section padding: py-6/8 for cards, py-12/16 for page sections

## Component Library

**Navigation**:
- Collapsible sidebar with icon-only/expanded states
- Role indicator badge at top (Club Admin/Coach/Parent)
- Grouped navigation items with subtle dividers
- Active state: Left border accent + background tint

**Dashboards**:
- Multi-column grid layouts (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Stat cards with large numbers, trend indicators, micro charts
- Quick action panels with icon buttons
- Activity feed/recent items sidebar (300-350px)

**Data Tables**:
- Sticky headers with sort indicators
- Row actions revealed on hover
- Bulk selection checkboxes
- Pagination + per-page controls
- Filter chips above table

**Scheduling Interface**:
- Calendar grid with time slots
- Drag-drop visual affordance (dashed borders on hover)
- Conflict warnings: Red border + warning icon
- Multi-view toggle (day/week/month)
- Legend for session types with color coding

**Forms & Inputs**:
- Floating labels for text inputs
- Clear field groupings with subtle backgrounds
- Inline validation messages
- Multi-step forms with progress indicator
- Date/time pickers with conflict previews

**Cards**:
- Athlete/Team cards: Avatar + name + key stats + quick actions
- Session cards: Time + location + attendance indicator + status badge
- Contract cards: Pricing tier + dates + payment status

**Modals & Overlays**:
- Slide-over panels for quick edits (400px width)
- Full modals for complex forms (max-w-2xl)
- Confirmation dialogs with clear action hierarchy

## Landing Page Structure

**Hero Section** (80vh):
- Full-width background image showing youth sports action/team management context
- Centered headline + subheadline + dual CTAs
- CTA buttons with blurred backgrounds (backdrop-blur-sm bg-white/10)
- Trust indicator strip below hero (client logos)

**Feature Showcase** (3-column grid):
- Icon + heading + description for core features
- Alternate row backgrounds for visual rhythm

**Role-Based Benefits** (2-column splits):
- Coach section, Admin section, Parent section
- Screenshot mockups paired with benefit lists

**Pricing Tiers** (3-column comparison):
- Contract-based pricing display
- Feature comparison table

**Social Proof**:
- Testimonial cards with organization logos
- Success metrics in 4-column stat display

**Footer**:
- Multi-column navigation + newsletter signup
- Contact info + social links

## Images

**Hero Image**: 
High-energy youth sports scene - coaches with tablets managing teams, athletes in action, or modern sports facility. Professional photography, slightly desaturated for brand overlay. Position: Full-width background with dark gradient overlay (from-black/40 to-black/20).

**Feature Screenshots**: 
Dashboard UI mockups showing scheduling calendar, athlete roster grid, and payment management. Use in Features section and Role-Based Benefits.

**Testimonial Section**:
Organization/club logos from existing clients, small headshots for testimonial quotes.

## Interaction Principles
- Instant feedback on data changes (success toasts)
- Optimistic UI updates for speed perception
- Loading skeletons matching content layout
- Keyboard shortcuts for power users (visible on hover)
- Minimal motion: Subtle fades and slides only (duration-200)