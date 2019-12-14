var memwatch = require('node-memwatch');

memwatch.on('leak', function(info: any) {
  console.log(info);
});

import { PgQueue } from '../src/PgQueue';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface Message {
  i: number;
}

async function main() {
  let numJobs = 100000;
  let completedJobs = 0;
  let startQueuing = +new Date();
  let startProcessing = +new Date();
  let endQueueing = +new Date();
  let endProcessing = +new Date();

  const counts = new WeakMap();

  class MyWorker extends PgQueue<Message> {
    async perform() {
      // await sleep(1000);
      completedJobs++;
      if (numJobs === completedJobs) {
        endProcessing = +new Date();
      }
      counts.set(this, counts.get(this) + 1);
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

  for (const q of queues) {
    counts.set(q, 0);
    q.on('error', e => console.log(e));
  }

  try {
    const promises = [];

    for (let i = 0; i < numJobs; i++) {
      promises.push(queues[0].enqueue({ i }));
    }

    await promises;

    endQueueing = +new Date();

    startProcessing = +new Date();

    await sleep(200);

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

  console.log();
  for (let i = 0; i < queues.length; i++) {
    console.log('queue', i, 'processed:', counts.get(queues[i]));
  }

  console.log();
  console.log('Memory usage');
  const used = process.memoryUsage() as any;
  for (let key in used) {
    console.log(
      `${key} ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`
    );
  }
}

main();
