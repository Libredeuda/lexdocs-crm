import { Banknote, CreditCard, Wallet } from "lucide-react";

// ════ LOGO ════ (escudo con checkmark dentro de círculo blanco para destacar)
const LOGO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%25' stop-color='%235B6BF0'/><stop offset='100%25' stop-color='%237C5BF0'/></linearGradient></defs><circle cx='32' cy='32' r='32' fill='%23ffffff'/><path fill='url(%23g)' d='M32 10 L14 17 v14 c0 12 8 23 18 25 10-2 18-13 18-25 V17 L32 10z'/><path fill='none' stroke='%23ffffff' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' d='M22 33 L29 40 L43 26'/></svg>";

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
