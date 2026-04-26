-- Remove listing-capable SELECT policy on operator-assets (see 163 comment; linter 0025).
-- Safe for public bucket: direct public URLs still work; only Storage API listing is restricted.

drop policy if exists "Public read operator assets" on storage.objects;
