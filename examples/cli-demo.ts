import * as dotenv from 'dotenv';
import {
  HCS10Tools,
  initializeHCS10Client,
  IStateManager,
  HCS10Client,
  ConnectionTool,
  ConnectionMonitorTool,
  ListConnectionsTool,
  InitiateConnectionTool,
  SendMessageToConnectionTool,
  CheckMessagesTool,
  ManageConnectionRequestsTool,
  AcceptConnectionRequestTool,
  ListUnapprovedConnectionRequestsTool,
  OpenConvaiState,
  RegisterAgentTool,
  PluginRegistry,
  PluginContext,
} from '@hashgraphonline/standards-agent-kit';
import readline from 'readline';
import * as path from 'path';
import { fileURLToPath } from 'url';
import WeatherPlugin from './plugins/weather';
import DeFiPlugin from './plugins/defi';
import { HbarPricePlugin } from '../src/plugins/hedera/HbarPricePlugin';
import { Logger } from '@hashgraphonline/standards-sdk';
import { updateEnvFile } from '../src/utils/state-tools';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// --- Interfaces & State ---
interface RegisteredAgent {
  name: string;
  accountId: string;
  inboundTopicId: string;
  outboundTopicId: string;
  profileTopicId?: string;
  operatorPrivateKey: string;
}

interface ActiveConnection {
  targetAccountId: string;
  targetAgentName: string; // Store target agent name for display
  targetInboundTopicId: string;
  connectionTopicId: string;
}

let hcsClient: HCS10Client;
let connectionTool: ConnectionTool; // For backward compatibility
let connectionMonitorTool: ConnectionMonitorTool; // Our new tool
let currentAgent: RegisteredAgent | null = null;
const registeredAgents: RegisteredAgent[] = [];
let stateManager: OpenConvaiState;
let isMonitoring = false; // Track monitoring status explicitly

// Plugin system state
let pluginRegistry: PluginRegistry | null = null;
let pluginContext: PluginContext | null = null;

// --- Readline Setup ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

// --- Helper Functions ---
function displayHeader(title: string) {
  console.log(`\n--- ${title} ---`);
}

function displayAgentInfo(agent: RegisteredAgent | null) {
  if (agent) {
    console.log(`  Name: ${agent.name}`);
    console.log(`  Account ID: ${agent.accountId}`);
    console.log(`  Inbound Topic: ${agent.inboundTopicId}`);
    console.log(`  Outbound Topic: ${agent.outboundTopicId}`);
    if (agent.profileTopicId) {
      console.log(`  Profile Topic: ${agent.profileTopicId}`);
    }
  } else {
    console.log('  No agent details available.');
  }
}

// Helper function to display available capabilities
function displayCapabilities() {
  displayHeader('Available Agent Capabilities');
  console.log('  0: TEXT_GENERATION - Generate coherent, human-like text');
  console.log('  1: IMAGE_GENERATION - Create visual content based on prompts');
  console.log(
    '  2: AUDIO_GENERATION - Synthesize speech, music, or soundscapes'
  );
  console.log('  3: VIDEO_GENERATION - Produce dynamic visual content');
  console.log('  4: CODE_GENERATION - Produce code based on text prompts');
  console.log('  5: LANGUAGE_TRANSLATION - Convert text between languages');
  console.log(
    '  6: SUMMARIZATION_EXTRACTION - Distill content into concise summaries'
  );
  console.log(
    '  7: KNOWLEDGE_RETRIEVAL - Access and reason with structured data'
  );
  console.log('  8: DATA_INTEGRATION - Aggregate and visualize data sources');
  console.log('  9: MARKET_INTELLIGENCE - Analyze financial and economic data');
  console.log(' 10: TRANSACTION_ANALYTICS - Monitor and analyze transactions');
  console.log(' 11: SMART_CONTRACT_AUDIT - Evaluate decentralized code');
  console.log(
    ' 12: GOVERNANCE_FACILITATION - Support decentralized decision-making'
  );
  console.log(
    ' 13: SECURITY_MONITORING - Detect and respond to security threats'
  );
  console.log(' 14: COMPLIANCE_ANALYSIS - Ensure regulatory adherence');
  console.log(
    ' 15: FRAUD_DETECTION - Identify and mitigate fraudulent activities'
  );
  console.log(
    ' 16: MULTI_AGENT_COORDINATION - Enable collaboration between agents'
  );
  console.log(
    ' 17: API_INTEGRATION - Connect with external systems and services'
  );
  console.log(
    ' 18: WORKFLOW_AUTOMATION - Automate routine tasks and processes'
  );
}

// Define fee-related types at file level
interface FeeBase {
  amount: number;
  collectorAccount?: string;
}

interface TokenFee extends FeeBase {
  tokenId: string;
}

interface FeeConfiguration {
  defaultCollectorAccountId: string;
  hbarFees: FeeBase[];
  tokenFees: TokenFee[];
  exemptAccountIds: string[];
}

async function promptForFeesConfiguration(): Promise<FeeConfiguration | null> {
  const configureFees = await question(
    'Configure fees for this agent? (y/n): '
  );
  if (configureFees.toLowerCase() !== 'y') {
    return null;
  }

  const feeConfig: FeeConfiguration = {
    defaultCollectorAccountId: '',
    hbarFees: [],
    tokenFees: [],
    exemptAccountIds: [],
  };

  // Get default collector account
  feeConfig.defaultCollectorAccountId = await question(
    'Default fee collector account ID (leave blank to use agent account): '
  );

  // Configure HBAR fees (multiple allowed)
  await configureHbarFees(feeConfig);

  // Configure token fees (multiple allowed)
  await configureTokenFees(feeConfig);

  // Configure exempt account IDs
  await configureExemptAccounts(feeConfig);

  // Show fee summary and confirm
  if (showFeeSummary(feeConfig) && (await confirmFeeConfiguration())) {
    return feeConfig;
  }
  return null;
}

async function configureHbarFees(feeConfig: FeeConfiguration): Promise<void> {
  const configureHbarFees = await question('Configure HBAR fees? (y/n): ');
  if (configureHbarFees.toLowerCase() !== 'y') {
    return;
  }

  const MAX_FEES = 10;
  const totalCurrentFees =
    feeConfig.hbarFees.length + feeConfig.tokenFees.length;
  let feesRemaining = MAX_FEES - totalCurrentFees;

  while (feesRemaining > 0) {
    const feeIndex = feeConfig.hbarFees.length + 1;
    const fee = await promptForHbarFee(
      feeIndex,
      feeConfig.defaultCollectorAccountId
    );

    if (!fee) {
      break;
    }

    feeConfig.hbarFees.push(fee);
    feesRemaining--;

    if (feesRemaining <= 0) {
      console.log(`Maximum number of fees (${MAX_FEES}) reached.`);
      break;
    }

    const addAnother = await question(
      `Add another HBAR fee? (${
        MAX_FEES - feesRemaining
      }/${MAX_FEES} fees configured) (y/n): `
    );
    if (addAnother.toLowerCase() !== 'y') {
      break;
    }
  }
}

