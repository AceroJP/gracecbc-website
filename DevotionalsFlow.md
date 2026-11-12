# GCBC COMMUNITY DEVOTIONALS
## Complete Feature Development Specification

You are working on the existing Grace Christian Baptist Church (GCBC) website.

Your task is to plan and implement a Community Devotionals feature that allows approved contributors to submit Christian devotionals for public reading.

This is an extension of the existing GCBC website, NOT a separate application.

Follow the existing project architecture, coding conventions, security requirements, and `WORKFLOW.md`.

---

# 1. EXISTING PROJECT TECHNOLOGY

The project uses the following stack:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- shadcn/ui
- Base UI as the preferred component primitive
- Radix UI only when needed
- Framer Motion
- Lucide React
- ESLint
- Vercel

Use the existing installed versions and configurations.

Do not upgrade packages or introduce unnecessary dependencies without approval.

Architecture requirements:

- Next.js App Router.
- Server Components by default.
- Client Components only when interactivity is required.
- Supabase server and browser clients must follow the existing project conventions.
- Server-side authorization for privileged operations.
- Database migrations for schema changes.
- Row Level Security (RLS) for database protection.

IMPORTANT:

Before development, inspect the existing project and follow `WORKFLOW.md`.

Do not assume that a feature, component, table, route, or utility already exists. Verify it first.

# 2. MAIN OBJECTIVE

Create a public Community Devotionals page where visitors can:

- Read published devotionals.
- Search devotionals.
- Browse devotionals by date or topic.
- View the author of each devotional.
- React to devotionals using a Like button.
- View the total number of likes.

Visitors do not need accounts to read or like devotionals.

Anyone interested in contributing must first apply and receive administrator approval.

Approved contributors can submit devotionals using a username-and-password modal.

All submitted devotionals must undergo administrator review before publication.

# 3. PUBLIC WEBSITE ROUTES

Integrate the feature into the existing GCBC public website.

Suggested routes:

- `/devotionals` — Public devotional listing.
- `/devotionals/[slug]` — Individual devotional reading page.
- `/devotionals/apply` — Contributor application page, or an application modal if that better matches the existing design.

The public navigation should link to `/devotionals`.

The Devotionals landing page should include:

1. Page heading and introduction.
2. Featured devotional, if configured.
3. Latest published devotionals.
4. Search functionality.
5. Topic/category filters.
6. Pagination or Load More.
7. Become a Contributor button.
8. Write a Devotional button.

The Write a Devotional button should open the contributor credential modal.

If the visitor is not an approved contributor, the server must reject the submission even if they access the modal or endpoint directly.

Only published devotionals may appear in public listings, search results, or individual reading pages.

Do not expose drafts, rejected devotionals, pending submissions, or unpublished content.

# 4. CONTRIBUTOR APPLICATION SYSTEM

Create a public contributor application form.

Anyone can apply without having an existing GCBC website account.

## Required application fields

1. Full Name
2. Preferred Username
3. Email Address
4. Password
5. Confirm Password
6. Agreement to the contributor guidelines.

Validation:

- Full name is required.
- Username is required and must be unique.
- Username should support a clearly defined character set.
- Username comparison should be case-insensitive.
- Email address must have a valid format.
- Email ownership must be verified.
- Password must meet reasonable security requirements.
- Password confirmation must match.
- Terms and contributor guidelines must be accepted.

Never store passwords as plaintext.

Use Supabase Auth for password hashing and credential verification where appropriate.

Do not implement a custom password storage system.

Do not store passwords in application records, contributor profiles, logs, or email messages.

## Application workflow

1. Applicant completes the form.
2. Server validates the application.
3. The applicant verifies their email address.
4. The application is recorded as Pending Admin Approval.
5. Administrator reviews the application.
6. Administrator can approve or reject the application.
7. Approved applicants receive an email notification.
8. Approved contributors can submit devotionals.

Email verification and administrator approval are separate requirements.

