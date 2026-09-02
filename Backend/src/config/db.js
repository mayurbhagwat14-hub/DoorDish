import mongoose from 'mongoose';
import dns from 'dns';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

// Configure DNS resolvers (Google & Cloudflare) to prevent Windows querySrv ECONNREFUSED issues
try {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder('ipv4first');
    }
} catch {
    // Fallback gracefully if DNS customization is restricted
}

export const connectDB = async (retries = 5, delayMs = 3000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const conn = await mongoose.connect(config.mongodbUri, {
                serverSelectionTimeoutMS: 10000, // Fail fast if Atlas is unreachable
                socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
                heartbeatFrequencyMS: 10000,     // Ping Atlas every 10s to keep connection alive
                maxIdleTimeMS: 30000,            // Drop idle connections after 30s
                retryWrites: true,
            });
            logger.info(`MongoDB connected: ${conn.connection.host}`);
            return conn;
        } catch (error) {
            logger.error(`MongoDB connection error (Attempt ${attempt}/${retries}): ${error.message}`);
            if (attempt === retries) {
                process.exit(1);
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};

/**
 * Close MongoDB connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
};
