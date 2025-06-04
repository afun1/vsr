-- Create a table for user profiles with roles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table profiles enable row level security;

-- Policy: Users can read their own profile
create policy "Users can read their own profile" on profiles
  for select using (auth.uid() = id);

-- Policy: Users can insert their own profile
create policy "Users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);

-- Policy: Only admins can update role
create policy "Admins can update role" on profiles
  for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
