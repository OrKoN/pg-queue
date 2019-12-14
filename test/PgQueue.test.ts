import { PgQueue } from '../src/PgQueue';
import { Pool } from 'pg';

beforeEach(() => {
  jest.resetAllMocks();
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('PgQueue any order', async () => {
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

  await queue.migrate();
  await queue.start();

  expect(pool.connect).toBeCalled();

  await queue.enqueue('test1');
  await queue.enqueue(async () => 'test2');

  await sleep(200);

  expect(queue.perform).toBeCalledTimes(2);

  await queue.stop();

  expect(pool.end).toBeCalledTimes(1);
});

test('PgQueue FIFO', async () => {
  const data: any[] = [];

  class MyWorker extends PgQueue<any> {
    async perform(item: any) {
      data.push(item);
    }
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const queue = new MyWorker({
    pool,
  });

  await queue.migrate();
  await queue.start();

  await queue.enqueue('test2');
  await queue.enqueue('test1');

  await sleep(200);

  await queue.stop();

  expect(data).toEqual(['test2', 'test1']);
});
