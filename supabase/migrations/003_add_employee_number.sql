-- Add employee_number column to access_requests
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query

alter table access_requests
  add column if not exists employee_number text;
