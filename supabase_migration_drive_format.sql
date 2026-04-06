-- Add drive_folder_format column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS drive_folder_format text;