async function promptForHbarFee(
  index: number,
  defaultCollector: string
): Promise<FeeBase | null> {
  const hbarFeeStr = await question(`HBAR fee amount for fee #${index}: `);
  if (!hbarFeeStr.trim()) {
    return null;
  }

  const amount = parseFloat(hbarFeeStr);
  if (isNaN(amount) || amount <= 0) {
    console.log('Invalid HBAR fee amount. Fee will not be added.');
    return null;
  }

  const fee: FeeBase = { amount };
  const useDefaultCollector = await question(
    'Use default collector account for this fee? (y/n): '
  );
  if (useDefaultCollector.toLowerCase() !== 'y') {
    const collectorAccount = await question(
      'Collector account ID for this fee: '
    );
    if (collectorAccount.trim()) {
      fee.collectorAccount = collectorAccount.trim();
    }
  }

  const collectorDisplay = getCollectorDisplay(
    fee.collectorAccount,
    defaultCollector
  );
  console.log(`Added HBAR fee: ${amount} HBAR ${collectorDisplay}`);

  return fee;
}

async function configureTokenFees(feeConfig: FeeConfiguration): Promise<void> {
  const configureTokenFees = await question('Configure token fees? (y/n): ');
  if (configureTokenFees.toLowerCase() !== 'y') {
    return;
  }

  const MAX_FEES = 10;
  const totalCurrentFees =
    feeConfig.hbarFees.length + feeConfig.tokenFees.length;
  let feesRemaining = MAX_FEES - totalCurrentFees;

  while (feesRemaining > 0) {
    const feeIndex = totalCurrentFees + feeConfig.tokenFees.length + 1;
    const fee = await promptForTokenFee(
      feeIndex,
      feeConfig.defaultCollectorAccountId
    );

    if (!fee) {
      break;
    }

    feeConfig.tokenFees.push(fee);
    feesRemaining--;

    if (feesRemaining <= 0) {
      console.log(`Maximum number of fees (${MAX_FEES}) reached.`);
      break;
    }

    const addAnother = await question(
      `Add another token fee? (${
        MAX_FEES - feesRemaining
      }/${MAX_FEES} fees configured) (y/n): `
    );
    if (addAnother.toLowerCase() !== 'y') {
      break;
    }
  }
}

async function promptForTokenFee(
  index: number,
  defaultCollector: string
): Promise<TokenFee | null> {
  const tokenIdStr = await question(
    `Token ID for fee #${index} (e.g., 0.0.12345): `
  );
  if (!tokenIdStr.trim() || !/^\d+\.\d+\.\d+$/.test(tokenIdStr.trim())) {
    console.log('Invalid token ID format. Token fee will not be added.');
    return null;
  }

  const tokenAmountStr = await question('Token amount per message: ');
  const amount = parseFloat(tokenAmountStr);

  if (isNaN(amount) || amount <= 0) {
    console.log('Invalid token amount. Token fee will not be added.');
    return null;
  }

  const fee: TokenFee = {
    amount,
    tokenId: tokenIdStr.trim(),
  };

  const useDefaultCollector = await question(
    'Use default collector account for this fee? (y/n): '
  );
  if (useDefaultCollector.toLowerCase() !== 'y') {
    const collectorAccount = await question(
      'Collector account ID for this fee: '
    );
    if (collectorAccount.trim()) {
      fee.collectorAccount = collectorAccount.trim();
    }
  }

  const collectorDisplay = getCollectorDisplay(
    fee.collectorAccount,
    defaultCollector
  );
  console.log(
    `Added token fee: ${amount} of token ${fee.tokenId} ${collectorDisplay}`
  );

  return fee;
}

function getCollectorDisplay(
  specificCollector?: string,
  defaultCollector?: string
): string {
  if (specificCollector) {
    return `to be collected by ${specificCollector}`;
  } else if (defaultCollector) {
    return `to be collected by ${defaultCollector}`;
  } else {
    return 'to be collected by agent account';
  }
}

async function configureExemptAccounts(
  feeConfig: FeeConfiguration
): Promise<void> {
  const configureExemptIds = await question(
    'Configure exempt accounts? (y/n): '
  );
  if (configureExemptIds.toLowerCase() !== 'y') {
    return;
  }

  const exemptAccountsInput = await question(
    'Exempt account IDs (comma-separated, leave blank for none): '
  );

  if (exemptAccountsInput.trim()) {
    const exemptIds = exemptAccountsInput
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^\d+\.\d+\.\d+$/.test(id));

    if (exemptIds.length === 0) {
      console.log('No valid exempt account IDs provided.');
    } else {
      feeConfig.exemptAccountIds = exemptIds;
      console.log(`Added ${exemptIds.length} exempt account(s).`);
    }
  }
}

function showFeeSummary(feeConfig: FeeConfiguration): boolean {
  const hasAnyFees =
    feeConfig.hbarFees.length > 0 || feeConfig.tokenFees.length > 0;

  console.log('\nFee configuration summary:');

  if (feeConfig.defaultCollectorAccountId) {
    console.log(`- Default collector: ${feeConfig.defaultCollectorAccountId}`);
  }

  if (feeConfig.hbarFees.length > 0) {
    console.log('- HBAR fees:');
    feeConfig.hbarFees.forEach((fee) => {
      console.log(
        `  - ${fee.amount} HBAR ${
          fee.collectorAccount
            ? `to ${fee.collectorAccount}`
            : 'to default collector'
        }`
      );
    });
  }

  if (feeConfig.tokenFees.length > 0) {
    console.log('- Token fees:');
    feeConfig.tokenFees.forEach((fee) => {
      console.log(
        `  - ${fee.amount} of token ${fee.tokenId} ${
          fee.collectorAccount
            ? `to ${fee.collectorAccount}`
            : 'to default collector'
        }`
      );
    });
  }

  if (feeConfig.exemptAccountIds.length > 0) {
    console.log(`- Exempt accounts: ${feeConfig.exemptAccountIds.join(', ')}`);
  }

  if (!hasAnyFees) {
    console.log('- No fees configured');
  }

  return hasAnyFees;
}

async function confirmFeeConfiguration(): Promise<boolean> {
  const confirmFees = await question(
    'Proceed with this fee configuration? (y/n): '
  );
  if (confirmFees.toLowerCase() !== 'y') {
    console.log('Fee configuration canceled. Proceeding without fees.');
    return false;
  }
  return true;
}

async function listManagedAgents() {
  displayHeader('Managed Agents (This Session)');
  if (registeredAgents.length === 0) {
    console.log('No agents have been registered in this session.');
    return;
  }
  registeredAgents.forEach((agent, index) => {
    console.log(
      `${index + 1}. ${agent.name} (${agent.accountId}) ${
        agent === currentAgent ? '[ACTIVE]' : ''
      }`
    );
  });
}

async function selectActiveAgent() {
  displayHeader('Select Active Agent');
  if (registeredAgents.length === 0) {
    console.log('No agents available to select. Register an agent first.');
    return;
  }

  await listManagedAgents();
  const choice = await question('Enter the number of the agent to activate: ');
  const index = parseInt(choice) - 1;

  if (isNaN(index) || index < 0 || index >= registeredAgents.length) {
    console.log('Invalid choice.');
    return;
  }

  currentAgent = registeredAgents[index];
  console.log(`Agent "${currentAgent.name}" selected as active.`);

  // Stop monitoring if active for the previous agent
  if (isMonitoring) {
    console.log('Stopping connection monitoring for the previous agent...');
    connectionTool.stopMonitoring();
    isMonitoring = false;
  }

  // Reconfigure client for the selected agent
  hcsClient = new HCS10Client(
    currentAgent.accountId,
    currentAgent.operatorPrivateKey,
    hcsClient.getNetwork(),
    {
      useEncryption: false,
      registryUrl: process.env.REGISTRY_URL || 'https://moonscape.tech',
    }
  );
  console.log(`Client reconfigured for active agent: ${currentAgent.name}`);

  // Reset active connections when switching agents
  stateManager.setCurrentAgent(currentAgent);
  console.log('Active connections cleared for the new agent.');
}

