const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri =
      process.env.MONGO_URI ||
      "mongodb://127.0.0.1:27017/reimburse_it";

    console.log("🔗 Connecting to MongoDB…");

    // Options that help with Atlas SRV resolution issues
    await mongoose.connect(uri, {
      // Use the newer DNS resolution if SRV fails on some networks
      family: 4, // Force IPv4 (avoids IPv6 DNS issues on some Windows setups)
    });

    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(
      "💡 Possible fixes:",
    );
    console.error(
      "   1. Whitelist your IP in Atlas → Network Access → Add Current IP (or 0.0.0.0/0)",
    );
    console.error(
      "   2. If DNS SRV fails, get the standard connection string from Atlas → Connect → Drivers",
    );
    console.error(
      "   3. Try changing your DNS to 8.8.8.8 (Google) or 1.1.1.1 (Cloudflare)",
    );
    process.exit(1);
  }
};

module.exports = { mongoose, connectDB };
