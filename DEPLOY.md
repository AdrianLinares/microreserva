# 🚀 GUÍA DE DESPLIEGUE EN PRODUCCIÓN

Para desplegar el proyecto en el servidor oficial corporativo del SGC, siga las siguientes pautas de configuración y arranque.

## 🏢 Arquitectura de Infraestructura (Servidor SGC)
El sistema operará sobre una máquina virtual corporativa optimizada con **vSphere HA**, distribuida físicamente de la siguiente manera:
- **Disco 1 (OS y Aplicación):** Aloja el Sistema Operativo, el motor Node.js, gestor PM2, servidor Proxy (Nginx/IIS) y los binarios/artefactos compilados del aplicativo (Frontend estático y Backend).
- **Disco 2 (Volumen de Base de Datos):** Disco asignado en Storage Compartido exclusivamente para PostgreSQL (`PGDATA`). Beneficiado por políticas de **Backup Diario** corporativas. 

> **Aviso:** Antes de levantar la DB, asegúrese de apuntar la variable `data_directory` en su `postgresql.conf` a la ruta de montaje del Disco 2.

## 1. Inicialización y Migración de Base de Datos (Disco 2)
- Las estructuras de tabla residen en `schema.sql`.
- **Importante:** Recuerde que para soportar el Bloqueo por Slot se modificó el Constraint de la DB. Así que, aplique el alter en su DB PostgreSQL si ya existía:
  ```sql
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_block_type_check;
  ALTER TABLE bookings ADD CONSTRAINT bookings_block_type_check CHECK (block_type IN ('day', 'slot'));
  ```

## 2. Construcción de Artefactos (Build)
Debe compilar ambos módulos (Frontend y Backend).
```bash
# 1. Compilar Backend
npm run build:backend
# Esto genera el código transpilado listo para ejecutarse en /server/dist/

# 2. Compilar Frontend
npm run build
# Esto empaquetará los asstes minificados en /dist/ (o /build/)
```

## 3. Gestor de Procesos (PM2)
Se ha orquestado el `ecosystem.config.cjs` para un arranque persistente.

Para ejecutar en producción:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Detalles del PM2:
- El backend corre por el puerto **3000** escuchando APIs.
- Fuerce expresamente la zona horaria `America/Bogota`.
- Almacena logs formateados en `YYYY-MM-DD HH:mm -0500` dentro de `./logs/`.

## 4. Servidor Web Inverso (Nginx/IIS)
Se recomienda instalar un Server proxy que ofrezca SSL (HTTPS) y redirija el tráfico estático de la react app construida (carpeta build) hacia el usuario, y el uso del segmento API hacia PM2.

**Ejemplo NGINX:**
```nginx
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
```

## 5. Prevención de Riesgos de Rutas (Legacy `/booking`)
Parte del front interactuaba originalmente con Servless Functions orientadas a archivos físicos (eg. solicitaba PUT a `/booking?id=X` y no a `/bookings`).
Para evitar fallas de reestructuracion, el API se ha aprovisionado con Routers Express específicos para ambos esquemas. Cualquier nuevo endpoint debe respetar el enrutador en `server/src/index.ts`.