An applicant must not gain contributor privileges merely by verifying their email.

An applicant must not gain contributor privileges before administrator approval.

## Application statuses

- Pending Email Verification
- Pending Admin Approval
- Approved
- Rejected
- Suspended

Provide appropriate messages for each status.

Prevent duplicate applications and duplicate usernames.

Do not reveal whether an email address or username belongs to an existing account through public error messages.

# 5. CONTRIBUTOR CREDENTIAL MODAL

Approved contributors do not need a traditional dashboard or persistent login.

When someone clicks Write a Devotional, open a clean modal.

Modal fields:

- Username
- Password

Modal actions:

- Cancel
- Continue

After submitting credentials:

1. Verify the credentials securely on the server.
2. Confirm that the contributor's account is approved and not suspended.
3. If credentials are invalid, display a generic error message.
4. If the account is not approved, do not allow submission.
5. If credentials are valid, allow access to the devotional submission form.

IMPORTANT SECURITY REQUIREMENT:

The user explicitly wants contributors to enter their username and password whenever they want to post.

Do not create a persistent contributor login session or a contributor dashboard.

Use a secure server-side authentication approach.

Preferred approach:

- Use Supabase Auth for actual password verification.
- Associate each authenticated user with a unique contributor profile.
- Resolve the username to the associated account securely on the server.
- Verify contributor approval status.
- Avoid exposing authentication tokens to browser code.
- Do not persist a contributor session in the browser.
- Use a short-lived, single-use authorization mechanism for the submission process if required by the chosen architecture.
- Ensure the authorization is tied to the approved contributor and cannot be reused by another person.
- Protect submission endpoints against replay, brute-force attempts, and unauthorized requests.

If Supabase Auth cannot support the intended username/password workflow safely with the existing architecture, explain the alternative before implementation.

Do not invent a custom authentication shortcut.

# 6. DEVOTIONAL SUBMISSION FORM

After successful contributor verification, display the devotional editor.

The submission form should be simple, organized, and comfortable to use.

## Required fields

### A. Devotional Title

Example:

Walking by Faith, Not by Sight

### B. Bible Passage

Example:

2 Corinthians 5:7

Allow a Bible book name, chapter, and verse reference.

### C. Bible Translation

Suggested options:

- KJV
- ESV
- Other

Allow the administrator to configure supported translations if necessary.

Do not automatically reproduce copyrighted Bible translations in full without considering their usage permissions.

### D. Key Verse

Allow the contributor to enter the selected key verse or a relevant excerpt.

Include its Bible reference.

### E. Devotional Message

Provide a rich-text editor supporting:

- Paragraphs
- Headings
- Bold
- Italic
- Numbered lists
- Bullet lists
- Bible references
- Links, if allowed by the administrator

Sanitize submitted HTML or rich-text content on the server.

Do not allow arbitrary scripts, unsafe HTML, or embedded malicious content.

### F. Personal Application

Allow contributors to explain how readers can apply the biblical lesson in daily life.

### G. Closing Prayer

Allow contributors to include a short prayer related to the devotional.

### H. Optional Topic/Category

Suggested categories:

- Faith
- Prayer
- Salvation
- Christian Living
- Forgiveness
- Love
- Hope
- Spiritual Growth
- Family
- Other

Allow the administrator to manage the categories.

## Automatic information

The system should automatically associate:

- Contributor ID
- Contributor display name
- Submission date
- Devotional status
- Created timestamp
- Updated timestamp

Contributors must not be able to impersonate another author by changing the author name in the request.

## Submission actions

- Save Draft, if supported by the chosen submission flow.
- Submit for Review.
- Cancel.

Before final submission, display a confirmation step.

After successful submission, show:

"Your devotional has been submitted successfully and is awaiting administrator review. Thank you for sharing God's Word with the GCBC community."

The submitted devotional must have the status Pending Review.

It must NOT automatically become publicly visible.

