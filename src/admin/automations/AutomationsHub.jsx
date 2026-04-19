import { useState } from "react";
import { Workflow, Bot, MessageCircle, FileText } from "lucide-react";
import { C, font } from "../../constants";
import WorkflowsList from "./WorkflowsList";
import AiAgentsList from "./AiAgentsList";
import AiConversationsList from "./AiConversationsList";
import TemplatesList from "./TemplatesList";

export default function AutomationsHub({ user }) {
  const [tab, setTab] = useState("workflows");

  const tabs = [
    { id: "workflows", label: "Workflows", icon: Workflow },
    { id: "agents", label: "Agentes IA", icon: Bot },
    { id: "conversations", label: "Conversaciones IA", icon: MessageCircle },
    { id: "templates", label: "Plantillas", icon: FileText },
  ];

  return (
    <div style={{ fontFamily: font }}>
      <div style={{
        display: "flex", gap: 4, marginBottom: 22,
        background: C.white, borderRadius: 12,
        border: `1px solid ${C.border}`, padding: 4,
        overflowX: "auto",
      }}>
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 9,
                background: active ? `linear-gradient(135deg, ${C.primary}12, ${C.violet}08)` : "transparent",
                color: active ? C.primary : C.textMuted,
                fontSize: 12.5, fontWeight: active ? 600 : 400,
                transition: ".2s", whiteSpace: "nowrap",
                border: active ? `1px solid ${C.primary}20` : "1px solid transparent",
                fontFamily: font, cursor: "pointer",
              }}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div key={tab} style={{ animation: "fadeIn .2s ease" }}>
        {tab === "workflows" && <WorkflowsList user={user} />}
        {tab === "agents" && <AiAgentsList user={user} />}
        {tab === "conversations" && <AiConversationsList user={user} />}
        {tab === "templates" && <TemplatesList user={user} />}
      </div>
    </div>
  );
}
