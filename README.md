<h1 align="center">
  pg-queue
  <a href="https://www.npmjs.org/package/pg-queue"><img src="https://img.shields.io/npm/v/pg-queue.svg?style=flat" alt="npm"></a>
  <a href="https://travis-ci.org/OrKoN/pg-queue"><img src="https://travis-ci.org/OrKoN/pg-queue.svg?branch=master" alt="travis"></a>
</h1>

Transactional background processing with PostgreSQL and Node.js/TypeScript.

## Use Cases

`pg-queue` lets you schedule and execute jobs without worying that they get lost. `pg-queue` uses PostgreSQL transactions, and, therefore, not suitable for highload systems. See [Bandwidth](#Bandwidth) and [Benchmark](#Benchmark) sections for more details. Example use cases include:

- sending emails
- offloading computations off the main Node server
- distributing task processing between multiple workers
- other background tasks

## Implementation Details

- pg-queue stores jobs in a table in your database. Multiple queues are stored in the same table.
- pg-queue polls the queues every 100 ms (configurable) to see if there are any jobs
- pg-queue fetches `maxProcessingConcurrency` jobs using `SELECT FOR UPDATE SKIP LOCKED` so that concurrent workers are not blocked
- if you need FIFO processing, you need to have only a single consuming instance of PgQueue and `maxProcessingConcurrency=1` and `fifo=true`.

## How to use

- Implement your queue class by extending PgQueue. One queue deals with one message type provided via `<Email>`

  ```ts
  class EmailSendingQueue extends PgQueue<Email> {}
  ```

- Implement the `perform` method of your queue class:

  ```ts
  class EmailSendingQueue extends PgQueue<Email> {
    async perform(email, db) {
      // email: Email, db: PoolClient
      // send the email
      // optionally use db for processing of the data in the same transaction
      // await db.query('UPDATE user SET lastEmailOn = NOW() WHERE id = someone')
    }
  }
  ```

- In your worker process, start the queue:

  ```ts
  const queue = new EmailSendingQueue();
  await queue.migrate(); // run once on startup for any queue type
  await queue.start();
  ```

  Constructor options:

  - `connectionString` (string) - connection URL of the database to connect to
  - `maxProcessingConcurrency` (integer) - how many jobs will be processed at once by the queue instance
  - `maxTransactionConcurrency` (integer) - how many transactions can the queue handle at the same time
  - `pool` (pg.Pool) - an instance of `pg`'s Pool. If you provide it, the `connectionString` and `maxTransactionConcurrency` won't apply. Note: the queue will own the pool so don't share the pool with other instances or other code.
  - `queueName` (string, max 255) - the logic name of the queue.
  - `tableName` (string) - the table name that PgQueue will use to store jobs
  - `pollingInterval` (integer, default = 100) - how often the queue will poll for new messages. Don't use very low value to reduce the number of queries.
  - `fifo` (bool, default = false) - whether the jobs have to be processed in order of insertion.

- Schedule the jobs from any process:

  ```ts
  await queue.enqueue({ to: 'someone', message: 'Welcome Email' });
  await queue.enqueue(async db => {
    // db: PoolClient
    // optionally use db to perform changes in the enqueueing transaction
    // await db.query('UPDATE user SET registered = true WHERE id = someone')
    // return data to enqueue
    return { to: 'someone', message: 'Welcome Email' };
  });
  ```

## Connecting

Via env variables as supported by node-postgres or via constructor variables:

```ts
const queue = new EmailSendingQueue({
  connectionString: process.env.DATABASE_URL,
});
```

## Bandwidth

Transactional processing is limited by the number of connections in the connection pool and how long the transactions take:

```
connections = 10
avgJobDurationInSec = 0.5
Jobs/sec = connections / avgJobDurationInSec = 10 / 0.5 = 20 jobs / sec
```

Keep the transactions short or commit immediately to have the best throughput.

## Benchmark

See `test/benchmark.ts`.

```
Num jobs = 200 ; Num workers = 1 ; FIFO = true ; maxProcessingConcurrency = 1 ; maxTransactionConcurrency = 1 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 25000 ; processing speed (jobs/s) = 37.90141896938014 ;

Num jobs = 200 ; Num workers = 1 ; FIFO = false ; maxProcessingConcurrency = 1 ; maxTransactionConcurrency = 1 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 33333.333333333336 ; processing speed (jobs/s) = 37.32446415373245 ;

Num jobs = 2000 ; Num workers = 1 ; FIFO = true ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 111111.11111111112 ; processing speed (jobs/s) = 368.07580174927114 ;

Num jobs = 2000 ; Num workers = 1 ; FIFO = false ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 222222.22222222225 ; processing speed (jobs/s) = 371.191135734072 ;

Num jobs = 2000 ; Num workers = 4 ; FIFO = true ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 400000 ; processing speed (jobs/s) = 1521.4857975236707 ;

Num jobs = 2000 ; Num workers = 4 ; FIFO = false ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 250000 ; processing speed (jobs/s) = 1586.3602668643439 ;

Num jobs = 20000 ; Num workers = 4 ; FIFO = true ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 173913.04347826086 ; processing speed (jobs/s) = 613.1738719223846 ;

Num jobs = 20000 ; Num workers = 4 ; FIFO = false ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 0 ;
queueing speed (jobs/s) = 246913.58024691357 ; processing speed (jobs/s) = 1457.2176949941793 ;

Num jobs = 20000 ; Num workers = 4 ; FIFO = true ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 10 ;
queueing speed (jobs/s) = 126582.27848101266 ; processing speed (jobs/s) = 483.6132633909235 ;

Num jobs = 20000 ; Num workers = 4 ; FIFO = false ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 10 ;
queueing speed (jobs/s) = 136054.42176870749 ; processing speed (jobs/s) = 897.9482365562559 ;

Num jobs = 2000 ; Num workers = 4 ; FIFO = true ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 100 ;
queueing speed (jobs/s) = 285714.2857142857 ; processing speed (jobs/s) = 305.7390283281961 ;

Num jobs = 2000 ; Num workers = 4 ; FIFO = false ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 100 ;
queueing speed (jobs/s) = 250000 ; processing speed (jobs/s) = 294.45727482678984 ;

Num jobs = 2000 ; Num workers = 4 ; FIFO = true ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 1000 ;
queueing speed (jobs/s) = 200000 ; processing speed (jobs/s) = 39.841714120258665 ;

Num jobs = 2000 ; Num workers = 4 ; FIFO = false ; maxProcessingConcurrency = 10 ; maxTransactionConcurrency = 10 ; avgJobDuration = 1000 ;
queueing speed (jobs/s) = 285714.2857142857 ; processing speed (jobs/s) = 40.136834535170756 ;
```

You can see that scheduling is much faster. And the more messages you have in queue the slower FIO processing gets. Althought with more than 1 worker and more than 1 maxProcessingConcurrency you cannot implement real FIFO order. With concurrency, FIFO mode simply guarantees that the oldest messages will be processed first although they might be processed concurrently. E.g. the oldest ten messages are processed concurrently if maxProcessingConcurrency = 10.
