// ════ USUARIOS DEMO ════
// SOLO para el modo demo de producto (VITE_DEMO_MODE=true). Este módulo se importa
// dinámicamente y SOLO dentro de la rama gated por el flag, de modo que el build de
// producción (sin el flag) lo elimina por completo vía dead-code elimination —
// así NUNCA se envían credenciales en el bundle real del SaaS.
// NO añadir aquí cuentas que existan de verdad en producción.
export const DEMO = [
  { email: "maria@demo.com", password: "1234", name: "María García López", caseType: "lso", caseId: "1412a-2025", lawyer: "Carlos Martínez", role: "client" },
  { email: "empresa@demo.com", password: "1234", name: "Construcciones Levante S.L.", caseType: "concurso", caseId: "0892b-2025", lawyer: "Ana Beltrán", role: "client" },
];
