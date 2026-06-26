# Board Games with Rob Events Website

## Purpose
This file tracks project context, assumptions, decisions, open questions, and build history for Codex or any coding agent working on this repository.

## Current Build Summary
The site manages Board Games with Rob events, including the Meeple in the Mountains board gaming retreat, using:
- Next.js App Router
- Supabase Auth, Postgres, and Storage
- Vercel hosting
- GitHub source control when Git is available locally

## Product Decisions
- Public visitors can see upcoming event details, bed availability, attendee count, and public event images.
- Public visitors cannot see attendee names or bed assignments.
- Attendees log in with email and a manually shared initial password created by the admin.
- Attendees can change or reset their password after initial login.
- Attendees can see game requests and games being brought for their assigned events.
- Attendees cannot see the full attendee list or everyone else's bed assignments.
- Food allergies and food preferences are visible only to admin and the attendee.
- Beds are event-specific and have a configurable capacity.
- Attendee accounts can own dependent participant profiles without separate logins.
- Dependents automatically attend the same events as their primary attendee and can receive bed assignments, preferences, shirt sizes, and game entries.
- Primary attendees and admins can manage dependents. Admins can convert a dependent into a standalone login account without losing existing event data.
- CSV export is not part of the MVP.

## MVP Scope
- Public event listing
- Login/logout
- Admin dashboard
- Event CRUD
- Admin-created users/profiles
- Event attendee assignment
- Configurable shirt sizes
- Event-specific bed list with capacity
- Bed assignment with capacity enforcement
- Attendee preference editing
- Game requests and games being brought
- Public event image display and admin image metadata management
- Admin report views
- Dependent participant management and conversion to login accounts

## Out of Scope
- Payments
- Public registration
- Waitlists
- Automated email invitations
- BoardGameGeek integration
- CSV export
- Chat/forums/social features