// --- Connection Actions ---
async function startMonitoringConnections() {
  displayHeader('Monitor Incoming Connections');
  if (!currentAgent) {
    console.log(
      'No active agent selected. Please select or register an agent first.'
    );
    return;
  }
  if (!currentAgent.inboundTopicId) {
    console.log('Active agent data is missing the inbound topic ID.');
    return;
  }
  if (isMonitoring) {
    console.log(
      `Already monitoring connections for ${currentAgent.name} on topic ${currentAgent.inboundTopicId}.`
    );
    return;
  }

  try {
    // Use the ConnectionMonitorTool to start monitoring
    const result = await connectionMonitorTool.invoke({
      acceptAll: true,
      monitorDurationSeconds: 60,
    });
    console.log(result);
    if (
      result.includes('Monitored for') ||
      result.includes('Started monitoring')
    ) {
      isMonitoring = true;
    }
  } catch (error) {
    console.error('\nError starting connection monitor:', error);
  }
}

async function stopMonitoringConnections() {
  displayHeader('Stop Monitoring Connections');
  if (!isMonitoring) {
    console.log('Connection monitoring is not currently active.');
    return;
  }
  if (!currentAgent) {
    console.log(
      'Warning: No active agent, but monitoring was somehow active. Attempting to stop.'
    );
  }

  try {
    // For backward compatibility, still stop the connectionTool if it's running
    if (connectionTool) {
      connectionTool.stopMonitoring();
    }
    isMonitoring = false;
    console.log('Connection monitoring stopped.');
  } catch (error) {
    console.error('\nError stopping connection monitor:', error);
  }
}

async function initiateConnection() {
  displayHeader('Initiate Connection');
  if (!currentAgent) {
    console.log(
      'No active agent selected. Please select or register an agent first.'
    );
    return;
  }

  const targetAccountId = await question(
    "Enter the target agent's Account ID (e.g., 0.0.12345): "
  );
  if (!targetAccountId || !/^\d+\.\d+\.\d+$/.test(targetAccountId)) {
    console.log('Invalid Account ID format.');
    return;
  }

  if (targetAccountId === currentAgent.accountId) {
    console.log('Cannot connect to yourself.');
    return;
  }

  if (
    stateManager
      .listConnections()
      .some(
        (c) =>
          c.targetAccountId === targetAccountId &&
          !c.isPending &&
          !c.needsConfirmation
      )
  ) {
    console.warn(
      `You already have an established connection with ${targetAccountId}. Are you sure you want to initiate a new connection?`
    );
    const confirm = await question('(y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Connection initiation canceled.');
      return;
    }
  }

  try {
    console.log(`Initiating connection to ${targetAccountId}...`);

    const initiateConnectionTool = new InitiateConnectionTool({
      hcsClient,
      stateManager,
    });

    const result = await initiateConnectionTool.invoke({ targetAccountId });
    console.log(result);
  } catch (error) {
    console.error(
      '\nUnexpected error during connection initiation:',
      error instanceof Error ? error.message : error
    );
  }
}

async function listActiveConnections() {
  displayHeader('Active Connections');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  try {
    console.log(
      `Fetching connections for ${currentAgent.name} (${currentAgent.accountId})...`
    );

    if (!stateManager) {
      console.error('State manager is not initialized!');
      return;
    }

    // Create the ListConnectionsTool on demand with current hcsClient
    const listTool = new ListConnectionsTool({ stateManager, hcsClient });

    const connectionListOutput = await listTool.invoke({
      includeDetails: true,
      showPending: true,
    });

    console.log(connectionListOutput);
  } catch (error) {
    console.error(
      '\\nError listing connections using ListConnectionsTool:',
      error
    );
  }
}

async function manageConnectionRequests() {
  displayHeader('Manage Connection Requests');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  const manageTool = new ManageConnectionRequestsTool({
    hcsClient,
    stateManager,
  });

  const acceptTool = new AcceptConnectionRequestTool({
    hcsClient,
    stateManager,
  });

  console.log('Connection Request Management Options:');
  console.log('  1. List Pending Requests');
  console.log('  2. View Request Details');
  console.log('  3. Accept Request');
  console.log('  4. Reject Request');
  console.log('  0. Back to Main Menu');

  const choice = await question('Enter your choice: ');

  // Variables needed for request management
  let viewRequestId,
    acceptRequestId,
    rejectRequestId,
    configureFees,
    hbarFeeStr,
    exemptAccountsInput;
  let hbarFee, exemptIds;

  switch (choice.trim()) {
    case '1':
      try {
        const result = await manageTool.invoke({ action: 'list' });
        console.log(result);
      } catch (error) {
        console.error('\nError listing requests:', error);
      }
      break;

    case '2':
      viewRequestId = await question('Enter request ID to view: ');
      try {
        const result = await manageTool.invoke({
          action: 'view',
          requestKey: viewRequestId,
        });
        console.log(result);
      } catch (error) {
        console.error('\nError viewing request:', error);
      }
      break;

    case '3':
      acceptRequestId = await question('Enter request ID to accept: ');
      try {
        configureFees = await question(
          'Configure fees for this connection? (y/n): '
        );

        if (configureFees.toLowerCase() === 'y') {
          hbarFeeStr = await question('HBAR fee amount (e.g., 0.5): ');
          exemptAccountsInput = await question(
            'Exempt account IDs (comma-separated, leave blank for none): '
          );

          if (hbarFeeStr.trim()) {
            hbarFee = parseFloat(hbarFeeStr);
            if (isNaN(hbarFee) || hbarFee < 0) {
              console.log('Invalid HBAR fee amount. Fee will not be set.');
              hbarFee = undefined;
            }
          }

          if (exemptAccountsInput.trim()) {
            exemptIds = exemptAccountsInput
              .split(',')
              .map((id) => id.trim())
              .filter((id) => /^\d+\.\d+\.\d+$/.test(id));
            if (exemptIds.length === 0) {
              console.log('No valid exempt account IDs provided.');
              exemptIds = undefined;
            }
          }

          const result = await acceptTool.invoke({
            requestKey: acceptRequestId,
            hbarFee,
            exemptAccountIds: exemptIds,
          });
          console.log(result);
        } else {
          const result = await acceptTool.invoke({
            requestKey: acceptRequestId,
          });
          console.log(result);
        }
      } catch (error) {
        console.error('\nError accepting request:', error);
      }
      break;

    case '4':
      rejectRequestId = await question('Enter request ID to reject: ');
      try {
        const result = await manageTool.invoke({
          action: 'reject',
          requestKey: rejectRequestId,
        });
        console.log(result);
      } catch (error) {
        console.error('\nError rejecting request:', error);
      }
      break;

    case '0':
      return;

    default:
      console.log('Invalid choice.');
      break;
  }

  await manageConnectionRequests();
}

