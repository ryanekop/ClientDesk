module.exports = {
  apps: [
    {
      name: "clientdesk",
      script: ".next/standalone/server.js",
      cwd: "/var/www/clientdesk",
      env: {
        PORT: 3001,
        NODE_ENV: "production",
        HOSTNAME: "0.0.0.0",
      },
      // Restart jika memory melebihi 512MB
      max_memory_restart: "512M",
      // Auto restart jika crash
      autorestart: true,
      // Tunggu 3 detik sebelum restart
      restart_delay: 3000,
    },
  ],
};