# 7. DEVOTIONAL APPROVAL AND MODERATION

This is a mandatory feature.

Every submitted devotional must be reviewed by an authorized GCBC administrator before publication.

Create an admin management section for devotionals.

Suggested route:

`/admin/devotionals`

Use the existing admin route and layout conventions if different.

## Admin dashboard overview

Display:

- Total devotionals
- Published
- Pending Review
- Rejected
- Unpublished
- Total contributors

## Admin devotional management

Provide tabs or filters:

- All
- Pending Review
- Published
- Rejected
- Unpublished

For every devotional, display:

- Title
- Author
- Bible passage
- Submission date
- Current status
- Last updated

## Admin actions

Administrator can:

1. View complete devotional.
2. Preview public presentation.
3. Edit devotional content.
4. Approve and publish.
5. Reject submission.
6. Unpublish an existing devotional.
7. Delete devotional after confirmation.
8. Add an internal moderation note.

When rejecting a devotional, provide an optional reason.

When publishing, allow the administrator to:

- Set or confirm publication date.
- Feature the devotional on the public page.
- Confirm its category.

Record who approved, rejected, edited, or unpublished a devotional and when.

Do not allow ordinary contributors to perform administrator actions.

# 8. PUBLIC DEVOTIONAL DESIGN

Create a professional and welcoming Community Devotionals page.

Follow the existing GCBC website design system.

Do not redesign the entire website.

The public page should feel like part of the original GCBC website.

## Devotional listing card

Each card should display:

- Devotional title
- Bible passage
- Short excerpt
- Author name
- Publication date
- Category
- Like count
- Read Devotional link

Keep the design clean and readable.

Avoid unnecessary visual clutter.

Do not allow long titles or descriptions to break the card layout.

Use consistent card spacing, typography, and responsive behavior.

## Individual devotional reading page

Suggested content order:

1. Category
2. Devotional title
3. Bible passage
4. Author information
5. Publication date and reading time
6. Key verse
7. Devotional message
8. Personal application
9. Closing prayer
10. Like button and reaction count
11. Related devotionals

The reading experience should prioritize readability.

Use a comfortable content width, clear headings, proper paragraph spacing, and accessible typography.

The author name should be displayed publicly.

Do not expose the contributor's private email address.

# 9. ANONYMOUS LIKE / REACTION SYSTEM

Visitors should be able to like devotionals without creating accounts.

Requirements:

- Like button with heart icon.
- Display total likes.
- Update the displayed count after a successful reaction.
- Avoid repeated likes from the same browser/device where reasonably possible.
- Allow a visitor to remove their like if the chosen design supports toggling.
- Prevent simple duplicate requests.
- Apply server-side rate limiting.
- Do not trust a client-provided reaction count.
- Never allow public visitors to change reaction counts directly.

Use a secure anonymous reaction design.

Consider a random browser-generated identifier stored locally and a server-side hashed identifier for deduplication.

Do not use personally identifying information or device fingerprinting.

Explain the limitations of anonymous likes: clearing browser data or using another device may allow another reaction.

The database must calculate or maintain the authoritative reaction count.

# 10. ADMIN CONTRIBUTOR MANAGEMENT

Suggested route:

`/admin/devotional-contributors`

Use existing admin navigation and authorization.

Display:

- Full Name
- Username
- Email (admin-only)
- Application Date
- Email Verification Status
- Contributor Status
- Number of Published Devotionals

Administrator actions:

- View application details.
- Approve application.
- Reject application.
- Suspend contributor.
- Reactivate contributor.
- View contributor's devotionals.
- Review application history.
- Delete a contributor account after explicit confirmation.

Deleting a contributor account permanently deletes its Supabase Auth user, contributor profile, applications, devotionals, reactions, reports, and submission grants. Do not allow this action for administrator accounts, and record the deletion in the audit log.

Suspended contributors must not be able to submit new devotionals.

