import { Banknote, CreditCard, Wallet } from "lucide-react";

// ════ LOGO ════
const LOGO = "data:image/jpeg;base64,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";

// ════ FUENTE ════
const font = "'Poppins', sans-serif";

// ════ PALETA DE COLORES ════
const C = {
  primary: "#5B6BF0", primaryDark: "#4A58D4", primaryLight: "#7B8AF5",
  violet: "#7C5BF0", violetDark: "#6344D4",
  teal: "#5BBFA0", tealLight: "#7DD4B8", tealSoft: "rgba(91,191,160,0.08)",
  cta: "#6B5BF0",
  dark: "#2D2D2D",
  sidebar: "#1E1E2E", sidebarLight: "#2A2A3D", sidebarMid: "#353550",
  text: "#2D2D2D", textMuted: "#7A7A8A", textLight: "#A0A0B0",
  green: "#22c55e", greenSoft: "rgba(34,197,94,0.08)",
  red: "#ef4444", redSoft: "rgba(239,68,68,0.08)",
  orange: "#f59e0b", orangeSoft: "rgba(245,158,11,0.08)",
  blue: "#3b82f6", blueSoft: "rgba(59,130,246,0.08)",
  white: "#ffffff", bg: "#F5F5F7", card: "#ffffff",
  border: "#E5E5EA",
};

// ════ BASE DE CONOCIMIENTO ════
const KB = {
  ls01: { name:"DNI/NIE", issuer:"Direcci\u00f3n General de la Polic\u00eda", validity:"En vigor", whereToGet:"Comisar\u00eda con cita previa en sede.policia.gob.es", criteria:"Confirma que es un DNI o NIE espa\u00f1ol oficial. Debe mostrar n\u00famero, nombre, fecha nacimiento, fecha validez (no caducado) y foto. Verifica anverso y reverso." },
  ls02: { name:"Libro de familia", issuer:"Registro Civil", validity:"Actualizado", whereToGet:"Registro Civil del lugar de matrimonio", criteria:"Confirma que es un Libro de Familia oficial con sello del Registro Civil, datos del matrimonio y filiaci\u00f3n de hijos." },
  ls03: { name:"Certificado empadronamiento", issuer:"Ayuntamiento", validity:"3 meses", whereToGet:"Sede electr\u00f3nica del Ayuntamiento con Cl@ve o certificado digital", criteria:"Confirma que es un certificado (NO volante) con cabecera del Ayuntamiento, nombre, DNI, direcci\u00f3n, fecha expedici\u00f3n no superior a 3 meses, y sello." },
  ls04: { name:"Antecedentes penales", issuer:"Ministerio de Justicia", validity:"3 meses", whereToGet:"sede.mjusticia.gob.es", criteria:"Confirma certificado del Ministerio de Justicia con CSV de verificaci\u00f3n, fecha no superior a 3 meses. NO confundir con certificado de delitos sexuales." },
  ls05: { name:"3 \u00faltimas n\u00f3minas", issuer:"Empresa empleadora", validity:"3 meses", whereToGet:"RRHH o portal del empleado", criteria:"Confirma que son 3 n\u00f3minas consecutivas y recientes con CIF empresa, datos trabajador, salario bruto/neto y deducciones." },
  ls06: { name:"IRPF 4 a\u00f1os", issuer:"AEAT", validity:"\u00daltimos 4 ejercicios", whereToGet:"sede.agenciatributaria.gob.es con Cl@ve", criteria:"Confirma declaraciones IRPF Modelo 100 oficiales, con CSV, de los \u00faltimos 4 ejercicios consecutivos." },
  ls09: { name:"Extractos bancarios 12 meses", issuer:"Entidad bancaria", validity:"12 meses consecutivos", whereToGet:"Banca electr\u00f3nica de cada entidad", criteria:"Confirma extractos de TODAS las cuentas, 12 meses consecutivos, con movimientos detallados (no solo saldos)." },
  ls14: { name:"Certificado deuda AEAT", issuer:"AEAT", validity:"3 meses", whereToGet:"sede.agenciatributaria.gob.es", criteria:"Confirma certificado AEAT de situaci\u00f3n de deudas con CSV, fecha no superior a 3 meses, y detalle de deudas pendientes." },
  ls15: { name:"Certificado deuda TGSS", issuer:"TGSS", validity:"3 meses", whereToGet:"sede.seg-social.gob.es", criteria:"Confirma certificado TGSS de deudas (NO confundir con vida laboral), con sello digital y fecha reciente." },
  ca04: { name:"Certificaci\u00f3n Registro Mercantil", issuer:"Registro Mercantil", validity:"3 meses", whereToGet:"www.registradores.org", criteria:"Confirma certificaci\u00f3n oficial (no nota simple) del Registro Mercantil con datos vigentes y administradores actuales." },
  ca10: { name:"Certificado AEAT empresa", issuer:"AEAT", validity:"3 meses", whereToGet:"sede.agenciatributaria.gob.es", criteria:"Igual que ls14 pero con CIF de empresa." },
  ca18: { name:"Extractos bancarios empresa", issuer:"Entidades bancarias", validity:"12 meses", whereToGet:"Banca electr\u00f3nica de empresa", criteria:"Extractos de TODAS las cuentas de la sociedad, 12 meses consecutivos." },
  ca24: { name:"Informe CIRBE", issuer:"Banco de Espa\u00f1a", validity:"3 meses", whereToGet:"sede.bde.es con certificado digital", criteria:"Confirma Informe CIRBE oficial del Banco de Espa\u00f1a, con detalle de operaciones de riesgo y fecha no superior a 3 meses." },
};

