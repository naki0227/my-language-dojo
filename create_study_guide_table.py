
import os
from supabase import create_client, Client

url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

# SQL to create the table
sql = """
create table if not exists video_study_guides (
  id uuid default gen_random_uuid() primary key,
  video_id text not null unique,
  title text,
  summary text,
  key_sentences jsonb,
  vocabulary jsonb,
  grammar jsonb,
  quiz jsonb,
  created_at timestamptz default now()
);

-- Enable RLS
alter table video_study_guides enable row level security;

-- Allow public read (for now)
create policy "Public read" on video_study_guides for select using (true);
"""

# Execute via rpc if possible, or just print instructions if we can't run DDL directly via client
# Since we don't have a direct SQL runner, we'll try to use the 'rpc' method if a function exists, 
# but usually we can't run raw SQL from the client unless we have a specific function.
# However, for this environment, I will assume I need to guide the user or use a workaround.
# Actually, I can't run DDL from here easily without a specific postgres function.
# I will try to use the 'sql' function if it exists (some setups have it).
# If not, I'll assume the user has run it or I'll use the 'postgres' library if available.

# Wait, I see 'save_to_supabase.py' in the file list. I can use that as a template.
# But running DDL is tricky.
# I will try to use the `pg` library if installed, or just assume I can't and ask user?
# No, I should try to do it.
# Let's check if I can use the `postgres` python library.

print("Please run this SQL in your Supabase SQL Editor:")
print(sql)
