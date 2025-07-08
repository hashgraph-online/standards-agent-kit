# Solving the Circular Dependency Problem

## The Problem
- `standards-agent-plugin` needs to import tools from `standards-agent-kit`
- `standards-agent-kit` wants to be able to use the plugin
- This creates a circular dependency that npm cannot resolve

## The Solution: Dynamic Import Pattern

### 1. **Plugin Depends on Kit (Normal)**
```json
// standards-agent-plugin/package.json
{
  "dependencies": {
    "@hashgraphonline/standards-agent-kit": "^2.0.0"
  }
}
```

### 2. **Kit Does NOT Depend on Plugin**
```json
// standards-agent-kit/package.json
{
  "dependencies": {
    // No reference to plugin here!
  },
  "optionalDependencies": {
    // Also not here - this would still create a circular dep
  }
}
```

### 3. **Kit Loads Plugin Dynamically**

```typescript
// standards-agent-kit/src/kit/StandardsAgentKit.ts

export class StandardsAgentKit {
  private loadedPlugins: Map<string, BasePlugin> = new Map();

  /**
   * Dynamically load a plugin by package name
   * This avoids any build-time dependency
   */
  async loadPlugin(packageName: string): Promise<BasePlugin | null> {
    try {
      // Dynamic import - no dependency needed!
      const module = await import(packageName);
      
      // Get the plugin class (handle different export styles)
      const PluginClass = module.OpenConvAIPlugin || module.default || module[Object.keys(module)[0]];
      
      if (!PluginClass) {
        throw new Error(`No valid plugin class found in ${packageName}`);
      }

      // Create and initialize the plugin
      const plugin = new PluginClass();
      
      // Special handling for our plugin
      if (packageName === '@hashgraphonline/standards-agent-plugin') {
        await plugin.initialize({
          logger: this.hederaKit.logger,
          config: {
            hederaKit: this.hederaKit,
            registryUrl: this.config.registryUrl
          },
          client: {
            getNetwork: () => this.config.network || 'testnet'
          },
          stateManager: this.stateManager
        });
      }

      // Add to hedera kit
      await this.hederaKit.addPlugin(plugin);
      this.loadedPlugins.set(packageName, plugin);
      
      return plugin;
    } catch (error) {
      // Plugin not installed or other error - this is OK!
      console.warn(`Could not load plugin ${packageName}:`, error.message);
      return null;
    }
  }

  /**
   * Convenience method for loading the standards plugin
   */
  async loadStandardsPlugin(): Promise<boolean> {
    const plugin = await this.loadPlugin('@hashgraphonline/standards-agent-plugin');
    return plugin !== null;
  }
}
```

## Why This Works

1. **No Build-Time Dependency**: The kit never imports the plugin at build time
2. **Runtime Resolution**: Dynamic import happens at runtime when user calls `loadPlugin()`
3. **Graceful Failure**: If plugin isn't installed, it just returns null
4. **User Control**: User must explicitly install both packages

## Usage Patterns

### Pattern 1: Just the Tools
```bash
npm install @hashgraphonline/standards-agent-kit
```

```typescript
import { RegisterAgentTool, HCS10Builder } from '@hashgraphonline/standards-agent-kit';

// Use tools directly
const tool = new RegisterAgentTool({ ... });
```

### Pattern 2: With Plugin
```bash
npm install @hashgraphonline/standards-agent-kit @hashgraphonline/standards-agent-plugin
```

```typescript
import { StandardsAgentKit } from '@hashgraphonline/standards-agent-kit';

const kit = new StandardsAgentKit(config);
await kit.initialize();

// Load plugin dynamically
const loaded = await kit.loadStandardsPlugin();
if (loaded) {
  console.log('Plugin loaded successfully');
  const tools = kit.getTools(); // Now includes bundled tools
}
```

## Alternative Patterns (Not Recommended)

### ❌ Peer Dependencies
```json
// This still creates circular dependency!
{
  "peerDependencies": {
    "@hashgraphonline/standards-agent-plugin": "*"
  }
}
```

### ❌ Optional Dependencies
```json
// This also creates circular dependency!
{
  "optionalDependencies": {
    "@hashgraphonline/standards-agent-plugin": "^1.0.0"
  }
}
```

### ❌ Try-Catch Import
```typescript
// This creates build-time dependency!
try {
  const plugin = require('@hashgraphonline/standards-agent-plugin');
} catch (e) {
  // ...
}
```

## The Key Insight

**Dynamic import (`import()`) is the ONLY way to avoid npm seeing a dependency relationship**. This is because:

1. It's not analyzed at build time
2. It's treated as a string, not a module reference  
3. Bundlers and npm don't follow dynamic imports for dependency resolution

## Proof It Works

This pattern is used by many popular packages:
- **Next.js**: Loads plugins dynamically
- **Webpack**: Loads loaders dynamically
- **ESLint**: Loads plugins dynamically
- **Prettier**: Loads plugins dynamically

They all use the same pattern: the core package has no dependency on plugins, but can load them dynamically if they're installed.

## Implementation Checklist

- [ ] Remove ALL static imports of plugin from kit
- [ ] Implement dynamic import in `loadPlugin()` method
- [ ] Ensure plugin properly exports its class
- [ ] Test with plugin not installed (should not error)
- [ ] Test with plugin installed (should load successfully)
- [ ] Document the installation process clearly

This solves the circular dependency problem completely! 🦊