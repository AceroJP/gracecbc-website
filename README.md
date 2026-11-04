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

Supabase SSR session-cookie refresh is wired through the Next.js proxy. Authentication uses the Supabase project configured in Vercel; no local database or application schema is required for sign-in.

### Admin authentication and access

- Visit `/login` and sign in with an existing Supabase Auth email/password account. Public sign-up is not provided. The older `/auth/login` path redirects to `/login`.
- Every `/admin` route checks the signed-in user on the server. Only a user whose server-managed `app_metadata.role` is exactly `admin` can enter the admin workspace.
- Grant administrator access to the intended account using a trusted server-side Supabase Admin API operation or another secure administrative process that updates **app metadata** to `{ "role": "admin" }`. Do not use user-editable `user_metadata` for authorization. Never put a service-role key in this application or in a `NEXT_PUBLIC_*` variable.
- Add the production site URL and `/login`-related redirect URLs to Supabase Auth's allowed URLs when required by your project settings.
- Sign out using the control in the admin header.

### Events content

The Events admin page creates, updates, and deletes church events stored in the same Supabase project used for authentication. Saving an event publishes it immediately on the public homepage. Events may have an optional end date for multi-day events; leave it blank for a one-day event. Event dates and times are stored as local church date/time values.

Before deploying the Events feature, apply the migration files in `supabase/migrations/` to the connected Supabase project, in filename order. In the Supabase Dashboard, open **SQL Editor**, paste and run each migration that has not already been applied. Do not rerun migrations on an existing database; for an existing Events installation, apply only the new migration. The migrations grant public event reads and restrict event create, update, and delete operations to signed-in users whose server-managed `app_metadata.role` is `admin`.

### Event registration

Admins can enable registration per event, add up to 20 custom fields (short/long answer, email, phone, dropdown, or checkbox), and mark each field required or optional. Registration can have an optional closing date and participant limit. Visitors complete a Cloudflare Turnstile challenge before submission. The server verifies the single-use token, applies a database-backed limit of five attempts per event/IP per fixed 15-minute window, validates every answer against the saved form, then records the submission. Registrations are private to admins and can be viewed or exported as CSV from the event in the admin portal.

Configure these Vercel variables before enabling event registration:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: the public site key from a Cloudflare Turnstile widget configured for the website hostnames.
- `TURNSTILE_SECRET_KEY`: the matching Turnstile secret; server-only.
- `SUPABASE_SECRET_KEY`: a Supabase secret key used only by the server to call narrowly granted registration and rate-limit database functions. Never use a `NEXT_PUBLIC_` prefix or expose this value to the browser.

Set these variables for the Production environment in Vercel and redeploy after changing them. The Turnstile widget must also allow the production hostname (for example, `gracechristianbaptistchurch.vercel.app`) in its Cloudflare hostname settings. If the public site key is unset, the registration form is intentionally unavailable; if its hostname is not allowed, the form loads but Turnstile verification fails.

The Supabase secret key is an elevated credential, not a Google Forms API key. Keep it only in the server environment. If any security setting or challenge verification is unavailable, the registration is rejected. Apply all unapplied migration files before deployment; the registration migration adds registration data and rate-limiting functions.

## Project structure

```text
src/
  app/
    (public)/             Public website routes and layout
    auth/                 Supabase email/password sign-in and sign-out actions
    admin/                Admin dashboard, Events manager, and protected sections
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
    database.types.ts     Supabase database types
public/
  icons/
  images/
  logos/
supabase/
  migrations/              Supabase database schema migrations
```

Other key files: `components.json` configures shadcn/Base Nova and aliases; `eslint.config.mjs` configures ESLint; `postcss.config.mjs` enables Tailwind CSS 4; `tsconfig.json` enables strict TypeScript and the `@/*` alias.

## Deployment with Vercel

1. Push the project to a Git provider supported by Vercel and import the repository into Vercel, or deploy it using the Vercel CLI.
2. In Vercel project settings, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the required deployment environments. Use the same values configured for the intended Supabase project; never add a service-role key to client-visible environment variables.
3. Deploy. Vercel detects the Next.js framework and uses the project build configuration.
4. If/when Supabase Auth is enabled, configure its allowed site and redirect URLs for the deployed domain and local development URL.

## Current implementation status

- **Public website:** published events and their enabled registration forms are displayed on the homepage. Other church-specific content remains pending confirmation.
- **Admin workspace:** events and registration forms can be managed; authorized admins can view registrations and export them as CSV. Remaining sections are placeholders. Server-side checks require a signed-in Supabase user with `app_metadata.role === "admin"`.
- **Supabase:** environment validation, browser/server clients, session refresh, email/password sign-in, admin role checks, event RLS, private registration submissions, challenge verification, and database-backed registration rate limiting are implemented. Apply all unapplied migrations and configure the required Vercel environment variables before enabling production registration. Storage and Realtime features are not implemented.
- **Design system:** Tailwind theme tokens and reusable button, input, card, and dialog components are available.
- **Verification:** lint, TypeScript, and production build passed during Phase 9. Browser checks confirmed public/admin pages and responsive layouts at mobile, tablet, and desktop widths.

## Remaining setup and implementation

- Confirm and supply church-approved public website content.
- Apply the Supabase migrations to the production project and configure Turnstile/Supabase server secrets before deploying registration.
- Design database tables and migrations for the remaining content sections, then define and verify row-level security policies before storing that content.
- Grant `app_metadata.role = "admin"` to the intended administrator account using a trusted administrative process.
- Configure and verify Supabase Auth redirect URLs when authentication is implemented.
- Add and test storage, publishing, and Realtime behavior only when those features are approved and their policies are in place.
