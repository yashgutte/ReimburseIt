/**
 * Receipt field extraction via Google Gemini (multimodal).
 * Requires GEMINI_API_KEY in server/.env
 */
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { convertCurrency } = require("../utils/currencyUtils");

const ALLOWED_CATEGORIES = [
  "Food",
  "Travel",
  "Lodging",
  "Supplies",
  "Software",
  "Other",
];

function normalizeCategory(raw) {
  if (raw == null || String(raw).trim() === "") return "Other";
  const t = String(raw).trim();
  const found = ALLOWED_CATEGORIES.find(
    (c) => c.toLowerCase() === t.toLowerCase(),
  );
  return found || "Other";
}

function stripJsonFence(text) {
  let s = String(text).trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m;
  const m = s.match(fence);
  if (m) s = m[1].trim();
  return s;
}

function parseModelJson(text) {
  const cleaned = stripJsonFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("invalid json");
  }
}

const EXTRACTION_PROMPT = `You are an expert receipt and invoice reader. From the attached image or PDF, extract:

1. expenseDate — the date of the transaction or payment (not print date if different). Return as YYYY-MM-DD. If unknown, use null.
2. amount — the TOTAL amount paid (numeric only, no symbols). If multiple totals exist, use the final total. If unclear, null.
3. currencyCode — ISO 4217 three-letter code (e.g. USD, INR, EUR, GBP) shown on the receipt for that total. If not visible, null.
4. category — pick exactly one: Food, Travel, Lodging, Supplies, Software, Other (best fit from line items / merchant).
5. description — short line: merchant or vendor name + what was bought (max 200 chars).
6. remarks — short optional notes: tax/VAT line, invoice #, payment method; empty string if none.
7. detailedDescription — optional longer text: address, line items summary, or other useful text; empty string if none.

Respond with ONLY valid JSON (no markdown), shape:
{"expenseDate":"YYYY-MM-DD"|null,"amount":number|null,"currencyCode":"XXX"|null,"category":"Other","description":"","remarks":"","detailedDescription":""}`;

/**
 * @param {Buffer} buffer
 * @param {string} mimeType e.g. image/jpeg, application/pdf
 * @param {string} companyCurrencyCode ISO 4217 target for conversion
 * @returns {Promise<object>}
 */
async function extractReceiptFromBuffer(buffer, mimeType, companyCurrencyCode) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to server/.env to enable receipt scanning.",
    );
  }

  const target = (companyCurrencyCode || "USD").toUpperCase();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  });

  const base64 = Buffer.from(buffer).toString("base64");
  const inline = {
    inlineData: {
      data: base64,
      mimeType: mimeType || "application/octet-stream",
    },
  };

  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
    inline,
  ]);
  const response = result.response;
  const text = response.text();
  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  let parsed;
  try {
    parsed = parseModelJson(text);
  } catch (e) {
    console.error("Gemini JSON parse error:", text.slice(0, 500));
    throw new Error("Could not parse receipt data from AI response.");
  }

  const amount =
    parsed.amount != null && parsed.amount !== ""
      ? Number(parsed.amount)
      : null;
  const safeAmount =
    amount != null && Number.isFinite(amount) ? amount : null;

  let currencyCode =
    parsed.currencyCode != null && String(parsed.currencyCode).trim() !== ""
      ? String(parsed.currencyCode).trim().toUpperCase().slice(0, 3)
      : null;

  if (!currencyCode && safeAmount != null) {
    currencyCode = target;
  }

  let expenseDate = null;
  if (parsed.expenseDate != null && String(parsed.expenseDate).trim() !== "") {
    const d = String(parsed.expenseDate).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) expenseDate = d;
  }

  const category = normalizeCategory(parsed.category);
  const description = String(parsed.description || "").trim().slice(0, 500);
  const remarks = String(parsed.remarks || "").trim().slice(0, 1000);
  const detailedDescription = String(parsed.detailedDescription || "")
    .trim()
    .slice(0, 2000);

  let amountInCompanyCurrency = null;
  if (safeAmount != null && currencyCode) {
    try {
      amountInCompanyCurrency = await convertCurrency(
        safeAmount,
        currencyCode,
        target,
      );
    } catch (err) {
      console.warn("Currency conversion failed:", err.message);
      amountInCompanyCurrency = null;
    }
  }

  return {
    expenseDate,
    amount: safeAmount,
    currencyCode: currencyCode || target,
    category,
    description,
    remarks,
    detailedDescription,
    companyCurrencyCode: target,
    amountInCompanyCurrency,
  };
}

/**
 * @param {string} filePath absolute or cwd-relative
 * @param {string} mimeType
 * @param {string} companyCurrencyCode
 */
async function extractReceiptFromFile(filePath, mimeType, companyCurrencyCode) {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const buffer = fs.readFileSync(resolved);
  const mt =
    mimeType ||
    (resolved.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg");
  return extractReceiptFromBuffer(buffer, mt, companyCurrencyCode);
}

module.exports = {
  extractReceiptFromBuffer,
  extractReceiptFromFile,
  normalizeCategory,
  ALLOWED_CATEGORIES,
};
