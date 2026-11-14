import "./config/env.js";
import http from "node:http";
import app from "./app.js";
import { initRealtime } from "./services/realtime.js";
import { connectDB } from "./config/db.js";
import { startReminderScheduler } from "./services/reminders.js";

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing. Copy .env.example to .env and set it.");
    process.exit(1);
}

// One failed background job or socket message must not take the whole server down (while it
// restarts, every visitor gets a 502). Log the problem and keep serving.
process.on("unhandledRejection", (reason) => console.error("Unhandled promise rejection:", reason?.stack || reason));
process.on("uncaughtException", (error) => console.error("Uncaught exception:", error?.stack || error));

connectDB(process.env.MONGO_URI)
    .then(() => {
        // One HTTP server for both the REST API (Express) and real-time updates (Socket.io).
        const server = http.createServer(app);
        initRealtime(server);
        // Hosting proxies (Render, etc.) reuse connections for up to a minute or more. Node closes idle
        // ones after 5 seconds by default, and a request sent down a just-closed connection comes back
        // as "502 Bad Gateway". Keeping them open longer than the proxy does prevents that.
        server.keepAliveTimeout = 120000;
        server.headersTimeout = 125000;
        server.listen(PORT, () => console.log(`CollabOS API running on http://localhost:${PORT}`));
        startReminderScheduler();
    })
    .catch((error) => {
        console.error("Could not start server:", error.message);
        process.exit(1);
    });