Their previously published devotionals should not be automatically deleted.

Administrator should decide whether existing content remains published.

Send approval and rejection notifications through the existing email integration.

Never include passwords, authentication tokens, or private credentials in email.

# 11. EMAIL NOTIFICATIONS

Inspect whether the existing project already has an email provider or Supabase SMTP configuration.

Required notifications:

### Application received

Subject:

GCBC Contributor Application Received

Message:

Thank you for applying to become a GCBC devotional contributor. Your application has been received and is awaiting review.

### Email verification

Send a secure verification link or code.

### Application approved

Subject:

You Are Approved as a GCBC Devotional Contributor

Message:

Your application has been approved. You can now contribute devotionals to the Grace Christian Baptist Church website.

To submit a devotional, visit the Devotionals page and select Write a Devotional.

### Application rejected

Send a polite notification.

Do not disclose internal administrator notes.

### Devotional submitted

Optional notification to the administrator that a new devotional is awaiting review.

### Devotional published

Optional notification to the contributor that the devotional is now available publicly.

If no email provider exists:

- Identify the missing integration.
- Recommend a suitable provider.
- List the required environment variables.
- Explain the expected configuration and cost considerations.
- Wait for approval before integrating a paid external email service.

Do not claim that an email was sent unless the email provider confirms success.

# 12. DATABASE DESIGN

Inspect the existing Supabase schema before proposing new tables.

Do not create duplicate tables or conflict with existing structures.

Suggested logical entities:

### `devotional_contributors`

Purpose:

Stores contributor profile and approval status.

Suggested fields:

- id
- auth_user_id
- full_name
- username
- normalized_username
- email_verified_at
- status
- created_at
- updated_at

### `devotional_applications`

Purpose:

Tracks applications and administrator decisions.

Suggested fields:

- id
- contributor_id
- application_status
- submitted_at
- reviewed_by
- reviewed_at
- rejection_reason
- created_at
- updated_at

### `devotional_categories`

Purpose:

Stores manageable devotional categories.

Suggested fields:

- id
- name
- slug
- description
- is_active
- created_at

### `devotionals`

Purpose:

Stores submitted and published devotionals.

Suggested fields:

- id
- contributor_id
- category_id
- title
- slug
- bible_passage
- bible_translation
- key_verse
- message
- personal_application
- closing_prayer
- status
- is_featured
- submitted_at
- published_at
- approved_by
- approved_at
- rejection_reason
- created_at
- updated_at

### `devotional_reactions`

Purpose:

Stores anonymous reactions.

Suggested fields:

- id
- devotional_id
- visitor_identifier_hash
- created_at

Add an appropriate unique constraint to prevent duplicate reactions for the same devotional and visitor identifier.

### `devotional_reports`

Purpose:

Allows public readers to report inappropriate or misleading content.

Suggested fields:

- id
- devotional_id
- reason
- details
- status
- created_at
- reviewed_by
- reviewed_at

The final database design may differ if an existing project structure provides a better solution.

Requirements:

- Foreign keys.
- Appropriate indexes.
- Unique constraints.
- Check constraints where appropriate.
- Timestamps.
- Referential integrity.
- Proper deletion behavior.
- Database migrations.
- RLS policies.

Do not execute destructive schema changes without approval.

# 13. SECURITY REQUIREMENTS

Security is a priority because the feature accepts public submissions.

Implement and test:

1. Server-side validation for every application and devotional submission.
2. Secure password verification through Supabase Auth.
3. Email verification.
4. Username uniqueness enforced by the database.
5. Contributor approval checks on the server.
6. Admin-only moderation permissions.
7. RLS for every relevant table.
8. No public access to private applications.
9. No public access to contributor emails or authentication data.
10. No public access to unpublished devotionals.
11. No service-role key or secret exposed to client-side code.
12. Sanitization of rich-text content.
13. Rate limiting for applications, credential attempts, submissions, and reactions.
14. CSRF protection where applicable.
15. Secure single-use submission authorization.
16. Safe error messages.
17. Audit logging for administrative actions.
18. Protection against duplicate submissions.
19. Input length and payload size limits.
20. Safe handling of malicious links and HTML.

