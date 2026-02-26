module.exports = {
  apps: [
    {
      name: 'hkchat-server',
      script: 'server.js',
      cwd: './server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Logging
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Restart policy
      exp_backoff_restart_delay: 100,
      max_restarts: 50,
      min_uptime: '10s'
    }
  ]
};
