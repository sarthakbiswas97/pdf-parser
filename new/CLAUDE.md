# DocParser Frontend

## Tech Stack

- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 + shadcn/ui (New York style)
- **Routing:** React Router v7
- **Forms:** React Hook Form + Zod validation
- **Data Fetching:** TanStack Query (React Query)
- **Icons:** Lucide React
- **Utilities:** clsx, tailwind-merge, class-variance-authority

## Project Structure

```
src/
  components/
    ui/           # shadcn/ui primitives (auto-generated, do not manually edit)
    layout/       # Shell, SideRail, TopBar
    features/     # Feature-specific components grouped by domain
      upload/     # UploadZone, ImportCards
      document/   # ResultsView, FieldGrid, SummaryCard, PagePanel
      chat/       # ChatDock, MessageBubble, ChatInput
      batch/      # BatchView, BatchCard
      integrations/ # DriveBrowser, GmailBrowser, EmailDigest
      settings/   # SettingsPanel
  hooks/          # Custom React hooks
  lib/            # Utilities (api client, cn helper, constants)
  types/          # TypeScript type definitions
  pages/          # Route-level page components
  App.tsx         # Router + providers setup
  main.tsx        # Entry point
```

## Design System

### Colors (Dark Theme - Always Dark, No Light Mode)

- **Background:** `#0a0a0a` (near-black)
- **Surface:** `#111111` / `#161616` / `#1a1a1a` (layered surfaces)
- **Border:** `rgba(255, 255, 255, 0.08)` (subtle) / `rgba(255, 255, 255, 0.16)` (active)
- **Primary (Green):** `#22c55e` (actions, CTAs) / `#4ade80` (highlights, badges)
- **Text:** `#fafafa` (primary) / `#a3a3a3` (muted) / `#525252` (faint)
- **Amber:** `#fbbf24` (OCR indicators, warnings)
- **Red:** `#f87171` (errors, destructive)

### Typography

- **Sans:** Inter (body text, UI)
- **Mono:** JetBrains Mono (data values, badges, code)
- **Base size:** 14px
- **Headings:** tracking-tight, font-semibold

### Layout Architecture (Inverted-L Shell)

```
+--------+------------------------------------------+
| Side   |  Top Bar (48px, contextual)              |
| Rail   +------------------------------------------+
| 56px   |                                          |
| icons  |  Main Content (centered, max-w-3xl)      |
|        |                                          |
|        +------------------------------------------+
|        |  Chat Dock (pinned bottom)               |
+--------+------------------------------------------+
```

- **Side Rail (56px):** Icon-only navigation, green active indicator, tooltips
- **Top Bar (48px):** Document context, status badges, breadcrumbs
- **Main Content:** Centered, max-width 768px, scrollable
- **Chat Dock:** Pinned bottom, expandable to 50vh
- **Right Panel (360px, conditional):** Page details, citations (inline on xl+)

### Spacing

- 4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Cards: `p-4` to `p-6`
- Sections: `gap-6` to `gap-8`

### Border Radius

- Cards: `rounded-lg` (10px)
- Buttons: `rounded-md` (8px)
- Badges: `rounded-full`
- Modals/Upload zone: `rounded-xl` (14px)

### Animations

- Hover states: 100ms ease
- Panel transitions: 200ms cubic-bezier(0.16, 1, 0.3, 1)
- Page transitions: 300ms
- Card hover: translateY(-1px) + shadow, NOT background change

## Backend API

- Base URL: proxied through Vite dev server to `http://localhost:8000`
- Streaming: NDJSON format for `/parse`, `/batch`, `/integrations/drive/parse/*`
- Auth: Google OAuth via popup window + postMessage

### Key Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/parse` | Upload + parse PDF (streaming NDJSON) |
| POST | `/analyze` | AI classify + extract fields |
| POST | `/chat` | RAG Q&A on document |
| POST | `/export` | Export parsed data (JSON/CSV) |
| POST | `/batch` | Batch parse multiple PDFs |
| GET/POST | `/settings` | Integration settings |
| GET | `/auth/google/status` | Check Google auth |
| GET | `/auth/google` | Start OAuth flow |
| POST | `/auth/google/disconnect` | Revoke Google tokens |
| GET | `/integrations/drive/browse` | Browse Drive folders |
| POST | `/integrations/drive/parse/:id` | Parse Drive PDF |
| GET | `/integrations/gmail/attachments` | List email attachments |
| POST | `/integrations/gmail/parse/:msgId/:attId` | Parse email attachment |
| GET | `/integrations/gmail/digest` | Email digest |
| POST | `/integrations/gmail/chat` | Chat about emails |
| POST | `/integrations/calendar/add` | Add calendar event |
| GET | `/schemas` | List doc type schemas |

## Conventions

- **No emojis** in code, comments, or UI text
- **Immutable state** - never mutate, always create new objects
- **Type everything** - all function signatures must have type annotations
- **Early returns** - avoid deep nesting (max 3 levels)
- **Error boundaries** - wrap route-level components
- **Loading states** - use Skeleton components, never bare spinners
- **Empty states** - always design empty states with icon + message
- **Accessible** - all interactive elements must have aria labels
- **No `any`** - use `unknown` and narrow with type guards

## Commands

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```
