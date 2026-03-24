# 📂 ESTRUCTURA DEL PROYECTO

El proyecto se divide de manera lógica dentro del repositorio raíz para un fácil acceso y despliegue integrado (PM2 levanta los distruidos compilados, mientras Nginx/IIS puede servir el front).

## Árbol de Directorios
```text
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
│   │   ├── routes/        # Definición de Routers API (`/api/booking`, `/api/bookings`)
│   │   └── index.ts       # Entrypoint servidor Express
│   ├── tsconfig.json      # Config de compilación para el backend
│   └── dist/              # Generado autom. al ejecutar `npm run build:backend`
├── logs/                  # 📊 Registros y bitácoras generados por Winston/PM2
├── schema.sql             # Plantilla de creación de Tablas en Postgres Constraint (block_type)
├── ecosystem.config.cjs   # Configuración de despliegue PM2
├── package.json           # Dependencias raíz (Frontend y utilitarios)
└── vite.config.ts         # Configuración del empaquetador Vite
```

## Flujo de Datos (Arquitectura)
1. **Frontend:** El componente `AdminPanel.tsx` intercepta clicks. Al seleccionar "Bloquear Slot", actualiza y envía vía `POST /api/bookings` o `PUT /api/booking` la solicitud con los identificadores temporales.
2. **Controlador BD (`server/src/controllers/bookings.ts`):** Identifica e invalida lógicamente colisiones temporales. Gestiona DB Deletes en caso de desbloqueos (status "available").
3. **Persistencia y Timezone (`index.ts -> db.ts`):** A un nivel de capa del entorno (Node), la variable `TZ=America/Bogota` asegura que la persistencia se hace en hora real de Colombia sobre PostgreSQL.
4. **Respuesta Visual y Logger:** El logger interno (Winston) registra operaciones a `./logs/combined.log` y el SPA de React se actualiza en memoria sin refresco gracias al polling o promesas asíncronas HTTP.
