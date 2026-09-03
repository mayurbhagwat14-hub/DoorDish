import http from 'http';
import { config } from './src/config/env.js';
import { validateConfig } from './src/config/validateEnv.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { connectRedis, closeRedis } from './src/config/redis.js';
import { initSocket } from './src/config/socket.js';
import { initializeFirebaseRealtime } from './src/config/firebase.js';
import { logger } from './src/utils/logger.js';

const SHUTDOWN_TIMEOUT_MS = 10000;
let server = null;

const gracefulShutdown = async (signal) => {
    logger.info(`[SocketServer] ${signal} received, starting graceful shutdown`);
    if (!server) {
        process.exit(0);
        return;
    }
    server.close(async () => {
        try {
            await disconnectDB();
            await closeRedis();
            logger.info('[SocketServer] Graceful shutdown complete');
            process.exit(0);
        } catch (err) {
            logger.error(`[SocketServer] Shutdown error: ${err.message}`);
            process.exit(1);
        }
    });
    setTimeout(() => {
        logger.error('[SocketServer] Shutdown timeout, forcing exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
};

const startSocketServer = async () => {
    try {
        validateConfig();
        initializeFirebaseRealtime();

        // 1. Connect to Database (MongoDB)
        await connectDB();

        // 2. Connect Redis if enabled
        if (config.redisEnabled) {
            await connectRedis();
        }

        // 3. Create dedicated HTTP server for Socket.IO
        const httpServer = http.createServer((req, res) => {
            if (req.url === '/health' || req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', service: 'doordish-socket-server', port: config.socketPort }));
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        // 4. Initialize Socket.IO instance
        await initSocket(httpServer);

        // 5. Start dedicated HTTP listener
        const socketPort = config.socketPort || 5001;
        server = httpServer.listen(socketPort, config.host, () => {
            logger.info(`[SocketServer] Standalone Socket.IO server running on ${config.host}:${socketPort}`);
            console.log(`⚡ [Socket URL] http://localhost:${socketPort}`);
        });

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (err) {
        logger.error(`[SocketServer] Startup failed: ${err.message}`);
        process.exit(1);
    }
};

startSocketServer();