// ════ DOCUMENTOS LSO ════
const DOCS_LSO=[{id:"ls01",name:"DNI / NIE en vigor (deudor y c\u00f3nyuge)",cat:"Datos Personales",catNum:1,status:"pending",required:true},{id:"ls02",name:"Libro de familia",cat:"Datos Personales",catNum:1,status:"pending",required:true},{id:"ls03",name:"Certificado empadronamiento actual",cat:"Datos Personales",catNum:1,status:"pending",required:true},{id:"ls04",name:"Certificado antecedentes penales",cat:"Datos Personales",catNum:1,status:"pending",required:true},{id:"ls05",name:"\u00daltimas 3 n\u00f3minas",cat:"Situaci\u00f3n Laboral",catNum:2,status:"pending",required:true},{id:"ls06",name:"Declaraciones IRPF/RENTA (4 a\u00f1os)",cat:"Situaci\u00f3n Laboral",catNum:2,status:"pending",required:true},{id:"ls07",name:"Declaraci\u00f3n patrimonio",cat:"Situaci\u00f3n Laboral",catNum:2,status:"pending",required:false},{id:"ls08",name:"Certificado prestaciones desempleo/pensiones",cat:"Situaci\u00f3n Laboral",catNum:2,status:"pending",required:false},{id:"ls09",name:"Extractos bancarios 12 meses",cat:"Situaci\u00f3n Bancaria",catNum:3,status:"pending",required:true},{id:"ls10",name:"Contratos pr\u00e9stamos, hipotecas, cr\u00e9ditos",cat:"Situaci\u00f3n Bancaria",catNum:3,status:"pending",required:true},{id:"ls11",name:"Certificados deuda entidades financieras",cat:"Situaci\u00f3n Bancaria",catNum:3,status:"pending",required:true},{id:"ls12",name:"Tarjetas cr\u00e9dito y saldos pendientes",cat:"Situaci\u00f3n Bancaria",catNum:3,status:"pending",required:true},{id:"ls13",name:"Listado acreedores completo (Excel)",cat:"Deudas y Acreedores",catNum:4,status:"pending",required:true},{id:"ls14",name:"Certificado deuda AEAT",cat:"Deudas y Acreedores",catNum:4,status:"pending",required:true},{id:"ls15",name:"Certificado deuda TGSS",cat:"Deudas y Acreedores",catNum:4,status:"pending",required:true},{id:"ls16",name:"Deuda otras AAPP",cat:"Deudas y Acreedores",catNum:4,status:"pending",required:false},{id:"ls17",name:"Reclamaciones judiciales en curso",cat:"Deudas y Acreedores",catNum:4,status:"pending",required:true},{id:"ls18",name:"Escrituras de propiedad",cat:"Inventario Bienes",catNum:5,status:"pending",required:true},{id:"ls19",name:"Recibos IBI (2 a\u00f1os)",cat:"Inventario Bienes",catNum:5,status:"pending",required:true},{id:"ls20",name:"Contratos alquiler",cat:"Inventario Bienes",catNum:5,status:"pending",required:true},{id:"ls21",name:"Permisos circulaci\u00f3n y fichas t\u00e9cnicas",cat:"Inventario Bienes",catNum:5,status:"pending",required:true},{id:"ls22",name:"Tasaciones inmuebles/veh\u00edculos",cat:"Inventario Bienes",catNum:5,status:"pending",required:false},{id:"ls23",name:"Seguros contratados",cat:"Inventario Bienes",catNum:5,status:"pending",required:true},{id:"ls24",name:"Acciones o participaciones sociales",cat:"Inventario Bienes",catNum:5,status:"pending",required:false},{id:"ls25",name:"Propiedad intelectual, patentes",cat:"Inventario Bienes",catNum:5,status:"pending",required:false},{id:"ls26",name:"Gastos mensuales",cat:"Gastos e Ingresos",catNum:6,status:"pending",required:true},{id:"ls27",name:"Ingresos mensuales",cat:"Gastos e Ingresos",catNum:6,status:"pending",required:true},{id:"ls28",name:"Contratos de trabajo",cat:"Contratos Vigentes",catNum:7,status:"pending",required:true},{id:"ls29",name:"Contratos mercantiles",cat:"Contratos Vigentes",catNum:7,status:"pending",required:false},{id:"ls30",name:"Leasing, renting, compromisos financieros",cat:"Contratos Vigentes",catNum:7,status:"pending",required:true}];

