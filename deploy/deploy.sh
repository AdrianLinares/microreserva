#!/usr/bin/env bash
set -euo pipefail

# Simple deploy helper for Micro-Reserva (to be run on the VM)
# Usage: sudo ./deploy.sh <git-repo-url>  (or run after cloning if repo already present)

REPO_URL=${1:-}
APP_DIR=/opt/micro-reserva
FRONTEND_DIR=${APP_DIR}/dist
WWW_DIR=/var/www/micro-reserva
SERVICE_NAME=micro-reserva

if [ -n "$REPO_URL" ]; then
  echo "Clonando repo en ${APP_DIR}"
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: app dir $APP_DIR does not exist"
  exit 1
fi

# Ensure nodeapp user exists
id -u nodeapp >/dev/null 2>&1 || sudo useradd -r -s /bin/false nodeapp

echo "Instalando dependencias y construyendo como nodeapp"
cd "$APP_DIR"
sudo -u nodeapp npm ci
sudo -u nodeapp npm run build:frontend
sudo -u nodeapp npm run build:backend

echo "Copiando frontend a ${WWW_DIR}"
sudo rm -rf "$WWW_DIR"
sudo mkdir -p "$WWW_DIR"
sudo cp -r "$FRONTEND_DIR"/* "$WWW_DIR" || true
sudo chown -R www-data:www-data "$WWW_DIR"

echo "Asegurate de haber creado /etc/micro-reserva.env con credenciales y el archivo systemd unit"
echo "Activando servicio systemd: ${SERVICE_NAME}"
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

echo "Despliegue finalizado. Estado del servicio:"
sudo systemctl status ${SERVICE_NAME} --no-pager
