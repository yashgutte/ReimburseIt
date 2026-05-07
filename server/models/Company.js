const { mongoose } = require("./db");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    country: { type: String, default: "" },
    currency_code: { type: String, default: "USD" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Company", companySchema);
