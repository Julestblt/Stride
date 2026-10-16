import { createServer } from "node:http";
import { handleWorkerRequest } from "./handler";

const port = Number(process.env.COACH_WORKER_PORT ?? 3400);
const host = process.env.COACH_WORKER_HOST ?? "127.0.0.1";

const server = createServer((request, response) => {
  request.resume();
  handleWorkerRequest({
    method: request.method ?? "GET",
    path: new URL(request.url ?? "/", "http://worker").pathname,
    authorization: request.headers.authorization,
  })
    .catch(() => ({
      status: 500,
      body: { ok: false, reason: "worker_failed" },
    }))
    .then(({ status, body }) => {
      response.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(body));
    });
});

server.listen(port, host, () => {
  console.log(`stride-coach-worker listening on ${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
