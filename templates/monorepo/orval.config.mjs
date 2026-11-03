export default {
  api: {
    input: './packages/api/openapi.generated.json',
    output: {
      target: './packages/api/src/generated/client.ts', schemas: './packages/api/src/generated/models',
      client: 'fetch', mode: 'split', clean: true,
      baseUrl: { runtime: 'apiBaseUrl', imports: [{ name: 'apiBaseUrl', importPath: '../base-url' }] },
    },
  },
};
