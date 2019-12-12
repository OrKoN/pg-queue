import { Pool, PoolClient } from 'pg';

function e(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

interface Options {
  connectionString?: string;
  maxTransactionConcurrency?: number;
  queueName?: string;
  tableName?: string;
}

export abstract class PgQueue {
  private pool: Pool;
  private queueName: string;
  private tableName: string;
  private estimatedQueueSize = 0;
  private lastEstimateDate = 0;
  private interval?: NodeJS.Timeout;

  public constructor(opts?: Options) {
    this.tableName = (opts && opts.tableName) || '__pg_queue_jobs';
    this.queueName = (opts && opts.queueName) || 'default';
    if (this.queueName.length > 255) {
      throw new Error('queueName must be less or equal to 255');
    }
    this.pool = new Pool(
      opts
        ? {
            connectionString: opts.connectionString,
            max: opts.maxTransactionConcurrency,
          }
        : undefined
    );
  }

  public abstract async perform(data: any, client: PoolClient): Promise<void>;

  public async start() {
    await this.migrate();
    this.pool.on('error', err => console.log('error', err));
    this.interval = setInterval(() => this.process(), 100);
  }

  public async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    await this.pool.end();
  }

  public async enqueue(data: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ${e(this.tableName)}(queue, data) VALUES ($1, $2)`,
        [this.queueName, JSON.stringify(data)]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  private async process() {
    if (!this.interval) {
      return;
    }
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
        `DELETE FROM ${e(this.tableName)}
          WHERE id = (
            SELECT id
            FROM ${e(this.tableName)}
            WHERE queue = $1
            ORDER BY id
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          RETURNING *;
        `,
        [this.queueName]
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
    if (+new Date() - this.lastEstimateDate < 100) {
      return;
    }
    const count = await client.query(
      `SELECT COUNT(1)
       FROM ${e(this.tableName)}
       WHERE queue = $1`,
      [this.queueName]
    );
    const queueSize = parseInt(count.rows[0].count, 10);
    if (queueSize > this.estimatedQueueSize) {
      this.estimatedQueueSize = queueSize;
    }
    this.lastEstimateDate = +new Date();
  }

  private async migrate() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName}(id bigserial, queue varchar(255), data json)`
    );
  }
}
