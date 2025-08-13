// This file sets up Jest mocks for the plugin system tests
const path = require('path');
const fs = require('fs');
const { TextEncoder, TextDecoder } = require('util');

// Add TextEncoder and TextDecoder to the global context
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Add Web Streams API support
const {
  ReadableStream,
  WritableStream,
  TransformStream,
} = require('stream/web');
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Mock dynamic import
// This is the key fix for the PluginLoader tests
global.importShim = jest.fn();

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn(),
  resolve: jest.fn(),
  dirname: jest.fn(),
  basename: jest.fn(),
  extname: jest.fn(),
}));

// Mock for the connection info storage
class MockStorage {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value.toString();
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }

  key(index) {
    return Object.keys(this.store)[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }
}

// Setup globals
global.localStorage = new MockStorage();
global.sessionStorage = new MockStorage();

// Axios response formatter
global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = init.headers || {};
    this.ok = this.status >= 200 && this.status < 300;
  }

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }

  text() {
    return Promise.resolve(this.body);
  }
};

// Blob class mock
global.Blob = class Blob {
  constructor(content, options = {}) {
    this._content = content;
    this._options = options;
    this.size = content.reduce((acc, val) => acc + val.length, 0);
    this.type = options.type || '';
  }

  text() {
    return Promise.resolve(this._content.join(''));
  }

  arrayBuffer() {
    const text = this._content.join('');
    const buf = new ArrayBuffer(text.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0; i < text.length; i++) {
      bufView[i] = text.charCodeAt(i);
    }
    return Promise.resolve(buf);
  }

  stream() {
    throw new Error('Stream not implemented in the mock');
  }

  slice(start, end, contentType) {
    const text = this._content.join('');
    const sliced = text.slice(start, end);
    return new Blob([sliced], { type: contentType || this.type });
  }
};

// URL class mock
global.URL = class URL {
  constructor(url, base) {
    if (base !== undefined) {
      url = base + url;
    }

    this.href = url;

    // Parse URL
    const urlParts = url.split('://');
    this.protocol = urlParts.length > 1 ? urlParts[0] + ':' : '';

    const hostPath = urlParts.length > 1 ? urlParts[1] : urlParts[0];
    const hostPathSplit = hostPath.split('/');
    this.hostname = hostPathSplit[0];
    this.host = hostPathSplit[0];

    this.pathname = '/' + hostPathSplit.slice(1).join('/').split('?')[0];

    const queryString = url.split('?')[1];
    this.search = queryString ? '?' + queryString.split('#')[0] : '';

    const fragment = url.split('#')[1];
    this.hash = fragment ? '#' + fragment : '';

    this.origin = this.protocol + '//' + this.host;
  }

  createObjectURL() {
    return 'blob:mock-url';
  }

  revokeObjectURL() {
    // No-op
  }
};

// Mock File class
global.File = class File extends global.Blob {
  constructor(content, name, options = {}) {
    super(content, options);
    this.name = name;
    this.lastModified = options.lastModified || Date.now();
  }
};

// Mock window.fetch
global.fetch = jest.fn();

// Set up mock for crypto
global.crypto = {
  getRandomValues: function (buffer) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  },
  subtle: {
    digest: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    encrypt: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    decrypt: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    sign: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    verify: jest.fn().mockImplementation(() => Promise.resolve(true)),
    generateKey: jest.fn().mockImplementation(() =>
      Promise.resolve({
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
      })
    ),
    importKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve('mock-imported-key')),
    exportKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    deriveKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve('mock-derived-key')),
    deriveBits: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    wrapKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve(new ArrayBuffer(32))),
    unwrapKey: jest
      .fn()
      .mockImplementation(() => Promise.resolve('mock-unwrapped-key')),
  },
};


jest.mock('@grpc/grpc-js', () => ({
  credentials: {
    createSsl: jest.fn(),
    createInsecure: jest.fn(),
  },
  loadPackageDefinition: jest.fn(),
  makeGenericClientConstructor: jest.fn(),
  status: {
    OK: 0,
    CANCELLED: 1,
    UNKNOWN: 2,
  },
  Metadata: jest.fn(),
  Client: jest.fn(),
}));

jest.mock('./src/utils/state-tools', () => ({
  updateEnvFile: jest.fn().mockResolvedValue(undefined),
  getAgentFromEnv: jest.fn(),
  createAgent: jest.fn(),
  ENV_FILE_PATH: '.env',
}));

// Mock pino and pino-pretty to avoid file system issues
jest.mock('pino', () => {
  return jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    trace: jest.fn(),
    level: 'info',
  }));
});

jest.mock('pino-pretty', () => {
  return jest.fn().mockImplementation(() => ({
    write: jest.fn(),
  }));
});

