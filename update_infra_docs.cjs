const fs = require('fs');

// 1. Actualizar README.md
let readme = fs.readFileSync('README.md', 'utf8');
readme = readme.replace(
    '- **Base de Datos:** PostgreSQL en la nube (Neon).', 
    '- **Base de Datos:** PostgreSQL alojado en servidor interno SGC (esquema multi-disco con vSphere HA, Storage Compartido y backups diarios automatizados).'
);
readme = readme.replace(
    '- PostgreSQL local o un Data Source como Neon', 
    '- Servidor interno SGC (recursos garantizados, 2 discos)'
);
fs.writeFileSync('README.md', readme);

// 2. Actualizar DEPLOY.md
let deploy = fs.readFileSync('DEPLOY.md', 'utf8');
const replacementText = `Para desplegar el proyecto en el servidor oficial corporativo del SGC, siga las siguientes pautas de configuración y arranque.

## 🏢 Arquitectura de Infraestructura (Servidor SGC)
El sistema operará sobre una máquina virtual corporativa optimizada con **vSphere HA**, distribuida físicamente de la siguiente manera:
- **Disco 1 (OS y Aplicación):** Aloja el Sistema Operativo, el motor Node.js, gestor PM2, servidor Proxy (Nginx/IIS) y los binarios/artefactos compilados del aplicativo (Frontend estático y Backend).
- **Disco 2 (Volumen de Base de Datos):** Disco asignado en Storage Compartido exclusivamente para PostgreSQL (\`PGDATA\`). Beneficiado por políticas de **Backup Diario** corporativas. 

> **Aviso:** Antes de levantar la DB, asegúrese de apuntar la variable \`data_directory\` en su \`postgresql.conf\` a la ruta de montaje del Disco 2.`;

deploy = deploy.replace(
    'Para pasar de un entorno de pruebas locales a un servidor oficial corporativo, siga las siguientes pautas de empaquetado y arranque demonizado.', 
    replacementText
);

// Asegurar que el paso de DB concuerde
deploy = deploy.replace(
    '## 1. Migración de Base de Datos',
    '## 1. Inicialización y Migración de Base de Datos (Disco 2)'
);

fs.writeFileSync('DEPLOY.md', deploy);

// 3. Actualizar ESTRUCTURA.md para reflejarlo un poco
let estructura = fs.readFileSync('ESTRUCTURA.md', 'utf8');
estructura = estructura.replace(
    'PostgreSQL en la nube (Neon)',
    'PostgreSQL en Disco 2 del servidor'
);
fs.writeFileSync('ESTRUCTURA.md', estructura);

console.log("Documentación adaptada exitosamente a la topología de servidor SGC (vSphere HA / Multi-Disco).");
