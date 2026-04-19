import { useState, useEffect, useMemo } from "react";
import {
  Calendar, Clock, Plus, X, Check, RefreshCw, Phone, Briefcase,
  Scale, AlertCircle, ChevronLeft, ChevronRight, MapPin, User, FolderKanban
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import TaskFormModal from "./TaskFormModal";

const TYPE_META = {
  task:     { label: "Tarea",    icon: Check,       color: C.primary },
  call:     { label: "Llamada",  icon: Phone,       color: C.blue    },
  meeting:  { label: "Reunión",  icon: Briefcase,   color: C.violet  },
  deadline: { label: "Plazo",    icon: AlertCircle, color: C.orange  },
  hearing:  { label: "Vista",    icon: Scale,       color: C.red     },
};

const PRIORITY_META = {
  low:    { label: "Baja",    color: C.textMuted },
  normal: { label: "Normal",  color: C.blue      },
  high:   { label: "Alta",    color: C.orange    },
  urgent: { label: "Urgente", color: C.red       },
};

const RECURRENCE_LABEL = { daily: "Diaria", weekly: "Semanal", monthly: "Mensual" };

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lunes=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function formatDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export default function AgendaView({ user }) {
  const [events, setEvents] = useState([]);
  const [team, setTeam] = useState([]);
  const [view, setView] = useState("list"); // list | month | day
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);
  const [modalDefault, setModalDefault] = useState(null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [dayCursor, setDayCursor] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [dayDetail, setDayDetail] = useState(null); // YYYY-MM-DD para modal lateral en vista mes

  useEffect(() => { loadAll(); }, [user?.org_id]);

  async function loadAll() {
    setLoading(true);
    try {
      let q = supabase
        .from("events")
        .select("*, assignee:users!events_assigned_to_fkey(full_name), case:cases(case_number)")
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });
      if (user?.org_id) q = q.eq("org_id", user.org_id);
      const { data, error } = await q;
      if (error) throw error;
      setEvents(data || []);

      let teamQ = supabase
        .from("users")
        .select("id, full_name, role")
        .in("role", ["owner", "admin", "lawyer", "procurador", "staff"])
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      const { data: t } = await teamQ;
      setTeam(t || []);
    } catch (e) {
      console.error("loadAll", e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleCompleted(eventId, currentCompleted) {
    try {
      await supabase
        .from("events")
        .update({
          is_completed: !currentCompleted,
          completed_at: !currentCompleted ? new Date().toISOString() : null,
        })
        .eq("id", eventId);
      loadAll();
    } catch (e) {
      console.error(e);
    }
  }

  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      if (!showCompleted && ev.is_completed) return false;
      if (filterAssignee !== "all" && ev.assigned_to !== filterAssignee) return false;
      if (filterType !== "all" && ev.event_type !== filterType) return false;
      return true;
    });
  }, [events, showCompleted, filterAssignee, filterType]);

  function openCreate(defaults = null) {
    setModalInitial(null);
    setModalDefault(defaults);
    setModalOpen(true);
  }
  function openEdit(ev) {
    setModalInitial(ev);
    setModalDefault(null);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setModalInitial(null);
    setModalDefault(null);
  }

  // ════════════════════════════════════════════════
  // VISTA LISTA — agrupada por día
  // ════════════════════════════════════════════════
  function renderList() {
    const today = ymd(new Date());
    const tomorrow = ymd(addDays(new Date(), 1));
    const weekEnd = ymd(addDays(new Date(), 7));

    const groups = { today: [], tomorrow: [], week: [], later: {} };
    for (const ev of filteredEvents) {
      const d = ev.event_date;
      if (d === today) groups.today.push(ev);
      else if (d === tomorrow) groups.tomorrow.push(ev);
      else if (d > tomorrow && d <= weekEnd) groups.week.push(ev);
      else {
        if (!groups.later[d]) groups.later[d] = [];
        groups.later[d].push(ev);
      }
    }

    const sections = [
      { key: "today",    title: "HOY",          items: groups.today },
      { key: "tomorrow", title: "MAÑANA",       items: groups.tomorrow },
      { key: "week",     title: "ESTA SEMANA",  items: groups.week },
    ];

    const laterDates = Object.keys(groups.later).sort();

    if (
      groups.today.length === 0 && groups.tomorrow.length === 0 &&
      groups.week.length === 0 && laterDates.length === 0
    ) {
      return (
        <div style={{
          padding: "60px 20px", textAlign: "center", color: C.textMuted,
          background: C.card, borderRadius: 16, border: `1px dashed ${C.border}`,
        }}>
          <Calendar size={36} color={C.textLight} style={{ marginBottom: 10 }} />
          <p style={{ fontSize: 14, margin: 0 }}>No hay tareas que mostrar</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Pulsa "+ Nueva tarea" para empezar</p>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {sections.map(s => s.items.length > 0 && (
          <div key={s.key}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.textMuted,
              letterSpacing: ".08em", marginBottom: 8,
            }}>{s.title} · {s.items.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.items.map(ev => <EventCard key={ev.id} ev={ev} onToggle={toggleCompleted} onEdit={openEdit} />)}
            </div>
          </div>
        ))}
        {laterDates.map(d => (
          <div key={d}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.textMuted,
              letterSpacing: ".08em", marginBottom: 8, textTransform: "uppercase",
            }}>{formatDateLong(d)} · {groups.later[d].length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.later[d].map(ev => <EventCard key={ev.id} ev={ev} onToggle={toggleCompleted} onEdit={openEdit} />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // VISTA MES
  // ════════════════════════════════════════════════
  function renderMonth() {
    const monthStart = new Date(monthCursor);
    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const gridStart = startOfWeek(monthStart);
    const cells = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));

    const eventsByDate = {};
    for (const ev of filteredEvents) {
      if (!eventsByDate[ev.event_date]) eventsByDate[ev.event_date] = [];
      eventsByDate[ev.event_date].push(ev);
    }

    return (
      <div>
        {/* Toolbar mes */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
              style={iconBtn()}
            ><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 16, fontWeight: 700, minWidth: 180, textAlign: "center" }}>
              {MONTH_NAMES[monthCursor.getMonth()]} {monthCursor.getFullYear()}
            </div>
            <button
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
              style={iconBtn()}
            ><ChevronRight size={16} /></button>
          </div>
          <button
            onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonthCursor(d); }}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
              fontFamily: font, cursor: "pointer", background: C.card,
              color: C.text, border: `1px solid ${C.border}`,
            }}
          >Hoy</button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 700 }}>
            {/* Cabecera días */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1,
              marginBottom: 4,
            }}>
              {DAY_SHORT.map(d => (
                <div key={d} style={{
                  textAlign: "center", fontSize: 11, fontWeight: 600,
                  color: C.textMuted, padding: "6px 0", textTransform: "uppercase",
                  letterSpacing: ".05em",
                }}>{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
              gridTemplateRows: "repeat(6, minmax(90px, 1fr))",
              gap: 1, background: C.border, border: `1px solid ${C.border}`,
              borderRadius: 12, overflow: "hidden",
            }}>
              {cells.map((d, i) => {
                const dStr = ymd(d);
                const isOtherMonth = d.getMonth() !== monthCursor.getMonth();
                const isToday = dStr === ymd(new Date());
                const dayEvents = eventsByDate[dStr] || [];
                const visible = dayEvents.slice(0, 3);
                const more = dayEvents.length - visible.length;
                return (
                  <div
                    key={i}
                    onClick={() => setDayDetail(dStr)}
                    style={{
                      background: isOtherMonth ? C.bg : C.card,
                      padding: 6, cursor: "pointer", minHeight: 90,
                      display: "flex", flexDirection: "column", gap: 4,
                      position: "relative",
                    }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 700 : 500,
                      color: isOtherMonth ? C.textLight : (isToday ? C.primary : C.text),
                      width: 22, height: 22, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isToday ? `${C.primary}15` : "transparent",
                    }}>{d.getDate()}</div>
                    {visible.map(ev => {
                      const meta = TYPE_META[ev.event_type] || TYPE_META.task;
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                          style={{
                            fontSize: 10.5, padding: "2px 5px", borderRadius: 5,
                            background: `${meta.color}15`, color: meta.color,
                            display: "flex", alignItems: "center", gap: 4,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            fontWeight: 500, opacity: ev.is_completed ? 0.5 : 1,
                            textDecoration: ev.is_completed ? "line-through" : "none",
                          }}
                        >
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: meta.color, flexShrink: 0,
                          }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ev.event_time?.slice(0, 5)} {ev.title}
                          </span>
                        </div>
                      );
                    })}
                    {more > 0 && (
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>
                        +{more} más
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal lateral día */}
        {dayDetail && (
          <DayDetailModal
            date={dayDetail}
            events={(eventsByDate[dayDetail] || [])}
            onClose={() => setDayDetail(null)}
            onEdit={(ev) => { setDayDetail(null); openEdit(ev); }}
            onCreate={() => { openCreate({ date: dayDetail, time: "09:00" }); setDayDetail(null); }}
            onToggle={toggleCompleted}
          />
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // VISTA DÍA — timeline horizontal 8:00–22:00
  // ════════════════════════════════════════════════
  function renderDay() {
    const dayStr = ymd(dayCursor);
    const dayEvents = filteredEvents.filter(ev => ev.event_date === dayStr);
    const HOURS = []; for (let h = 8; h <= 22; h++) HOURS.push(h);
    const slotWidth = 110;

    return (
      <div>
        {/* Toolbar día */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setDayCursor(addDays(dayCursor, -1))} style={iconBtn()}><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 16, fontWeight: 700, minWidth: 240, textAlign: "center", textTransform: "capitalize" }}>
              {dayCursor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <button onClick={() => setDayCursor(addDays(dayCursor, 1))} style={iconBtn()}><ChevronRight size={16} /></button>
          </div>
          <button
            onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDayCursor(d); }}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
              fontFamily: font, cursor: "pointer", background: C.card,
              color: C.text, border: `1px solid ${C.border}`,
            }}
          >Hoy</button>
        </div>

        <div style={{
          background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: 14, overflowX: "auto",
        }}>
          <div style={{ position: "relative", minWidth: HOURS.length * slotWidth, height: 160 }}>
            {/* Grid horas */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
              {HOURS.map(h => (
                <div
                  key={h}
                  onClick={() => openCreate({ date: dayStr, time: `${String(h).padStart(2, "0")}:00` })}
                  style={{
                    width: slotWidth, padding: "8px 6px", borderRight: `1px solid ${C.border}`,
                    fontSize: 11, color: C.textMuted, fontWeight: 600, cursor: "pointer",
                    textAlign: "center",
                  }}
                  title="Click para crear evento"
                >{String(h).padStart(2, "0")}:00</div>
              ))}
            </div>
            {/* Eventos */}
            <div style={{ position: "relative", height: 110, marginTop: 6 }}>
              {dayEvents.map((ev, idx) => {
                const meta = TYPE_META[ev.event_type] || TYPE_META.task;
                const [hh, mm] = (ev.event_time || "09:00").split(":").map(Number);
                const minutesFromStart = (hh - 8) * 60 + mm;
                const left = (minutesFromStart / 60) * slotWidth;
                const width = Math.max(60, ((ev.duration_minutes || 30) / 60) * slotWidth - 4);
                const top = (idx % 3) * 36;
                return (
                  <div
                    key={ev.id}
                    onClick={() => openEdit(ev)}
                    style={{
                      position: "absolute", left, top, width,
                      background: `${meta.color}18`, borderLeft: `3px solid ${meta.color}`,
                      borderRadius: 6, padding: "5px 8px", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: meta.color,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      opacity: ev.is_completed ? 0.5 : 1,
                      textDecoration: ev.is_completed ? "line-through" : "none",
                    }}
                  >
                    {ev.event_time?.slice(0, 5)} · {ev.title}
                  </div>
                );
              })}
              {dayEvents.length === 0 && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color: C.textMuted, fontSize: 12,
                }}>
                  No hay eventos este día — click en una hora para crear uno
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ════════════════════════════════════════════════
  return (
    <div style={{ padding: 24, fontFamily: font, background: C.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 18, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>Agenda</h1>
          <p style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
            Gestión de tareas, llamadas, reuniones y plazos
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          style={{
            padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            fontFamily: font, cursor: "pointer", border: "none",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", display: "flex", alignItems: "center", gap: 6,
            boxShadow: `0 4px 14px ${C.primary}40`,
          }}
        >
          <Plus size={15} /> Nueva tarea
        </button>
      </div>

      {/* Toggle vistas */}
      <div style={{ display: "flex", gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, width: "fit-content", marginBottom: 16 }}>
        {[
          { v: "list",  l: "Lista" },
          { v: "month", l: "Mes"   },
          { v: "day",   l: "Día"   },
        ].map(opt => (
          <button
            key={opt.v}
            onClick={() => setView(opt.v)}
            style={{
              padding: "7px 18px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
              fontFamily: font, cursor: "pointer", border: "none",
              background: view === opt.v ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : "transparent",
              color: view === opt.v ? "#fff" : C.text,
            }}
          >{opt.l}</button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        marginBottom: 18, background: C.card, padding: 12, borderRadius: 12,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <User size={13} color={C.textMuted} />
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            style={selectMini()}
          >
            <option value="all">Todos los letrados</option>
            {team.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={13} color={C.textMuted} />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={selectMini()}
          >
            <option value="all">Todos los tipos</option>
            <option value="call">Llamada</option>
            <option value="deadline">Plazo</option>
            <option value="meeting">Reunión</option>
            <option value="hearing">Vista</option>
            <option value="task">Tarea</option>
          </select>
        </div>
        <label style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 12,
          color: C.text, cursor: "pointer", marginLeft: "auto",
        }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={e => setShowCompleted(e.target.checked)}
            style={{ cursor: "pointer" }}
          /> Mostrar completadas
        </label>
      </div>

      {/* Contenido */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>Cargando…</div>
      ) : (
        <>
          {view === "list"  && renderList()}
          {view === "month" && renderMonth()}
          {view === "day"   && renderDay()}
        </>
      )}

      {modalOpen && (
        <TaskFormModal
          initialData={modalInitial}
          defaultDate={modalDefault}
          user={user}
          onClose={closeModal}
          onSaved={() => loadAll()}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// COMPONENTES INTERNOS
// ════════════════════════════════════════════════

function EventCard({ ev, onToggle, onEdit }) {
  const meta = TYPE_META[ev.event_type] || TYPE_META.task;
  const Icon = meta.icon;
  const prio = PRIORITY_META[ev.priority] || PRIORITY_META.normal;
  const completed = ev.is_completed;

  return (
    <div
      onClick={() => onEdit(ev)}
      style={{
        background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
        padding: "12px 14px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        opacity: completed ? 0.5 : 1,
        borderLeft: `4px solid ${meta.color}`,
        transition: "transform .12s, box-shadow .12s",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <input
        type="checkbox"
        checked={completed}
        onClick={e => e.stopPropagation()}
        onChange={() => onToggle(ev.id, completed)}
        style={{ cursor: "pointer", width: 16, height: 16, flexShrink: 0 }}
      />
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${meta.color}15`, display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={15} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: C.text,
          textDecoration: completed ? "line-through" : "none",
          marginBottom: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        }}>
          <span>{ev.title}</span>
          {ev.recurrence && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5,
              color: C.violet, background: `${C.violet}12`, padding: "2px 6px", borderRadius: 5,
              fontWeight: 600,
            }}>
              <RefreshCw size={10} /> {RECURRENCE_LABEL[ev.recurrence]}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 600, color: prio.color,
            background: `${prio.color}15`, padding: "2px 7px", borderRadius: 5,
          }}>{prio.label}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11.5, color: C.textMuted }}>
          {ev.event_time && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Clock size={11} /> {ev.event_time.slice(0, 5)}
            </span>
          )}
          {ev.assignee?.full_name && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <User size={11} /> {ev.assignee.full_name}
            </span>
          )}
          {ev.case?.case_number && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <FolderKanban size={11} /> {ev.case.case_number}
            </span>
          )}
          {ev.location && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <MapPin size={11} /> {ev.location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DayDetailModal({ date, events, onClose, onEdit, onCreate, onToggle }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)",
      backdropFilter: "blur(3px)", display: "flex", justifyContent: "flex-end",
      fontFamily: font,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420, background: C.card, height: "100%",
          padding: 22, overflow: "auto", boxShadow: "-8px 0 30px rgba(0,0,0,.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Eventos del día</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, textTransform: "capitalize" }}>{formatDateLong(date)}</div>
          </div>
          <button onClick={onClose} style={iconBtn()}><X size={16} /></button>
        </div>

        <button
          onClick={onCreate}
          style={{
            width: "100%", padding: "10px 16px", borderRadius: 10, fontSize: 13,
            fontWeight: 600, fontFamily: font, cursor: "pointer", border: "none",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginBottom: 14,
          }}
        ><Plus size={14} /> Añadir evento este día</button>

        {events.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
            No hay eventos
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map(ev => <EventCard key={ev.id} ev={ev} onToggle={onToggle} onEdit={onEdit} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// HELPERS DE ESTILO
// ════════════════════════════════════════════════
function iconBtn() {
  return {
    width: 32, height: 32, borderRadius: 8,
    border: `1px solid ${C.border}`, background: C.card, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: C.text,
  };
}
function selectMini() {
  return {
    padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
    fontSize: 12, fontFamily: font, background: C.card, color: C.text,
    outline: "none", cursor: "pointer",
  };
}
