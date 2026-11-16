// Servidor estático mínimo só para visualizar o protótipo localmente.
const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname, "..");
const porta = Number(process.env.PORT) || 5173;
const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const arquivo = path.join(raiz, url === "/" ? "index.html" : url);
  if (!arquivo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, (err, dados) => {
    if (err) { res.writeHead(404); return res.end("Não encontrado"); }
    res.writeHead(200, { "Content-Type": tipos[path.extname(arquivo)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(dados);
  });
}).listen(porta, () => console.log(`Protótipo em http://localhost:${porta}`));
