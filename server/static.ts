import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  // Serve static files first
  app.use(express.static(distPath));

  // Use a middleware function instead of a path string to avoid PathError
  app.use((req, res, next) => {
    // If it's a GET request and not for an API, send index.html
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.resolve(distPath, "index.html"));
    }
    next();
  });
}
