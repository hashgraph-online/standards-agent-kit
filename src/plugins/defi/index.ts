import { BasePlugin, GenericPluginContext, HederaTool, HederaAgentKit } from 'hedera-agent-kit';
import {
  HederaGetTokenInfoTool,
  HederaTransferTokensTool,
  HederaGetAccountTokensTool,
  HederaAssociateTokensTool
} from 'hedera-agent-kit';

/**
 * DeFi Integration Plugin for the Standards Agent Kit
 * Uses built-in Hedera token tools from hedera-agent-kit
 */
export default class DeFiPlugin extends BasePlugin<GenericPluginContext> {
  id = 'defi-integration';
  name = 'DeFi Integration Plugin';
  description = 'Provides tools to interact with DeFi protocols on Hedera using built-in Hedera tools';
  version = '1.0.0';
  author = 'Hashgraph Online';

  private tools: HederaTool[] = [];

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);
    this.initializeTools();
  }

  private initializeTools(): void {
    const hederaKit = this.context.config.hederaKit as HederaAgentKit;
    const logger = this.context.logger;

    this.tools = [
      new HederaGetTokenInfoTool({ hederaKit, logger }),
      new HederaTransferTokensTool({ hederaKit, logger }),
      new HederaGetAccountTokensTool({ hederaKit, logger }),
      new HederaAssociateTokensTool({ hederaKit, logger })
    ];
  }

  getTools(): HederaTool[] {
    return this.tools;
  }
}
