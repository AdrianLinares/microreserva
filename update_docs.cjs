const fs = require('fs');

const readmeContent = `# SGC-MICRORESERVA - SISTEMA DE GESTIÓN DE LA SALA DE PETROGRAFÍA

Sistema de agendamiento y reserva de equipos de la Sala de Petrografía del Servicio Geológico Colombiano (SGC). Esta aplicación permite a los investigadores y técnicos reservar equipos específicos por bloques de tiempo (slots horarios), gestionar cancelaciones, notificar automáticamente a los involucrados y bloquear preventivamente turnos por mantenimientos u otras restricciones.

## 🚀 Arquitectura del Proyecto
El sistema ha migrado a un esquema de **Monorepo** compuesto por:
- **Frontend:** Single Page Application (SPA) en React + Vite + TypeScript.
- **Backend:** API REST en Node.js + Express (TypeScript), desplegado de manera persistente con PM2.
- **Base de Datos:** PostgreSQL en la nube (Neon).
- **Notificaciones:** Envío de correos automatizados vía \`nodemailer\` mediante el SMTP corporativo del SGC.

---

## ✨ Características Principales
1. **Reserva de Equipos (Slots):** Interfaz gráfica intuitiva dividida en días y slots de horas para agendamiento de equipos (ej. Microscopios, Cortadoras).
2. **Bloqueo Administrativo:** Los administradores pueden bloquear:
   - Días completos.
   - Slot(s) específicos (turnos de hora) independiente por equipo. (Ej. Mantenimiento del Equipo B a las 10:00 AM).
3. **Notificaciones por Correo:** Alerta inmediata a los usuarios tras agendar, modificar o cancelar un turno.
4. **Zona Horaria Estricta:** El sistema se encuentra parametrizado para manejar, validar y loggear en la zona horaria **America/Bogota** sin depender de la configuración local del sistema operativo subyacente.

---

## 🛠 Entorno de Desarrollo

### Prerrequisitos
- Node.js (v18 o superior recomendado)
- PostgreSQL local o un Data Source como Neon
- Git

### Instalación
1. Clonar el repositorio.
2. Instalar dependencias tanto en raíz (Frontend) como en \`/server\` (Backend):
   \`\`\`bash
   npm install
   cd server && npm install
   \`\`\`

3. Configurar variables de entorno (ver sección Variables de Entorno).
4. Levantar el proyecto en desarrollo:
   - **Backend:** \`npm run build:backend && node server/dist/index.js\` 
   - **Frontend:** \`npm run dev\`

---

## 🔐 Variables de Entorno

**Frontend (\`.env.local\` en raíz):**
\`\`\`env
VITE_API_URL=http://localhost:3000/api
VITE_ADMIN_EMAILS=admin@sgc.gov.co
\`\`\`

**Backend (\`server/.env\` o \`.env\` en raíz para el inicio):**
\`\`\`env
PORT=3000
DATABASE_URL=postgres://usuario:pass@host/db?sslmode=require
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=correo@sgc.gov.co
SMTP_PASS=tu_password
CORS_ORIGIN=http://localhost:5173,http://granate.sgc.gov.co
LOG_LEVEL=info
NODE_ENV=development
TZ=America/Bogota
\`\`\`

## 📚 Documentación Técnica
- [Arquitectura (ESTRUCTURA.md)](./ESTRUCTURA.md)
- [Guía de Despliegue (DEPLOY.md)](./DEPLOY.md)
`;

