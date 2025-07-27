import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
cloudinary.config({
  cloud_name: "djtvn83lp",
  api_key: "389158573923714",
  api_secret: "nK6E7F-dpSaezIPQohVZhknU7V8",
  secure: true,
});

export const uploadPDF = async (localFilePath) => {
  try {
   const fileBuffer = localFilePath.buffer; // file data in memory
    const fileName = localFilePath.originalname;

    // Upload to Cloudinary using upload_stream
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "pdfs" }, // use resource_type raw for PDFs
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        stream.end(buffer);
      });
    };

    const result = await streamUpload(fileBuffer);
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary PDF upload error:", error);
    throw error;
  }
};
export const uploadImageToCloudinary = async (buffer, folder) => {
  if (!buffer) throw new Error("No image buffer provided");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
         transformation: [
          { width: "auto",  crop: "fill" }, // or crop: "fill_pad"
          { fetch_format: "auto" },
          { quality: "auto" },
          { dpr: "auto" },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};
export const deleteFromCloudinary = async (imageUrl) => {
  try {
    const urlParts = imageUrl.split("/upload/");
    if (urlParts.length < 2) {
      console.error("Invalid image URL format");
      return;
    }

    const fullPathWithExt = urlParts[1]; // e.g. "products/category/abc123.png"
    const fullPublicId = fullPathWithExt.replace(/\.[^/.]+$/, ""); // remove extension

    await cloudinary.uploader.destroy(fullPublicId);
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error.message);
  }
};
