import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import StringReplace from 'vite-plugin-string-replace';
import type { LibraryFormats } from 'vite';

export default defineConfig(async () => {
  const format = (process.env.BUILD_FORMAT || 'es') as LibraryFormats;
  let outputDir: string;

  if (format === 'umd') {
    outputDir = 'dist/umd';
  } else if (format === 'cjs') {
    outputDir = 'dist/cjs';
  } else {
    outputDir = 'dist/es';
  }

  const externalDependencies = [
    '@hashgraph/sdk',
    '@hashgraphonline/hedera-agent-kit',
    '@hashgraphonline/standards-sdk',
    '@langchain/community',
    '@langchain/core',
    '@langchain/openai',
    '@octokit/rest',
    'axios',
    'chromadb',
    'commander',
    'dotenv',
    'langchain',
    'libsodium-wrappers',
    'openai',
    'prompts',
    'ts-node',
    'typescript',
    'zod',
  ];

  const plugins = [
    StringReplace([
      {
        search: 'VITE_BUILD_FORMAT',
        replace: format,
      },
    ]),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts', 'examples/**/*', 'vite.config.ts'],
      outDir: outputDir,
    }),
  ];

  // Only add nodePolyfills for UMD builds
  if (format === 'umd') {
    const { nodePolyfills } = await import('vite-plugin-node-polyfills');
    plugins.push(nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }));
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        util: 'util',
      },
    },
    build: {
      outDir: outputDir,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: format === 'umd' ? 'StandardsAgentKit' : undefined,
        fileName: (fmt) =>
          `standards-agent-kit.${fmt === 'cjs' ? 'cjs' : `${fmt}.js`}`,
        formats: [format],
      },
      rollupOptions: {
        external: (id: string) => {
          if (format === 'umd') {
            return false;
          }
          return (
            externalDependencies.some(
              (dep) => id === dep || id.startsWith(`${dep}/`)
            ) ||
            (!id.startsWith('.') &&
              !id.startsWith('/') &&
              !id.includes(__dirname))
          );
        },
        output:
          format === 'cjs'
            ? {
                exports: 'named',
                format: 'cjs',
              }
            : {
                globals: (id: string) => {
                  const globalMap: Record<string, string> = {
                    '@hashgraph/sdk': 'HederaSDK',
                    '@hashgraphonline/hedera-agent-kit': 'HederaAgentKit',
                    '@hashgraphonline/standards-sdk': 'StandardsSDK',
                    '@langchain/community': 'LangchainCommunity',
                    '@langchain/core': 'LangchainCore',
                    '@langchain/openai': 'LangchainOpenAI',
                    '@octokit/rest': 'OctokitRest',
                    axios: 'Axios',
                    chromadb: 'ChromaDB',
                    commander: 'Commander',
                    dotenv: 'Dotenv',
                    langchain: 'Langchain',
                    'libsodium-wrappers': 'LibsodiumWrappers',
                    openai: 'OpenAI',
                    prompts: 'Prompts',
                    'ts-node': 'TsNode',
                    typescript: 'TypeScript',
                    zod: 'Zod',
                  };
                  return globalMap[id] || id;
                },
                preserveModules: format === 'es',
                preserveModulesRoot: format === 'es' ? 'src' : undefined,
                exports: 'named',
                inlineDynamicImports: format === 'umd',
                name: format === 'umd' ? 'StandardsAgentKit' : undefined,
              },
      },
      minify: 'terser',
      sourcemap: true,
      target: 'es2020',
    },
    define: {
      VITE_BUILD_FORMAT: JSON.stringify(format),
      ...(format === 'cjs' ? { Buffer: 'globalThis.Buffer' } : {}),
    },
    ssr: {
      noExternal: [],
      external: externalDependencies,
    },
  };
});