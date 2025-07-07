import { HederaAgentKit, ServerSigner } from 'hedera-agent-kit';
import { HCS10Builder } from '../builders/hcs10/hcs10-builder';
import { RegisterAgentTool } from '../tools/hcs10/RegisterAgentTool';
import { FindRegistrationsTool } from '../tools/hcs10/FindRegistrationsTool';
import { InitiateConnectionTool } from '../tools/hcs10/InitiateConnectionTool';
import { ListConnectionsTool } from '../tools/hcs10/ListConnectionsTool';
import { SendMessageToConnectionTool } from '../tools/hcs10/SendMessageToConnectionTool';
import { CheckMessagesTool } from '../tools/hcs10/CheckMessagesTool';
import { ConnectionMonitorTool } from '../tools/hcs10/ConnectionMonitorTool';
import { ManageConnectionRequestsTool } from '../tools/hcs10/ManageConnectionRequestsTool';
import { AcceptConnectionRequestTool } from '../tools/hcs10/AcceptConnectionRequestTool';
import { RetrieveProfileTool } from '../tools/hcs10/RetrieveProfileTool';
import { ListUnapprovedConnectionRequestsTool } from '../tools/hcs10/ListUnapprovedConnectionRequestsTool';
import { IStateManager } from '../state/state-types';
import { OpenConvaiState } from '../state/open-convai-state';
import { Logger } from '@hashgraphonline/standards-sdk';
import { ENV_FILE_PATH } from '../utils/state-tools';

export interface HCS10ClientConfig {
  operatorId?: string;
  operatorKey?: string;
  network?: 'mainnet' | 'testnet';
  useEncryption?: boolean;
  registryUrl?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface HCS10InitializationOptions {
  clientConfig?: HCS10ClientConfig;
  stateManager?: IStateManager;
  createAllTools?: boolean;
  monitoringClient?: boolean;
}

/**
 * Tool collection containing all available tools from the standards-agent-kit
 */
export interface HCS10Tools {
  registerAgentTool: RegisterAgentTool;
  findRegistrationsTool: FindRegistrationsTool;
  retrieveProfileTool: RetrieveProfileTool;
  initiateConnectionTool: InitiateConnectionTool;
  listConnectionsTool: ListConnectionsTool;
  sendMessageToConnectionTool: SendMessageToConnectionTool;
  checkMessagesTool: CheckMessagesTool;
  connectionMonitorTool: ConnectionMonitorTool;
  manageConnectionRequestsTool: ManageConnectionRequestsTool;
  acceptConnectionRequestTool: AcceptConnectionRequestTool;
  listUnapprovedConnectionRequestsTool: ListUnapprovedConnectionRequestsTool;
}

/**
 * Initializes the HCS10 client and returns pre-registered LangChain tools.
 *
 * @param options - Initialization options
 * @returns Object containing hederaKit, hcs10Builder and requested tools
 */
export const initializeStandardsAgentKit = async (
  options?: HCS10InitializationOptions
): Promise<{
  hederaKit: HederaAgentKit;
  hcs10Builder: HCS10Builder;
  monitoringHederaKit?: HederaAgentKit;
  monitoringHcs10Builder?: HCS10Builder;
  tools: Partial<HCS10Tools>;
  stateManager: IStateManager;
}> => {
  const config = options?.clientConfig || {};

  const operatorId = config.operatorId || process.env.HEDERA_OPERATOR_ID;
  const operatorPrivateKey =
    config.operatorKey || process.env.HEDERA_OPERATOR_KEY;

  const networkEnv = config.network || process.env.HEDERA_NETWORK || 'testnet';

  let network: 'mainnet' | 'testnet';
  if (networkEnv === 'mainnet') {
    network = 'mainnet';
  } else if (networkEnv === 'testnet') {
    network = 'testnet';
  } else {
    console.warn(
      `Unsupported network specified: '${networkEnv}'. Defaulting to 'testnet'.`
    );
    network = 'testnet';
  }

  if (!operatorId || !operatorPrivateKey) {
    throw new Error(
      'Operator ID and private key must be provided either through options or environment variables.'
    );
  }

  const shouldSilence = process.env.DISABLE_LOGGING === 'true';
  const logger = Logger.getInstance({
    level: config.logLevel || 'info',
    silent: shouldSilence,
  });

  const stateManager =
    options?.stateManager ||
    new OpenConvaiState({
      defaultEnvFilePath: ENV_FILE_PATH,
      defaultPrefix: 'TODD',
    });
  logger.info('State manager initialized');

  // Create HederaAgentKit
  const signer = new ServerSigner(operatorId, operatorPrivateKey, network);
  const hederaKit = new HederaAgentKit(signer);
  await hederaKit.initialize();
  logger.info(`HederaAgentKit initialized for ${operatorId} on ${network}`);

  // Create HCS10Builder
  const hcs10Builder = new HCS10Builder(hederaKit, stateManager, {
    useEncryption: config.useEncryption,
    registryUrl: config.registryUrl,
    logLevel: config.logLevel,
  });

  let monitoringHederaKit: HederaAgentKit | undefined;
  let monitoringHcs10Builder: HCS10Builder | undefined;

  if (options?.monitoringClient) {
    const monitoringSigner = new ServerSigner(operatorId, operatorPrivateKey, network);
    monitoringHederaKit = new HederaAgentKit(monitoringSigner);
    await monitoringHederaKit.initialize();
    monitoringHcs10Builder = new HCS10Builder(monitoringHederaKit, stateManager, {
      useEncryption: config.useEncryption,
      registryUrl: config.registryUrl,
      logLevel: 'error',
    });
    logger.info('Monitoring client initialized');
  }

  const tools: Partial<HCS10Tools> = {};

  // Always create RegisterAgentTool
  tools.registerAgentTool = new RegisterAgentTool({
    hederaKit,
    hcs10Builder,
    logger: undefined,
  });

  if (options?.createAllTools) {
    tools.findRegistrationsTool = new FindRegistrationsTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.retrieveProfileTool = new RetrieveProfileTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.initiateConnectionTool = new InitiateConnectionTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.listConnectionsTool = new ListConnectionsTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.sendMessageToConnectionTool = new SendMessageToConnectionTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.checkMessagesTool = new CheckMessagesTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.connectionMonitorTool = new ConnectionMonitorTool({
      hederaKit: monitoringHederaKit || hederaKit,
      hcs10Builder: monitoringHcs10Builder || hcs10Builder,
      logger: undefined,
    });
    tools.manageConnectionRequestsTool = new ManageConnectionRequestsTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.acceptConnectionRequestTool = new AcceptConnectionRequestTool({
      hederaKit,
      hcs10Builder,
      logger: undefined,
    });
    tools.listUnapprovedConnectionRequestsTool =
      new ListUnapprovedConnectionRequestsTool({
        hederaKit,
        hcs10Builder,
        logger: undefined,
      });

    logger.info('All tools initialized');
  }

  return {
    hederaKit,
    hcs10Builder,
    monitoringHederaKit,
    monitoringHcs10Builder,
    tools,
    stateManager,
  };
};