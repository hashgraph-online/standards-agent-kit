import type { HederaAgentKit } from 'hedera-agent-kit';
import {
  AccountId,
  Client,
  TopicCreateTransaction,
  TopicId,
  TopicMessageSubmitTransaction,
  TransactionId,
} from '@hashgraph/sdk';
import {
  buildHcs2CreateRegistryTx,
  buildHcs2RegisterTx,
  buildHcs2UpdateTx,
  buildHcs2DeleteTx,
  buildHcs2MigrateTx,
  HCS2RegistryType,
  buildHcs6CreateRegistryTx,
  buildHcs6RegisterEntryTx,
  buildHcs10SendMessageTx,
  buildHcs10SubmitConnectionRequestTx,
  buildHcs20DeployTx,
  buildHcs20MintTx,
  buildHcs20TransferTx,
  buildHcs20BurnTx,
  buildHcs20RegisterTx,
  buildHcs12CreateRegistryTopicTx,
  buildHcs12SubmitMessageTx,
  buildHcs12RegisterAssemblyTx,
  buildHcs12AddBlockToAssemblyTx,
  buildHcs12AddActionToAssemblyTx,
  buildHcs12UpdateAssemblyTx,
  buildHcs7SubmitMessageTx,
  buildHcs7EvmMessageTx,
  buildHcs7WasmMessageTx,
} from '@hashgraphonline/standards-sdk';

export type ByteBuildHandler = (ctx: {
  hederaKit: HederaAgentKit;
  request: Record<string, unknown>;
}) => Promise<{ transactionBytes: string }>;

class ByteBuildRegistryImpl {
  private handlers = new Map<string, ByteBuildHandler>();

  register(op: string, handler: ByteBuildHandler): void {
    this.handlers.set(op, handler);
  }

  has(op: string): boolean {
    return this.handlers.has(op);
  }

  async build(
    op: string,
    hederaKit: HederaAgentKit,
    request: Record<string, unknown>
  ): Promise<{ transactionBytes: string } | null> {
    const h = this.handlers.get(op);
    if (!h) return null;
    return await h({ hederaKit, request });
  }
}

export const ByteBuildRegistry = new ByteBuildRegistryImpl();

async function freezeTxToBytes(
  hederaKit: HederaAgentKit,
  tx: any,
): Promise<{ transactionBytes: string }> {
  const network = hederaKit.client.network.toString().includes('mainnet')
    ? 'mainnet'
    : 'testnet';
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const operatorId = hederaKit.signer.getAccountId().toString();
  const payer = AccountId.fromString(operatorId);
  if (typeof tx.setTransactionId === 'function') {
    tx.setTransactionId(TransactionId.generate(payer));
  }
  if (typeof tx.setAutoRenewAccountId === 'function') {
    try { tx.setAutoRenewAccountId(operatorId); } catch {}
  }
  const frozen = await tx.freezeWith(client);
  return { transactionBytes: Buffer.from(frozen.toBytes()).toString('base64') };
}

async function buildTopicCreateBytes(
  hederaKit: HederaAgentKit,
  memo: string,
  ttlSeconds?: number
): Promise<{ transactionBytes: string }> {
  const network = hederaKit.client.network.toString().includes('mainnet')
    ? 'mainnet'
    : 'testnet';
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const operatorId = hederaKit.signer.getAccountId().toString();
  const payer = AccountId.fromString(operatorId);

  let tx = new TopicCreateTransaction()
    .setTransactionId(TransactionId.generate(payer))
    .setTopicMemo(memo);
  if (ttlSeconds && Number.isFinite(ttlSeconds)) {
    try {
      tx = tx.setAutoRenewPeriod(ttlSeconds);
    } catch {}
  }
  const frozen = await tx.freezeWith(client);
  return { transactionBytes: Buffer.from(frozen.toBytes()).toString('base64') };
}

async function buildTopicMessageBytes(
  hederaKit: HederaAgentKit,
  topicId: string,
  message: string | Uint8Array,
  memo?: string
): Promise<{ transactionBytes: string }> {
  const network = hederaKit.client.network.toString().includes('mainnet')
    ? 'mainnet'
    : 'testnet';
  const client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  const operatorId = hederaKit.signer.getAccountId().toString();
  const payer = AccountId.fromString(operatorId);
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setTransactionId(TransactionId.generate(payer))
    .setMessage(message);
  if (memo && memo.length > 0) {
    tx.setTransactionMemo(memo);
  }
  const frozen = await tx.freezeWith(client);
  return { transactionBytes: Buffer.from(frozen.toBytes()).toString('base64') };
}

