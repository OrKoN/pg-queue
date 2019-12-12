import { Pool, PoolClient } from 'pg';

function escSql(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

export abstract class PgQueue {
  private pool: Pool;
  private queue = 'default';
  private tableName = '__pg_queue_jobs';
  private estimatedQueueSize = 0;
  private lastEstimate = 0;
  private interval?: NodeJS.Timeout;

  public constructor(connectionString: string, maxConcurrency = 10) {
    this.pool = new Pool({
      connectionString,
      max: maxConcurrency,
    });
  }

  public async start() {
    await this.migrate();
    this.pool.on('error', err => console.log('error', err));
    this.interval = setInterval(() => this.process(), 100);
  }

  public async stop() {
    if (this.interval) clearInterval(this.interval);
    await this.pool.end();
  }

  public async enqueue(data: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ${escSql(this.tableName)}(queue, data) VALUES ($1, $2)`,
        [this.queue, JSON.stringify(data)]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public abstract async perform(data: any, client: PoolClient): Promise<void>;

  private async process() {
    while (this.estimatedQueueSize) {
      this.estimatedQueueSize--;
      this.dequeue();
    }
    this.dequeue();
  }

  private async dequeue() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `DELETE FROM ${escSql(this.tableName)}
          WHERE id = (
            SELECT id
            FROM ${escSql(this.tableName)}
            WHERE queue = $1
            ORDER BY id
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          RETURNING *;
        `,
        [this.queue]
      );
      if (rows.length > 0) {
        await this.perform(rows[0].data, client);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      try {
        await this.estimateQueueSize(client);
      } catch {}
      client.release();
    }
  }

  private async estimateQueueSize(client: PoolClient) {
    if (+new Date() - this.lastEstimate < 100) {
      return;
    }
    const count = await client.query(
      `SELECT COUNT(1)
       FROM ${escSql(this.tableName)}
       WHERE queue = $1`,
      [this.queue]
    );
    const queueSize = parseInt(count.rows[0].count, 10);
    if (queueSize > this.estimatedQueueSize) {
      this.estimatedQueueSize = queueSize;
    }
    this.lastEstimate = +new Date();
  }

  private async migrate() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName}(id bigserial, queue varchar(255), data json)`
    );
  }
}
