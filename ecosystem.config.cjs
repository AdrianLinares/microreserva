module.exports = {
  apps: [
    {
      name: 'microreserva-api',
      script: './server/dist/index.js',
      instances: 1, // Cambiar a 'max' si se desea clústering por núcleos, pero 1 es seguro para este tipo de base de datos
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'America/Bogota'
      },
      log_date_format: "YYYY-MM-DD HH:mm Z",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log"
    }
  ]
};