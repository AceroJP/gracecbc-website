# GITHUB COPILOT AGENT — PROJECT FOUNDATION & ARCHITECTURE IMPLEMENTATION

## Project Name
Grace Christian Baptist Church (GCBC) — Dynamic Church Website & Admin CMS

## ROLE

Act as a Senior Full-Stack Developer and Software Architect.

Your task is to initialize and configure the project, install the approved technology stack, establish a scalable project architecture, and prepare the application for future feature development.

You are authorized to create and modify project files, install dependencies, configure tooling, and implement the initial application shell.

Do not build all business features yet.

---

# PHASE 1 — PROJECT INSPECTION

Before making changes:

1. Inspect the existing workspace and directory structure.
2. Determine whether this is an existing project or a new project.
3. Inspect existing package.json, dependencies, configuration files, and source code.
4. Preserve existing working code and configuration where possible.
5. Do not overwrite important files without checking their contents.
6. Identify existing configuration problems before proceeding.

If the workspace is empty, initialize the project.

If an existing project is present, adapt it rather than unnecessarily recreating it.

---

# PHASE 2 — APPROVED TECHNOLOGY STACK

Use these exact technologies:

| Technology | Requirement |
|---|---|
| Next.js | Version 16 |
| React | Version 19 |
| TypeScript | Latest compatible stable version |
| Tailwind CSS | Version 4 |
| Supabase | PostgreSQL, Auth, Storage |
| shadcn/ui | Component system |
| Base UI | Preferred component primitive |
| Radix UI | Only where necessary |
| Framer Motion | Animation |
| Lucide React | Icons |
| ESLint | Linting |
| Vercel | Deployment |

Additional supporting libraries:

- React Hook Form
- Zod
- TanStack Table
- Sonner

### Important compatibility rules

1. Verify that all selected packages are compatible with Next.js 16 and React 19.
2. Do not install outdated versions simply because they appear in older tutorials.
3. Use official installation commands and documentation.
4. Do not force incompatible package versions.
5. Prefer stable releases over experimental or canary releases.
6. If a dependency is incompatible, stop and report the issue before substituting it.
7. Do not unnecessarily install both Base UI and Radix implementations of the same component.
8. Use the current shadcn/ui initialization and component installation conventions for Tailwind CSS 4.

---

# PHASE 3 — PROJECT INITIALIZATION

Configure:

