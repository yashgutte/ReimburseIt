const multer = require("multer");
const { cloudinaryStorage } = require("../utils/cloudinary");

// File filter — only allow images and PDFs
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image files and PDFs are allowed!"), false);
  }
};

/**
 * Multer instance backed by Cloudinary.
 * After a successful upload, req.file.path = full Cloudinary HTTPS URL.
 * No files are written to disk on the server.
 */
const upload = multer({
  storage: cloudinaryStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

module.exports = upload;