// --- Messaging Actions ---
async function selectConnection(
  promptMessage: string
): Promise<ActiveConnection | null> {
  // Instead of directly using stateManager.listConnections(), which might not be in sync,
  // we'll use the listConnectionsTool to ensure we have the most up-to-date connections
  if (!currentAgent) {
    console.log('No active agent selected.');
    return null;
  }

  // First refresh connections using the same tool as option 7
  try {
    // Create the ListConnectionsTool on demand with current hcsClient
    const listTool = new ListConnectionsTool({ stateManager, hcsClient });
    await listTool.invoke({
      includeDetails: false,
      showPending: true,
    });
  } catch (error) {
    console.error('Error refreshing connections:', error);
    // Continue with what we have in state, even if refresh failed
  }

  // Now get the updated list from state manager
  const currentConnections = stateManager.listConnections();
  console.log(
    `Found ${currentConnections.length} connections in state manager.`
  );

  if (currentConnections.length === 0) {
    console.log('No active connections available.');
    return null;
  }
  displayHeader('Select Connection');
  console.log(
    `Connections for ${currentAgent?.name} (${currentAgent?.accountId}):`
  );
  // Log all connections for debugging
  currentConnections.forEach((conn, index) => {
    console.log(
      `${index + 1}. To: ${conn.targetAgentName} (${conn.targetAccountId})`
    );
    console.log(`     Connection Topic: ${conn.connectionTopicId}`);
    // Determine status in a more readable way without nested ternary
    let statusDisplay = conn.status || 'unknown';
    if (conn.isPending) {
      statusDisplay = 'pending';
    } else if (conn.needsConfirmation) {
      statusDisplay = 'needs confirmation';
    } else if (!statusDisplay || statusDisplay === 'unknown') {
      statusDisplay = 'established';
    }
    console.log(`     Status: ${statusDisplay}`);
  });

  const choice = await question(promptMessage);
  const index = parseInt(choice) - 1;

  if (isNaN(index) || index < 0 || index >= currentConnections.length) {
    console.log('Invalid choice.');
    return null;
  }
  return currentConnections[index];
}

async function sendMessageToConnection() {
  displayHeader('Send Message');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }
  const connection = await selectConnection(
    'Select connection to send message to: '
  );
  if (!connection) {
    console.log('Invalid connection selection.');
    return;
  }

  const messageContent = await question('Enter message content: ');
  if (!messageContent) {
    console.log('Message cannot be empty.');
    return;
  }

  try {
    console.log(`Sending message to ${connection.targetAgentName}...`);
    const sendMessageToConnectionTool = new SendMessageToConnectionTool({
      hcsClient,
      stateManager,
    });
    const result = await sendMessageToConnectionTool.invoke({
      targetIdentifier: connection.targetAccountId,
      message: messageContent,
    });

    console.log(result);
  } catch (error) {
    console.error(
      '\nUnexpected error sending message:',
      error instanceof Error ? error.message : error
    );
  }
}

async function viewMessagesFromConnection() {
  displayHeader('View Incoming Messages');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }
  const connection = await selectConnection(
    'Select connection to view messages from: '
  );
  if (!connection) {
    console.log('Invalid connection selection.');
    return;
  }

  try {
    console.log(`Checking for messages from ${connection.targetAgentName}...`);
    const checkMessagesTool = new CheckMessagesTool({
      hcsClient,
      stateManager,
    });
    const result = await checkMessagesTool.invoke({
      targetIdentifier: connection.targetAccountId,
      lastMessagesCount: 10,
    });

    console.log(result);
  } catch (error) {
    console.error(
      '\nUnexpected error checking messages:',
      error instanceof Error ? error.message : error
    );
  }
}

async function listUnapprovedConnectionRequests() {
  displayHeader('Unapproved Connection Requests');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  try {
    console.log(
      `Fetching unapproved connection requests for ${currentAgent.name} (${currentAgent.accountId})...`
    );

    if (!stateManager) {
      console.error('State manager is not initialized!');
      return;
    }

    const listTool = new ListUnapprovedConnectionRequestsTool({
      stateManager,
      hcsClient,
    });

    const requestsOutput = await listTool.invoke({});
    console.log(requestsOutput);
  } catch (error) {
    console.error('\nError listing unapproved connection requests:', error);
  }
}

// --- Main Menu Loop ---
async function showMenu() {
  console.log('\n============ HCS-10 CLI Demo ============');
  console.log(
    `Active Agent: ${
      currentAgent
        ? `${currentAgent.name} (${currentAgent.accountId})`
        : 'None Selected'
    }`
  );
  console.log(`Monitoring Status: ${isMonitoring ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(
    `Plugin System: ${pluginRegistry ? 'INITIALIZED' : 'NOT INITIALIZED'}`
  );
  console.log('-----------------------------------------');
  console.log('Agent Management:');
  console.log('  1. Register New Agent');
  console.log('  2. List Managed Agents (This Session)');
  console.log('  3. Select Active Agent');
  console.log('-----------------------------------------');
  console.log('Connection Management:');
  console.log('  4. Start Monitoring Incoming Connections (for Active Agent)');
  console.log('  5. Stop Monitoring Incoming Connections');
  console.log('  6. Initiate Connection to Another Agent');
  console.log('  7. List Active Connections (for Active Agent)');
  console.log('  10. Manage Connection Requests');
  console.log('  11. Accept Connection Request (Direct)');
  console.log('  12. List Unapproved Connection Requests');
  console.log('-----------------------------------------');
  console.log('Messaging:');
  console.log('  8. Send Message to Active Connection');
  console.log('  9. View Incoming Messages from Active Connection');
  console.log('-----------------------------------------');
  console.log('Plugin System:');
  console.log('  13. Use Plugin Tool');
  console.log('  14. Send Weather Report via Message');
  console.log('-----------------------------------------');
  console.log('  0. Exit');
  console.log('=========================================');

  const choice = await question('Enter your choice: ');

  switch (choice.trim()) {
    case '1':
      await registerNewAgent();
      break;
    case '2':
      await listManagedAgents();
      break;
    case '3':
      await selectActiveAgent();
      break;
    case '4':
      await startMonitoringConnections();
      break;
    case '5':
      await stopMonitoringConnections();
      break;
    case '6':
      await initiateConnection();
      break;
    case '7':
      await listActiveConnections();
      break;
    case '8':
      await sendMessageToConnection();
      break;
    case '9':
      await viewMessagesFromConnection();
      break;
    case '10':
      await manageConnectionRequests();
      break;
    case '11':
      await acceptConnectionRequest();
      break;
    case '12':
      await listUnapprovedConnectionRequests();
      break;
    case '13':
      await usePluginTool();
      break;
    case '14':
      await sendWeatherReportViaMessage();
      break;
    case '0':
      console.log('Exiting demo...');
      if (isMonitoring) {
        console.log('Stopping connection monitoring...');
        connectionTool.stopMonitoring();
        isMonitoring = false;
      }
      rl.close();
      return; // Stop loop
    default:
      console.log('Invalid choice. Please try again.');
      break;
  }
  // Show menu again unless exiting
  await showMenu();
}

let initResult: {
  hcs10Client: HCS10Client;
  tools: Partial<HCS10Tools>;
  stateManager: IStateManager;
};

async function usePluginTool() {
  displayHeader('Use Plugin Tool');

  if (!pluginRegistry) {
    console.log(
      'Plugin system not initialized. Please initialize it first (option 13).'
    );
    return;
  }

  const tools = pluginRegistry.getAllTools();

  if (tools.length === 0) {
    console.log(
      'No plugin tools available. Load plugins first (options 15-16).'
    );
    return;
  }

  // Display available tools
  console.log('Available tools:');
  tools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name}: ${tool.description}`);
  });

  // Let user select a tool
  const toolChoice = await question('Select a tool (enter number): ');
  const toolIndex = parseInt(toolChoice) - 1;

  if (isNaN(toolIndex) || toolIndex < 0 || toolIndex >= tools.length) {
    console.log('Invalid tool selection.');
    return;
  }

  const selectedTool = tools[toolIndex];
  console.log(`\nSelected tool: ${selectedTool.name}`);
  console.log(`Description: ${selectedTool.description}`);

  // Handle different tools with specific parameter prompts
  try {
    let result;

    if (selectedTool.name === 'get_current_weather') {
      const location = await question('Enter location (e.g., London, UK): ');
      const unit = await question(
        'Enter temperature unit (celsius/fahrenheit): '
      );

      result = await selectedTool.invoke({
        location,
        unit: unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      });
    } else if (selectedTool.name === 'get_weather_forecast') {
      const location = await question('Enter location (e.g., London, UK): ');
      const daysStr = await question('Enter number of days (1-7): ');
      const unit = await question(
        'Enter temperature unit (celsius/fahrenheit): '
      );

      const days = parseInt(daysStr);

      result = await selectedTool.invoke({
        location,
        days: isNaN(days) ? 3 : days,
        unit: unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      });
    } else if (selectedTool.name === 'get_token_price') {
      const tokenId = await question('Enter token ID (e.g., 0.0.1234): ');

      result = await selectedTool.invoke({
        tokenId,
      });
    } else if (selectedTool.name === 'swap_tokens') {
      const fromTokenId = await question(
        'Enter source token ID (e.g., 0.0.1234): '
      );
      const toTokenId = await question(
        'Enter destination token ID (e.g., 0.0.5678): '
      );
      const amountStr = await question('Enter amount to swap: ');

      const amount = parseFloat(amountStr);

      result = await selectedTool.invoke({
        fromTokenId,
        toTokenId,
        amount: isNaN(amount) ? 1 : amount,
      });
    } else if (selectedTool.name === 'check_token_balance') {
      const tokenId = await question('Enter token ID (e.g., 0.0.1234): ');
      const accountId = await question(
        'Enter account ID (optional, press Enter to use current agent): '
      );

      result = await selectedTool.invoke({
        tokenId,
        accountId: accountId.trim() || undefined,
      });
    } else {
      console.log(
        'This tool requires custom parameters that are not supported in this demo.'
      );
      return;
    }

    console.log('\nResult:');
    console.log(result);
  } catch (error) {
    console.error('Error using tool:', error);
  }
}

