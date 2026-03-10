-- Fix function_search_path_mutable linter warning (0011)
-- Set explicit search_path on protect_baseline_credit to prevent search path injection
-- Trigger functions have signature () RETURNS trigger
alter function public.protect_baseline_credit() set search_path = public;
