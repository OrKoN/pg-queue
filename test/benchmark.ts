import { PgQueue } from '../src/PgQueue';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface Message {
  i: number;
}

async function main() {
  let numJobs = 20000;
  let completedJobs = 0;
  let startQueuing = +new Date();
  let startProcessing = +new Date();
  let endQueueing = +new Date();
  let endProcessing = +new Date();

  class MyWorker extends PgQueue<Message> {
    async perform() {
      // await sleep(1000);
      completedJobs++;
      if (numJobs === completedJobs) {
        endProcessing = +new Date();
      }
    }
  }

  const queue = new MyWorker({
    connectionString: process.env.DATABASE_URL,
    maxTransactionConcurrency: 100,
    maxProcessingConcurrency: 100,
  });

  try {
    const promises = [];

    for (let i = 0; i < numJobs; i++) {
      promises.push(queue.enqueue({ i }));
    }

    await promises;

    endQueueing = +new Date();

    startProcessing = +new Date();

    await queue.start();

    while (completedJobs < numJobs) {
      await sleep(100);
    }
  } finally {
    await queue.stop();
  }

  const durationQueuing = (endQueueing - startQueuing) / 1000;
  const durationProcessing = (endProcessing - startProcessing) / 1000;

  console.log(
    'queueing jobs/s =',
    numJobs / durationQueuing,
    'processing jobs/s =',
    completedJobs / durationProcessing
  );
}

main();
