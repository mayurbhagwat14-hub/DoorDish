import 'dotenv/config';
import { Worker } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { NOTIFICATION_QUEUE } from '../queue.constants.js';
import { processNotificationJob } from '../processors/notification.processor.js';
import { waitForBullMQRedis, attachWorkerLifecycle } from './workerBootstrap.js';

const start = async () => {
    const connection = await waitForBullMQRedis();
    if (!connection) {
        logger.info('Notification worker idle (Redis/BullMQ disabled)');
        setInterval(() => {}, 86400000);
        return;
    }

    const worker = new Worker(NOTIFICATION_QUEUE, processNotificationJob, {
        connection,
        concurrency: 5,
    });
    attachWorkerLifecycle(worker, 'Notification');
    logger.info('Notification worker started');
};

start().catch((err) => {
    logger.error(`Notification worker failed to start: ${err.message}`);
    setInterval(() => {}, 86400000);
});