// --- Weather-Messaging Integration ---
async function sendWeatherReportViaMessage() {
  displayHeader('Send Weather Report via Message');

  if (!currentAgent) {
    console.log('No active agent selected. Please select an agent first.');
    return;
  }

  if (!pluginRegistry) {
    console.log('Plugin system not initialized. Please try again.');
    return;
  }

  // Check for active connections
  // First refresh connections using ListConnectionsTool
  try {
    const listTool = new ListConnectionsTool({ stateManager, hcsClient });
    await listTool.invoke({
      includeDetails: false,
      showPending: true,
    });
  } catch (error) {
    console.error('Error refreshing connections:', error);
    // Continue with what we have in state, even if refresh failed
  }

  // Now get the updated list from state manager
  const connections = stateManager.listConnections();
  if (!connections || connections.length === 0) {
    console.log(
      'No active connections available. Please establish a connection first (option 6).'
    );
    return;
  }

  // Display available connections
  console.log('Available connections:');
  connections.forEach((conn, index) => {
    console.log(`${index + 1}. ${conn.targetAccountId} (${conn.status})`);
  });

  // Let user select a connection
  const connChoice = await question(
    'Select a connection to send weather report to (enter number): '
  );
  const connIndex = parseInt(connChoice) - 1;

  if (isNaN(connIndex) || connIndex < 0 || connIndex >= connections.length) {
    console.log('Invalid connection selection.');
    return;
  }

  const selectedConnection = connections[connIndex];
  console.log(`\nSelected connection: ${selectedConnection.targetAccountId}`);

  // Get weather tools from plugin registry
  const weatherTools = pluginRegistry
    .getAllTools()
    .filter(
      (tool) =>
        tool.name === 'get_current_weather' ||
        tool.name === 'get_weather_forecast'
    );

  if (weatherTools.length === 0) {
    console.log(
      'Weather tools not available. Please check plugin initialization.'
    );
    return;
  }

  // Let user choose between current weather and forecast
  console.log('\nWeather report options:');
  console.log('1. Current Weather');
  console.log('2. Weather Forecast');

  const reportChoice = await question('Select report type (enter number): ');

  let weatherTool;
  if (reportChoice === '1') {
    weatherTool = weatherTools.find(
      (tool) => tool.name === 'get_current_weather'
    );
  } else if (reportChoice === '2') {
    weatherTool = weatherTools.find(
      (tool) => tool.name === 'get_weather_forecast'
    );
  } else {
    console.log('Invalid report type selection.');
    return;
  }

  if (!weatherTool) {
    console.log('Selected weather tool not available.');
    return;
  }

  // Get location from user
  const location = await question('Enter location (e.g., London, UK): ');
  const unit = await question('Enter temperature unit (celsius/fahrenheit): ');

  try {
    let weatherReport;

    // Get weather data based on selected tool
    if (weatherTool.name === 'get_current_weather') {
      weatherReport = await weatherTool.invoke({
        location,
        unit: unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      });
    } else {
      const daysStr = await question(
        'Enter number of days for forecast (1-7): '
      );
      const days = parseInt(daysStr);

      weatherReport = await weatherTool.invoke({
        location,
        days: isNaN(days) ? 3 : days,
        unit: unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
      });
    }

    // Prepare message with weather report
    const messageText = `🌤️ Weather Report 🌤️\n\n${weatherReport}\n\nSent from HCS-10 CLI Demo using the Weather Plugin`;

    console.log('\nSending the following weather report:');
    console.log('-----------------------------------');
    console.log(messageText);
    console.log('-----------------------------------');

    // Confirm before sending
    const confirm = await question('Send this weather report? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Weather report sending cancelled.');
      return;
    }

    // Send the message
    const sendMessageToConnectionTool = new SendMessageToConnectionTool({
      hcsClient,
      stateManager,
    });

    await sendMessageToConnectionTool.invoke({
      targetIdentifier: selectedConnection.targetAccountId,
      message: messageText,
    });

    console.log('Weather report sent successfully!');
  } catch (error) {
    console.error('Error sending weather report:', error);
  }
}

