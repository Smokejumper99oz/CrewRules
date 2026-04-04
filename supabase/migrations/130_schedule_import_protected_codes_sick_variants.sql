-- Idempotent Frontier sick summary variants (exact-match preservation + classification).

insert into public.schedule_import_protected_codes (tenant, code, event_type, preserve_on_baseline_replace, active)
select 'frontier', 'SICK LEAVE', 'sick', true, true
where not exists (
  select 1
  from public.schedule_import_protected_codes p
  where coalesce(p.tenant, '') = 'frontier'
    and p.normalized_code = upper(trim('SICK LEAVE'))
);

insert into public.schedule_import_protected_codes (tenant, code, event_type, preserve_on_baseline_replace, active)
select 'frontier', 'SICK DAY', 'sick', true, true
where not exists (
  select 1
  from public.schedule_import_protected_codes p
  where coalesce(p.tenant, '') = 'frontier'
    and p.normalized_code = upper(trim('SICK DAY'))
);
