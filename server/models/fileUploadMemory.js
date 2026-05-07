const multer = require("multer");

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only images or PDF are allowed"), false);
  }
};

/** In-memory upload for OCR (no file left on disk). */
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter,
});

module.exports = uploadMemory;