const estructuraContent = `# 📂 ESTRUCTURA DEL PROYECTO

El proyecto se divide de manera lógica dentro del repositorio raíz para un fácil acceso y despliegue integrado (PM2 levanta los distruidos compilados, mientras Nginx/IIS puede servir el front).

## Árbol de Directorios
\`\`\`text
SGC-MICRORESERVA/
├── public/                # Assets del frontend
├── src/                   # 📱 CÓDIGO FUENTE FRONTEND (React)
│   ├── components/        # Componentes UI (AdminPanel, BookingModal)
│   ├── services/          # Llamadas fetch/Axios a la API (api.ts)
│   ├── types.ts           # Definiciones estrictas TS compartidas implícitamente
│   ├── constants.ts       # Lista de Equipos, Horarios permitidos.
│   ├── App.tsx            # Árbol principal de rutas y contexto
│   └── main.tsx           # Entrypoint de React
├── server/                # ⚙️ CÓDIGO FUENTE BACKEND (Express / Node.js)
│   ├── src/
│   │   ├── config/        # Setup PostgreSQL, Nodemailer, Logger y Zona Horaria
│   │   ├── controllers/   # Lógica de Negocio (Reservas, Desbloqueos, Switch turnos)
│   │   ├── routes/        # Definición de Routers API (\`/api/booking\`, \`/api/bookings\`)
│   │   └── index.ts       # Entrypoint servidor Express
│   ├── tsconfig.json      # Config de compilación para el backend
│   └── dist/              # Generado autom. al ejecutar \`npm run build:backend\`
├── logs/                  # 📊 Registros y bitácoras generados por Winston/PM2
├── schema.sql             # Plantilla de creación de Tablas en Postgres Constraint (block_type)
├── ecosystem.config.cjs   # Configuración de despliegue PM2
├── package.json           # Dependencias raíz (Frontend y utilitarios)
└── vite.config.ts         # Configuración del empaquetador Vite
\`\`\`

## Flujo de Datos (Arquitectura)
1. **Frontend:** El componente \`AdminPanel.tsx\` intercepta clicks. Al seleccionar "Bloquear Slot", actualiza y envía vía \`POST /api/bookings\` o \`PUT /api/booking\` la solicitud con los identificadores temporales.
2. **Controlador BD (\`server/src/controllers/bookings.ts\`):** Identifica e invalida lógicamente colisiones temporales. Gestiona DB Deletes en caso de desbloqueos (status "available").
3. **Persistencia y Timezone (\`index.ts -> db.ts\`):** A un nivel de capa del entorno (Node), la variable \`TZ=America/Bogota\` asegura que la persistencia se hace en hora real de Colombia sobre PostgreSQL.
4. **Respuesta Visual y Logger:** El logger interno (Winston) registra operaciones a \`./logs/combined.log\` y el SPA de React se actualiza en memoria sin refresco gracias al polling oa promesas asíncronas HTTP.
`;

const deployContent = `# 🚀 GUÍA DE DESPLIEGUE EN PRODUCCIÓN

Para pasar de un entorno de pruebas locales a un servidor oficial corporativo, siga las siguientes pautas de empaquetado y arranque demonizado.

## 1. Migración de Base de Datos
- Las estructuras de tabla residen en \`schema.sql\`.
- **Importante:** Recuerde que para soportar el Bloqueo por Slot se modificó el Constraint de la DB. Así que, aplique el alter en su DB PostgreSQL si ya existía:
  \`\`\`sql
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_block_type_check;
  ALTER TABLE bookings ADD CONSTRAINT bookings_block_type_check CHECK (block_type IN ('day', 'slot'));
  \`\`\`

## 2. Construcción de Artefactos (Build)
Debe compilar ambos módulos (Frontend y Backend).
\`\`\`bash
# 1. Compilar Backend
npm run build:backend
# Esto genera el código transpilado listo para ejecutarse en /server/dist/

# 2. Compilar Frontend
npm run build
# Esto empaquetará los asstes minificados en /dist/ (o /build/)
\`\`\`

## 3. Gestor de Procesos (PM2)
Se ha orquestado el \`ecosystem.config.cjs\` para un arranque persistente.

Para ejecutar en producción:
\`\`\`bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
\`\`\`

Detalles del PM2:
- El backend corre por el puerto **3000** escuchando APIs.
- Fuerce expresamente la zona horaria \`America/Bogota\`.
- Almacena logs formateados en \`YYYY-MM-DD HH:mm -0500\` dentro de \`./logs/\`.

## 4. Servidor Web Inverso (Nginx/IIS)
Se recomienda instalar un Server proxy que ofrezca SSL (HTTPS) y redirija el tráfico estático de la react app construida (carpeta build) hacia el usuario, y el uso del segmento API hacia PM2.

**Ejemplo NGINX:**
\`\`\`nginx
server {
    listen 80;
    server_name granate.sgc.gov.co;

    # Frontend
    location / {
        root /ruta/al/proyecto/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Route a PM2
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`

## 5. Prevención de Riesgos de Rutas (Legacy \`/booking\`)
Parte del front interactuaba originalmente con Servless Functions orientadas a archivos físicos (eg. solicitaba PUT a \`/booking?id=X\` y no a \`/bookings\`).
Para evitar fallas de reestructuracion, el API se ha aprovisionado con Routers Express específicos para ambos esquemas. Cualquier nuevo endpoint debe respetar el enrutador en \`server/src/index.ts\`.
`;

fs.writeFileSync('README.md', readmeContent);
fs.writeFileSync('ESTRUCTURA.md', estructuraContent);
fs.writeFileSync('DEPLOY.md', deployContent);

console.log("Documentos actualizados exitosamente.");
