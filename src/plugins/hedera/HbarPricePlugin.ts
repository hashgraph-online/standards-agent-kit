// Re-export the HBAR price tool from hedera-agent-kit
export { HederaGetHbarPriceTool as GetHbarPriceTool } from 'hedera-agent-kit';

import { BasePlugin, GenericPluginContext, HederaTool, HederaAgentKit } from 'hedera-agent-kit';
import { HederaGetHbarPriceTool } from 'hedera-agent-kit';

/**
 * Plugin to provide tools related to Hedera network information, like HBAR price.
 * Uses the built-in HederaGetHbarPriceTool from hedera-agent-kit.
 */
export class HbarPricePlugin extends BasePlugin<GenericPluginContext> {
  id = 'hedera-hbar-price';
  name = 'Hedera HBAR Price Plugin';
  description = 'Provides tools to interact with Hedera network data, specifically HBAR price.';
  version = '1.0.0';
  author = 'Hashgraph Online';

  private tools: HederaTool[] = [];

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      new HederaGetHbarPriceTool({
        hederaKit: this.context.config.hederaKit as HederaAgentKit,
        logger: this.context.logger
      })
    ];
  }

  getTools(): HederaTool[] {
    return this.tools;
  }
}