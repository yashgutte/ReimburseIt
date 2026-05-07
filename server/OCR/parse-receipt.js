#!/usr/bin/env node
/**
 * CLI: parse a receipt image/PDF with Gemini and print JSON to stdout.
 *
 * Usage:
 *   node server/OCR/parse-receipt.js <path-to-file> [companyCurrencyCode]
 *
 * Examples:
 *   node OCR/parse-receipt.js ./sample-receipt.png INR
 *   node OCR/parse-receipt.js /tmp/bill.pdf USD
 *
 * Requires: GEMINI_API_KEY in server/.env (load from repo root or set env).
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const {
  extractReceiptFromFile,
} = require("./extractReceipt");

async function main() {
  const fileArg = process.argv[2];
  const currencyArg = (process.argv[3] || "USD").toUpperCase();

  if (!fileArg) {
    console.error(
      "Usage: node parse-receipt.js <path-to-receipt-image-or-pdf> [companyCurrencyCode]",
    );
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg)
    ? fileArg
    : path.join(process.cwd(), fileArg);

  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";

  try {
    const out = await extractReceiptFromFile(filePath, mime, currencyArg);
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
}

main();
