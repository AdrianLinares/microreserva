# MicroReserva

Sistema de gestión de reservas para la Sala de Petrografía, con frontend en React + Vite y backend serverless en Netlify Functions con PostgreSQL (Neon).

## Resumen

MicroReserva permite:

- Solicitud de turnos por usuarios en una grilla semanal.
- Gestión administrativa de solicitudes (aprobar, eliminar, editar e intercambiar).
- Bloqueo de equipos por día, rango o de forma indefinida.
- Exportación de calendario semanal a PDF.
- Control de reglas de negocio (límite de turnos por persona, ventana de solicitud y validaciones de conflicto).

## Stack tecnológico

- Frontend: React 19, TypeScript, Vite 6, Lucide React.
- Backend: Netlify Functions (Node), Neon PostgreSQL.
- Seguridad: Basic Auth para administración, bcryptjs para validación de hashes.
- Utilidades: html2pdf.js para exportación del calendario.

## Arquitectura

### Frontend

- src/App.tsx: flujo principal de reservas y visualización de disponibilidad.
- src/components/BookingModal.tsx: captura de datos del solicitante.
- src/components/AdminPanel.tsx: panel de administración y exportación PDF.
- src/services/api.ts: cliente HTTP hacia las funciones serverless.
- src/constants.ts y src/types.ts: catálogo de equipos, slots y tipos del dominio.

### Backend (Netlify Functions)

- netlify/functions/bookings.ts
   - GET: lista reservas.
   - POST: crea reservas (pendientes para usuarios; estados administrativos solo con autenticación).
- netlify/functions/booking.ts
   - PUT: actualiza estado o mueve una reserva de slot.
   - DELETE: elimina reserva.
- netlify/functions/bookings-swap.ts
   - POST: intercambia slots entre dos reservas.
- netlify/functions/settings.ts
   - GET/PUT: lectura y actualización de ajustes administrativos.
- netlify/functions/lib/auth.ts
   - verificación de credenciales admin vía Basic Auth + bcrypt.

## Estructura del proyecto

```text
microreserva/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── constants.ts
│   ├── types.ts
│   ├── components/
│   │   ├── AdminPanel.tsx
│   │   └── BookingModal.tsx
│   └── services/
│       └── api.ts
├── netlify/
│   └── functions/
│       ├── booking.ts
│       ├── bookings.ts
│       ├── bookings-swap.ts
│       ├── settings.ts
│       └── lib/
│           └── auth.ts
├── scripts/
│   └── generate-hash.mjs
├── schema.sql
├── netlify.toml
├── package.json
└── README.md
```

## Requisitos

- Node.js 20 o superior (alineado con netlify.toml).
- npm 9 o superior.
- Cuenta y base de datos PostgreSQL (Neon u otra compatible).

## Instalación y ejecución local

1) Instalar dependencias:

```bash
npm install
```

2) Configurar variables de entorno en un archivo .env local (o en el entorno de Netlify Dev):

```bash
DATABASE_URL=postgres://usuario:password@host/db
ALLOWED_ORIGIN=http://localhost:8888
ADMIN_USERS=[{"username":"admin","passwordHash":"$2a$12$..."}]
```

3) Levantar entorno de desarrollo (frontend + functions):

```bash
npm run dev
```

Con la configuración actual de Netlify, la app corre en:

- UI + proxy functions: http://localhost:8888
- Vite interno: puerto 3000

## Scripts disponibles

- npm run dev: inicia Netlify Dev.
- npm run build: genera build de frontend en dist.
- npm run preview: previsualiza build de Vite.
- npm run generate-hash: genera un hash bcrypt para contraseñas admin.

## Configuración de autenticación admin

El backend usa Basic Auth. En frontend, las credenciales se guardan temporalmente en sessionStorage y se envían en el header Authorization.

Variable obligatoria:

- ADMIN_USERS: JSON con arreglo de usuarios admins.

Formato esperado:

```json
[
   {
      "username": "admin",
      "passwordHash": "$2a$12$..."
   }
]
```

Para generar un hash bcrypt:

```bash
npm run generate-hash
```

## Base de datos

El esquema SQL base está en schema.sql e incluye:

- Tabla bookings.
- Tabla admin_settings.
- Índices para consultas por fecha, estado y correo.

Aplicación de esquema recomendada:

1) Crear base de datos.
2) Ejecutar schema.sql completo.
3) Verificar que admin_settings contenga la key notification_email.

## Reglas funcionales relevantes

- Máximo de slots por persona: 6 reservas activas (pendiente/aprobada).
- Ventana de solicitud: lunes 07:00 a viernes 12:00.
- Estados de reserva:
   - pending: solicitud del usuario.
   - approved: aprobada por administración.
   - blocked: bloqueada por administración.
   - available: estado de referencia en UI.
- Bloqueo indefinido por equipo o para todos los equipos.

## Endpoints

Base local:

- /.netlify/functions

Rutas:

- GET /bookings
- POST /bookings
- PUT /booking?id={id}
- DELETE /booking?id={id}
- POST /bookings-swap
- GET /settings
- PUT /settings

Además, netlify.toml define un redirect de /api/* hacia /.netlify/functions/*.

## Despliegue en Netlify

Configuración ya incluida en netlify.toml:

- Build command: npm run build
- Publish directory: dist
- Functions directory: netlify/functions
- Headers de seguridad y caché configurados

Variables de entorno mínimas en producción:

- DATABASE_URL
- ADMIN_USERS
- ALLOWED_ORIGIN (recomendado fijarlo al dominio real)

## Troubleshooting

### 401 Unauthorized en panel admin

- Verifica ADMIN_USERS y formato JSON válido.
- Verifica que el hash de password corresponda a la contraseña usada.

### Error de CORS

- Ajusta ALLOWED_ORIGIN al dominio correcto del frontend.

### No se guardan reservas

- Verifica conectividad de DATABASE_URL.
- Revisa logs de Netlify Functions para detalle del error SQL.

### Conflictos al mover/intercambiar reservas

- El sistema rechaza operaciones cuando detecta colisión de slot.

## Notas de mantenimiento

- Si cambias reglas de negocio, actualiza tanto frontend (validación UX) como backend (validación autoritativa).
- Mantén sincronizado el catálogo de equipos en src/constants.ts con la disponibilidad real del laboratorio.

## Estado del proyecto

- Versión: 1.0.0
- Última actualización de README: Febrero 2026
