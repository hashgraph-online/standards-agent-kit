# Yalc Resolution Issue Analysis

## The Problem
When running `pnpm run demo:cli` from inside `standards-agent-kit`:
1. cli-demo.ts imports from `@hashgraphonline/standards-agent-plugin` ✓
2. Plugin tries to import from `@hashgraphonline/standards-agent-kit` ✗
3. Fails because we're INSIDE the kit package, so it's not resolvable by package name

## The Solution
We need to ensure the kit is resolvable as a package even when developing inside it.

## Steps to Fix
1. Remove the bad symlink
2. Rebuild kit and push to yalc
3. Install the kit FROM yalc into itself as a dev dependency
4. This creates proper module resolution