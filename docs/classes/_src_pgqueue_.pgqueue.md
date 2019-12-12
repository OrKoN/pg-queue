[pg-queue](../README.md) › [Globals](../globals.md) › ["src/PgQueue"](../modules/_src_pgqueue_.md) › [PgQueue](_src_pgqueue_.pgqueue.md)

# Class: PgQueue

## Hierarchy

* **PgQueue**

## Index

### Constructors

* [constructor](_src_pgqueue_.pgqueue.md#constructor)

### Properties

* [estimatedQueueSize](_src_pgqueue_.pgqueue.md#private-estimatedqueuesize)
* [interval](_src_pgqueue_.pgqueue.md#private-optional-interval)
* [lastEstimateDate](_src_pgqueue_.pgqueue.md#private-lastestimatedate)
* [pool](_src_pgqueue_.pgqueue.md#private-pool)
* [queueName](_src_pgqueue_.pgqueue.md#private-queuename)
* [tableName](_src_pgqueue_.pgqueue.md#private-tablename)

### Methods

* [dequeue](_src_pgqueue_.pgqueue.md#private-dequeue)
* [enqueue](_src_pgqueue_.pgqueue.md#enqueue)
* [estimateQueueSize](_src_pgqueue_.pgqueue.md#private-estimatequeuesize)
* [migrate](_src_pgqueue_.pgqueue.md#private-migrate)
* [perform](_src_pgqueue_.pgqueue.md#abstract-perform)
* [process](_src_pgqueue_.pgqueue.md#private-process)
* [start](_src_pgqueue_.pgqueue.md#start)
* [stop](_src_pgqueue_.pgqueue.md#stop)

## Constructors

###  constructor

\+ **new PgQueue**(`opts?`: [Options](../interfaces/_src_pgqueue_.options.md)): *[PgQueue](_src_pgqueue_.pgqueue.md)*

*Defined in [src/PgQueue.ts:20](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L20)*

**Parameters:**

Name | Type |
------ | ------ |
`opts?` | [Options](../interfaces/_src_pgqueue_.options.md) |

**Returns:** *[PgQueue](_src_pgqueue_.pgqueue.md)*

## Properties

### `Private` estimatedQueueSize

• **estimatedQueueSize**: *number* = 0

*Defined in [src/PgQueue.ts:18](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L18)*

___

### `Private` `Optional` interval

• **interval**? : *NodeJS.Timeout*

*Defined in [src/PgQueue.ts:20](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L20)*

___

### `Private` lastEstimateDate

• **lastEstimateDate**: *number* = 0

*Defined in [src/PgQueue.ts:19](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L19)*

___

### `Private` pool

• **pool**: *Pool*

*Defined in [src/PgQueue.ts:15](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L15)*

___

### `Private` queueName

• **queueName**: *string*

*Defined in [src/PgQueue.ts:16](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L16)*

___

### `Private` tableName

• **tableName**: *string*

*Defined in [src/PgQueue.ts:17](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L17)*

## Methods

### `Private` dequeue

▸ **dequeue**(): *Promise‹void›*

*Defined in [src/PgQueue.ts:82](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L82)*

**Returns:** *Promise‹void›*

___

###  enqueue

▸ **enqueue**(`data`: any): *Promise‹void›*

*Defined in [src/PgQueue.ts:54](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L54)*

**Parameters:**

Name | Type |
------ | ------ |
`data` | any |

**Returns:** *Promise‹void›*

___

### `Private` estimateQueueSize

▸ **estimateQueueSize**(`client`: PoolClient): *Promise‹void›*

*Defined in [src/PgQueue.ts:115](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L115)*

**Parameters:**

Name | Type |
------ | ------ |
`client` | PoolClient |

**Returns:** *Promise‹void›*

___

### `Private` migrate

▸ **migrate**(): *Promise‹void›*

*Defined in [src/PgQueue.ts:132](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L132)*

**Returns:** *Promise‹void›*

___

### `Abstract` perform

▸ **perform**(`data`: any, `client`: PoolClient): *Promise‹void›*

*Defined in [src/PgQueue.ts:38](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L38)*

**Parameters:**

Name | Type |
------ | ------ |
`data` | any |
`client` | PoolClient |

**Returns:** *Promise‹void›*

___

### `Private` process

▸ **process**(): *Promise‹void›*

*Defined in [src/PgQueue.ts:71](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L71)*

**Returns:** *Promise‹void›*

___

###  start

▸ **start**(): *Promise‹void›*

*Defined in [src/PgQueue.ts:40](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L40)*

**Returns:** *Promise‹void›*

___

###  stop

▸ **stop**(): *Promise‹void›*

*Defined in [src/PgQueue.ts:46](https://github.com/OrKoN/pg-queue/blob/484d844/src/PgQueue.ts#L46)*

**Returns:** *Promise‹void›*
