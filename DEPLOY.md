# Guía de Despliegue - Servidor Interno (SGC)

Este documento detalla el procedimiento para configurar y desplegar el proyecto **MicroReserva** en una máquina virtual Linux corporativa. El sistema se compone de una aplicación de React compiada (Vite) y un backend Node.js (Express), apoyados por un proxy reverso Nginx.

## Requisitos Previos (Infraestructura SGC)
- Sistema Operativo: Linux (Ubuntu 22.04 LTS / CentOS 8 o superior).
- **Node.js**: v18.x o v20.x LTS.
- **Nginx**: Como proxy reverso.
- **PM2**: Como administrador de procesos persistente para Node.js.
- Conectividad a la Base de Datos PostgreSQL Corporativa.
- Conectividad por puerto 587 o 465 al relay SMTP Corporativo.

---

## 1. Descarga y Compilación

1. Clona el repositorio en el servidor (Ej: `/var/www/microreserva`).
2. Instala las dependencias y compila el código (Frontend + Backend):
   ```bash
   cd /var/www/microreserva
   npm install
   npm run build
   ```
Esto creará las carpetas:
- `/dist/` -> Estáticos del frontend.
- `/server/dist/` -> Transpilables del backend Express.

## 2. Configuración de Entorno
Copia el archivo `.env.example` y renómbralo a `.env`. 
```bash
cp .env.example .env
nano .env
```
Ajusta la URL de la base de datos `DATABASE_URL` y las credenciales `SMTP_*` del SGC.

## 3. Gestor de Procesos de Backend (PM2)

Para asegurar que el backend se recupere automáticamente ante posibles reinicios del servidor, ejecutamos:

```bash
# Instalar PM2 a nivel global
sudo npm install -g pm2

# Arrancar la aplicación usando el archivo de ecosistema incluido
pm2 start ecosystem.config.cjs

# Guardar y habilitar auto-inicio en reinicios (Systemd)
pm2 startup systemd
pm2 save
```
> Nota: El backend estará corriendo por defecto en el puerto `3000`. Los logs se encuentran en `/var/www/microreserva/logs/`.

---

## 4. Configuración del Proxy Reverso (Nginx)

Se requiere configurar Nginx para servir los archivos locales de React (HTML, CSS, JS) y dirigir todas las conexiones de la ruta `/api` hacia PM2.

Crea un archivo de configuración en `/etc/nginx/sites-available/microreserva` (o el equivalente en CentOS):

```nginx
server {
    listen 80;
    server_name granate.sgc.gov.co;

    # Opcional pero recomendado: Redirigir a HTTPS y usar certificado interno
    # listen 443 ssl;
    # ssl_certificate /rutas/a/tus/certificados/granate.crt;
    # ssl_certificate_key /rutas/a/tus/certificados/granate.key;

    # Encabezados de seguridad para cumplimiento corporativo
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    root /var/www/microreserva/dist;
    index index.html;

    # 1. Rutas Frontend: Soporte para Single Page Application (React)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 2. Rutas Backend: Proxy hacia Express.js configurado por PM2
    location /api/ {
        proxy_pass http://127.0.0.0:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Pasar IP real (muy util para logs)
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Habilita y reinicia Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/microreserva /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Auditoría y Monitoreo

- **Logs de Aplicación/Errores**: Revisa la carpeta `/logs` del proyecto. Winston crea archivos paralelos de errores críticos y accesos generales en formato JSON.
- **Status en Tiempo Real**: Ejecuta `pm2 monit` para ver métricas de consumo de CPU/RAM de la API interna.
