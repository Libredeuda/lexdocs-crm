-- =============================================================================
-- Migration 007: Tareas con calendario, recordatorios, push y Google Calendar
-- =============================================================================

-- 1. Ampliar tabla events para tareas/recordatorios/recurrencia
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence text
  CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_until date;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_minutes_before integer DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal'
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_minutes integer DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location text;

CREATE INDEX IF NOT EXISTS idx_events_assigned_to ON events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_pending_reminder ON events(event_date, event_time)
  WHERE notification_sent_at IS NULL AND is_completed = false;

-- 2. Web Push subscriptions (suscripciones del navegador del usuario)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

-- 3. Centro de notificaciones in-app (bell icon)
CREATE TABLE IF NOT EXISTS notifications_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  icon text,
  type text,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_inbox_user_unread
  ON notifications_inbox(user_id, is_read, created_at DESC);
ALTER TABLE notifications_inbox DISABLE ROW LEVEL SECURITY;

-- 4. Conexiones Google Calendar (OAuth tokens por usuario)
CREATE TABLE IF NOT EXISTS google_calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  google_email text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  calendar_id text DEFAULT 'primary',
  block_busy_slots boolean DEFAULT true,
  sync_tasks boolean DEFAULT false,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE google_calendar_connections DISABLE ROW LEVEL SECURITY;

-- 5. Función para crear próxima ocurrencia de tarea recurrente
CREATE OR REPLACE FUNCTION create_next_recurrence(p_event_id uuid)
RETURNS uuid AS $$
DECLARE
  r_case_id uuid;
  r_org_id uuid;
  r_title text;
  r_description text;
  r_event_type text;
  r_event_date date;
  r_event_time time;
  r_assigned_to uuid;
  r_created_by uuid;
  r_recurrence text;
  r_recurrence_until date;
  r_reminder integer;
  r_priority text;
  r_duration integer;
  r_location text;
  r_parent_id uuid;
  v_new_id uuid;
  v_next_date date;
BEGIN
  SELECT case_id, org_id, title, description, event_type, event_date, event_time,
         assigned_to, created_by, recurrence, recurrence_until, reminder_minutes_before,
         priority, duration_minutes, location, recurrence_parent_id
  INTO r_case_id, r_org_id, r_title, r_description, r_event_type, r_event_date, r_event_time,
       r_assigned_to, r_created_by, r_recurrence, r_recurrence_until, r_reminder,
       r_priority, r_duration, r_location, r_parent_id
  FROM events WHERE id = p_event_id;

  IF r_recurrence IS NULL THEN RETURN NULL; END IF;

  IF r_recurrence = 'daily' THEN
    v_next_date := r_event_date + INTERVAL '1 day';
  ELSIF r_recurrence = 'weekly' THEN
    v_next_date := r_event_date + INTERVAL '1 week';
  ELSIF r_recurrence = 'monthly' THEN
    v_next_date := r_event_date + INTERVAL '1 month';
  ELSE
    RETURN NULL;
  END IF;

  IF r_recurrence_until IS NOT NULL AND v_next_date > r_recurrence_until THEN
    RETURN NULL;
  END IF;

  INSERT INTO events (
    case_id, org_id, title, description, event_type, event_date, event_time,
    assigned_to, created_by, recurrence, recurrence_until, reminder_minutes_before,
    priority, duration_minutes, location, recurrence_parent_id
  )
  VALUES (
    r_case_id, r_org_id, r_title, r_description, r_event_type,
    v_next_date, r_event_time, r_assigned_to, r_created_by,
    r_recurrence, r_recurrence_until, r_reminder,
    r_priority, r_duration, r_location,
    COALESCE(r_parent_id, p_event_id)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger: al marcar tarea recurrente como completed, crear la siguiente
CREATE OR REPLACE FUNCTION on_event_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed IS DISTINCT FROM true) THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
    IF NEW.recurrence IS NOT NULL THEN
      PERFORM create_next_recurrence(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_event_completed ON events;
CREATE TRIGGER trg_event_completed
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION on_event_completed();

-- 7. pg_cron para disparar el cron de recordatorios cada 5 minutos
-- NOTA: Si pg_cron no está disponible en tu plan, comenta este bloque y usa GitHub Actions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    -- Asume que existe la extension http o pg_net. Probar primero pg_net.
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
      CREATE EXTENSION IF NOT EXISTS pg_net;
    END IF;
  END IF;
END $$;

SELECT 'Migration 007 completed: tareas, recordatorios, push, GCal y recurrencia' AS status;
