# LexDocs — Test en navegador

App de gestión documental legal de **LibreDeuda Abogados**.

## 🚀 Arranque rápido (3 pasos)

### 1. Instalar Node.js (si no lo tienes)

Descarga e instala desde https://nodejs.org (versión LTS).
Verifica: `node --version` debería mostrar v18 o superior.

### 2. Instalar dependencias

Abre la terminal en esta carpeta y ejecuta:

```bash
npm install
```

(tarda ~30 segundos la primera vez)

### 3. Arrancar la app

```bash
npm run dev
```

La app se abrirá automáticamente en **http://localhost:5173**

---

## 🔑 Credenciales de prueba

| Tipo | Email | Contraseña |
|------|-------|-----------|
| Particular (Ley 2ª Oportunidad) | `maria@demo.com` | `1234` |
| Empresa (Concurso Acreedores) | `empresa@demo.com` | `1234` |

---

## ✅ Qué puedes probar

### Funcional 100%
- ✅ **Login** con ambos perfiles
- ✅ **Navegación** entre todas las secciones (Inicio / Documentos / Mi expediente / Agenda / Asistente IA)
- ✅ **Subida de documentos**: foto, archivo, escáner integrado (CamScanner)
- ✅ **Verificación con IA** (modo demo simulado — ver abajo)
- ✅ **Mensajes motivadores** personalizados con tu nombre
- ✅ **Progreso por categoría** con barras visuales
- ✅ **Timeline** del expediente completo
- ✅ **Asistente IA** conversacional (requiere API real para respuestas)
- ✅ **Responsive**: prueba el móvil con F12 → modo dispositivo

### Modo DEMO (importante)
El **verificador con IA** está en modo simulado para esta prueba:
- Si subes un archivo muy pequeño (<10KB) → marca como "corrupto"
- Si subes una imagen <30KB → marca como "borrosa"
- Para archivos normales: simula resultados realistas (70% válido, 15% incompleto, 10% incorrecto, 5% caducado)

Esto te permite ver TODAS las pantallas del flujo (verificado, incompleto, incorrecto, caducado, en revisión) sin necesidad de API key.

Para usar **verificación real con Claude Vision**, configura un backend (ver `backend-notificaciones/`) y crea un archivo `.env`:

```
VITE_VERIFY_API_URL=http://localhost:3001
```

---

## 📂 Estructura del proyecto

```
lexdocs-test/
├── src/
│   ├── App.jsx          ← Toda la app (single-file)
│   ├── main.jsx         ← Entry point React
│   └── styles.css       ← Reset CSS
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## 🐛 Problemas comunes

**"command not found: npm"** → No tienes Node.js instalado. Ve al paso 1.

**El navegador no abre solo** → Abre manualmente http://localhost:5173

**"Port 5173 is already in use"** → Cierra otros procesos o cambia el puerto en `vite.config.js`.

**La cámara del escáner no funciona** → Necesita HTTPS o localhost. En localhost funciona.

---

## 📦 Build para producción

```bash
npm run build
```

Genera la carpeta `dist/` lista para subir a Vercel, Netlify, Railway o cualquier hosting estático.
