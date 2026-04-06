-- Migration: Add custom_event_types, sort_order, is_addon, form_sections

-- Custom event types per vendor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_event_types text[] DEFAULT '{}';

-- Custom form sections (form builder)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_sections jsonb DEFAULT '[]';

-- Package sort order and add-on flag
ALTER TABLE services ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_addon boolean DEFAULT false;