// ════ DOCUMENTOS CONCURSO ════
const DOCS_CONCURSO=[{id:"ca01",name:"Escritura de constituci\u00f3n",cat:"Identificaci\u00f3n y Constituci\u00f3n",catNum:1,status:"pending",required:true},{id:"ca02",name:"Estatutos sociales vigentes",cat:"Identificaci\u00f3n y Constituci\u00f3n",catNum:1,status:"pending",required:true},{id:"ca03",name:"DNI del administrador",cat:"Identificaci\u00f3n y Constituci\u00f3n",catNum:1,status:"pending",required:true},{id:"ca04",name:"Certificaci\u00f3n Registro Mercantil",cat:"Identificaci\u00f3n y Constituci\u00f3n",catNum:1,status:"pending",required:true},{id:"ca05",name:"Poderes de representaci\u00f3n",cat:"Identificaci\u00f3n y Constituci\u00f3n",catNum:1,status:"pending",required:false},{id:"ca06",name:"Cuentas anuales 3 ejercicios",cat:"Doc. Contable y Fiscal",catNum:2,status:"pending",required:true},{id:"ca07",name:"Impuesto Sociedades 3 ejercicios",cat:"Doc. Contable y Fiscal",catNum:2,status:"pending",required:true},{id:"ca08",name:"Declaraciones IVA 12 meses",cat:"Doc. Contable y Fiscal",catNum:2,status:"pending",required:true},{id:"ca09",name:"Retenciones 12 meses",cat:"Doc. Contable y Fiscal",catNum:2,status:"pending",required:true},{id:"ca10",name:"Certificado AEAT",cat:"Doc. Contable y Fiscal",catNum:2,status:"pending",required:true},{id:"ca11",name:"Certificado TGSS",cat:"Doc. Contable y Fiscal",catNum:2,status:"pending",required:true},{id:"ca12",name:"Memoria explicativa insolvencia",cat:"Memoria Econ\u00f3mica y Jur\u00eddica",catNum:3,status:"pending",required:true,warn:"Requisito art. 7 TRLC"},{id:"ca13",name:"Destino cr\u00e9ditos tras insolvencia",cat:"Memoria Econ\u00f3mica y Jur\u00eddica",catNum:3,status:"pending",required:true},{id:"ca14",name:"Insolvencia actual o inminente",cat:"Memoria Econ\u00f3mica y Jur\u00eddica",catNum:3,status:"pending",required:true},{id:"ca15",name:"Bienes inmuebles con cargas",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:true},{id:"ca16",name:"Tasaci\u00f3n inmuebles gravados",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:true},{id:"ca17",name:"Veh\u00edculos y maquinaria",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:true},{id:"ca18",name:"Extractos bancarios 12 meses",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:true},{id:"ca19",name:"Existencias y stocks",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:true},{id:"ca20",name:"Clientes pendientes cobro",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:true},{id:"ca21",name:"Contratos arrendamiento",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:true},{id:"ca22",name:"Participaciones otras sociedades",cat:"Inventario Bienes (Masa Activa)",catNum:4,status:"pending",required:false},{id:"ca23",name:"Lista acreedores (Word/Excel)",cat:"Lista Acreedores (Masa Pasiva)",catNum:5,status:"pending",required:true,warn:"Formato editable"},{id:"ca24",name:"Informe CIRBE (3 meses)",cat:"Lista Acreedores (Masa Pasiva)",catNum:5,status:"pending",required:true},{id:"ca25",name:"Contratos pr\u00e9stamo y p\u00f3lizas",cat:"Lista Acreedores (Masa Pasiva)",catNum:5,status:"pending",required:true},{id:"ca26",name:"Certificados saldo deuda",cat:"Lista Acreedores (Masa Pasiva)",catNum:5,status:"pending",required:true},{id:"ca27",name:"Reclamaciones y embargos",cat:"Lista Acreedores (Masa Pasiva)",catNum:5,status:"pending",required:true},{id:"ca28",name:"Trabajadores y salarios",cat:"Doc. Laboral",catNum:6,status:"pending",required:true},{id:"ca29",name:"N\u00f3minas trabajadores",cat:"Doc. Laboral",catNum:6,status:"pending",required:true},{id:"ca30",name:"Contratos de trabajo",cat:"Doc. Laboral",catNum:6,status:"pending",required:true},{id:"ca31",name:"Certificado SS",cat:"Doc. Laboral",catNum:6,status:"pending",required:true},{id:"ca32",name:"Salarios pendientes",cat:"Doc. Laboral",catNum:6,status:"pending",required:false},{id:"ca33",name:"Contratos mercantiles",cat:"Contratos y Rel. Jur\u00eddicas",catNum:7,status:"pending",required:true},{id:"ca34",name:"Contratos proveedores",cat:"Contratos y Rel. Jur\u00eddicas",catNum:7,status:"pending",required:true},{id:"ca35",name:"Contratos AAPP",cat:"Contratos y Rel. Jur\u00eddicas",catNum:7,status:"pending",required:false},{id:"ca36",name:"Transmisiones a vinculados",cat:"Transmisiones Patrimoniales",catNum:8,status:"pending",required:true,warn:"Obligatorio art. 7 TRLC"}];

