import { GenericPlugin } from '../GenericPlugin';
import { GenericPluginContext } from '../PluginInterface';
import { StructuredTool } from '@langchain/core/tools';
import { HCS10Client } from '../../hcs10/HCS10Client';
import { IStateManager } from '../../state/state-types';
import { OpenConvaiState } from '../../state/open-convai-state';

import { RegisterAgentTool } from '../../tools/RegisterAgentTool';
import { SendMessageTool } from '../../tools/SendMessageTool';
import { ConnectionTool } from '../../tools/ConnectionTool';
import { FindRegistrationsTool } from '../../tools/FindRegistrationsTool';
import { InitiateConnectionTool } from '../../tools/InitiateConnectionTool';
import { ListConnectionsTool } from '../../tools/ListConnectionsTool';
import { SendMessageToConnectionTool } from '../../tools/SendMessageToConnectionTool';
import { CheckMessagesTool } from '../../tools/CheckMessagesTool';
import { ConnectionMonitorTool } from '../../tools/ConnectionMonitorTool';
import { ManageConnectionRequestsTool } from '../../tools/ManageConnectionRequestsTool';
import { AcceptConnectionRequestTool } from '../../tools/AcceptConnectionRequestTool';
import { RetrieveProfileTool } from '../../tools/RetrieveProfileTool';
import { ListUnapprovedConnectionRequestsTool } from '../../tools/ListUnapprovedConnectionRequestsTool';

/**
 * OpenConvAI Plugin that provides all the tools from standards-agent-kit
 * This plugin enables full HCS-10 agent functionality including registration,
 * connection management, and messaging capabilities.
 */
export class OpenConvAIPlugin extends GenericPlugin {
  id = 'openconvai-standards-agent-kit';
  name = 'OpenConvAI Standards Agent Kit Plugin';
  description =
    'Comprehensive plugin providing all HCS-10 agent tools for registration, connections, and messaging';
  version = '1.0.0';
  author = 'Hashgraph Online';
  namespace = 'openconvai';

  private hcs10Client?: HCS10Client;
  private stateManager?: IStateManager;
  private tools: StructuredTool[] = [];

  override async initialize(context: GenericPluginContext): Promise<void> {
    await super.initialize(context);

    if (!(context.client instanceof HCS10Client)) {
      throw new Error('OpenConvAIPlugin requires an HCS10Client instance');
    }

    this.hcs10Client = context.client as HCS10Client;

    this.stateManager =
      (context.stateManager as IStateManager) || new OpenConvaiState();

    this.initializeTools();

    this.context.logger.info(
      'OpenConvAI Standards Agent Kit Plugin initialized successfully'
    );
  }

  private initializeTools(): void {
    if (!this.hcs10Client || !this.stateManager) {
      throw new Error(
        'HCS10Client and StateManager must be initialized before creating tools'
      );
    }

    this.tools = [
      new RegisterAgentTool(this.hcs10Client, this.stateManager),
      new SendMessageTool(this.hcs10Client),
      new ConnectionTool({
        client: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new FindRegistrationsTool({
        hcsClient: this.hcs10Client,
      }),
      new RetrieveProfileTool(this.hcs10Client),
      new InitiateConnectionTool({
        hcsClient: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new ListConnectionsTool({
        hcsClient: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new SendMessageToConnectionTool({
        hcsClient: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new CheckMessagesTool({
        hcsClient: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new ConnectionMonitorTool({
        hcsClient: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new ManageConnectionRequestsTool({
        hcsClient: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new AcceptConnectionRequestTool({
        hcsClient: this.hcs10Client,
        stateManager: this.stateManager,
      }),
      new ListUnapprovedConnectionRequestsTool({
        stateManager: this.stateManager,
        hcsClient: this.hcs10Client,
      }),
    ];
  }

  getTools(): StructuredTool[] {
    return this.tools;
  }

  override async cleanup(): Promise<void> {
    this.tools = [];
    this.hcs10Client = undefined;
    this.stateManager = undefined;
    this.context.logger.info(
      'OpenConvAI Standards Agent Kit Plugin cleaned up'
    );
  }
}