## Activity Log
- 2026-06-11: Created implementation plan from BRD and product-owner clarifications.
- 2026-06-11: Began MVP implementation in an empty workspace.
- 2026-06-11: Added Next.js App Router project scaffold, Supabase migration, auth helpers, public home page, login, attendee dashboard, attendee preferences, attendee games, admin dashboard, event management, user management, bed capacity management, image uploads, shirt sizes, and reports.
- 2026-06-11: Added database guards for bed capacity and attendee-only preference updates.
- 2026-06-11: Installed Node.js/npm, installed project dependencies, confirmed `npm run build` passes, confirmed `npm run typecheck` passes, and confirmed the local dev server returns HTTP 200.
- 2026-06-11: Installed Git and initialized the workspace as a local Git repository on `main`.
- 2026-06-23: Created the hosted Supabase project, successfully ran the initial database migration, configured `.env.local`, and confirmed the local site connects to Supabase.
- 2026-06-23: Created and verified the first administrator login. Added event date validation and browser draft recovery after testing found that development refreshes could clear an unfinished event form.
- 2026-06-23: Verified Supabase accepts a known-valid event date range and removed the temporary test row. Improved event creation diagnostics to report the exact dates received by the server while retaining the browser draft after a failed save.
- 2026-06-23: Rebranded the site as Board Games with Rob Events, added representative image upload during event creation, made the homepage action aware of login state, replaced the empty image gradient with a clear placeholder, defaulted new events to Upcoming, and allowed admins to preview draft events on the homepage.
- 2026-06-23: Added direct attendee creation and assignment within an event, attendee self-service contact editing, clearer bed occupancy and full-bed selection states, compact 250px event card images, and renamed the shared game views to Game Inventory and Wishlist with contributor names.
- 2026-06-23: Added the supplied Board Games with Rob logo to the homepage, replaced the Meeple in the Mountains hero title with Board Games with Rob, and removed the explanatory Upcoming Retreats panel so event cards follow the brand header directly.
- 2026-06-23: Added admin bed editing for name, type, capacity, and sort order, with a guard preventing capacity from being reduced below current occupancy.
- 2026-06-23: Fixed the bed management layout so edit controls and Save bed buttons cannot overlap the Assignments panel; the panels stack at narrower widths.
- 2026-06-23: Added profile-level allergies, drink preferences, snack preferences, food preferences, and attendee comments to the database migration, My Account page, and admin user management.
- 2026-06-23: Reworked bed assignments into capacity-based slots for each bed, showing assigned people or Not assigned and allowing admins to assign, replace, move, or clear each slot.
- 2026-06-24: Added an event-specific admin Planning Report showing each attendee's shirt size and grouped allergies, snack preferences, and food preferences with duplicate preference names consolidated.
- 2026-06-24: Consolidated attendee preferences into My Account by moving shirt size to the profile, synchronizing it to event assignments for compatibility, and removing the event-specific Preferences route and links.
- 2026-06-24: Simplified Admin Users into a compact table with an Edit modal for each user's full contact, preference, comment, shirt size, and role details.
- 2026-06-23: Added the same preference and comment fields to the event-specific Create and Assign Attendee workflow so all admin user creation paths are consistent.
- 2026-06-23: Added a prominent attendee dashboard prompt linking to My Account so users can enter and update their own allergies, food and drink preferences, contact details, and comments after login.
- 2026-06-24: Added dependent participants owned by primary attendee accounts. Dependents inherit event assignments, can be assigned to beds, have independent shirt and food preferences, and can own inventory or wishlist game entries. Added attendee/admin management, dependent labels throughout planning views, and admin conversion to a standalone login while retaining existing data.
- 2026-06-24: Added `supabase/migrations/0004_dependents.sql`, confirmed `npm run typecheck` passes, and confirmed the Next.js 16.2.9 production build passes.
- 2026-06-24: Fixed the event attendee Assign Existing User panel so its label, dropdown, and button remain compact instead of stretching to match the taller attendee-creation form.
- 2026-06-24: Added Ctrl-click multi-selection when assigning existing users to an event and added inline, capacity-aware bed assignment controls to every attendee row.
- 2026-06-24: Replaced the Admin Users native dialog timing dependency with a React-controlled modal overlay so Edit buttons open reliably.
- 2026-06-24: Made Admin Users editing URL-backed and server-rendered, eliminating client hydration as a dependency for opening user records.
- 2026-06-25: Updated the event attendee selector to display dependents alongside their primary attendee and clarify that assigning the primary attendee automatically assigns the full dependent household.
- 2026-06-25: Reworked the attendee experience into My Events. Assigned attendees can open an event to see privacy-safe attendee names, Games Being Brought, and the Game Wishlist. Game management now supports existing-title suggestions, new titles, notes, and owner-only editing/deletion for the attendee and dependents.
- 2026-06-25: Added a public two-column, scrollable Games Being Brought list beside each event image. Added `supabase/migrations/0005_public_brought_games.sql` to expose only brought-game titles for upcoming or active events.
- 2026-06-25: Constrained the public Games Being Brought panel to the event image height and increased its left spacing so it cannot collide with the event title below.
- 2026-06-25: Added event image management with previews, alt-text and sort-order editing, optional file replacement, and deletion from both the event record and Supabase Storage when the file is no longer referenced.
- 2026-06-25: Added a reusable event-management menu to Event Details, Attendees, Beds, Images, Inventory and Wishlist, and Planning Report, with the current section visibly highlighted.
- 2026-06-25: Replaced per-attendee bed Save buttons with a batch Save All Bed Assignments workflow that validates final bed capacities, supports swaps between full beds, and restores prior assignments if an update fails.
- 2026-06-25: Corrected public and attendee bed availability so a multi-capacity bed is no longer reported as available once any slot in that bed is occupied.
- 2026-06-25: Added cleanup for event-specific game inventory and wishlist entries when an attendee is removed. Existing orphaned entries are removed by `0006_cleanup_removed_attendee_games.sql`, future removals are handled by a database trigger, and all event game views filter to current attendees.
- 2026-06-25: Fixed anonymous homepage totals and brought-game listings by loading protected attendee and game rows with the server-only Supabase admin client, while continuing to render only public-safe counts and game titles.
- 2026-06-25: Restructured public event cards so event details occupy the left column and Games Being Brought fills the right column down to the metrics. Replaced CSS newspaper columns with a two-column grid and vertical scrolling to eliminate horizontal overflow.
- 2026-06-25: Clarified game editing with dedicated My Wishlist and My Games Being Brought sections containing direct title/notes fields and Save/Delete controls, while preserving read-only shared event lists below.
- 2026-06-25: Added reusable shirt designs with sample images, size-specific prices, event assignment, household quantity ordering, and an event order report with names, design, size, quantity, cost, and total.
- 2026-06-25: Added multi-image galleries for shirt designs. Admins can select multiple images during creation or upload more later, existing single images are migrated automatically, and attendees see every sample image for each design.
- 2026-06-25: Clarified shirt availability when a catalog design has not been assigned to an event. The attendee page now shows a clear empty state instead of an empty Save form, with a direct assignment link for admins.
- 2026-06-25: Prepared the first production publication to the GitHub repository `rsearing/meepleinthemountains`.
- 2026-06-25: Hardened the public homepage so upcoming events load through the normal public/session-aware Supabase client first, preventing server-only enrichment issues from hiding the event card.
- 2026-06-25: Removed the homepage dependency on the Supabase service-role key and added `0009_public_event_summaries.sql` so public event cards can show attendee counts and bed availability without exposing attendee rows.
- 2026-06-25: Replaced the homepage Board Games with Rob logo with the final full-color PNG asset and updated its display dimensions.
- 2026-06-25: Changed the homepage hero title from Board Games with Rob to Events Page because the brand name is already present in the logo.
- 2026-06-26: Added `0010_public_brought_games_function.sql` and updated the public homepage to load brought-game titles through a public-safe RPC so logged-out visitors can see Games Being Brought without exposing attendee details.
- 2026-06-26: Added admin shirt design editing, individual sample image deletion, image uploads, and confirmed whole-design deletion from the Shirt Designs page.

## Open Questions
- None blocking MVP implementation.

## Build Notes
- Do not commit secrets.
- Required local env vars are documented in `.env.example`.
- Supabase schema and Row Level Security changes are defined in the numbered files under `supabase/migrations`.
- Run `supabase/migrations/0004_dependents.sql` in the Supabase SQL Editor before testing dependent features.
- Run `supabase/migrations/0009_public_event_summaries.sql` in the Supabase SQL Editor before expecting public homepage attendee counts and occupied-bed availability in production.
- Run `supabase/migrations/0010_public_brought_games_function.sql` in the Supabase SQL Editor before expecting public homepage brought-game titles in production.
- Git is installed and the local repository is initialized. The production GitHub repository is `rsearing/meepleinthemountains`.
- npm reported two moderate dependency audit findings after install. Do not run forced upgrades without checking for breaking changes.
- Browser automation could not launch because the bundled Playwright package could not resolve `playwright-core`; use the local browser manually or repair the Playwright runtime for visual QA.
