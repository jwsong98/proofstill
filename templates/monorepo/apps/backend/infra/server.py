import argparse
import json
import os
from pathlib import Path
import sys

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from infra.app import create_app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--ready-file')
    parser.add_argument('--request-log')
    args = parser.parse_args()
    app = create_app(request_log=args.request_log)

    class Server(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets=sockets)
            if not self.started:
                return
            port = self.servers[0].sockets[0].getsockname()[1]
            ready = {'pid': os.getpid(), 'baseUrl': f'http://127.0.0.1:{port}'}
            if args.ready_file:
                output = Path(args.ready_file)
                temporary = output.with_suffix('.tmp')
                temporary.write_text(json.dumps(ready))
                temporary.replace(output)
            else:
                print(json.dumps(ready), flush=True)

    server = Server(uvicorn.Config(app, host='127.0.0.1', port=args.port,
                                  log_level='warning', access_log=False))
    app.state.shutdown = lambda: setattr(server, 'should_exit', True)
    server.run()


if __name__ == '__main__':
    main()
