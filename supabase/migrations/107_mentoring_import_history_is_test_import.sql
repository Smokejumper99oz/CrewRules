-- Optional audit flag: admin-marked test runs (history row only; does not tag profiles/assignments).

alter table public.mentoring_import_history
  add column if not exists is_test_import boolean not null default false;

comment on column public.mentoring_import_history.is_test_import is
  'When true, uploader marked the run as a test import (audit only).';
