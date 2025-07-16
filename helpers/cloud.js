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
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

