import 'dotenv/config';
import { Worker } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { ORDER_QUEUE } from '../queue.constants.js';
import { processOrderJob } from '../processors/order.processor.js';
import { waitForBullMQRedis, attachWorkerLifecycle } from './workerBootstrap.js';

const start = async () => {
    const connection = await waitForBullMQRedis();
    if (!connection) {
        logger.info('Order worker idle (Redis/BullMQ disabled)');
        setInterval(() => {}, 86400000);
        return;
    }

    const worker = new Worker(ORDER_QUEUE, processOrderJob, {
        connection,
        concurrency: 5,
    });
    attachWorkerLifecycle(worker, 'Order');
    logger.info('Order worker started');
};

start().catch((err) => {
    logger.error(`Order worker failed to start: ${err.message}`);
    setInterval(() => {}, 86400000);
});