// --- Initialization and Start ---
async function main() {
  console.log('Initializing HCS10 client...');
  try {
    // Initialize state manager with TODD as the default prefix
    stateManager = new OpenConvaiState();
    console.log('State manager initialized with default prefix: TODD');

    initResult = initializeHCS10Client({
      stateManager: stateManager,
      clientConfig: {
        operatorId: process.env.HEDERA_OPERATOR_ID,
        operatorKey: process.env.HEDERA_OPERATOR_PRIVATE_KEY,
      },
    });

    hcsClient = initResult.hcs10Client;
    // Ensure connectionTool exists before assignment
    if (!initResult.tools.connectionTool) {
      throw new Error('ConnectionTool failed to initialize.');
    }
    connectionTool = initResult.tools.connectionTool;

    // Explicitly initialize the ConnectionsManager
    stateManager.initializeConnectionsManager(hcsClient.standardClient);
    console.log('ConnectionsManager initialized with current client');

    // Initialize our ConnectionMonitorTool with the client
    connectionMonitorTool = new ConnectionMonitorTool({
      hcsClient: hcsClient,
      stateManager: stateManager,
    });

    console.log('Client initialized successfully.');

    // Load all known agents from environment variables
    const knownPrefixes = (process.env.KNOWN_AGENT_PREFIXES || 'TODD')
      .split(',')
      .map((prefix) => prefix.trim())
      .filter((prefix) => prefix.length > 0);

    console.log(
      `Found ${knownPrefixes.length} known agent prefixes: ${knownPrefixes.join(
        ', '
      )}`
    );

    for (const prefix of knownPrefixes) {
      const agent = await loadAgentFromEnv(prefix);
      if (agent) {
        registeredAgents.push(agent);
        console.log(`Loaded agent: ${agent.name} (${agent.accountId})`);
      }
    }

    // Prompt the user to select an agent to use
    if (registeredAgents.length > 0) {
      console.log('\nSelect an agent to use:');
      currentAgent = await promptSelectAgent();

      if (currentAgent) {
        console.log(
          `Selected agent: ${currentAgent.name} (${currentAgent.accountId})`
        );

        // Reconfigure client for the selected agent
        hcsClient = new HCS10Client(
          currentAgent.accountId,
          currentAgent.operatorPrivateKey,
          hcsClient.getNetwork(),
          {
            useEncryption: false,
            registryUrl: process.env.REGISTRY_URL || 'https://moonscape.tech',
          }
        );

        // Update the state manager and tools with the selected agent
        stateManager.setCurrentAgent(currentAgent);

        // Re-initialize the ConnectionsManager with the new client
        stateManager.initializeConnectionsManager(hcsClient.standardClient);
        console.log('ConnectionsManager re-initialized with selected agent');

        // Recreate connection tools with the new client
        connectionTool = new ConnectionTool({
          client: hcsClient,
          stateManager: stateManager,
        });

        connectionMonitorTool = new ConnectionMonitorTool({
          hcsClient: hcsClient,
          stateManager: stateManager,
        });

        console.log('Client and tools reconfigured for the selected agent.');
      } else {
        console.log(
          'No agent selected. Please register or select an agent before using connection features.'
        );
      }
    } else {
      console.log('No agents found. Please register a new agent.');
    }

    // Automatically initialize plugin system
    try {
      console.log('\nAutomatically initializing plugin system...');

      // Load Weather API key from environment with better error handling
      const weatherApiKey = process.env.WEATHER_API_KEY;

      // Create plugin context with explicit environment variable handling
      pluginContext = {
        client: hcsClient,
        logger: new Logger({
          module: 'WeatherPlugin',
        }),
        config: {
          weatherApiKey: weatherApiKey,
        },
      };

      // Initialize plugin registry
      pluginRegistry = new PluginRegistry(pluginContext);

      // Load and register plugins
      const weatherPlugin = new WeatherPlugin();
      const defiPlugin = new DeFiPlugin();
      const hbarPricePlugin = new HbarPricePlugin();

      await pluginRegistry.registerPlugin(weatherPlugin);
      await pluginRegistry.registerPlugin(defiPlugin);
      await pluginRegistry.registerPlugin(hbarPricePlugin);

      console.log('Plugin system initialized successfully!');
      console.log(
        'Weather, DeFi, and HBAR Price plugins loaded automatically.'
      );

      if (!weatherApiKey) {
        console.log(
          '\nWARNING: Weather API key not found in environment variables.'
        );
        console.log(
          'To use the Weather plugin, add the following to your .env file:'
        );
        console.log('WEATHER_API_KEY=your_api_key_from_weatherapi.com');
        console.log(
          'You can get a free API key from https://www.weatherapi.com/'
        );
      } else {
        console.log(
          `Weather API key loaded successfully from environment variables.`
        );
      }
    } catch (error) {
      console.error('Error initializing plugin system:', error);
      console.log('Continuing without plugin functionality.');
    }

    await showMenu();
  } catch (error) {
    console.error('Failed to initialize HCS10 client:', error);
    rl.close();
  }
}

