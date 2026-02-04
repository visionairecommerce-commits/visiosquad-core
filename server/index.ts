/**
 * Server Entry Point
 * 
 * Starts the Express server. For testing, import from ./app.ts instead.
 */

import { startServer } from "./app";

// Re-export log for backward compatibility
export { log } from "./app";

// Start the server
startServer();
