import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: "djtvn83lp",
  api_key: "389158573923714",
  api_secret: "nK6E7F-dpSaezIPQohVZhknU7V8",
  secure: true,
});

// Upload PDF
export const uploadPDF = async (localFilePath) => {
  try {
    const fileBuffer = localFilePath.buffer;
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "raw", folder: "pdfs" },
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

// Upload Image
export const uploadImageToCloudinary = async (buffer, folder) => {
  if (!buffer) throw new Error("No image buffer provided");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: "auto", crop: "fill" },
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

// Upload Video
export const uploadVideoToCloudinary = async (buffer, folder = "videos") => {
  if (!buffer) throw new Error("No video buffer provided");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "video",
        chunk_size: 6000000, // 6MB chunks
        eager_async: true,
        eager: [
          { format: "mp4", transformation: [{ quality: "auto" }] },
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

// Delete from Cloudinary
export const deleteFromCloudinary = async (imageUrl) => {
  try {
    const urlParts = imageUrl.split("/upload/");
    if (urlParts.length < 2) {
      console.error("Invalid image URL format");
      return;
    }

    const fullPathWithExt = urlParts[1];
    const fullPublicId = fullPathWithExt.replace(/\.[^/.]+$/, "");

    await cloudinary.uploader.destroy(fullPublicId, {
      resource_type: "auto", // ensures video, image, pdf can all be deleted
    });
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error.message);
  }
};