Never disable RLS to make the feature work.

Do not rely on hiding buttons or frontend checks as authorization.

The server and database must enforce permissions.

If a security requirement cannot be implemented with the existing stack, explain the limitation and propose a safe alternative.

# 14. TESTING REQUIREMENTS

Test the complete workflow.

## Contributor applications

- Valid application.
- Missing required fields.
- Invalid email.
- Duplicate username.
- Password mismatch.
- Email verification.
- Pending application.
- Approved application.
- Rejected application.

## Contributor credentials

- Correct username and password.
- Incorrect password.
- Unknown username.
- Unverified email.
- Pending contributor.
- Approved contributor.
- Suspended contributor.
- Repeated failed attempts.
- Expired or reused submission authorization.

## Devotional submissions

- Valid devotional.
- Missing title.
- Missing Bible passage.
- Empty message.
- Invalid content.
- Malicious HTML.
- Duplicate submission.
- Unauthorized contributor.
- Successful submission to Pending Review.

## Admin moderation

- Approve and publish.
- Reject.
- Edit.
- Unpublish.
- Delete with confirmation.
- Unauthorized admin access.

## Public website

- Published devotionals are visible.
- Pending devotionals are hidden.
- Rejected devotionals are hidden.
- Search works.
- Filters work.
- Individual reading pages work.
- Likes work.
- Duplicate likes are prevented as designed.
- Private contributor information is not exposed.

## Responsive testing

Test:

- Desktop.
- Tablet.
- Mobile.

Run the available:

- ESLint.
- TypeScript checks.
- Unit tests.
- Integration tests.
- Playwright tests, if available.

Report actual test results. Never claim tests passed without running them.

# 15. DEVELOPMENT PHASES AND APPROVAL GATES

Do not implement the entire feature in one operation.

Work in the following phases.

## PHASE 1 — PROJECT INSPECTION

First, inspect:

- `WORKFLOW.md`
- `.github/copilot-instructions.md`, if present.
- Existing public website layout.
- Existing admin dashboard.
- Existing Supabase configuration.
- Existing authentication implementation.
- Existing database migrations.
- Existing email integration.
- Existing component and design system.
- Existing events and announcements implementation.

Research suitable existing MIT-licensed GitHub repositories or packages that could help with the feature.

Verify the actual license file and compatibility before recommending any repository.

Do not assume that a public GitHub repository is MIT-licensed.

For this phase:

- Do not modify files.
- Do not install packages.
- Do not create database tables.
- Do not execute migrations.
- Do not generate implementation code.

Deliver an inspection report with:

1. Existing project architecture.
2. Relevant existing files.
3. Existing authentication and email capabilities.
4. Existing Supabase tables and policies relevant to the feature.
5. Recommended database architecture.
6. Security considerations.
7. MIT repository research findings.
8. Missing requirements or dependencies.
9. Proposed implementation phases.

STOP and wait for my approval.

## PHASE 2 — DATABASE AND SECURITY DESIGN

After approval:

Present the final database schema and relationships.

Explain:

- Contributor authentication.
- Username resolution.
- Email verification.
- Contributor approval.
- Devotional submission authorization.
- Admin moderation.
- Anonymous reactions.
- RLS policies.
- Rate limiting.
- Audit logs.

Show the proposed migrations and explain how they preserve existing data.

Do not execute migrations until I approve the design.

## PHASE 3 — CONTRIBUTOR APPLICATION SYSTEM

After approval:

Implement:

- Application page.
- Form validation.
- Username uniqueness.
- Supabase Auth integration.
- Email verification.
- Application status tracking.
- Admin approval and rejection.
- Approval email notifications.

Test the complete application workflow.