// ════ USUARIOS DEMO ════
const DEMO=[
  {email:"maria@demo.com",password:"1234",name:"Mar\u00eda Garc\u00eda L\u00f3pez",caseType:"lso",caseId:"1412a-2025",lawyer:"Carlos Mart\u00ednez",role:"client"},
  {email:"empresa@demo.com",password:"1234",name:"Construcciones Levante S.L.",caseType:"concurso",caseId:"0892b-2025",lawyer:"Ana Beltr\u00e1n",role:"client"},
  {email:"admin@libredeuda.com",password:"admin1234",name:"Carlos Mart\u00ednez",role:"admin",caseType:null,caseId:null,lawyer:null}
];

// ════ EVENTOS ════
const EVENTS_LSO=[{id:"e1",title:"Llamada seguimiento",date:"2026-04-16",time:"10:00",type:"call",desc:"Revisi\u00f3n documentaci\u00f3n pendiente"},{id:"e2",title:"Plazo: Extractos bancarios",date:"2026-04-22",type:"deadline",desc:"12 meses de extractos"},{id:"e3",title:"Reuni\u00f3n en despacho",date:"2026-04-28",time:"12:00",type:"meeting",desc:"Revisi\u00f3n completa"},{id:"e4",title:"Plazo: Certificados AEAT/TGSS",date:"2026-05-05",type:"deadline",desc:"Certificados deuda"},{id:"e5",title:"Solicitud AEP",date:"2026-05-20",time:"09:30",type:"hearing",desc:"Notar\u00eda"}];
const EVENTS_CONC=[{id:"e1",title:"Recogida documental",date:"2026-04-17",time:"11:00",type:"call",desc:"Doc. societaria"},{id:"e2",title:"Plazo: Contabilidad",date:"2026-04-25",type:"deadline",desc:"Cuentas y modelos"},{id:"e3",title:"Reuni\u00f3n administrador",date:"2026-04-30",time:"10:00",type:"meeting",desc:"Masa activa/pasiva"},{id:"e4",title:"Plazo: Acreedores + CIRBE",date:"2026-05-08",type:"deadline",desc:"Lista + CIRBE"},{id:"e5",title:"Solicitud concursal",date:"2026-05-22",time:"09:00",type:"hearing",desc:"Juzgado Mercantil"}];

