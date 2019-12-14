import { PgQueue } from '../src/PgQueue';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface Message {
  i: number;
}

async function main() {
  let numJobs = 1000;
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

  const queues = [
    new MyWorker({
      connectionString: process.env.DATABASE_URL,
    }),
    new MyWorker({
      connectionString: process.env.DATABASE_URL,
    }),
    new MyWorker({
      connectionString: process.env.DATABASE_URL,
    }),
    new MyWorker({
      connectionString: process.env.DATABASE_URL,
    }),
  ];

  try {
    const promises = [];

    for (let i = 0; i < numJobs; i++) {
      promises.push(queues[0].enqueue({ i }));
    }

    await promises;

    endQueueing = +new Date();

    startProcessing = +new Date();

    for (const q of queues) {
      await q.start();
    }

    while (completedJobs < numJobs) {
      await sleep(100);
    }
  } finally {
    for (const q of queues) {
      await q.stop();
    }
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
