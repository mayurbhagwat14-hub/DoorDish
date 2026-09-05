import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let db = null;
let messaging = null;
let cachedServiceAccount = null;

const sanitizeString = (value) => String(value ?? '').trim();

const parseServiceAccountJson = (raw) => {
    let val = sanitizeString(raw);
    if (!val) return null;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1).trim();
    }
    val = val.replace(/\\"/g, '"');
    if (!val.endsWith('"}') && !val.endsWith('}')) {
        if (val.endsWith('"')) val = val + '}';
        else val = val + '"}';
    }
    try {
        return JSON.parse(val);
    } catch {
        try {
            const fixed = val.replace(/(?<!\\)\r?\n/g, '\\n');
            return JSON.parse(fixed);
        } catch {
            return null;
        }
    }
};

const getServiceAccountFromEnv = () => {
    if (cachedServiceAccount) return cachedServiceAccount;

    const rawJson = sanitizeString(config.firebaseServiceAccount);
    if (rawJson) {
        const parsed = parseServiceAccountJson(rawJson);
        if (parsed) {
            cachedServiceAccount = parsed;
            return cachedServiceAccount;
        }
        logger.error('Error parsing FIREBASE_SERVICE_ACCOUNT JSON: Invalid format');
    }

    const pathValue = sanitizeString(config.firebaseServiceAccountPath);
    if (pathValue) {
        const filePath = resolve(process.cwd(), pathValue);
        if (existsSync(filePath)) {
            try {
                cachedServiceAccount = JSON.parse(readFileSync(filePath, 'utf8'));
                return cachedServiceAccount;
            } catch (err) {
                logger.error(`Error reading or parsing firebase service account file at ${filePath}:`, err.message);
            }
        }
    }

    return null;
};

/**
 * Initializes Firebase Admin SDK with Service Account.
 * Supports both FCM and Realtime Database.
 */
export const initializeFirebaseRealtime = () => {
    try {
        if (admin.apps.length > 0) {
            db = admin.database();
            messaging = admin.messaging();
            return { db, messaging };
        }

        const serviceAccount = getServiceAccountFromEnv();
        const databaseURL = config.firebaseDatabaseUrl;

        if (!serviceAccount) {
            logger.warn('⚠️ Firebase service account not configured. Firebase features may not work.');
            return null;
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL || undefined
        });

        db = admin.database();
        messaging = admin.messaging();

        // logger.info('✅ Firebase Realtime Database Initialized Successfully');
        return { db, messaging };
    } catch (error) {
        logger.error(`❌ Firebase Initialization Error: ${error.message}`);
        return null;
    }
};

/**
 * Returns the initialized Firebase Realtime Database instance.
 * @returns {admin.database.Database}
 * @throws Error if not initialized
 */
export const getFirebaseDB = () => {
    if (!db) {
        throw new Error('⚠️ Firebase Realtime Database not initialized. Call initializeFirebaseRealtime() first.');
    }
    return db;
};

/**
 * Returns the initialized Firebase Messaging instance.
 * @returns {admin.messaging.Messaging}
 * @throws Error if not initialized
 */
export const getFirebaseMessaging = () => {
    if (!messaging) {
        throw new Error('⚠️ Firebase Messaging not initialized. Call initializeFirebaseRealtime() first.');
    }
    return messaging;
};

export default admin;
