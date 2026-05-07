require("dotenv").config();
const bcrypt = require("bcrypt");
const { connectDB } = require("./models/db");
const { User, Company } = require("./models");

const seedData = async () => {
  // Use the real company already in the database — never create dummy data.
  const company = await Company.findOne({}).sort({ createdAt: 1 });
  if (!company) {
    console.log("⚠️  No company found in DB. Skipping admin seed.");
    return;
  }
  console.log(`🏢 Using company: "${company.name}" (${company._id})`);

  const adminEmail = "admin@gmail.com";
  const existing = await User.findOne({ email: adminEmail });

  if (existing) {
    // Only repair clearly corrupted fields — NEVER touch the password
    let dirty = false;
    if (!existing.company_id) { existing.company_id = company._id; dirty = true; }
    if (existing.role !== "admin") { existing.role = "admin"; dirty = true; }
    if (!Array.isArray(existing.roles) || !existing.roles.includes("admin")) {
      existing.roles = ["admin"]; dirty = true;
    }
    if (dirty) await existing.save();
    console.log(`👤 Admin exists: ${adminEmail} — no password changes made.`);
    return existing;
  }

  // First boot only: create admin with default password
  const password_hash = await bcrypt.hash("admin123", 12);
  const user = await User.create({
    name: "Admin User",
    email: adminEmail,
    password_hash,
    role: "admin",
    roles: ["admin"],
    company_id: company._id,
    manager_id: null,
  });
  console.log(`👤 Admin created: ${adminEmail} — default password: admin123`);
  return user;
};

module.exports = seedData;

if (require.main === module) {
  connectDB()
    .then(() => seedData())
    .then(() => { console.log("✅ Done."); process.exit(0); })
    .catch((err) => { console.error(err); process.exit(1); });
}
