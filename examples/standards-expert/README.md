# Standards Expert Agent

The Standards Expert Agent is a specialized AI agent that can answer questions about the Hedera Standards SDK. It uses the HCS-10 protocol to communicate with clients and provides information about how to use the Standards SDK and Standards Agent Kit.

## Features

- Uses OpenAI API for fast, reliable responses
- Focused knowledge on Hedera Standards SDK
- Answers questions about HCS-1, HCS-2, HCS-3, etc.
- Provides implementation guidance for standards
- Can fetch documentation directly from GitHub
- Self-contained with minimal external dependencies

## Prerequisites

- Node.js 18 or higher
- Hedera account and private key
- HCS topics created for inbound and outbound communication
- OpenAI API key

## Installation

```bash
# Clone the repository
git clone https://github.com/hashgraph/standards-agent-kit.git
cd standards-agent-kit

# Install dependencies
npm install
```

## Setup

```bash
# Set up the environment
npm run standards-expert setup

# Edit the .env file with your credentials and API keys
```

## Environment Variables

Create a `.env` file with the following variables:

```
# Hedera Account Information
HEDERA_ACCOUNT_ID=0.0.123456
HEDERA_PRIVATE_KEY=302e...

# Agent HCS Topics
AGENT_INBOUND_TOPIC_ID=0.0.123456
AGENT_OUTBOUND_TOPIC_ID=0.0.123457

# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Optional Configuration
# VECTOR_STORE_PATH=./vector-store
# OPENAI_MODEL=gpt-3.5-turbo
```

## Process Documentation

Before running the agent, you should process the documentation to build a vector store. You have two options:

### Option 1: Process local documentation files

```bash
# Process official HCS standards documentation from a local directory
npm run standards-expert process-docs -d path/to/standards/docs
```

### Option 2: Fetch documentation directly from GitHub (Recommended)

```bash
# Fetch and process HCS standards documentation from GitHub
npm run standards-expert process-docs -d ./docs --github
```

You can also specify a custom GitHub repository and branch:

```bash
npm run standards-expert process-docs -d ./docs --github --github-repo hashgraph-online/hcs-improvement-proposals --github-branch main
```

## Running the Agent

```bash
# Start the agent
npm run standards-expert start
```

## Using with PM2

For production deployment, you can use PM2 to keep the agent running:

```bash
# Generate PM2 ecosystem file
npm run standards-expert generate-pm2

# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js
```

## Connecting with the Agent

Other agents or clients can connect to the Standards Expert Agent using the HCS-10 protocol:

1. Find the agent in a registry or use its inbound topic ID directly
2. Send a connection request to the agent's inbound topic
3. The agent will respond with a connection acceptance and create a connection topic
4. Send questions about Hedera Standards via the connection topic
5. Receive expert responses about standards implementation and usage

## Commands

The agent CLI supports the following commands:

```bash
# Show help
npm run standards-expert help

# Start the agent
npm run standards-expert start

# Set up the environment
npm run standards-expert setup

# Process documentation (local or from GitHub)
npm run standards-expert process-docs -d /path/to/docs
npm run standards-expert process-docs -d ./docs --github

# Generate PM2 ecosystem file
npm run standards-expert generate-pm2

# Register a new agent
npm run standards-expert register -n "Standards Expert" -d "Agent that answers questions about Hedera Standards"
```

## Customization

You can customize the agent's behavior with these options:

- Change the OpenAI model (e.g., gpt-4) with the `--model` flag
- Adjust log verbosity with the `--log-level` flag
- Specify custom vector store location with the `--vector-store` flag
- Use GitHub for documentation with the `--github` flag 