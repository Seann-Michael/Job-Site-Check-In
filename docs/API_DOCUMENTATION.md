# API Documentation

The authoritative, up-to-date reference for every HTTP endpoint the Express server
mounts lives next to the code:

- [`server/routes/README.md`](../server/routes/README.md) — method, path, auth
  requirement, request body and response shape for each route.
- [`server/index.ts`](../server/index.ts) — the single place routes are mounted;
  if a path is not registered there it does not exist.

Everything else in the application (businesses, projects, reviews, clients,
users, settings, workflows, …) is read and written directly through the
Supabase client with Row Level Security; there is no bespoke REST layer for
those resources. See [`DATA_MODELS.md`](./DATA_MODELS.md) for the table shapes
and [`supabase/README.md`](../supabase/README.md) for migrations.
