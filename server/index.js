// Node 21+ removed SlowBuffer; buffer-equal-constant-time (via jwa → jsonwebtoken) still needs it.
const _buf = require("buffer");
if (_buf.SlowBuffer === undefined) {
  _buf.SlowBuffer = _buf.Buffer;
}

require("dotenv").config();
const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const path = require("path");

const { connectDB } = require("./models/db");
const seedData = require("./seed-data");

const AuthRouter = require("./routes/AuthRouter");
const { forgotPassword } = require("./controllers/AuthController");
const { forgotPasswordValidation } = require("./middlewares/AuthMiddleware");
const AdminRouter = require("./routes/AdminRouter");
const UserRouter = require("./routes/UserRouter");
const ExpenseRouter = require("./routes/ExpenseRouter");
const ManagerRouter = require("./routes/ManagerRouter");

const app = express();

require("./models");

const PORT = process.env.PORT || 8080;

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// CORS — production origin comes from FRONTEND_URL env var (set in Render dashboard).
// Fallback to the expected Vercel URL so it works even if the env var is forgotten.
const allowedOrigins = [
  process.env.FRONTEND_URL || "https://reimburse-it.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no Origin header (same-origin, curl, mobile apps,
    // server-to-server). Without this, those requests get CORS headers
    // stripped and the browser rejects the response even though the server
    // processed it successfully — causing false "network error" toasts.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  // We send JWT via Authorization header, NOT cookies.
  // credentials:true is only needed for cookie-based auth and causes
  // stricter CORS enforcement we don't need.
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Static file serving removed — files are now stored on Cloudinary CDN

// Routes (forgot-password registered here first so it always resolves after server restarts)
app.post(
  "/api/auth/forgot-password",
  forgotPasswordValidation,
  forgotPassword,
);
app.use("/api/auth", AuthRouter);
app.use("/api/admin", AdminRouter);
app.use("/api/users", UserRouter);
app.use("/api/expenses", ExpenseRouter);
app.use("/api/manager", ManagerRouter);

// Health check
app.get("/ping", (req, res) => {
  res.json({
    message: "ReimburseIt server is running",
  });
});

// 404
app.use("*", (req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: "Internal server error",
  });
});

async function start() {
  await connectDB();

  app.listen(PORT, async () => {
    console.log(`🚀 ReimburseIt server running on port ${PORT}`);

    try {
      await seedData();
      console.log("🌱 Seed data executed");
    } catch (err) {
      console.log("⚠️ Seed skipped or failed:", err.message);
    }
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
