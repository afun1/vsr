-- Create a table for user profiles with roles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text, -- NEW: display name for user
  role text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  avatar_url text, -- NEW: URL for user avatar
  notifications_enabled boolean default true -- NEW: notification preference
);

-- Create a table for recordings
create table recordings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade, -- NEW: link to clients table
  video_url text not null, -- REQUIRED: video file location
  transcript text not null, -- REQUIRED: transcript text
  created_at timestamp with time zone default timezone('utc'::text, now()),
  transcript_sentiment text, -- NEW: sentiment analysis of the transcript
  transcript_keywords text, -- NEW: keywords extracted from the transcript
  transcript_summary text, -- NEW: summary of the transcript
  archived_at timestamp with time zone, -- NEW: soft delete timestamp
  recorder_display_name text -- NEW: snapshot of display name at recording time
);

-- Create a table for clients
create table clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  sparky_username text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  first_name text, -- NEW: first name for client
  last_name text -- NEW: last name for client
);

-- Create a table for audit logs
create table audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create a table for comments
create table comments (
  id uuid default gen_random_uuid() primary key,
  recording_id uuid references recordings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  user_display_name text, -- snapshot of display name at comment time
  deleted_at timestamp with time zone, -- for soft deletes
  created_at timestamp with time zone default timezone('utc'::text, now()),
  status text default 'approved' -- NEW: status column for moderation
);
create index if not exists idx_comments_recording_id on comments(recording_id);
create index if not exists idx_comments_user_id on comments(user_id);
create index if not exists idx_comments_status on comments(status); -- NEW: index for status

-- Table to store comment edit history
create table comment_edits (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid references comments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  old_content text not null,
  edited_at timestamp with time zone default timezone('utc'::text, now()),
  old_user_display_name text
);
create index if not exists idx_comment_edits_comment_id on comment_edits(comment_id);
create index if not exists idx_comment_edits_user_id on comment_edits(user_id);

-- Trigger function to log comment edits
create or replace function log_comment_edit() returns trigger as $$
begin
  insert into comment_edits (comment_id, user_id, old_content, edited_at, old_user_display_name)
  values (new.id, new.user_id, old.content, now(), old.user_display_name);
  return new;
end;
$$ language plpgsql;

-- Trigger to call the function before update on comments
create trigger trg_log_comment_edit
before update on comments
for each row
when (old.content is distinct from new.content or old.user_display_name is distinct from new.user_display_name)
execute procedure log_comment_edit();

-- Trigger function to log comment creation and deletion to audit_logs
create or replace function log_comment_audit() returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    insert into audit_logs (user_id, action, target_type, target_id, details)
    values (new.user_id, 'create_comment', 'comment', new.id, jsonb_build_object('content', new.content, 'recording_id', new.recording_id));
    return new;
  elsif (TG_OP = 'DELETE') then
    insert into audit_logs (user_id, action, target_type, target_id, details)
    values (old.user_id, 'delete_comment', 'comment', old.id, jsonb_build_object('content', old.content, 'recording_id', old.recording_id));
    return old;
  end if;
  return null;
end;
$$ language plpgsql;

-- Trigger for comment creation
create trigger trg_log_comment_create
after insert on comments
for each row
execute procedure log_comment_audit();

-- Trigger for comment deletion
create trigger trg_log_comment_delete
after delete on comments
for each row
execute procedure log_comment_audit();

-- Enable RLS
alter table profiles enable row level security;
alter table recordings enable row level security;
alter table audit_logs enable row level security;
alter table comments enable row level security;
alter table comment_edits enable row level security;

-- Policy: Users can read their own profile
create policy "Users can read their own profile" on profiles
  for select using (auth.uid() = id);

-- Policy: Users can insert their own profile
create policy "Users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);

-- Policy: Only admins can update role
create policy "Admins can update role" on profiles
  for update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Policy: Users can manage their own recordings
create policy "Users can manage their own recordings" on recordings
  for all using (auth.uid() = user_id);

-- Policy: Only admins can read audit logs
create policy "Admins can read audit logs" on audit_logs
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Users can insert audit_logs" on audit_logs
  for insert with check (auth.uid() = user_id);

-- Policy: Users can read comments on their own recordings or their own comments
create policy "Users can read comments on their recordings or their own" on comments
  for select using (
    auth.uid() = user_id
    or exists (select 1 from recordings r where r.id = recording_id and r.user_id = auth.uid())
  );

-- Policy: Users can insert their own comments
create policy "Users can insert their own comments" on comments
  for insert with check (auth.uid() = user_id);

-- Policy: Users can delete their own comments or admins can delete any
create policy "Users or admins can delete comments" on comments
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Policy: Users can update their own comments
create policy "Users can update their own comments" on comments
  for update using (auth.uid() = user_id);

-- Policy: Only admins can read comment edit history
create policy "Admins can read comment edit history" on comment_edits
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Add avatar_url to profiles for profile pictures
alter table profiles add column if not exists avatar_url text;
-- Add unique constraint to email
alter table profiles add constraint profiles_email_unique unique(email);
-- Add index for notifications_enabled
create index if not exists idx_profiles_notifications_enabled on profiles(notifications_enabled);
-- Add archive_after_days to profiles for data retention
alter table profiles add column if not exists archive_after_days integer default 90;
-- Add first_name and last_name columns to clients table
alter table clients add column if not exists first_name text;
alter table clients add column if not exists last_name text;
-- Add unique constraint to prevent duplicate clients by email
alter table clients add constraint unique_client_email unique (email);
