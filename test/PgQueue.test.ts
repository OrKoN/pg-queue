import { PgQueue } from '../src/PgQueue';
import { Pool } from 'pg';

beforeEach(() => {
  jest.resetAllMocks();
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('PgQueue', async () => {
  class MyWorker extends PgQueue<any> {
    async perform() {}
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  jest.spyOn(pool, 'connect');
  jest.spyOn(pool, 'end');

  const queue = new MyWorker({
    pool,
  });

  jest.spyOn(queue, 'perform');

  await queue.start();

  expect(pool.connect).toBeCalled();

  await queue.enqueue('test1');
  await queue.enqueueing(enqueue => enqueue('test2'));

  await sleep(200);

  expect(queue.perform).toBeCalledTimes(2);

  await queue.stop();

  expect(pool.end).toBeCalledTimes(1);
});
