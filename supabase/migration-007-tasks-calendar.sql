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
  v_event events%ROWTYPE;
  v_new_id uuid;
  v_next_date date;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF v_event.recurrence IS NULL THEN RETURN NULL; END IF;

  v_next_date := CASE v_event.recurrence
    WHEN 'daily' THEN v_event.event_date + INTERVAL '1 day'
    WHEN 'weekly' THEN v_event.event_date + INTERVAL '1 week'
    WHEN 'monthly' THEN v_event.event_date + INTERVAL '1 month'
    ELSE NULL
  END;

  IF v_next_date IS NULL THEN RETURN NULL; END IF;
  IF v_event.recurrence_until IS NOT NULL AND v_next_date > v_event.recurrence_until THEN
    RETURN NULL;
  END IF;

  INSERT INTO events (
    case_id, org_id, title, description, event_type, event_date, event_time,
    assigned_to, created_by, recurrence, recurrence_until, reminder_minutes_before,
    priority, duration_minutes, location, recurrence_parent_id
  )
  VALUES (
    v_event.case_id, v_event.org_id, v_event.title, v_event.description, v_event.event_type,
    v_next_date, v_event.event_time, v_event.assigned_to, v_event.created_by,
    v_event.recurrence, v_event.recurrence_until, v_event.reminder_minutes_before,
    v_event.priority, v_event.duration_minutes, v_event.location,
    COALESCE(v_event.recurrence_parent_id, v_event.id)
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
