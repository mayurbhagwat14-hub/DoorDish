import 'dotenv/config';
import { Worker } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { PAYMENT_QUEUE } from '../queue.constants.js';
import { processPaymentJob } from '../processors/payment.processor.js';
import { waitForBullMQRedis, attachWorkerLifecycle } from './workerBootstrap.js';

const start = async () => {
    const connection = await waitForBullMQRedis();
    if (!connection) {
        logger.info('Payment worker idle (Redis/BullMQ disabled)');
        setInterval(() => {}, 86400000);
        return;
    }

    const worker = new Worker(PAYMENT_QUEUE, processPaymentJob, {
        connection,
        concurrency: 5,
    });
    attachWorkerLifecycle(worker, 'Payment');
    logger.info('Payment worker started');
};

start().catch((err) => {
    logger.error(`Payment worker failed to start: ${err.message}`);
    setInterval(() => {}, 86400000);
});
