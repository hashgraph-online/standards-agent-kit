import { StructuredTool, ToolParams } from '@langchain/core/tools';
import { z } from 'zod';
import {
  IStateManager,
  ActiveConnection,
} from '../state/open-convai-state';

export interface ListConnectionsToolParams extends ToolParams {
  stateManager: IStateManager;
}

/**
 * A tool to list currently active HCS-10 connections stored in the state manager.
 */
export class ListConnectionsTool extends StructuredTool {
  name = 'list_connections';
  description =
    'Lists the currently active HCS-10 connections. Provides details like connection number, target agent name, target account ID, status, and the connection topic ID for each connection.';
  schema = z.object({});

  private stateManager: IStateManager;

  constructor({ stateManager, ...rest }: ListConnectionsToolParams) {
    super(rest);
    this.stateManager = stateManager;
  }

  protected async _call(_: z.infer<this['schema']>): Promise<string> {
    const connections = this.stateManager.listConnections();

    if (connections.length === 0) {
      return 'There are currently no active connections.';
    }

    let output = 'Active Connections:\n';
    connections.forEach(
      (conn: ActiveConnection & { status?: string }, index) => {
        output += `${index + 1}. To: ${conn.targetAgentName} (${
          conn.targetAccountId
        }) | Status: ${conn.status || 'established'} | Topic: ${
          conn.connectionTopicId
        }\n`;
      }
    );

    return output.trim();
  }
}
