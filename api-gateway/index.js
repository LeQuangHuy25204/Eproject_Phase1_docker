const express = require("express");
const httpProxy = require("http-proxy");

const proxy = httpProxy.createProxyServer();
const app = express();

// Route requests to the auth service
app.use("/auth", (req, res) => {
  // Xóa /auth khỏi URL trước khi forward
  // VD: /auth/register -> /register
  req.url = req.url.replace(/^\/auth/, '') || '/';
  proxy.web(req, res, { target: "http://auth:3000" });
});

// Route requests to the product service
app.use("/products", (req, res) => {
  // Xóa /products khỏi URL trước khi forward
  // VD: /products/api/products -> /api/products
  req.url = req.url.replace(/^\/products/, '') || '/';
  proxy.web(req, res, { target: "http://product:3001" });
});

// Route requests to the order service
app.use("/orders", (req, res) => {
  // Xóa /orders khỏi URL trước khi forward
  // VD: /orders/buy -> /buy
  req.url = req.url.replace(/^\/orders/, '') || '/';
  proxy.web(req, res, { target: "http://order:3002" });
});

// Start the server
const port = process.env.PORT || 3003;
app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});
