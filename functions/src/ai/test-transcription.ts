// /functions/src/ai/test-transcription.ts

import { transcribeVideo } from "./transcribe-video";

// IMPORTANT: Update this with a real GCS URI to a video file in your bucket.
const GCS_URI_TO_TEST = "gs://clipforge-xl.firebasestorage.app/like mike test.mp4";

// --- TEST EXECUTION ---
async function runTest() {
  console.log(`Testing transcription for: ${GCS_URI_TO_TEST}`);

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: GEMINI_API_KEY environment variable is not set.");
    return;
  }

  if (GCS_URI_TO_TEST.includes("your-bucket")) {
    console.error("❌ ERROR: Please update GCS_URI_TO_TEST with a real GCS URI.");
    return;
  }

  const [bucketName,...filePathParts] = GCS_URI_TO_TEST.replace("gs://", "").split("/");
  const filePath = filePathParts.join("/");

  try {
    const transcript = await transcribeVideo(bucketName, filePath);
    console.log("\n--- TRANSCRIPTION RESULT ---");
    console.log(transcript);
    console.log("\n✅ Transcription Succeeded.");
  } catch (error) {
    console.error("\n❌ Transcription Failed.");
    // The detailed error is already logged inside transcribeVideo
  }
}

runTest();