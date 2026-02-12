// Cloudinary configuration
// Values are loaded from environment variables (see .env file)
// In React, environment variables must be prefixed with REACT_APP_ to be accessible

// Temporary fallback values - remove these once .env is working
// These will be used if environment variables are not loaded
const FALLBACK_CLOUD_NAME = 'djgovodpi';
const FALLBACK_API_KEY = '944382644828331';
const FALLBACK_UPLOAD_PRESET = 'athlete_photos';

const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || FALLBACK_CLOUD_NAME;
const apiKey = process.env.REACT_APP_CLOUDINARY_API_KEY || FALLBACK_API_KEY;
const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || FALLBACK_UPLOAD_PRESET;

export const cloudinaryConfig = {
  cloudName: cloudName || '',
  apiKey: apiKey || '',
  // API Secret is NOT used for unsigned uploads (client-side)
  // Keep it secure - only use for server-side signed uploads if needed
  // If you need it, add REACT_APP_CLOUDINARY_API_SECRET to .env (but it's not needed for unsigned uploads)
  
  // For client-side uploads, use unsigned uploads with an upload preset
  // Create an upload preset in Cloudinary Console: Settings > Upload > Upload presets
  // Set it to "Unsigned" and name it (e.g., 'athlete_photos')
  uploadPreset: uploadPreset || ''
};

// Upload URL for unsigned uploads
export const CLOUDINARY_UPLOAD_URL = cloudName 
  ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
  : 'https://api.cloudinary.com/v1_1/djgovodpi/image/upload'; // Fallback URL

// Note: For unsigned uploads, you only need:
// 1. Cloud name (REACT_APP_CLOUDINARY_CLOUD_NAME) ✓
// 2. Upload preset name (REACT_APP_CLOUDINARY_UPLOAD_PRESET) - must be set to "Unsigned" in Cloudinary console
// 
// The API secret is NOT needed for unsigned uploads and should NEVER be exposed in client-side code.
// If you need signed uploads, implement them on a server-side API endpoint.
