-- Global cache for filed routes from FlightAware. Shared across users to reduce API calls.
create table if not exists public.flight_route_cache (
  id uuid primary key default gen_random_uuid(),
  ident text not null,
  origin text not null,
  destination text not null,
  departure_iso timestamptz not null,
  route text not null,
  last_checked timestamptz not null default now(),
  unique (ident, departure_iso)
);

create index if not exists idx_flight_route_cache_lookup
  on public.flight_route_cache (ident, departure_iso);

alter table public.flight_route_cache enable row level security;

create policy "Authenticated users can read flight_route_cache"
  on public.flight_route_cache for select
  to authenticated
  using (true);

create policy "Authenticated users can insert flight_route_cache"
  on public.flight_route_cache for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update flight_route_cache"
  on public.flight_route_cache for update
  to authenticated
  using (true)
  with check (true);
