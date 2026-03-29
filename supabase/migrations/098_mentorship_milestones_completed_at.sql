-- Actual completion instant (local time preserved via timestamptz). Optional; legacy rows use completed_date only.

alter table public.mentorship_milestones
  add column if not exists completed_at timestamptz null;

comment on column public.mentorship_milestones.completed_at is
  'When the milestone was marked complete; used for timeline display with time of day.';
