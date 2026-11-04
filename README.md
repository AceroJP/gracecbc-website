# Grace Christian Baptist Church Website

A responsive website foundation for Grace Christian Baptist Church (GCBC), with a public-facing site and a separate admin workspace shell. This project is being implemented in phases; church content and management features are intentionally not fabricated.

## Technology stack

- Next.js 16.4.4 with the App Router
- React and React DOM 19.3.1
- TypeScript 6.0.3 with strict mode
- Tailwind CSS 4.3.4
- shadcn/ui Base Nova components using Base UI 1.9.0
- Supabase SSR 0.12.7 and Supabase JavaScript client 2.118.0
- ESLint 9.39.5
- Lucide React 1.67.0
- Zod 4.6.7
- Node.js 22 or later; npm
- Vercel deployment target

Supporting packages currently included: Framer Motion 14.9.0, React Hook Form 7.91.0, TanStack Table 9.3.1, Sonner 2.0.8, class-variance-authority 0.7.1, `cn` 0.5.2, and `tw-animate-css` 1.4.0.

## Requirements

- Node.js 22 or later
- npm
- A Supabase project for features that require Supabase

## Installation and local development

Install dependencies:

```bash
npm install
```

Create `.env.local` from the example file.

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:

```bash
cp .env.example .env.local
```

Set the Supabase environment variables described below in `.env.local`. Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build locally |

## Supabase setup

1. Create or select a project in the Supabase dashboard.
2. Find the project URL and publishable key in the project's Connect/API settings.
3. Add them to `.env.local`:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

4. Restart the Next.js server after changing environment variables.

The browser and server Supabase clients use the public URL and publishable key. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_*` variable or expose it to browser code. `.env*` files are ignored by Git; `.env.example` contains variable names only.

Supabase SSR session-cookie refresh is wired through the Next.js proxy. The current repository does not yet include database migrations or application tables, and no database schema, row-level security policies, content publishing, or Realtime behavior is implemented. An empty `supabase/migrations/` directory is reserved for future migrations.

## Project structure

```text
src/
  app/
    (public)/             Public website routes and layout
    admin/                Admin dashboard and placeholder sections
    error.tsx             Application error boundary
    globals.css           Tailwind import and design tokens
    layout.tsx            Root layout, fonts, and metadata
    not-found.tsx         Not-found page
    proxy.ts              Supabase session refresh entry point
  components/
    admin/                Admin interface shell
    public/               Public header and footer
    ui/                   Reusable Base UI/shadcn components
  lib/
    auth/                 Server-side auth helpers
    supabase/              Browser/server clients and session proxy
    env.ts                 Runtime validation for public Supabase config
  types/
    database.types.ts     Supabase database type placeholder
public/
  icons/
  images/
  logos/
supabase/
  migrations/              Reserved for database migrations
```

Other key files: `components.json` configures shadcn/Base Nova and aliases; `eslint.config.mjs` configures ESLint; `postcss.config.mjs` enables Tailwind CSS 4; `tsconfig.json` enables strict TypeScript and the `@/*` alias.

## Deployment with Vercel

1. Push the project to a Git provider supported by Vercel and import the repository into Vercel, or deploy it using the Vercel CLI.
2. In Vercel project settings, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the required deployment environments. Use the same values configured for the intended Supabase project; never add a service-role key to client-visible environment variables.
3. Deploy. Vercel detects the Next.js framework and uses the project build configuration.
4. If/when Supabase Auth is enabled, configure its allowed site and redirect URLs for the deployed domain and local development URL.

## Current implementation status

- **Public website:** responsive shell and content-area placeholders are in place. Church-specific schedules, addresses, contact information, events, and other content remain pending confirmation.
- **Admin workspace:** responsive dashboard and placeholder sections are in place. The interface is **not protected** by authentication or authorization; do not enter sensitive information.
- **Supabase:** environment validation, browser/server clients, and session refresh are implemented. Auth screens, admin access control, database schema, RLS policies, storage, and Realtime features are not implemented.
- **Design system:** Tailwind theme tokens and reusable button, input, card, and dialog components are available.
- **Verification:** lint, TypeScript, and production build passed during Phase 9. Browser checks confirmed public/admin pages and responsive layouts at mobile, tablet, and desktop widths.

## Remaining setup and implementation

- Confirm and supply church-approved public website content.
- Design database tables and migrations, then define and verify row-level security policies before storing application data.
- Implement administrator sign-in and enforce authorization on protected routes and server-side data operations before using the admin workspace for real management.
- Configure and verify Supabase Auth redirect URLs when authentication is implemented.
- Add and test storage, publishing, and Realtime behavior only when those features are approved and their policies are in place.