## PHASE 4 — CONTRIBUTOR CREDENTIAL MODAL

After approval:

Implement:

- Write a Devotional button.
- Username and password modal.
- Server-side credential verification.
- Approved-contributor authorization.
- Secure, short-lived, single-use submission authorization.
- Rate limiting.
- Appropriate error and success messages.

Do not create a persistent contributor login session or dashboard.

## PHASE 5 — DEVOTIONAL SUBMISSION EDITOR

After approval:

Implement the devotional submission form.

Include:

- Title.
- Bible passage.
- Translation.
- Key verse.
- Devotional message.
- Personal application.
- Closing prayer.
- Category.

Implement server-side validation and content sanitization.

Every successful submission must be saved as Pending Review.

## PHASE 6 — ADMIN MODERATION

After approval:

Implement:

- Devotional overview statistics.
- Pending review list.
- Devotional preview.
- Edit and publish.
- Reject.
- Unpublish.
- Delete with confirmation.
- Contributor management.
- Application review.
- Audit history.

Ensure only authorized administrators can access these operations.

## PHASE 7 — PUBLIC DEVOTIONALS PAGE

After approval:

Implement:

- Public listing.
- Featured devotional.
- Latest devotionals.
- Search.
- Categories.
- Individual devotional reading page.
- Author information.
- Publication date.
- Related devotionals.
- Responsive layouts.

Only published content must be visible.

## PHASE 8 — ANONYMOUS REACTIONS

After approval:

Implement:

- Like button.
- Authoritative reaction count.
- Duplicate reaction protection.
- Anonymous visitor identification.
- Server-side rate limiting.
- Like toggle, if supported.

Test duplicate and malicious requests.

## PHASE 9 — FINAL TESTING AND SECURITY REVIEW

Perform complete functional, security, responsive, and regression testing.

Verify that existing GCBC pages and features remain functional.

Check:

- Events.
- Announcements.
- Navigation.
- Admin authentication.
- Public website.
- Supabase RLS.
- Email notifications.
- Contributor permissions.
- Devotional moderation.
- Anonymous reactions.

Provide a final implementation report.

# 16. AGENT WORKING RULES

Follow these rules throughout development:

- Read `WORKFLOW.md` before starting.
- Inspect before modifying.
- Do not invent files, database tables, APIs, or package capabilities.
- Do not install dependencies without justification.
- Do not change the established technology stack without approval.
- Do not create unnecessary abstractions.
- Prefer simple, maintainable solutions.
- Keep the original GCBC website visual identity.
- Reuse existing components and utilities where appropriate.
- Do not delete existing data except when an administrator explicitly confirms contributor-account deletion; remove all associated records according to the documented cascade behavior.
- Do not bypass RLS.
- Do not expose secrets.
- Do not claim an implementation is complete when it is only partially implemented.
- Do not claim tests passed unless they were executed successfully.
- Ask for approval at the specified phase gates.

After each phase, provide:

1. What was implemented.
2. Files created or modified.
3. Database changes, if any.
4. Tests executed and actual results.
5. Security considerations.
6. Known issues.
7. What remains.
8. The next proposed phase.

Do not automatically continue into the next approval-gated phase.

---

# FINAL EXPECTED RESULT

GCBC should have a complete Community Devotionals feature where:

- Anyone can apply to become a contributor.
- Applicants verify their email.
- Administrators approve contributor applications.
- Approved contributors enter their username and password whenever they want to submit.
- Contributors write devotionals using a structured editor.
- All submissions go to Pending Review.
- Administrators review and publish devotionals.
- The public can read published devotionals without an account.
- Readers can like devotionals without registering.
- The author's name is displayed publicly.
- Private contributor information remains protected.

Build this as a secure, maintainable extension of the existing GCBC website.

**START WITH PHASE 1 ONLY. INSPECT THE PROJECT AND WAIT FOR MY APPROVAL BEFORE MAKING ANY CHANGES.**