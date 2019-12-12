# pg-queue

Transactional background processing with PostgreSQL and Node.js

```
class MyQueue extends PgQueue {
  async perform(data, client) {
    // do smth with data
    // use client for transaction processing of the data
  }
}

const queue = new MyQueue();

await queue.start();
await queue.enqueue({ a: 'b' })
```

## Connecting

Via env variables as supported by node-postgres or via constructor variables.

## Bandwidth

Transactional processing is limited by the number of connections in the connection pool and how long the transactions take:

```
Jobs/sec = connections / avgJobDurationInSec
Jobs/sec = 10 / 0.5 = 20 jobs
```

Keep the transactions short or commit immediately to have the best throughput.