// ════ PAGOS ════
const PAYMENTS = {
  lso: {
    totalContracted: 2500,
    method: "direct_debit",
    iban: "ES12 **** **** **** **** 1234",
    bank: "BBVA",
    payments: [
      { id:"p0", n:0, date:"2026-01-05", amount:147, status:"paid", concept:"An\u00e1lisis de viabilidad", invoice:"FA-2026-0145" },
      { id:"p1", n:1, date:"2026-01-15", amount:208.33, status:"paid", concept:"Mensualidad 1/12", invoice:"FA-2026-0167" },
      { id:"p2", n:2, date:"2026-02-15", amount:208.33, status:"paid", concept:"Mensualidad 2/12", invoice:"FA-2026-0289" },
      { id:"p3", n:3, date:"2026-03-15", amount:208.33, status:"paid", concept:"Mensualidad 3/12", invoice:"FA-2026-0412" },
      { id:"p4", n:4, date:"2026-04-18", amount:208.33, status:"upcoming", concept:"Mensualidad 4/12" },
      { id:"p5", n:5, date:"2026-05-15", amount:208.33, status:"pending", concept:"Mensualidad 5/12" },
      { id:"p6", n:6, date:"2026-06-15", amount:208.33, status:"pending", concept:"Mensualidad 6/12" },
      { id:"p7", n:7, date:"2026-07-15", amount:208.33, status:"pending", concept:"Mensualidad 7/12" },
      { id:"p8", n:8, date:"2026-08-15", amount:208.33, status:"pending", concept:"Mensualidad 8/12" },
      { id:"p9", n:9, date:"2026-09-15", amount:208.33, status:"pending", concept:"Mensualidad 9/12" },
      { id:"p10", n:10, date:"2026-10-15", amount:208.33, status:"pending", concept:"Mensualidad 10/12" },
      { id:"p11", n:11, date:"2026-11-15", amount:208.33, status:"pending", concept:"Mensualidad 11/12" },
      { id:"p12", n:12, date:"2026-12-15", amount:208.37, status:"pending", concept:"Mensualidad 12/12 (final)" },
    ]
  },
  concurso: {
    totalContracted: 8500,
    method: "transfer",
    iban: "ES81 0049 1500 0512 1023 4567",
    beneficiary: "LibreApp S.L.",
    bank: "BBVA",
    paymentConcept: "Exp. 0892b-2025",
    payments: [
      { id:"p0", n:0, date:"2026-01-10", amount:350, status:"paid", concept:"An\u00e1lisis de viabilidad concursal", invoice:"FA-2026-0089" },
      { id:"p1", n:1, date:"2026-02-25", amount:1416.67, status:"paid", concept:"Plazo 1/6 - Provisi\u00f3n inicial", invoice:"FA-2026-0234" },
      { id:"p2", n:2, date:"2026-03-25", amount:1416.67, status:"paid", concept:"Plazo 2/6", invoice:"FA-2026-0398" },
      { id:"p3", n:3, date:"2026-04-25", amount:1416.67, status:"upcoming", concept:"Plazo 3/6" },
      { id:"p4", n:4, date:"2026-05-25", amount:1416.67, status:"pending", concept:"Plazo 4/6" },
      { id:"p5", n:5, date:"2026-06-25", amount:1416.67, status:"pending", concept:"Plazo 5/6" },
      { id:"p6", n:6, date:"2026-07-25", amount:1416.65, status:"pending", concept:"Plazo 6/6 (final)" },
    ]
  }
};

// ════ INFO METODOS DE PAGO ════
const methodInfo = {
  direct_debit: { label:"Domiciliaci\u00f3n bancaria", icon:Banknote, desc:"Cargo autom\u00e1tico en tu cuenta" },
  card: { label:"Tarjeta autom\u00e1tica", icon:CreditCard, desc:"Cargo autom\u00e1tico en tu tarjeta" },
  transfer: { label:"Transferencia bancaria", icon:Wallet, desc:"Realizas la transferencia t\u00fa" },
};

// ════ FUNCION ADMIN: DATOS CROSS-CLIENT ════
export function getAllCases() {
  const clients = DEMO.filter(u => u.role === "client");
  return clients.map(client => {
    const docs = (client.caseType === "concurso" ? DOCS_CONCURSO : DOCS_LSO).map(d => ({...d}));
    const events = client.caseType === "concurso" ? EVENTS_CONC : EVENTS_LSO;
    const payments = PAYMENTS[client.caseType];
    const uploaded = docs.filter(d => d.status === "uploaded" || d.status === "review").length;
    const progress = docs.length ? Math.round(uploaded / docs.length * 100) : 0;
    const pendingDocs = docs.filter(d => d.status === "pending" && d.required).length;
    const docsInReview = docs.filter(d => d.status === "review").length;
    const nextPayment = payments?.payments?.find(p => p.status === "upcoming") || null;
    const totalDocs = docs.length;
    return {
      client: { name: client.name, email: client.email, caseType: client.caseType, caseId: client.caseId, lawyer: client.lawyer },
      docs,
      events,
      payments,
      progress,
      phase: progress >= 100 ? "Revisi\u00f3n letrada" : "Recogida documental",
      pendingDocs,
      docsInReview,
      totalDocs,
      nextPayment,
      lastActivity: new Date().toISOString().split("T")[0]
    };
  });
}

// ════ EXPORTS ════
export { LOGO, font, C, KB, DOCS_LSO, DOCS_CONCURSO, DEMO, EVENTS_LSO, EVENTS_CONC, PAYMENTS, methodInfo };
