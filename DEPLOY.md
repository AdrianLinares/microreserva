# 🚀 Guía paso a paso para desplegar Micro-Reserva en el servidor interno

Este documento explica, paso a paso y en un nivel junior, cómo desplegar la aplicación en la VM interna (micro-reserva.sgc.gov.co). Está pensado para que cualquier persona con acceso al servidor pueda seguirlo.

Resumen de rutas y valores por defecto usados en esta guía
- App en: /opt/micro-reserva
- Frontend servido por Nginx desde: /var/www/micro-reserva
- Servicio systemd: micro-reserva (unidad: /etc/systemd/system/micro-reserva.service)
- Variables de entorno: /etc/micro-reserva.env
- Puerto del backend: 3000

IMPORTANTE: NO pongas contraseñas ni DATABASE_URL en el repositorio. Usa /etc/micro-reserva.env con permisos restringidos.

Requisitos previos (si lo hizo TI ya están listos)
- Node.js (v20) instalado
- Nginx con SSL configurado para micro-reserva.sgc.gov.co
- PostgreSQL instalado y accesible desde la VM

Si alguno falta, pídelo a TI antes de continuar.

1) Crear usuario de la aplicación y preparar directorios

  sudo useradd -r -s /bin/false nodeapp || true
  sudo mkdir -p /opt/micro-reserva
  sudo chown -R nodeapp:nodeapp /opt/micro-reserva

2) Clonar el repositorio (o copiar los archivos)

  # Reemplaza <REPO_URL> por la URL real
  sudo rm -rf /opt/micro-reserva
  sudo git clone <REPO_URL> /opt/micro-reserva
  sudo chown -R nodeapp:nodeapp /opt/micro-reserva

3) Crear la base de datos y cargar el esquema

  # Abrir psql como postgres o usar credenciales administrativas
  sudo -u postgres psql
  -- Dentro de psql:
  CREATE DATABASE microreserva;
  CREATE USER micro_user WITH PASSWORD 'CAMBIA-ESTO';
  GRANT ALL PRIVILEGES ON DATABASE microreserva TO micro_user;
  \q

  # Cargar el esquema SQL (desde el repositorio)
  sudo -u postgres psql -U micro_user -d microreserva -f /opt/micro-reserva/schema.sql

  Nota: si IT ya tiene Postgres y credenciales, usa las credenciales que te den y no crees usuarios duplicados.

4) Crear archivo de entorno seguro (NO en el repo)

  sudo tee /etc/micro-reserva.env > /dev/null <<'EOF'
  NODE_ENV=production
  PORT=3000
  TZ=America/Bogota
  DATABASE_URL=postgres://micro_user:CAMBIA-ESTO@localhost:5432/microreserva
  DB_SSL=false
  CORS_ORIGIN=https://micro-reserva.sgc.gov.co
  EOF

  sudo chown root:root /etc/micro-reserva.env
  sudo chmod 640 /etc/micro-reserva.env

5) Instalar dependencias y compilar (ejecutar como nodeapp)

  cd /opt/micro-reserva
  sudo -u nodeapp npm ci
  sudo -u nodeapp npm run build:frontend
  sudo -u nodeapp npm run build:backend

  Esto genera:
  - Frontend compilado en /opt/micro-reserva/dist
  - Backend compilado en /opt/micro-reserva/server/dist

6) Copiar frontend estático a la carpeta que Nginx servirá

  sudo rm -rf /var/www/micro-reserva
  sudo mkdir -p /var/www/micro-reserva
  sudo cp -r /opt/micro-reserva/dist/* /var/www/micro-reserva/
  sudo chown -R www-data:www-data /var/www/micro-reserva

7) Crear la unidad systemd (archivo) para ejecutar la app

  sudo tee /etc/systemd/system/micro-reserva.service > /dev/null <<'EOF'
  [Unit]
  Description=Micro-Reserva API Node.js
  After=network.target

  [Service]
  Type=simple
  User=nodeapp
  Group=nodeapp
  WorkingDirectory=/opt/micro-reserva
  EnvironmentFile=/etc/micro-reserva.env
  ExecStart=/usr/bin/node /opt/micro-reserva/server/dist/index.js
  Restart=always
  RestartSec=5
  LimitNOFILE=65535
  StandardOutput=syslog
  StandardError=syslog

  [Install]
  WantedBy=multi-user.target
  EOF

8) Activar y arrancar el servicio

  sudo systemctl daemon-reload
  sudo systemctl enable micro-reserva
  sudo systemctl start micro-reserva

  # Ver estado y logs
  sudo systemctl status micro-reserva --no-pager
  sudo journalctl -u micro-reserva -f

9) Configuración Nginx (si IT no la creó ya)

  # Crear el archivo de config (ejemplo)
  sudo tee /etc/nginx/sites-available/micro-reserva.conf > /dev/null <<'EOF'
  server {
      listen 80;
      server_name micro-reserva.sgc.gov.co;
      return 301 https://$host$request_uri;
  }

  server {
      listen 443 ssl;
      server_name micro-reserva.sgc.gov.co;

      # ssl_certificate /etc/letsencrypt/live/micro-reserva.sgc.gov.co/fullchain.pem;
      # ssl_certificate_key /etc/letsencrypt/live/micro-reserva.sgc.gov.co/privkey.pem;

      root /var/www/micro-reserva;
      index index.html;

      location / {
          try_files $uri $uri/ /index.html;
      }

      location /api/ {
          proxy_pass http://127.0.0.1:3000/api/;
          proxy_http_version 1.1;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_set_header Connection "";
          proxy_buffering off;
      }

      client_max_body_size 10M;
  }
  EOF

  sudo ln -sf /etc/nginx/sites-available/micro-reserva.conf /etc/nginx/sites-enabled/micro-reserva.conf
  sudo nginx -t
  sudo systemctl reload nginx

10) Validaciones rápidas (pruebas)

  # Health endpoint
  curl -sS https://micro-reserva.sgc.gov.co/api/health | jq .

  # Carga UI: abrir https://micro-reserva.sgc.gov.co en un navegador desde la red interna

11) Comandos útiles para mantenimiento

  # Reiniciar servicio
  sudo systemctl restart micro-reserva

  # Ver logs de hoy
  sudo journalctl -u micro-reserva --since "today"

  # Ver permisos del env
  ls -l /etc/micro-reserva.env

12) Problemas comunes y soluciones rápidas

- Si el servicio no arranca: sudo journalctl -u micro-reserva -e (ver causa). Asegúrate de que /etc/micro-reserva.env existe y tiene las credenciales correctas.
- Si Nginx devuelve 502 Bad Gateway: valida que node está escuchando en localhost:3000 (ss -ltnp | grep 3000) y que systemd empezó correctamente.
- Si la UI carga pero las llamadas a /api fallan por CORS: revisa CORS_ORIGIN en /etc/micro-reserva.env.

Notas finales y recomendaciones
- NO subas /etc/micro-reserva.env al repositorio.
- Monitorea uso de memoria y conexiones Postgres; si aparecen problemas hablamos para reducir el pool de conexiones.
- Si prefieres, puedes usar pm2 en lugar de systemd; en este proyecto ya hay ecosystem.config.cjs preparado.

Checklist mínimo antes de dar por terminado
- [ ] /etc/micro-reserva.env creado y con permisos 640 root:root
- [ ] Servicio systemd creado y en estado activo
- [ ] Frontend servido correctamente por Nginx
- [ ] Health endpoint responde 200

Si necesitas, genero un tar.gz con la carpeta deploy/ para que IT lo descargue y aplique (contiene ejemplos). Solicítalo y lo preparo.
