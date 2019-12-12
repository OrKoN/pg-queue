import { PgQueue } from '../src/PgQueue';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('PgQueue', () => {
  it('works', async () => {
    let numJobs = 1000;
    let completedJobs = 0;
    let startQueuing = +new Date();
    let startProcessing = +new Date();
    let endQueueing = +new Date();
    let endProcessing = +new Date();

    class MyWorker extends PgQueue {
      async perform() {
        await sleep(1);
        completedJobs++;
        if (numJobs === completedJobs) {
          endProcessing = +new Date();
        }
      }
    }

    const queue = new MyWorker({
      connectionString: 'postgresql://localhost:5434/orkon-private',
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
  });
});
