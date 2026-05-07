const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary with credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Multer-Cloudinary storage instance.
 * Handles both receipt files (images + PDFs) and profile pictures
 * by routing to different Cloudinary folders based on the field name.
 *
 * After upload, `req.file.path` contains the full Cloudinary HTTPS URL.
 */
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const isProfile = file.fieldname === "profilePicture";
    const isPdf = file.mimetype === "application/pdf";

    return {
      folder: isProfile ? "reimburse-it/profiles" : "reimburse-it/receipts",
      // "auto" lets Cloudinary detect whether it's an image or a raw file (PDF)
      resource_type: "auto",
      // For non-PDF images, restrict allowed formats
      ...(isPdf
        ? {}
        : {
            allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
          }),
    };
  },
});

module.exports = { cloudinary, cloudinaryStorage };
