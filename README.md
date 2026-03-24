# SGC-MICRORESERVA - SISTEMA DE GESTIÓN DE LA SALA DE PETROGRAFÍA

Sistema de agendamiento y reserva de equipos de la Sala de Petrografía del Servicio Geológico Colombiano (SGC). Esta aplicación permite a los investigadores y técnicos reservar equipos específicos por bloques de tiempo (slots horarios), gestionar cancelaciones, notificar automáticamente a los involucrados y bloquear preventivamente turnos por mantenimientos u otras restricciones.

## 🚀 Arquitectura del Proyecto
El sistema ha migrado a un esquema de **Monorepo** compuesto por:
- **Frontend:** Single Page Application (SPA) en React + Vite + TypeScript.
- **Backend:** API REST en Node.js + Express (TypeScript), desplegado de manera persistente con PM2.
- **Base de Datos:** PostgreSQL alojado en servidor interno SGC (esquema multi-disco con vSphere HA, Storage Compartido y backups diarios automatizados).
- **Notificaciones:** Envío de correos automatizados vía `nodemailer` mediante el SMTP corporativo del SGC.

---

## ✨ Características Principales
1. **Reserva de Equipos (Slots):** Interfaz gráfica intuitiva dividida en días y slots de horas para agendamiento de equipos (ej. Microscopios, Estereomicroscopios).
2. **Bloqueo Administrativo:** Los administradores pueden bloquear:
   - Días completos.
   - Slot(s) específicos (turnos de 4 horas) independiente por equipo. (Ej. Mantenimiento del Equipo 8 en el turno de la mañana).
3. **Notificaciones por Correo:** Alerta inmediata a los usuarios tras enviar notificación de cambios (Horario final).
4. **Zona Horaria Estricta:** El sistema se encuentra parametrizado para manejar, validar y loggear en la zona horaria **America/Bogota** sin depender de la configuración local del sistema operativo subyacente.

---

## 🛠 Entorno de Desarrollo

### Prerrequisitos
- Node.js (v18 o superior recomendado)
- Servidor interno SGC (recursos garantizados, 2 discos)
- Git/Asure DevOps

### Instalación
1. Clonar el repositorio.
2. Instalar dependencias tanto en raíz (Frontend) como en `/server` (Backend):
   ```bash
   npm install
   cd server && npm install
   ```

3. Configurar variables de entorno (ver sección Variables de Entorno).
4. Levantar el proyecto en desarrollo:
   - **Backend:** `npm run build:backend && node server/dist/index.js` 
   - **Frontend:** `npm run dev`

---

## 🔐 Variables de Entorno

**Frontend (`.env.local` en raíz):**
```env
VITE_API_URL=http://localhost:3000/api
VITE_ADMIN_EMAILS=admin@sgc.gov.co
```

**Backend (`server/.env` o `.env` en raíz para el inicio):**
```env
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
```

## 📚 Documentación Técnica
- [Arquitectura (ESTRUCTURA.md)](./ESTRUCTURA.md)
- [Guía de Despliegue (DEPLOY.md)](./DEPLOY.md)
