import assert from 'assert';
import { Pool, PoolClient } from 'pg';
import EventEmitter from 'events';

function e(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

interface Options {
  connectionString?: string;
  maxConcurrency?: number;
  maxTransactionConcurrency?: number;
  queueName?: string;
  tableName?: string;
}

export abstract class PgQueue extends EventEmitter {
  private maxConcurrency: number;
  private pool: Pool;
  private queueName: string;
  private tableName: string;
  private pollingInterval = 100;

  private concurrency = 0;
  private estimatedQueueSize = 0;
  private lastEstimateDate = 0;
  private stopped = true;

  public constructor(opts?: Options) {
    super();
    this.tableName = (opts && opts.tableName) || '__pg_queue_jobs';
    this.queueName = (opts && opts.queueName) || 'default';
    this.maxConcurrency = (opts && opts.maxConcurrency) || 10;
    this.pool = new Pool(
      opts
        ? {
            connectionString: opts.connectionString,
            max: opts.maxTransactionConcurrency,
          }
        : undefined
    );
    assert(
      this.queueName.length <= 255,
      'queueName must be less or equal to 255'
    );
  }

  public abstract async perform(data: any, client: PoolClient): Promise<void>;

  public async start() {
    this.stopped = false;
    this.pool.on('error', err => this.emit('error', err));
    await this.migrate();
    await this.schedulePolling();
  }

  private async poll() {
    if (this.stopped) {
      return;
    }

    while (
      this.estimatedQueueSize > 0 &&
      this.concurrency < this.maxConcurrency
    ) {
      this.estimatedQueueSize--;
      this.concurrency++;
      this.dequeue().finally(() => this.concurrency--);
    }

    await this.estimateQueueSize();
    await this.schedulePolling();
  }

  private async schedulePolling() {
    !this.stopped &&
      setTimeout(() => !this.stopped && this.poll(), this.pollingInterval);
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
      this.emit('error', e);
    } finally {
      client.release();
    }
  }

  public async stop() {
    this.stopped = true;
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

  private async estimateQueueSize() {
    if (+new Date() - this.lastEstimateDate < 100) {
      return;
    }
    const client = await this.pool.connect();
    try {
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
    } finally {
      await client.release();
    }
  }

  private async migrate() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName}(id bigserial, queue varchar(255), data json)`
    );
  }
}
