/**
 * PM2 ecosystem for Ometto API + BullMQ workers.
 *
 * PM2 ecosystem for DoorDish API + BullMQ workers.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload ecosystem.config.cjs
 *   pm2 stop ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'doordish-api',
      script: './server.js',
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        SOCKET_SEPARATE_SERVER: 'true',
      },
    },
    {
      name: 'doordish-socket',
      script: './socket.server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        SOCKET_PORT: 5001,
      },
    },
    {
      name: 'doordish-worker-order',
      script: './src/shared/queues/orderQueue.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'doordish-worker-payment',
      script: './src/shared/queues/paymentQueue.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'doordish-worker-notification',
      script: './src/shared/queues/notificationQueue.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'doordish-worker-tracking',
      script: './src/shared/queues/trackingQueue.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'doordish-worker-otp',
      script: './src/shared/queues/otpQueue.worker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '256M',
      restart_delay: 5000,
      env: { NODE_ENV: 'production' },
    },
  ],
};