async function acceptConnectionRequest() {
  displayHeader('Accept Connection Request');
  if (!currentAgent) {
    console.log('No active agent selected.');
    return;
  }

  const manageTool = new ManageConnectionRequestsTool({
    hcsClient,
    stateManager,
  });

  const acceptTool = new AcceptConnectionRequestTool({
    hcsClient,
    stateManager,
  });

  try {
    console.log('Current pending requests:');
    const listResult = await manageTool.invoke({ action: 'list' });
    console.log(listResult);

    if (listResult.includes('No pending connection requests found')) {
      console.log('No requests to accept.');
      return;
    }

    const requestKey = await question('Enter request key to accept: ');

    interface FeeParams {
      requestKey: string;
      defaultCollectorAccount?: string;
      hbarFees?: Array<{
        amount: number;
        collectorAccount?: string;
      }>;
      tokenFees?: Array<{
        amount: number;
        tokenId: string;
        collectorAccount?: string;
      }>;
      exemptAccountIds?: string[];
    }

    const feeParams: FeeParams = { requestKey };
    const configureFees = await question(
      'Configure fees for this connection? (y/n): '
    );

    if (configureFees.toLowerCase() === 'y') {
      const hbarFees: Array<{
        amount: number;
        collectorAccount?: string;
      }> = [];
      const tokenFees: Array<{
        amount: number;
        tokenId: string;
        collectorAccount?: string;
      }> = [];
      let defaultCollectorAccount = '';

      // Configure default collector account (optional)
      const configureDefaultCollector = await question(
        'Configure default collector account? (y/n): '
      );
      if (configureDefaultCollector.toLowerCase() === 'y') {
        defaultCollectorAccount = await question(
          'Default collector account ID (leave blank for agent account): '
        );
        if (defaultCollectorAccount.trim()) {
          feeParams.defaultCollectorAccount = defaultCollectorAccount.trim();
        }
      }

      // Configure HBAR fees (can have multiple)
      const configureHbarFees = await question('Configure HBAR fees? (y/n): ');
      if (configureHbarFees.toLowerCase() === 'y') {
        let addMore = true;

        while (addMore) {
          const hbarFeeStr = await question('HBAR fee amount: ');
          if (hbarFeeStr.trim()) {
            const amount = parseFloat(hbarFeeStr);
            if (isNaN(amount) || amount <= 0) {
              console.log('Invalid HBAR fee amount. Fee will not be added.');
            } else {
              const fee: { amount: number; collectorAccount?: string } = {
                amount,
              };

              const collectorAccount = await question(
                'Collector account ID (leave blank for default): '
              );
              if (collectorAccount.trim()) {
                fee.collectorAccount = collectorAccount.trim();
              }

              hbarFees.push(fee);
              console.log(
                `Added HBAR fee: ${amount} HBAR${
                  fee.collectorAccount ? ` to ${fee.collectorAccount}` : ''
                }`
              );
            }
          }

          const addMoreResponse = await question(
            'Add another HBAR fee? (y/n): '
          );
          addMore = addMoreResponse.toLowerCase() === 'y';
        }

        if (hbarFees.length > 0) {
          feeParams.hbarFees = hbarFees;
        }
      }

      // Configure token fees (can have multiple)
      const configureTokenFees = await question(
        'Configure token fees? (y/n): '
      );
      if (configureTokenFees.toLowerCase() === 'y') {
        let addMore = true;

        while (addMore) {
          const tokenIdStr = await question('Token ID (e.g., 0.0.12345): ');

          if (tokenIdStr.trim() && /^\d+\.\d+\.\d+$/.test(tokenIdStr.trim())) {
            const tokenAmountStr = await question('Token amount per message: ');
            const amount = parseFloat(tokenAmountStr);

            if (isNaN(amount) || amount <= 0) {
              console.log('Invalid token amount. Token fee will not be added.');
            } else {
              const fee: {
                amount: number;
                tokenId: string;
                collectorAccount?: string;
              } = {
                amount,
                tokenId: tokenIdStr.trim(),
              };

              const collectorAccount = await question(
                'Collector account ID (leave blank for default): '
              );
              if (collectorAccount.trim()) {
                fee.collectorAccount = collectorAccount.trim();
              }

              tokenFees.push(fee);
              console.log(
                `Added token fee: ${amount} of token ${tokenIdStr}${
                  fee.collectorAccount ? ` to ${fee.collectorAccount}` : ''
                }`
              );
            }
          } else {
            console.log(
              'Invalid token ID format. Token fee will not be added.'
            );
          }

          const addMoreResponse = await question(
            'Add another token fee? (y/n): '
          );
          addMore = addMoreResponse.toLowerCase() === 'y';
        }

        if (tokenFees.length > 0) {
          feeParams.tokenFees = tokenFees;
        }
      }

      // Configure exempt account IDs (applies to both fee types)
      const configureExemptIds = await question(
        'Configure exempt accounts? (y/n): '
      );
      if (configureExemptIds.toLowerCase() === 'y') {
        const exemptAccountsInput = await question(
          'Exempt account IDs (comma-separated, leave blank for none): '
        );

        if (exemptAccountsInput.trim()) {
          const exemptIds = exemptAccountsInput
            .split(',')
            .map((id) => id.trim())
            .filter((id) => /^\d+\.\d+\.\d+$/.test(id));

          if (exemptIds.length === 0) {
            console.log('No valid exempt account IDs provided.');
          } else {
            feeParams.exemptAccountIds = exemptIds;
          }
        }
      }

      // Show fee summary
      console.log('\nFee configuration summary:');
      if (feeParams.defaultCollectorAccount) {
        console.log(
          `- Default collector: ${feeParams.defaultCollectorAccount}`
        );
      }
      if (feeParams.hbarFees && feeParams.hbarFees.length > 0) {
        console.log('- HBAR fees:');
        feeParams.hbarFees.forEach((fee) => {
          console.log(
            `  - ${fee.amount} HBAR${
              fee.collectorAccount ? ` to ${fee.collectorAccount}` : ''
            }`
          );
        });
      }
      if (feeParams.tokenFees && feeParams.tokenFees.length > 0) {
        console.log('- Token fees:');
        feeParams.tokenFees.forEach((fee) => {
          console.log(
            `  - ${fee.amount} of token ${fee.tokenId}${
              fee.collectorAccount ? ` to ${fee.collectorAccount}` : ''
            }`
          );
        });
      }
      if (feeParams.exemptAccountIds && feeParams.exemptAccountIds.length > 0) {
        console.log(
          `- Exempt accounts: ${feeParams.exemptAccountIds.join(', ')}`
        );
      }
      if (!feeParams.hbarFees && !feeParams.tokenFees) {
        console.log('- No fees configured');
      }

      const confirmFees = await question(
        'Proceed with this fee configuration? (y/n): '
      );
      if (confirmFees.toLowerCase() !== 'y') {
        console.log(
          'Fee configuration canceled. Connection request will not be accepted.'
        );
        return;
      }

      const result = await acceptTool.invoke(feeParams);
      console.log(result);
    } else {
      const result = await acceptTool.invoke({ requestKey });
      console.log(result);
    }
  } catch (error) {
    console.error('\nError accepting connection request:', error);
  }
}

// Helper function to load an agent from environment variables with a specified prefix
async function loadAgentFromEnv(
  prefix: string
): Promise<RegisteredAgent | null> {
  const accountId = process.env[`${prefix}_ACCOUNT_ID`];
  const privateKey = process.env[`${prefix}_PRIVATE_KEY`];
  const inboundTopicId = process.env[`${prefix}_INBOUND_TOPIC_ID`];
  const outboundTopicId = process.env[`${prefix}_OUTBOUND_TOPIC_ID`];
  const profileTopicId = process.env[`${prefix}_PROFILE_TOPIC_ID`]; // Optional

  if (!accountId || !privateKey || !inboundTopicId || !outboundTopicId) {
    console.log(`Incomplete agent details for prefix ${prefix}, skipping.`);
    return null;
  }

  return {
    name: `${prefix} Agent`,
    accountId,
    inboundTopicId,
    outboundTopicId,
    profileTopicId,
    operatorPrivateKey: privateKey,
  };
}

// Function to prompt the user to select an agent from the loaded agents
async function promptSelectAgent(): Promise<RegisteredAgent | null> {
  if (registeredAgents.length === 0) {
    console.log('No agents available. Please register a new agent.');
    return null;
  }

  if (registeredAgents.length === 1) {
    console.log(
      `Auto-selecting the only available agent: ${registeredAgents[0].name}`
    );
    return registeredAgents[0];
  }

  await listManagedAgents();

  const choice = await question(
    'Enter the number of the agent to use (or press Enter to skip): '
  );

  if (!choice.trim()) {
    console.log(
      'No agent selected. You can register a new one or select one later.'
    );
    return null;
  }

  const index = parseInt(choice) - 1;
  if (isNaN(index) || index < 0 || index >= registeredAgents.length) {
    console.log('Invalid choice. No agent selected.');
    return null;
  }

  return registeredAgents[index];
}

// Helper function to update KNOWN_AGENT_PREFIXES in the .env file
async function addPrefixToKnownAgents(prefix: string): Promise<void> {
  const envFilePath = '.env';
  const currentPrefixes = process.env.KNOWN_AGENT_PREFIXES || '';

  // Split by comma, filter empty entries, add new prefix if not already there
  const prefixList = currentPrefixes
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (!prefixList.includes(prefix)) {
    prefixList.push(prefix);

    // Update the env file with the new list
    await updateEnvFile(envFilePath, {
      KNOWN_AGENT_PREFIXES: prefixList.join(','),
    });

    console.log(`Added ${prefix} to known agent prefixes.`);
  }
}

