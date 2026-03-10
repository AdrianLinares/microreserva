# MicroReserva

Aplicacion para gestionar reservas de la Sala de Petrografia.

Stack principal:
- Frontend: React + TypeScript + Vite.
- Backend: Netlify Functions (Node) + PostgreSQL (Neon).

## Objetivo de esta guia

Este README esta pensado para facilitar la entrada de nuevos colaboradores al proyecto.
Al terminar de leerlo debes poder:
- levantar el proyecto en local,
- entender por donde viajan los datos,
- ubicar rapido donde editar cada funcionalidad.

## Flujo funcional (vista rapida)

1. Usuario selecciona slots en la grilla.
2. Frontend envia solicitud a funciones en /.netlify/functions.
3. Backend valida reglas de negocio y guarda en PostgreSQL.
4. Admin aprueba, bloquea, libera o mueve reservas desde el panel.

## Arquitectura en 60 segundos

Frontend:
- src/App.tsx: pantalla principal de reservas.
- src/components/BookingModal.tsx: modal de captura de datos de usuario.
- src/components/AdminPanel.tsx: panel de administracion.
- src/services/api.ts: cliente HTTP para hablar con Netlify Functions.

Backend (serverless):
- netlify/functions/bookings.ts: listar y crear reservas.
- netlify/functions/booking.ts: editar estado/slot y eliminar reserva.
- netlify/functions/bookings-swap.ts: intercambio de slots entre dos reservas.
- netlify/functions/settings.ts: configuracion admin/publica.
- netlify/functions/lib/auth.ts: validacion de Basic Auth admin.

## Requisitos

- Node.js 20 o superior.
- npm 9 o superior.
- Base de datos PostgreSQL (Neon recomendado).

## Instalacion local

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo .env con variables minimas:

```env
DATABASE_URL=postgres://usuario:password@host/db
ALLOWED_ORIGIN=http://localhost:8888
ADMIN_USERS=[{"username":"admin","passwordHash":"$2a$12$..."}]
```

3. Levantar desarrollo:

```bash
npm run dev
```

Puertos esperados:
- App + proxy Netlify: http://localhost:8888
- Vite interno: http://localhost:3000

## Variables de entorno explicadas

- DATABASE_URL:
  - Conexion a PostgreSQL.
  - Sin esta variable, las funciones fallan al iniciar.

- ADMIN_USERS:
  - JSON de usuarios admin con hash bcrypt.
  - Ejemplo:

```json
[
  {
    "username": "admin",
    "passwordHash": "$2a$12$..."
  }
]
```

- ALLOWED_ORIGIN:
  - Dominio permitido para CORS en produccion.
  - En local, las funciones aceptan origen abierto para facilitar desarrollo.

## Scripts utiles

- npm run dev: desarrollo completo con Netlify Dev.
- npm run build: build de frontend.
- npm run preview: probar build local.
- npm run generate-hash: generar hash bcrypt para ADMIN_USERS.

## Regla de negocio clave

- Ventana de solicitud:
  - Lunes 07:00 a Viernes 12:00.

- Limite de reservas:
  - Aplica solo para la proxima semana.
  - Configurable desde panel admin.

- Estados de reserva:
  - pending: solicitud pendiente.
  - approved: aprobada por admin.
  - blocked: bloqueada por admin.
  - available: slot libre/placeholder.

## Guia de codigo

Si necesitas cambiar...

- UI de seleccion de turnos:
  - Revisar src/App.tsx y src/components/BookingModal.tsx.

- Logica de validacion en cliente:
  - Revisar src/App.tsx (handleSlotClick y handleBookingSubmit).

- Reglas reales de seguridad/negocio:
  - Revisar netlify/functions/bookings.ts.
  - Nota: el backend es la fuente de verdad.

- Login admin:
  - Frontend: src/services/api.ts + src/App.tsx.
  - Backend: netlify/functions/lib/auth.ts.

- Acciones de administracion:
  - UI: src/components/AdminPanel.tsx.
  - Endpoints: netlify/functions/booking.ts, netlify/functions/bookings-swap.ts, netlify/functions/settings.ts.

## Troubleshooting rapido

Error CORS en local:
- Reinicia npm run dev.
- Limpia cache de Netlify si hace falta: rm -rf .netlify/cache
- Verifica que entras por http://localhost:8888

401 Unauthorized en admin:
- Revisa formato JSON de ADMIN_USERS.
- Verifica que el hash bcrypt corresponda a la contraseña.

No guarda reservas:
- Revisa DATABASE_URL.
- Revisa logs de funciones en terminal de Netlify Dev.

Pantalla en blanco:
- Revisa consola del navegador.
- Verifica que Vite y Netlify Dev esten corriendo sin errores.

## Deploy en Netlify

Configuracion actual (netlify.toml):
- build command: npm run build
- publish dir: dist
- functions dir: netlify/functions

Variables minimas en Netlify:
- DATABASE_URL
- ADMIN_USERS
- ALLOWED_ORIGIN

## Estado

- Version: 1.0.0
- README actualizado: 2026-03-10
