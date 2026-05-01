-- ========================================================
-- Client Desk (Vendor Management) - Core Database Schema
-- ========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS & PROFILES (Studio Admin / Owners)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  studio_name TEXT,
  whatsapp_number TEXT,
  telegram_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_chat_id TEXT,
  telegram_language TEXT NOT NULL DEFAULT 'id' CHECK (telegram_language IN ('id', 'en')),
  telegram_notify_new_booking BOOLEAN NOT NULL DEFAULT TRUE,
  telegram_notify_settlement_submitted BOOLEAN NOT NULL DEFAULT TRUE,
  telegram_notify_session_h1 BOOLEAN NOT NULL DEFAULT TRUE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
  client_status_deadline_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_status_deadline_trigger_status TEXT,
  client_status_deadline_default_days INTEGER NOT NULL DEFAULT 7,
  tracking_project_deadline_visible BOOLEAN NOT NULL DEFAULT FALSE,
  tracking_video_links_visible_from_status TEXT DEFAULT 'File Siap',
  fastpik_default_selection_enabled BOOLEAN DEFAULT TRUE,
  fastpik_default_download_enabled BOOLEAN DEFAULT TRUE,
  finance_fixed_operational_costs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. FREELANCE / TEAM MEMBERS
CREATE TABLE IF NOT EXISTS freelance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Belongs to which studio admin
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- e.g., 'Photographer', 'Videographer', 'MUA'
  whatsapp_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SERVICES & PACKAGES
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,
  affects_schedule BOOLEAN DEFAULT true,
  color TEXT NOT NULL DEFAULT '#000000' CHECK (color ~* '^#[0-9a-f]{6}$'),
  default_operational_costs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BOOKINGS (Transactions)
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  booking_code TEXT UNIQUE NOT NULL, -- e.g., 'BKG-001'
  client_name TEXT NOT NULL,
  client_whatsapp TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  freelance_id UUID REFERENCES freelance(id) ON DELETE SET NULL,
  
  -- Scheduling & Status
  session_date TIMESTAMPTZ,
  booking_date DATE DEFAULT CURRENT_DATE,
  project_deadline_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'DP', 'Terjadwal', 'Edit', 'Selesai', 'Batal')),
  
  -- Financial
  total_price NUMERIC(15, 2) DEFAULT 0,
  dp_paid NUMERIC(15, 2) DEFAULT 0,
  is_fully_paid BOOLEAN DEFAULT false,
  
  -- Data & Delivery
  notes TEXT,
  admin_notes TEXT,
  drive_folder_url TEXT,
  video_drive_folder_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TEMPLATES (WhatsApp & Forms)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'whatsapp_client',
    'whatsapp_booking_confirm',
    'whatsapp_session_reminder_client',
    'whatsapp_settlement_client',
    'whatsapp_settlement_confirm',
    'whatsapp_freelancer',
    'invoice'
  )),
  name TEXT NOT NULL,
  content TEXT NOT NULL, -- The text format containing variables like {{client_name}}
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_key TEXT NOT NULL,
  scheduled_for_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_notification_logs_event_key_idx
  ON telegram_notification_logs (user_id, event_type, event_key);

CREATE INDEX IF NOT EXISTS telegram_notification_logs_booking_idx
  ON telegram_notification_logs (booking_id, event_type);

-- ========================================================
-- RLS (Row Level Security) Policies
-- ========================================================
-- Default: Off (As configured per User's request, to be toggled on later if explicitly needed)
-- To enable later: 
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE freelance ENABLE ROW LEVEL SECURITY;
-- (and add policies accordingly)
