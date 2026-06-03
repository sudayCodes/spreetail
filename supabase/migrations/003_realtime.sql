-- Enable Supabase Realtime for messages and activity_log
-- Run this in the Supabase SQL Editor

-- Add tables to the realtime publication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.expense_splits;
alter publication supabase_realtime add table public.settlements;
