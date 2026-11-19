# TPT Production Control

Web client for the machining production system. Authentication and shared attendance/production records use Supabase; the Vercel deployment serves the client.

## Local development

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project settings.
3. Run `supabase/migrations/20261119000000_initial.sql` in the Supabase SQL Editor. It creates all required tables, including Master Data and Tools Inventory.
   If you already ran an earlier version of this migration, run the updated file again in the SQL Editor to add the new tables and permissions.
4. Create each user in Supabase Authentication, then create its `public.profiles` row using that Auth user's UUID:

   ```sql
   insert into public.profiles (id, role, display_name)
   values ('AUTH_USER_UUID', 'operator', 'AMRI');
   ```

   For admin or boss accounts:

   ```sql
   insert into public.profiles (id, role, display_name)
   values
     ('ADMIN_AUTH_USER_UUID', 'admin', 'ADMIN_NAME'),
     ('BOSS_AUTH_USER_UUID', 'boss', 'BOSS_NAME')
   on conflict (id) do update
   set role = excluded.role,
       display_name = excluded.display_name;
   ```

   Use `operator`, `admin`, or `boss` as the role. Operator display names must be AMRI, M. RIPAI, ERWIN, AGUS, SIGIT, or HAFIDZ. Create accounts administratively; public sign-up is not enabled.
5. Run `npm install` and `npm run dev`.

Do not put a Supabase `service_role` key in `.env.local`, Vercel, or any `VITE_` variable. The browser only uses the publishable/anon key; access is controlled by Supabase Auth and row-level security.

## Vercel

Import this repository into Vercel. Use the Vite defaults (`npm run build`, output directory `dist`) and add the two `VITE_SUPABASE_*` variables in the project's Environment Variables for Preview and Production. Redeploy after setting or changing them. `vercel.json` routes client-side paths to the SPA entry point.

## Data coverage

Operator authentication, attendance timestamps, production submissions, Admin verification, master customer/item/PO data, and tools inventory are stored in Supabase. Other screens that still show sample/demo data (including parts of payroll calculation) need their own database workflows before they represent live operational records.
