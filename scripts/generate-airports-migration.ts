/**
 * Generate SQL for canonical airport upsert migration.
 * Run: npx tsx scripts/generate-airports-migration.ts
 * Output: INSERT ... ON CONFLICT SQL. Paste into a new migration file.
 */

import { AIRPORTS_CANONICAL } from "../data/airports-canonical";

const values = AIRPORTS_CANONICAL.map(
  (a) => `  ('${a.iata}', '${a.tz.replace(/'/g, "''")}')`
).join(",\n");

console.log(`-- Canonical airport upsert. Source: data/airports-canonical.ts
insert into public.airports (iata, tz) values
${values}
on conflict (iata) do update set tz = excluded.tz;
`);
