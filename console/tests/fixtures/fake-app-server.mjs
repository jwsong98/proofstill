import { createInterface } from 'node:readline';
const input = createInterface({ input: process.stdin });
let initialized = false;
function send(message) { process.stdout.write(JSON.stringify(message) + '\n'); }
input.on('line', line => {
  const message = JSON.parse(line);
  if (message.method === 'initialize') {
    if (process.argv.includes('--hang-initialize')) return;
    send({ id: message.id, result: { userAgent: 'fake-app-server' } }); return;
  }
  if (message.method === 'initialized') { initialized = true; return; }
  if (!message.method) { send({ method: 'client/response', params: message }); return; }
  if (!initialized) { send({ id: message.id, error: { code: -1, message: 'Not initialized' } }); return; }
  switch (message.method) {
    case 'echo': send({ id: message.id, result: message.params }); break;
    case 'hang': break;
    case 'exit': process.stderr.write('access_token=secret-token-value'); process.exit(9); break;
    case 'bad': process.stdout.write('not json\n'); break;
    case 'rpc-error': send({ id: message.id, error: { code: -32000, message: 'Bearer fake-secret access_token=secret-value' } }); break;
    case 'split': {
      const frame = JSON.stringify({ id: message.id, result: { split: true } }) + '\n';
      process.stdout.write(frame.slice(0, 12));
      setTimeout(() => process.stdout.write(frame.slice(12)), 10); break;
    }
    case 'out-of-order': setTimeout(() => send({ id: message.id, result: message.params }), message.params.delay); break;
    case 'notify': send({ method: 'item/agentMessage/delta', params: { delta: 'hello' } }); send({ id: message.id, result: true }); break;
    case 'ask': send({ id: message.params.id, method: message.params.method, params: { threadId: 'thread-1' } }); send({ id: message.id, result: true }); break;
    default: send({ id: message.id, result: {} });
  }
});
