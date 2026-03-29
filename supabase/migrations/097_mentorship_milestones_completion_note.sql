-- Optional text captured when a milestone is marked complete (portal / future use).

alter table public.mentorship_milestones
  add column if not exists completion_note text null;

comment on column public.mentorship_milestones.completion_note is
  'Optional mentor context when marking this milestone complete; distinct from assignment-level mentorship_notes.';
