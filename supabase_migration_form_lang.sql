-- Add form_lang column to profiles table
-- This allows vendors to choose the language for their public booking form (id or en)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_lang TEXT DEFAULT 'id';
