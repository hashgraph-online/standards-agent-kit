#!/bin/bash

# Set up environment
export HEDERA_OPERATOR_ID="0.0.4676767"
export HEDERA_OPERATOR_KEY="302e020100300506032b657004220420302e020100300506032b657004220420302e020100300506032b6570042204"
export KNOWN_AGENT_PREFIXES=""

# Run the CLI demo and capture output
echo "Testing CLI demo timing..."
(
  sleep 2
  echo "0" # Exit
) | timeout 15 pnpm run demo:cli 2>&1 | cat