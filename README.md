# pg-queue

Transactional background processing with PostgreSQL and Node.js/TypeScript:

```
class MyQueue extends PgQueue<MessageType> {
  async perform(data, client) {
    // do smth with data
    // use client for transaction processing of the data
  }
}

const queue = new MyQueue();

await queue.start();
await queue.enqueue({ a: 'b' });

await queue.enqueueing(async (enqueue, client) => {
  // do smth with client
  // and enqueue transactionally
  await enqueue('test2');
});

```

## Connecting

Via env variables as supported by node-postgres or via constructor variables.

## Bandwidth

Transactional processing is limited by the number of connections in the connection pool and how long the transactions take:

```
connections = 10
avgJobDurationInSec = 0.5
Jobs/sec = connections / avgJobDurationInSec = 10 / 0.5 = 20 jobs / sec
```

Keep the transactions short or commit immediately to have the best throughput.
