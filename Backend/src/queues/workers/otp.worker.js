import 'dotenv/config';
import { Worker } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { OTP_QUEUE } from '../queue.constants.js';
import { processOtpJob } from '../processors/otp.processor.js';
import { waitForBullMQRedis, attachWorkerLifecycle } from './workerBootstrap.js';

const start = async () => {
    const connection = await waitForBullMQRedis();
    if (!connection) {
        logger.info('OTP worker idle (Redis/BullMQ disabled)');
        setInterval(() => {}, 86400000);
        return;
    }

    const worker = new Worker(OTP_QUEUE, processOtpJob, {
        connection,
        concurrency: 5,
    });
    attachWorkerLifecycle(worker, 'OTP');
    logger.info('OTP worker started');
};

start().catch((err) => {
    logger.error(`OTP worker failed to start: ${err.message}`);
    setInterval(() => {}, 86400000);
});
