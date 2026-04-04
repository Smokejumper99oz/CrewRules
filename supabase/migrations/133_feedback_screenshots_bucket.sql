-- Private bucket for in-app feedback screenshots (server uploads via service role first).
-- No storage.objects policies in this migration — only the service role can read/write until explicit policies are added.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
