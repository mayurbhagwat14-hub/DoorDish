import { config } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Validates required environment configuration on startup.
 * Logs clear errors and exits if critical variables are missing.
 */
export const validateConfig = () => {
    const missing = [];

    if (!config.mongodbUri) {
        missing.push('MONGO_URI or MONGODB_URI');
    }
    if (!config.jwtAccessSecret) {
        missing.push('JWT_ACCESS_SECRET or JWT_SECRET');
    }
    if (!config.jwtRefreshSecret) {
        missing.push('JWT_REFRESH_SECRET');
    }
    if (config.redisEnabled && !config.redisUrl) {
        missing.push('REDIS_URL (required when REDIS_ENABLED=true)');
    }
    if (config.bullmqEnabled && !config.redisEnabled) {
        missing.push('REDIS_ENABLED=true (required when BULLMQ_ENABLED=true)');
    }
    if (config.useCloudinary) {
        if (!config.cloudinaryCloudName) missing.push('CLOUDINARY_CLOUD_NAME (required when USE_CLOUDINARY=true)');
        if (!config.cloudinaryApiKey) missing.push('CLOUDINARY_API_KEY (required when USE_CLOUDINARY=true)');
        if (!config.cloudinaryApiSecret) missing.push('CLOUDINARY_API_SECRET (required when USE_CLOUDINARY=true)');
    }

    // ASSET_BASE_URL is baked into every stored image URL.
    const assetBase = String(process.env.ASSET_BASE_URL || process.env.API_BASE_URL || '').trim();
    if (config.nodeEnv === 'production') {
        if (process.env.UPLOAD_REMOTE_ORIGIN) {
            logger.warn('UPLOAD_REMOTE_ORIGIN is set in production env');
        }
        if (!assetBase) {
            logger.warn('ASSET_BASE_URL or API_BASE_URL is not configured');
        } else if (!/^https:\/\//i.test(assetBase)) {
            logger.warn(`ASSET_BASE_URL is not an https:// origin (got "${assetBase}")`);
        }
    }


    if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
};
