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

## How to use

- Implement your queue class by extending PgQueue. One queue deals with one message type provided via `<Email>`

  ```ts
  class EmailSendingQueue extends PgQueue<Email> {}
  ```

- Implement the `perform` method of your queue class:

  ```ts
  class EmailSendingQueue extends PgQueue<Email> {
    async perform(email, db) {
      // ... send the email ...
      // optionally use db for processing of the data in the same transaction
      // await db.query('UPDATE user SET lastEmailOn = NOW() WHERE id = someone')
    }
  }
  ```

- In your worker process, start the queue:

  ```ts
  const queue = new EmailSendingQueue();
  await queue.start();
  ```

- Schedule the jobs from any process:

  ```ts
  await queue.enqueue({ to: 'someone', message: 'Welcome Email' });
  await queue.enqueue(async db => {
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

10 database connections, max 10 concurrent jobs, 20000 jobs that resolve immediately, sequential queueing -> processing:

```
queueing: jobs/s = 186915.8878504673
processing: jobs/s = 705.5918151349445
```

You can see that scheduling is much faster than processing because the scheduling is not limited whereas processing is capped at 10 concurrent jobs.