// Add minimal @hashgraph/sdk mock to fix import issues without interfering with real tests
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn().mockReturnValue({
      setOperator: jest.fn(),
      close: jest.fn(),
    }),
    forMainnet: jest.fn().mockReturnValue({
      setOperator: jest.fn(),
      close: jest.fn(),
    }),
  },
  PrivateKey: {
    fromString: jest.fn().mockReturnValue({
      publicKey: {
        toString: jest.fn().mockReturnValue('mock-public-key'),
      },
      toString: jest.fn().mockReturnValue('mock-private-key'),
    }),
    generate: jest.fn().mockReturnValue({
      publicKey: {
        toString: jest.fn().mockReturnValue('mock-public-key'),
      },
      toString: jest.fn().mockReturnValue('mock-private-key'),
    }),
  },
  AccountId: {
    fromString: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('0.0.123'),
    }),
  },
  TopicId: {
    fromString: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('0.0.456'),
    }),
  },
  TopicCreateTransaction: jest.fn(),
  TopicMessageSubmitTransaction: jest.fn(),
  TopicMessageQuery: jest.fn(),
  AccountCreateTransaction: jest.fn(),
  TransferTransaction: jest.fn(),
  TokenCreateTransaction: jest.fn(),
  TokenAssociateTransaction: jest.fn(),
  TokenMintTransaction: jest.fn(),
  TokenSupplyType: {
    Finite: 'FINITE',
    Infinite: 'INFINITE',
  },
  TokenType: {
    FungibleCommon: 'FUNGIBLE_COMMON',
    NonFungibleUnique: 'NON_FUNGIBLE_UNIQUE',
  },
  Hbar: {
    fromTinybars: jest.fn(),
    from: jest.fn(),
  },
  Status: {
    Success: 'SUCCESS',
  },
  Long: {
    ZERO: { toString: () => '0' },
    MAX_VALUE: { toString: () => '9223372036854775807' },
    fromString: jest.fn((str) => ({ toString: () => str })),
    fromNumber: jest.fn((num) => ({ toString: () => num.toString() })),
  },
}));

// Mock @hashgraphonline/standards-sdk to avoid version conflicts
jest.mock('@hashgraphonline/standards-sdk', () => {
  try {
    const actual = jest.requireActual('@hashgraphonline/standards-sdk');
    return {
      ...actual,
      Logger: jest.fn().mockImplementation((options) => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      })),
      HCS10Client: jest.fn().mockImplementation(() => ({
        initialize: jest.fn(),
        register: jest.fn(),
        sendMessage: jest.fn(),
        getMessages: jest.fn(),
      })),
      ConnectionsManager: jest.fn().mockImplementation(() => ({
        updateOrAddConnection: jest.fn(),
        getAllConnections: jest.fn().mockReturnValue([]),
        getConnectionByTopicId: jest.fn(),
        getConnectionByAccountId: jest.fn(),
        clearAll: jest.fn(),
      })),
    };
  } catch (error) {
    // Fallback if requireActual fails
    return {
      Logger: jest.fn().mockImplementation((options) => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      })),
      HCS10Client: jest.fn().mockImplementation(() => ({
        initialize: jest.fn(),
        register: jest.fn(),
        sendMessage: jest.fn(),
        getMessages: jest.fn(),
      })),
      ConnectionsManager: jest.fn().mockImplementation(() => ({
        updateOrAddConnection: jest.fn(),
        getAllConnections: jest.fn().mockReturnValue([]),
        getConnectionByTopicId: jest.fn(),
        getConnectionByAccountId: jest.fn(),
        clearAll: jest.fn(),
      })),
      NetworkType: { MAINNET: 'mainnet', TESTNET: 'testnet' },
      HederaMirrorNode: jest.fn(),
      HCS2RegistryType: { INDEXED: 'indexed', SEQUENTIAL: 'sequential' },
      AIAgentCapability: {
        TEXT_GENERATION: 'TEXT_GENERATION',
        IMAGE_GENERATION: 'IMAGE_GENERATION',
        AUDIO_GENERATION: 'AUDIO_GENERATION',
        VIDEO_GENERATION: 'VIDEO_GENERATION',
        CODE_GENERATION: 'CODE_GENERATION',
        DATA_ANALYSIS: 'DATA_ANALYSIS',
        TRANSLATION: 'TRANSLATION',
        SUMMARIZATION: 'SUMMARIZATION',
        QUESTION_ANSWERING: 'QUESTION_ANSWERING',
        SENTIMENT_ANALYSIS: 'SENTIMENT_ANALYSIS',
      },
      InboundTopicType: {
        DIRECT: 'DIRECT',
        BROADCAST: 'BROADCAST',
      },
    };
  }
});

