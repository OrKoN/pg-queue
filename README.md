# pg-queue

Transactional background processing with PostgreSQL and Node.js

```
class MyQueue extends PgQueue {
  async perform(data) {
    // do smth with data
  }
}

const queue = new MyQueue();

await queue.start();
await queue.enqueue({ a: 'b' })
```
