/**
 * PM2 Ecosystem Configuration for ConvertNest Backend
 * This file configures both Node.js backend and Python Gemini service
 */

module.exports = {
  apps: [
    // Node.js Backend API
    {
      name: 'convertnest-api',
      script: './src/server.js',
      cwd: '/home/convertnest/convertnest-backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    
    // Python Gemini Service for Image-to-Excel
    {
      name: 'python-gemini-service',
      script: '/home/convertnest/convertnest-backend/python-service/.venv/bin/python',
      args: 'app.py',
      cwd: '/home/convertnest/convertnest-backend/python-service',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PORT: 5000,
        GEMINI_API_KEY: 'AIzaSyD5PGAou3FpuCASRTi1f993TFd_XQd4NGI',
        DEBUG: 'False',
        LOG_LEVEL: 'INFO',
        MAX_FILE_SIZE_MB: 10
      },
      error_file: './logs/python-error.log',
      out_file: './logs/python-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
