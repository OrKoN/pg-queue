# pg-queue

Transactional background processing with PostgreSQL and Node.js/TypeScript:

```
class EmailSendingQueue extends PgQueue<Email> {
  async perform(email, db) {
    // ... send the email ...
    // optionally use db for processing of the data in the same transaction
    // await db.query('UPDATE user SET lastEmailOn = NOW() WHERE id = someone')
  }
}

const queue = new EmailSendingQueue();

await queue.start();
await queue.enqueue({ to: 'someone', message: 'Welcome Email' });
await queue.enqueue(async (db) => {
  // optionally use db to perform changes in the enqueueing transaction
  // await db.query('UPDATE user SET registered = true WHERE id = someone')
  // return data to enqueue
  return { to: 'someone', message: 'Welcome Email' };
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
