import assert from 'assert';
import { Pool, PoolClient } from 'pg';
import EventEmitter from 'events';
import { up } from 'migrations-engine';

function e(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}

interface Options {
  connectionString?: string;
  maxProcessingConcurrency?: number;
  maxTransactionConcurrency?: number;
  pollingInterval?: number;
  pool?: Pool;
  queueName?: string;
  tableName?: string;
}

type HookFn<T> = (client: PoolClient) => Promise<T>;

interface Query {
  name: string;
  text: string;
}

export abstract class PgQueue<T> extends EventEmitter {
  private maxProcessingConcurrency: number;
  private pool: Pool;
  private queueName: string;
  private tableName: string;
  private pollingInterval: number;

  private concurrency = 0;
  private stopped = true;
  private dequeueQuery: Query;
  private enqueueQuery: Query;
  private estimateQuery: Query;

  public constructor(opts?: Options) {
    super();
    this.tableName = (opts && opts.tableName) || '__pg_queue_jobs';
    this.queueName = (opts && opts.queueName) || 'default';
    this.maxProcessingConcurrency =
      (opts && opts.maxProcessingConcurrency) || 10;
    this.pollingInterval = (opts && opts.pollingInterval) || 100;

    assert(
      this.queueName.length <= 255,
      'queueName must be less or equal to 255'
    );

    this.pool =
      opts && opts.pool
        ? opts.pool
        : new Pool(
            opts
              ? {
                  connectionString: opts.connectionString,
                  max: opts.maxTransactionConcurrency,
                }
              : undefined
          );
    this.pool.on('error', err => this.emit('error', err));

    this.dequeueQuery = {
      name: 'dequeueQuery',
      text: `DELETE FROM ${e(this.tableName)}
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
    };

    this.enqueueQuery = {
      name: 'enqueueQuery',
      text: `INSERT INTO ${e(this.tableName)}(queue, data) VALUES ($1, $2)`,
    };

    this.estimateQuery = {
      name: 'estimateQuery',
      text: `SELECT COUNT(1) FROM ${e(this.tableName)} WHERE queue = $1`,
    };
  }

  public abstract async perform(data: T, client: PoolClient): Promise<void>;

  public async start() {
    await this.migrate();
    this.stopped = false;
    await this.poll();
  }

  public async stop() {
    this.stopped = true;
    await this.pool.end();
  }

  public async enqueue(dataOrFn: T | HookFn<T>) {
    await this._enqueue(
      dataOrFn instanceof Function
        ? dataOrFn
        : async () => {
            return dataOrFn;
          }
    );
  }

  public async _enqueue(fn: HookFn<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const data = await fn(client);
      await client.query({
        ...this.enqueueQuery,
        values: [this.queueName, JSON.stringify(data)],
      });
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  private async poll() {
    if (this.stopped) {
      return;
    }

    let estimatedQueueSize = await this.estimateQueueSize();

    while (
      estimatedQueueSize > 0 &&
      this.concurrency < this.maxProcessingConcurrency
    ) {
      estimatedQueueSize--;
      this.concurrency++;
      this.dequeue().finally(() => this.concurrency--);
    }

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
      const { rows } = await client.query({
        ...this.dequeueQuery,
        values: [this.queueName],
      });
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

  private async estimateQueueSize(): Promise<number> {
    const client = await this.pool.connect();
    try {
      const count = await client.query({
        ...this.estimateQuery,
        values: [this.queueName],
      });
      return parseInt(count.rows[0].count, 10);
    } finally {
      await client.release();
    }
  }

  private async migrate() {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS __pg_queue_migrations(name text)`
    );

    const { rows } = await this.pool.query(
      `SELECT * FROM __pg_queue_migrations`
    );

    const migrations = [
      {
        name: '00001-init',
        sql: `CREATE TABLE IF NOT EXISTS ${this.tableName}(id bigserial, queue varchar(255), data json)`,
      },
    ];

    const remainingMigrations = up(rows, migrations);

    for (const m of remainingMigrations) {
      const client = await this.pool.connect();
      try {
        const migration = migrations.find(item => item.name === m.name);
        if (!migration) {
          throw new Error(`Migration ${m.name} is missing`);
        }
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query(`INSERT INTO __pg_queue_migrations VALUES($1)`, [
          migration.name,
        ]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  }
}