ByteBuildRegistry.register(
  'hcs2.createRegistry',
  async ({ hederaKit, request }) => {
    const opts = (request?.options || {}) as {
      registryType?: number;
      ttl?: number;
      adminKey?: string | boolean;
      submitKey?: string | boolean;
    };

    let operatorPublicKey: any | undefined;
    try {
      const priv = (hederaKit as any)?.signer?.getOperatorPrivateKey?.();
      operatorPublicKey = priv?.publicKey;
    } catch {}

    const tx = buildHcs2CreateRegistryTx({
      registryType: (opts.registryType ?? HCS2RegistryType.INDEXED) as any,
      ttl: opts.ttl ?? 86400,
      adminKey: opts.adminKey as any,
      submitKey: opts.submitKey as any,
      operatorPublicKey,
    });
    return await freezeTxToBytes(hederaKit, tx);
  }
);

ByteBuildRegistry.register(
  'hcs2.migrateRegistry',
  async ({ hederaKit, request }) => {
    if (!isRecord(request)) throw new Error('hcs2.migrateRegistry: invalid request payload');
    const registryTopicId = getStringProp(request, 'registryTopicId') || '';
    if (!registryTopicId) throw new Error('hcs2.migrateRegistry: registryTopicId is required');
    const options = getObjectProp(request, 'options') || {};
    const targetTopicId = getStringProp(options, 'targetTopicId') || '';
    const metadata = getStringProp(options, 'metadata');
    const memo = getStringProp(options, 'memo');
    const tx = buildHcs2MigrateTx({
      registryTopicId,
      targetTopicId,
      metadata,
      memo,
    });
    return await freezeTxToBytes(hederaKit, tx);
  }
);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function getStringProp(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const val = obj[key];
  return typeof val === 'string' ? val : undefined;
}
function getNumberProp(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const val = obj[key];
  return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
}
function getObjectProp(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const val = obj[key];
  return isRecord(val) ? val : undefined;
}

ByteBuildRegistry.register(
  'hcs2.submitMessage',
  async ({ hederaKit, request }) => {
    if (!isRecord(request))
      throw new Error('hcs2.submitMessage: invalid request payload');
    const topicId =
      getStringProp(request, 'topicId') ||
      getStringProp(request, 'registryTopicId') ||
      '';
    if (!topicId) throw new Error('hcs2.submitMessage: topicId is required');
    const payload = request['payload'];
    const message =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    return await buildTopicMessageBytes(hederaKit, topicId, message);
  }
);

ByteBuildRegistry.register('hcs2.registerEntry', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs2.registerEntry: invalid request payload');
  const registryTopicId = getStringProp(request, 'registryTopicId') || '';
  if (!registryTopicId) throw new Error('hcs2.registerEntry: registryTopicId is required');
  const options = getObjectProp(request, 'options') || {};
  const targetTopicId = getStringProp(options, 'targetTopicId') || '';
  const metadata = getStringProp(options, 'metadata');
  const memo = getStringProp(options, 'memo');
  const tx = buildHcs2RegisterTx({
    registryTopicId,
    targetTopicId,
    metadata,
    memo,
  });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs2.updateEntry', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs2.updateEntry: invalid request payload');
  const registryTopicId = getStringProp(request, 'registryTopicId') || '';
  if (!registryTopicId) throw new Error('hcs2.updateEntry: registryTopicId is required');
  const options = getObjectProp(request, 'options') || {};
  const targetTopicId = getStringProp(options, 'targetTopicId') || '';
  const uid = getStringProp(options, 'uid') || '';
  const metadata = getStringProp(options, 'metadata');
  const memo = getStringProp(options, 'memo');
  const tx = buildHcs2UpdateTx({
    registryTopicId,
    uid,
    targetTopicId,
    metadata,
    memo,
  });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs2.deleteEntry', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs2.deleteEntry: invalid request payload');
  const registryTopicId = getStringProp(request, 'registryTopicId') || '';
  if (!registryTopicId) throw new Error('hcs2.deleteEntry: registryTopicId is required');
  const options = getObjectProp(request, 'options') || {};
  const uid = getStringProp(options, 'uid') || '';
  const memo = getStringProp(options, 'memo');
  const tx = buildHcs2DeleteTx({
    registryTopicId,
    uid,
    memo,
  });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register(
  'hcs6.createRegistry',
  async ({ hederaKit, request }) => {
    const opts = isRecord(request) ? getObjectProp(request, 'options') : undefined;
    const ttl = opts ? getNumberProp(opts, 'ttl') : undefined;

    let operatorPublicKey: any | undefined;
    try {
      const priv = (hederaKit as any)?.signer?.getOperatorPrivateKey?.();
      operatorPublicKey = priv?.publicKey;
    } catch {}

    const tx = buildHcs6CreateRegistryTx({ ttl: ttl ?? 86400, operatorPublicKey });
    return await freezeTxToBytes(hederaKit, tx);
  }
);

