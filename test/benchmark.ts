import { PgQueue } from '../src/PgQueue';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface Message {
  i: number;
}

async function runTest(
  numJobs: number,
  numWorkers: number,
  fifo: boolean,
  maxProcessingConcurrency: number,
  maxTransactionConcurrency: number
) {
  let completedJobs = 0;
  let startQueuing = +new Date();
  let startProcessing = +new Date();
  let endQueueing = +new Date();
  let endProcessing = +new Date();

  const counts = new WeakMap();

  class MyQueue extends PgQueue<Message> {
    async perform() {
      completedJobs++;
      if (numJobs === completedJobs) {
        endProcessing = +new Date();
      }
      counts.set(this, counts.get(this) + 1);
    }
  }

  const queues: MyQueue[] = [];

  for (let i = 0; i < numWorkers; i++) {
    queues.push(
      new MyQueue({
        connectionString: process.env.DATABASE_URL,
        fifo,
        maxProcessingConcurrency,
        maxTransactionConcurrency,
      })
    );
  }

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

  console.log();
  console.log(
    'Num jobs =',
    numJobs,
    ';',
    'Num workers =',
    numWorkers,
    ';',
    'FIFO =',
    fifo,
    ';',
    'maxProcessingConcurrency =',
    maxProcessingConcurrency,
    ';',
    'maxTransactionConcurrency =',
    maxTransactionConcurrency,
    ';'
  );

  console.log(
    'queueing speed (jobs/s) =',
    numJobs / durationQueuing,
    ';',
    'processing speed (jobs/s) =',
    completedJobs / durationProcessing,
    ';'
  );

  // console.log();
  // for (let i = 0; i < queues.length; i++) {
  //   console.log('queue', i, 'processed:', counts.get(queues[i]));
  // }
  // console.log();
}

async function main() {
  await runTest(200, 1, true, 1, 1);
  await runTest(200, 1, false, 1, 1);

  await runTest(2000, 1, true, 10, 10);
  await runTest(2000, 1, false, 10, 10);

  await runTest(2000, 4, true, 10, 10);
  await runTest(2000, 4, false, 10, 10);

  await runTest(20000, 4, true, 10, 10);
  await runTest(20000, 4, false, 10, 10);
}

main();
