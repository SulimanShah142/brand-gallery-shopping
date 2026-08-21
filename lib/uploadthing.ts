// lib/uploadthing.ts -> Complete High-Speed Resilient Implementation

import { generateReactNativeHelpers } from "@uploadthing/expo";
import * as FileSystem from "expo-file-system";

const SERVER_ORIGIN = "https://brand-gallery-backend.brand-gallery.workers.dev";
const UPLOADTHING_URL = `${SERVER_ORIGIN}/api/uploadthing`;

const { uploadFiles } = generateReactNativeHelpers<any>({
  url: UPLOADTHING_URL,
});

const createUploadFile = async (uri: string, name: string, type: string) => {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    throw new Error(`Local file does not exist: ${uri}`);
  }

  return {
    uri,
    name,
    type,
    size: fileInfo.size ?? 0,
    lastModified: Date.now(),
  } as any;
};

export const uploadImage = async (uri: string): Promise<string> => {
  if (!uri) return "";

  const filename = uri.split("/").pop() ?? `image-${Date.now()}.jpg`;
  const uploadFile = await createUploadFile(uri, filename, "image/jpeg");

  console.log("📤 Calling uploadFiles for imageUploader...");

  try {
    return await new Promise<string>(async (resolve, reject) => {
      try {
        const result = await uploadFiles("imageUploader", {
          files: [uploadFile],
        });

        // 🎯 THE EXTRACTION FIX: Log the exact shape to inspect it
        console.log("📥 uploadFiles raw result structural footprint:", JSON.stringify(result));

        if (!result) {
          return reject(new Error("UploadThing returned an empty response."));
        }

        // 🎯 UNWRAP THE ECOSYSTEM WRAPPER: Inspect both array or nested response states
        let targetAsset = null;
        
        if (Array.isArray(result) && result.length > 0) {
          targetAsset = result[0];
        } else if (result && typeof result === 'object') {
          if (Array.isArray((result as any).data) && (result as any).data.length > 0) {
            targetAsset = (result as any).data[0];
          } else if ((result as any).data) {
            targetAsset = (result as any).data;
          } else {
            targetAsset = result;
          }
        }

        console.log("🎯 Target Asset Extracted:", JSON.stringify(targetAsset));

        if (!targetAsset) {
          return reject(new Error("Could not map target file references from response payload."));
        }

        // Search through all potential key combinations including nested data and serverData blocks
        const finalCdnUrl = 
          targetAsset.url || 
          targetAsset.ufsUrl || 
          targetAsset.appUrl || 
          targetAsset.data?.url ||
          targetAsset.data?.ufsUrl ||
          targetAsset.serverData?.url ||
          targetAsset.serverData?.ufsUrl ||
          targetAsset.serverData?.appUrl ||
          "";
        
        console.log("✅ Web CDN link successfully retrieved:", finalCdnUrl);

        if (!finalCdnUrl) {
          return reject(new Error("No valid image text URL found inside asset keys."));
        }

        // Release the mobile UI main hardware thread with a clean macro-task queue delay
        setTimeout(() => {
          resolve(finalCdnUrl);
        }, 50);

      } catch (innerError) {
        reject(innerError);
      }
    });

  } catch (error: any) {
    console.error("❌ UploadThing Error Tracker Exception:", error?.message || error);
    throw error;
  }
};

export { uploadFiles };