ByteBuildRegistry.register(
  'hcs6.registerEntry',
  async ({ hederaKit, request }) => {
    if (!isRecord(request))
      throw new Error('hcs6.registerEntry: invalid request payload');
    const registryTopicId = getStringProp(request, 'registryTopicId') || '';
    if (!registryTopicId)
      throw new Error('hcs6.registerEntry: registryTopicId is required');
    const options = getObjectProp(request, 'options') || {};
    const targetTopicId = getStringProp(options, 'targetTopicId') || '';
    const memo = getStringProp(options, 'memo');
    const tx = buildHcs6RegisterEntryTx({
      registryTopicId,
      targetTopicId,
      memo,
    });
    return await freezeTxToBytes(hederaKit, tx);
  }
);

ByteBuildRegistry.register(
  'hcs6.submitMessage',
  async ({ hederaKit, request }) => {
    if (!isRecord(request))
      throw new Error('hcs6.submitMessage: invalid request payload');
    const topicId = getStringProp(request, 'topicId') || '';
    if (!topicId) throw new Error('hcs6.submitMessage: topicId is required');
    const payload = request['payload'];
    const message =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    return await buildTopicMessageBytes(hederaKit, topicId, message);
  }
);

ByteBuildRegistry.register('sendMessage', async ({ hederaKit, request }) => {
  if (!isRecord(request))
    throw new Error('sendMessage: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('sendMessage: topicId is required');
  const dataVal = request['data'];
  const memo = getStringProp(request, 'memo') || '';
  const operatorId = hederaKit.signer.getAccountId().toString();
  const data = typeof dataVal === 'string' ? dataVal : JSON.stringify(dataVal ?? {});
  const tx = buildHcs10SendMessageTx({ connectionTopicId: topicId, operatorId, data, memo });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register(
  'submitConnectionRequest',
  async ({ hederaKit, request }) => {
    if (!isRecord(request))
      throw new Error('submitConnectionRequest: invalid request payload');
    const inboundTopicId = getStringProp(request, 'inboundTopicId') || '';
    if (!inboundTopicId)
      throw new Error('submitConnectionRequest: inboundTopicId is required');
    const memo = getStringProp(request, 'memo') || '';
  const operatorId = hederaKit.signer.getAccountId().toString();
  const tx = buildHcs10SubmitConnectionRequestTx({ inboundTopicId, operatorId, memo });
    return await freezeTxToBytes(hederaKit, tx);
  }
);

ByteBuildRegistry.register('hcs20.deploy', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs20.deploy: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs20.deploy: topicId is required');
  const name = getStringProp(request, 'name') || '';
  const tick = getStringProp(request, 'tick') || '';
  const max = getStringProp(request, 'max') || '';
  const lim = getStringProp(request, 'lim');
  const metadata = getStringProp(request, 'metadata');
  const memo = getStringProp(request, 'memo');
  const tx = buildHcs20DeployTx({ topicId, name, tick, max, lim, metadata, memo });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs20.mint', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs20.mint: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs20.mint: topicId is required');
  const tick = getStringProp(request, 'tick') || '';
  const amt = getStringProp(request, 'amt') || '';
  const to = getStringProp(request, 'to') || '';
  const memo = getStringProp(request, 'memo');
  const tx = buildHcs20MintTx({ topicId, tick, amt, to, memo });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs20.transfer', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs20.transfer: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs20.transfer: topicId is required');
  const tick = getStringProp(request, 'tick') || '';
  const amt = getStringProp(request, 'amt') || '';
  const from = getStringProp(request, 'from') || '';
  const to = getStringProp(request, 'to') || '';
  const memo = getStringProp(request, 'memo');
  const tx = buildHcs20TransferTx({ topicId, tick, amt, from, to, memo });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs20.burn', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs20.burn: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs20.burn: topicId is required');
  const tick = getStringProp(request, 'tick') || '';
  const amt = getStringProp(request, 'amt') || '';
  const from = getStringProp(request, 'from') || '';
  const memo = getStringProp(request, 'memo');
  const tx = buildHcs20BurnTx({ topicId, tick, amt, from, memo });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs20.register', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs20.register: invalid request payload');
  const registryTopicId = getStringProp(request, 'registryTopicId') || '';
  if (!registryTopicId) throw new Error('hcs20.register: registryTopicId is required');
  const topicId = getStringProp(request, 'topicId') || '';
  const name = getStringProp(request, 'name') || '';
  const isPrivateVal = (request as any)['isPrivate'];
  const isPrivate = typeof isPrivateVal === 'boolean' ? isPrivateVal : false;
  const metadata = getStringProp(request, 'metadata');
  const memo = getStringProp(request, 'memo');
  const tx = buildHcs20RegisterTx({ registryTopicId, name, topicId, isPrivate, metadata, memo });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs12.createRegistry', async ({ hederaKit, request }) => {
  const opts = isRecord(request) ? getObjectProp(request, 'options') : undefined;
  const ttlVal = opts ? getNumberProp(opts, 'ttl') : undefined;
  const ttl = (ttlVal ?? 60) as number;
  const registry = (opts && getStringProp(opts, 'registry')) || 'hashlinks';
  let operatorPublicKey: any | undefined;
  try {
    const priv = (hederaKit as any)?.signer?.getOperatorPrivateKey?.();
    operatorPublicKey = priv?.publicKey;
  } catch {}
  const tx = buildHcs12CreateRegistryTopicTx({ registry: registry as any, ttl, operatorPublicKey });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs12.submitMessage', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs12.submitMessage: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs12.submitMessage: topicId is required');
  const payload = (request as any)['payload'];
  const tx = buildHcs12SubmitMessageTx({ topicId, payload: payload as any });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs12.registerAssembly', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs12.registerAssembly: invalid request payload');
  const assemblyTopicId = getStringProp(request, 'assemblyTopicId') || '';
  if (!assemblyTopicId) throw new Error('hcs12.registerAssembly: assemblyTopicId is required');
  const registration = getObjectProp(request, 'registration') || {};
  const tx = buildHcs12RegisterAssemblyTx({ assemblyTopicId, registration: registration as any });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs12.addBlock', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs12.addBlock: invalid request payload');
  const assemblyTopicId = getStringProp(request, 'assemblyTopicId') || '';
  if (!assemblyTopicId) throw new Error('hcs12.addBlock: assemblyTopicId is required');
  const operation = getObjectProp(request, 'operation') || {};
  const tx = buildHcs12AddBlockToAssemblyTx({ assemblyTopicId, operation: operation as any });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs12.addAction', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs12.addAction: invalid request payload');
  const assemblyTopicId = getStringProp(request, 'assemblyTopicId') || '';
  if (!assemblyTopicId) throw new Error('hcs12.addAction: assemblyTopicId is required');
  const operation = getObjectProp(request, 'operation') || {};
  const tx = buildHcs12AddActionToAssemblyTx({ assemblyTopicId, operation: operation as any });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs12.updateAssembly', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs12.updateAssembly: invalid request payload');
  const assemblyTopicId = getStringProp(request, 'assemblyTopicId') || '';
  if (!assemblyTopicId) throw new Error('hcs12.updateAssembly: assemblyTopicId is required');
  const operation = getObjectProp(request, 'operation') || {};
  const tx = buildHcs12UpdateAssemblyTx({ assemblyTopicId, operation: operation as any });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs7.submitMessage', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs7.submitMessage: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs7.submitMessage: topicId is required');
  const message = getObjectProp(request, 'message') || {};
  const tx = buildHcs7SubmitMessageTx({ topicId, message: message as any });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs7.evm', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs7.evm: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs7.evm: topicId is required');
  const config = getObjectProp(request, 'config') || {};
  const tx = buildHcs7EvmMessageTx({ topicId, config: config as any });
  return await freezeTxToBytes(hederaKit, tx);
});

ByteBuildRegistry.register('hcs7.wasm', async ({ hederaKit, request }) => {
  if (!isRecord(request)) throw new Error('hcs7.wasm: invalid request payload');
  const topicId = getStringProp(request, 'topicId') || '';
  if (!topicId) throw new Error('hcs7.wasm: topicId is required');
  const config = getObjectProp(request, 'config') || {};
  const tx = buildHcs7WasmMessageTx({ topicId, config: config as any });
  return await freezeTxToBytes(hederaKit, tx);
});
