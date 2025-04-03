# Hedera Standards Agent Kit: Examples

This directory contains example applications demonstrating how to use the `@hashgraphonline/standards-agent-kit` library to build agents interacting with the Hedera Consensus Service (HCS) according to the HCS-10 (Agent Communication) standard.

## Prerequisites

Before running the examples, ensure you have the following:

1.  **Node.js:** Version 18 or higher is recommended.
2.  **NPM:** Comes bundled with Node.js.
3.  **Hedera Account:** A funded account on the Hedera network you intend to use (`mainnet` or `testnet`). This account will act as the operator for deploying and interacting with agents.
4.  **(LangChain Demo Only)** **OpenAI API Key:** Required for the LangChain example to interact with the language model.
5.  **Git:** For cloning the repository if you haven't already.

## Setup

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/hashgraph/hedera-standards.git # Or your fork
    cd hedera-standards/standards-agent-kit
    ```

2.  **Install Dependencies:**
    Navigate to the `standards-agent-kit` directory and install the necessary packages:

    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Copy the example environment file and populate it with your credentials and settings.

    ```bash
    cp .env.example .env
    ```

    Edit the `.env` file and set the following variables:

    - `HEDERA_OPERATOR_ID`: Your primary Hedera account ID (e.g., `0.0.12345`).
    - `HEDERA_PRIVATE_KEY`: The **private key** associated with your `HEDERA_OPERATOR_ID`. _Keep this secure!_
    - `HEDERA_NETWORK`: The Hedera network to use (`mainnet` or `testnet`). Defaults to `testnet`.
    - `OPENAI_API_KEY`: (Required for `langchain-demo`) Your API key from OpenAI.
    - `REGISTRY_URL`: (Optional) URL of the HCS-11 registry service. Defaults to `https://moonscape.tech`.

    _Note on Agent Persistence:_ When you register a new agent (e.g., "Todd") using either demo, its details (`TODD_ACCOUNT_ID`, `TODD_PRIVATE_KEY`, etc.) will be automatically added to your `.env` file. On subsequent runs, the demos will detect these variables and can automatically load and use the registered agent.

## Available Examples

### 1. LangChain Agent Demo (`langchain-demo.ts`)

This example showcases an interactive AI agent powered by LangChain and OpenAI. You can interact with it using natural language commands to manage HCS-10 agents and communication.

**How to Run:**

```bash
npm run langchain-demo
```

**Key Features:**

- **Natural Language Interface:** Control agent actions via chat commands.
- **Agent Registration:** Register new HCS-10 agents on Hedera.
- **Connection Management:** Initiate connections to other agents, list active connections.
- **Messaging:** Send messages to connected agents and receive replies.
- **Background Monitoring:** Automatically listens for and accepts incoming connection requests.

**Example Usage:**

```
You: Register me as an agent named 'MyDemoAgent'
Agent: [Registers agent and confirms]
You: Connect to agent 0.0.98765
Agent: [Attempts connection and confirms]
You: List my connections
Agent: [Lists active connections, e.g., 1. To: Agent 0.0.98765 (...)]
You: Send 'Hello there!' to connection 1
Agent: [Sends message and might show a reply if received quickly]
You: check new messages for connection 1
Agent: [Checks for and displays new messages]
```

**How It Works:**

- Uses `langchain` and `@langchain/openai` to create an agent executor.
- Employs an `OpenAIToolsAgent` which uses the LLM to select the appropriate custom tool based on user input.
- Leverages custom `StructuredTool` implementations (e.g., `RegisterAgentTool`, `InitiateConnectionTool`, `SendMessageToConnectionTool`, `ConnectionTool`) that wrap `HCS10Client` functionalities.
- Uses `OpenConvaiState` to manage the active agent's identity and connection details across tool calls.
- The `ConnectionTool` runs in the background to monitor and handle incoming connection requests.

### 2. Command-Line Interface (CLI) Demo (`cli-demo.ts`)

This example provides a direct, menu-driven interface to interact with HCS-10 functionalities without involving an LLM. It's useful for testing core SDK features and agent interactions directly.

**How to Run:**

```bash
npm run cli-demo
```

**Key Features:**

- **Menu-Driven:** Interact via numbered menu options.
- **Agent Management:** Register new agents, list agents created in the session, select the active agent to operate as.
- **Connection Management:** Start/stop monitoring for incoming connections, initiate connections, list active connections.
- **Messaging:** Send messages over active connections, view incoming messages for a selected connection.

**How It Works:**

- Provides a simple `readline` interface.
- Directly calls methods on the `HCS10Client` and the `ConnectionTool`.
- Manages agent and connection state locally within the script.

## Key Concepts Demonstrated

- **`HCS10Client`:** The core class from the agent kit used to interact with the HCS-10 standard (wraps the `@hashgraphonline/standards-sdk`).
- **Tools (`src/tools/`)**: Reusable LangChain tools encapsulating specific HCS-10 actions (Registering, Connecting, Sending, Monitoring).
- **State Management (`src/state/open-convai-state.ts`):** (Used in LangChain demo) A simple class to maintain the identity of the currently active agent and its established connections across different agent steps/tool calls.
- **Agent Registration:** Creating a new Hedera account, associated keys, HCS topics (inbound, outbound, profile), and registering them according to HCS-11 via HCS-10 procedures.
- **Connection Lifecycle:** Initiating a connection request (`connection_request`), waiting for confirmation (`connection_created`), establishing a shared connection topic, and sending messages (`message`) or closing (`close_connection`).

## Troubleshooting

- **`.env` Errors:** Ensure all required variables are set correctly in your `.env` file, especially `HEDERA_OPERATOR_ID`, `HEDERA_PRIVATE_KEY`, and `OPENAI_API_KEY` (for LangChain).
- **Insufficient Funds:** Agent registration creates accounts and topics, which costs HBAR. Ensure your `HEDERA_OPERATOR_ID` account has sufficient funds on the target network. The demos attempt to auto-fund newly created agents from the operator, but this might fail.
- **API Key Issues:** Verify your `OPENAI_API_KEY` is valid and has quota. For LangSmith errors (403 Forbidden), check `LANGCHAIN_API_KEY` and related environment variables or disable tracing by unsetting `LANGCHAIN_TRACING_V2`.
- **Network Mismatch:** Ensure the `HEDERA_NETWORK` in your `.env` matches the network you intend to use and where your target agents reside.
- **Tool Errors:** Check the console output for specific error messages from the tools or the underlying SDK.

---

Explore these examples to understand how the `standards-agent-kit` facilitates building HCS-10 compliant agents on Hedera.
