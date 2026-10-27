const http = require("http");
const app = require("../templates/server");
const server = http.createServer(app);
server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  http.get(`http://127.0.0.1:${port}/health`, (response) => {
    console.log(`health status ${response.statusCode}`);
    response.resume(); response.on("end", () => server.close(() => process.exit(response.statusCode === 200 ? 0 : 1)));
  }).on("error", (error) => { console.error(error.message); server.close(() => process.exit(1)); });
});
