# Yalc Implementation Plan for Package Separation

## Overview
Use yalc to test the package separation locally before publishing to npm.

## Prerequisites
```bash
# Install yalc globally
npm install -g yalc
```

## Implementation Steps

### Step 1: Create Plugin Package Structure
```bash
# Create plugin package directory at same level as standards-agent-kit
cd /Users/michaelkantor/CascadeProjects/hashgraph-online
mkdir standards-agent-plugin
cd standards-agent-plugin

# Initialize package
npm init -y

# Create source structure
mkdir -p src/plugins/openconvai
mkdir -p src/types
```

### Step 2: Set Up Plugin Package.json
```json
{
  "name": "@hashgraphonline/standards-agent-plugin",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "dependencies": {
    "@hashgraphonline/standards-agent-kit": "file:../standards-agent-kit",
    "hedera-agent-kit": "^2.0.3"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  }
}
```

### Step 3: Move Plugin Code
1. Copy `OpenConvAIPlugin.ts` from standards-agent-kit to plugin package
2. Update imports to use package imports instead of relative paths
3. Create index.ts to export the plugin

### Step 4: Update Plugin Imports
```typescript
// OLD: relative imports
import { RegisterAgentTool } from '../../tools/hcs10/RegisterAgentTool';
import { HCS10Builder } from '../../builders/hcs10/hcs10-builder';

// NEW: package imports
import { 
  RegisterAgentTool,
  FindRegistrationsTool,
  InitiateConnectionTool,
  // ... other tools
  HCS10Builder,
  OpenConvaiState,
  type IStateManager
} from '@hashgraphonline/standards-agent-kit';
```

### Step 5: Build and Publish to Yalc
```bash
# In standards-agent-plugin directory
npm run build
yalc publish

# You should see: "Package @hashgraphonline/standards-agent-plugin published in store"
```

### Step 6: Update Standards Agent Kit
1. Remove OpenConvAIPlugin from standards-agent-kit/src/plugins/openconvai
2. Add plugin to devDependencies using yalc:

```bash
# In standards-agent-kit directory
yalc add @hashgraphonline/standards-agent-plugin
npm install
```

### Step 7: Update CLI Demo
```typescript
// In cli-demo.ts
// OLD
import { OpenConvAIPlugin } from '../src/plugins/openconvai/OpenConvAIPlugin';

// NEW
import { OpenConvAIPlugin } from '@hashgraphonline/standards-agent-plugin';
```

### Step 8: Test the Setup
```bash
# In standards-agent-kit directory
npm run build
npm run demo:cli
```

## Yalc Workflow Commands

### Publishing Updates
```bash
# After making changes to plugin
cd standards-agent-plugin
npm run build
yalc push  # Pushes updates to all linked projects
```

### Managing Links
```bash
# In standards-agent-kit
yalc remove @hashgraphonline/standards-agent-plugin  # Remove link
yalc add @hashgraphonline/standards-agent-plugin     # Re-add link

# Check what's linked
yalc installations show
```

### Cleanup
```bash
# Remove all yalc dependencies
yalc remove --all

# Clean yalc store
yalc installations clean
```

## Verification Steps

1. **Build Both Packages**
   - Plugin should build without errors
   - Kit should build without errors

2. **Run Tests**
   - Kit tests should pass
   - CLI demo should work

3. **Check Dependencies**
   - No circular dependency warnings
   - Plugin can import from kit
   - Kit doesn't depend on plugin (except in devDependencies)

## Troubleshooting

### If you get "Cannot find module" errors:
```bash
# Ensure plugin is built
cd standards-agent-plugin
npm run build
yalc push

# In kit, reinstall
cd standards-agent-kit
yalc remove @hashgraphonline/standards-agent-plugin
yalc add @hashgraphonline/standards-agent-plugin
npm install
```

### If you get type errors:
- Ensure tsconfig.json in plugin includes proper module resolution
- Check that all imports are from the package, not relative paths

## Next Steps After Testing

Once verified with yalc:
1. Remove yalc dependencies
2. Update package.json files for npm
3. Publish to npm registry
4. Update documentation

This approach lets us test the entire separation locally before committing to npm packages.

🦎