// Modified registerNewAgent function (changes at the end)
async function registerNewAgent() {
  displayHeader('Register New Agent');
  const name = await question('Enter agent name: ');
  const description = await question('Enter agent description (optional): ');
  const model = await question(
    'Enter agent model identifier (optional, e.g., gpt-4o): '
  );

  if (!name) {
    console.error('Agent name is required.');
    return;
  }

  // Display capabilities and let user select
  displayCapabilities();
  console.log(
    '\nSelect capabilities (comma-separated numbers, e.g., "0,4,7"): '
  );
  const capabilitiesInput = await question('> ');
  let capabilities: number[] | undefined = undefined;
  try {
    if (capabilitiesInput.trim()) {
      capabilities = capabilitiesInput.split(',').map((num) => {
        const parsed = parseInt(num.trim(), 10);
        if (isNaN(parsed) || parsed < 0 || parsed > 18) {
          throw new Error(`Invalid capability number: ${num.trim()}`);
        }
        return parsed;
      });
      if (capabilities.length === 0) {
        console.log('No valid capabilities selected, using tool default.');
        capabilities = undefined; // Let tool default if empty after parse
      }
    } else {
      console.log('Using tool default capabilities (TEXT_GENERATION).');
      capabilities = undefined; // Explicitly undefined to use default
    }
  } catch (error) {
    console.error(
      `Error parsing capabilities: ${
        error instanceof Error ? error.message : error
      }`
    );
    console.log('Using tool default capabilities (TEXT_GENERATION).');
    capabilities = undefined;
  }

  console.log(
    `Selected capabilities: ${
      capabilities ? capabilities.join(', ') : 'Default'
    }`
  );

  // --- ADDED PROFILE PICTURE PROMPT ---
  const profilePictureInput = await question(
    'Enter profile picture path or URL (optional, e.g., todd.svg or https://example.com/pfp.png): '
  );
  // --- END ADDED PROFILE PICTURE PROMPT ---

  // Handle fee configuration
  const feeConfig = await promptForFeesConfiguration();

  // Environment variable persistence configuration - Simplified Prompt
  console.log('\nConfigure environment variable persistence:');
  const prefixInput = await question(
    'Enter prefix for environment variables (e.g., DAVE, AGENT - leave blank for default TODD): '
  ); // No trailing space here

  let persistence: { prefix?: string } | undefined = undefined;
  const customPrefix = prefixInput.trim();

  if (customPrefix) {
    persistence = { prefix: customPrefix };
    console.log(`Environment variables will use the prefix: ${customPrefix}`);
  } else {
    console.log('Using default prefix: TODD');
    // No need to set persistence object, tool/stateManager uses default
  }

  // Modified section to fix linter error and update known prefixes
  // Note: Not keeping originalHCSClient since we don't restore it
  hcsClient = initResult.hcs10Client;

  // --- Use RegisterAgentTool ---
  try {
    console.log(
      `\nRegistering agent "${name}" using RegisterAgentTool... this may take several minutes.`
    );

    const registerTool = new RegisterAgentTool(hcsClient, stateManager);

    // Resolve local profile picture path
    let resolvedPfpInput: string | undefined = undefined;
    if (profilePictureInput) {
      const isUrl =
        profilePictureInput.startsWith('http://') ||
        profilePictureInput.startsWith('https://');
      if (isUrl) {
        resolvedPfpInput = profilePictureInput;
      } else {
        // Assume local path, resolve relative to project root
        resolvedPfpInput = path.join(projectRoot, profilePictureInput);
        console.log(`Resolved local profile picture path: ${resolvedPfpInput}`);
      }
    }

    // Prepare input based on tool schema
    const toolInput: Record<string, unknown> = {
      name,
      description,
      model,
      capabilities,
      profilePicture: resolvedPfpInput,
    };

    if (feeConfig) {
      toolInput.feeCollectorAccountId =
        feeConfig.defaultCollectorAccountId || undefined;
      toolInput.hbarFees =
        feeConfig.hbarFees.length > 0 ? feeConfig.hbarFees : undefined;
      toolInput.tokenFees =
        feeConfig.tokenFees.length > 0 ? feeConfig.tokenFees : undefined;
      toolInput.exemptAccountIds =
        feeConfig.exemptAccountIds.length > 0
          ? feeConfig.exemptAccountIds
          : undefined;
    }

    if (persistence && persistence.prefix) {
      toolInput.persistence = persistence;
    }

    // Invoke the tool
    const resultString = await registerTool.invoke(toolInput);

    // Process the result string
    try {
      const result = JSON.parse(resultString);

      if (
        result.success &&
        result.accountId &&
        result.privateKey &&
        result.inboundTopicId &&
        result.outboundTopicId
      ) {
        const newAgent: RegisteredAgent = {
          name: result.name,
          accountId: result.accountId,
          inboundTopicId: result.inboundTopicId,
          outboundTopicId: result.outboundTopicId,
          profileTopicId:
            result.profileTopicId !== 'N/A' ? result.profileTopicId : undefined,
          operatorPrivateKey: result.privateKey,
        };

        registeredAgents.push(newAgent);
        console.log('\nRegistration Successful!');
        console.log(result.message || resultString);
        displayAgentInfo(newAgent);

        // If user specified a custom prefix, add it to KNOWN_AGENT_PREFIXES in .env
        if (persistence && persistence.prefix) {
          await addPrefixToKnownAgents(persistence.prefix);
        } else {
          // Add the default prefix if not already in the list
          await addPrefixToKnownAgents('TODD');
        }

        // Automatically select the newly registered agent if it's the first one
        if (registeredAgents.length === 1) {
          currentAgent = newAgent;
          // Reconfigure client and tools for the new agent
          hcsClient = new HCS10Client(
            currentAgent.accountId,
            currentAgent.operatorPrivateKey,
            hcsClient.getNetwork(),
            {
              useEncryption: false,
              registryUrl: process.env.REGISTRY_URL || 'https://moonscape.tech',
            }
          );
          connectionTool = new ConnectionTool({
            client: hcsClient,
            stateManager,
          });
          connectionMonitorTool.updateClient(hcsClient);
          stateManager.setCurrentAgent(currentAgent);
          console.log(
            `\nAgent "${currentAgent.name}" automatically selected as active agent.`
          );
          console.log('Client and tools reconfigured.');
        } else {
          // Ask if they want to switch to the new agent
          const switchToNew = await question(
            'Would you like to switch to this new agent? (y/n): '
          );
          if (switchToNew.toLowerCase().startsWith('y')) {
            currentAgent = newAgent;
            // Reconfigure client and tools for the new agent
            hcsClient = new HCS10Client(
              currentAgent.accountId,
              currentAgent.operatorPrivateKey,
              hcsClient.getNetwork(),
              {
                useEncryption: false,
                registryUrl:
                  process.env.REGISTRY_URL || 'https://moonscape.tech',
              }
            );
            connectionTool = new ConnectionTool({
              client: hcsClient,
              stateManager,
            });
            connectionMonitorTool.updateClient(hcsClient);
            stateManager.setCurrentAgent(currentAgent);
            console.log(`\nSwitched to agent "${currentAgent.name}".`);
          } else {
            console.log('Keeping current agent selection.');
          }
        }
      } else {
        // Handle cases where parsing succeeded but registration wasn't fully successful
        console.error(
          'Registration via tool reported an issue or missing data:'
        );
        console.log(result.message || resultString);
      }
    } catch (parseError) {
      // Handle cases where the result string wasn't valid JSON (likely an error message)
      console.error('\nRegistration failed. Tool returned an error:');
      console.error(resultString);
    }
  } catch (error) {
    // Catch unexpected errors during tool instantiation or invocation
    console.error('\nError during agent registration process:', error);
  }
}

main();
