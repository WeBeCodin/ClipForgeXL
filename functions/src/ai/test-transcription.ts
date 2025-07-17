// To run this test script:
// 1. Make sure you are in the 'functions' directory in your terminal.
// 2. Run 'npm install' to install dependencies.
// 3. Set your GEMINI_API_KEY as an environment variable:
//    export GEMINI_API_KEY="your_api_key_here"
// 4. Update the GCS_URI_TO_TEST with a real GCS URI to a video file.
//    (e.g., "gs://your-bucket-name/your-video.mp4")
// 5. Run the script using: npx ts-node src/ai/test-transcription.ts

import { transcribeVideo } from "./transcribe-video";

// --- CONFIGURATION ---
// IMPORTANT: Replace this with a real GCS URI of a video in your bucket.
// The video should be in a bucket that your Gemini API key has access to.
const GCS_URI_TO_TEST = "gs://your-bucket/your-video.mp4"; 
// ---------------------


async function runTest() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("\nERROR: GEMINI_API_KEY environment variable is not set.");
    console.error("Please set it before running the test, e.g., export GEMINI_API_KEY=\"your_api_key_here\"\n");
    process.exit(1);
  }

  if (GCS_URI_TO_TEST.includes("your-bucket")) {
     console.error("\nERROR: Please update the GCS_URI_TO_TEST in `functions/src/ai/test-transcription.ts` to a real Google Cloud Storage URI.\n");
    process.exit(1);
  }
  
  console.log(`Testing transcription for: ${GCS_URI_TO_TEST}`);

  try {
    const transcript = await transcribeVideo(GCS_URI_TO_TEST);
    console.log("\n✅ Transcription Successful!\n");
    console.log("--- Transcript ---");
    console.log(transcript);
    console.log("------------------\n");
  } catch (error) {
    console.error("\n❌ Transcription Failed.\n");
    console.error("Error:", error);
  }
}

runTest();
