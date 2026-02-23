-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- Creates the access_requests table for the Request Access form

create table access_requests (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  airline text,
  created_at timestamptz default now()
);

alter table access_requests enable row level security;

create policy "Allow anonymous inserts"
  on access_requests for insert
  with check (true);