- Next.js 16 with App Router.
- React 19.
- TypeScript with strict mode.
- Tailwind CSS 4.
- ESLint.
- Path alias using @/*.
- Lucide React.
- Framer Motion.
- shadcn/ui with the approved Base UI approach.
- Required supporting libraries.

Ensure the project has clean and consistent configuration.

Configure reusable global CSS variables and design tokens.

Do not introduce unnecessary configuration files or dependencies.

---

# PHASE 4 — PROJECT ARCHITECTURE

Establish the following architecture.

gcbc-website/
│
├── public/
│   ├── images/
│   ├── icons/
│   └── logos/
│
├── src/
│   │
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── events/
│   │   │   ├── baptism/
│   │   │   ├── devotionals/
│   │   │   ├── livestream/
│   │   │   └── contact/
│   │   │
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── landing-page/
│   │   │   ├── events/
│   │   │   ├── announcements/
│   │   │   ├── schedules/
│   │   │   ├── baptism/
│   │   │   ├── devotionals/
│   │   │   ├── livestream/
│   │   │   ├── media/
│   │   │   └── settings/
│   │   │
│   │   ├── auth/
│   │   │   └── login/
│   │   │
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── public/
│   │   ├── admin/
│   │   ├── shared/
│   │   └── providers/
│   │
│   ├── features/
│   │   ├── landing-page/
│   │   ├── events/
│   │   ├── announcements/
│   │   ├── schedules/
│   │   ├── baptism/
│   │   ├── devotionals/
│   │   ├── livestream/
│   │   ├── media/
│   │   └── settings/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   ├── auth/
│   │   ├── validations/
│   │   ├── utils/
│   │   └── constants/
│   │
│   ├── hooks/
│   ├── types/
│   └── config/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── .env.example
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md

You may adjust the architecture if technically necessary, but explain any significant deviation.

Do not create empty files for every possible feature. Establish the directories and essential files needed for the initial working foundation.

---

# PHASE 5 — SUPABASE FOUNDATION

Prepare Supabase integration.

Create:

1. Browser Supabase client.
2. Server Supabase client.
3. Authentication-related utilities.
4. Type definitions for database interaction.
5. Environment variable validation.
6. Secure server-side configuration.

Prepare the following environment variables in .env.example:

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

Use the current Supabase recommended publishable-key configuration where appropriate.

Do not put secret keys or service-role keys in client-side code.

Do not invent credentials.

If Supabase credentials are unavailable, implement the configuration structure and document what I need to provide.

Do not pretend that database connectivity has been verified if no credentials are available.

---

# PHASE 6 — INITIAL UI FOUNDATION

Establish two separate application experiences.

## A. Public Website

Create the initial public website shell.

Requirements:

- Responsive navigation.
- Church logo placeholder.
- Main content container.
- Footer.
- Mobile navigation.
- Consistent typography.
- Responsive spacing.
- Theme variables.

The visual direction should be:

- Modern Baptist church website.
- Welcoming and professional.
- Clean and minimal.
- Strong typography.
- Calm and trustworthy color palette.
- Mobile-first responsive design.

Do not populate it with invented church information.

Use clearly identified placeholders until actual church content is provided.

## B. Admin Dashboard

Create an initial admin dashboard shell.

Requirements:

- Responsive sidebar.
- Top navigation.
- Main content area.
- Mobile-friendly navigation.
- User profile placeholder.
- Notification area.
- Breadcrumbs where appropriate.
- Reusable dashboard layout.

Admin navigation:

1. Dashboard
2. Landing Page Builder
3. Events
4. Announcements
5. Schedules
6. Baptism
7. Devotionals
8. Livestream
9. Media Library
10. Website Settings

The admin area must be logically separated from the public website.

Do not create fake authentication or claim that the admin dashboard is protected until real authentication and authorization are implemented.

---

# PHASE 7 — DESIGN SYSTEM

Create a reusable design system.

Include:

- Color tokens.
- Typography.
- Spacing conventions.
- Border radius.
- Shadows.
- Button variants.
- Input styles.
- Card styles.
- Dialog styles.
- Responsive breakpoints.

Use Tailwind CSS 4 conventions.

Use shadcn/ui components as the primary reusable UI foundation.

Use Lucide React for icons.

Use Framer Motion selectively for meaningful transitions.

Avoid unnecessary animations and visual clutter.

---

# PHASE 8 — CODE QUALITY

Requirements:

1. Use TypeScript strict mode.
2. Avoid using any unless justified.
3. Keep components reusable and maintainable.
4. Avoid oversized page components.
5. Separate business logic from presentation.
6. Use server components by default.
7. Use client components only when interaction requires them.
8. Follow Next.js App Router conventions.
9. Validate form data with Zod where applicable.
10. Follow ESLint rules.
11. Avoid unnecessary dependencies.
12. Never expose secrets.
13. Add meaningful loading, error, and not-found boundaries where appropriate.

---

# PHASE 9 — TESTING AND VERIFICATION

After implementation:

Run and verify:

1. npm install.
2. npm run lint.
3. npx tsc --noEmit.
4. npm run build.

Resolve errors caused by your implementation.

Verify:

- Application starts successfully.
- Public route renders.
- Admin dashboard shell renders.
- Responsive layouts work at mobile, tablet, and desktop sizes.
- No missing imports.
- No TypeScript errors.
- No broken package configuration.
- No exposed credentials.

If a test cannot be completed, explain why.

Do not claim success without actual verification.

---

# PHASE 10 — DOCUMENTATION

Update README.md with:

- Project overview.
- Technology stack.
- Installation instructions.
- Development commands.
- Folder architecture explanation.
- Supabase setup instructions.
- Environment variables.
- How to run the application.
- How to deploy using Vercel.
- Current implementation status.
- Remaining setup requirements.

---

# FINAL DEVELOPMENT RULES

- Do not build the complete church CMS yet.
- Do not implement all database tables yet.
- Do not create fake production authentication.
- Do not invent church details, addresses, or schedules.
- Do not use unnecessary sample data.
- Do not change the approved technology stack without approval.
- Do not introduce a multi-tenant architecture.
- Do not overengineer the project.
- Do not silently skip failed tests.

## EXPECTED DELIVERABLE

When finished, provide:

1. Summary of project initialization.
2. Installed dependency list and versions.
3. Final folder structure.
4. Important configuration files created.
5. Supabase setup status.
6. Public website shell status.
7. Admin dashboard shell status.
8. Responsive design verification.
9. Lint, TypeScript, and production build results.
10. Any outstanding issues or required manual actions.

**Begin by inspecting the workspace. Then implement the project foundation systematically.**