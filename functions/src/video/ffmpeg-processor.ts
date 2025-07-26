import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Use Firebase Admin Storage (which inherits service account permissions)
const storage = admin.storage();

interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  punctuated_word: string;
}

interface Selection {
  start: number;
  end: number;
}

interface CaptionStyle {
  textColor: string;
  highlightColor: string;
  outlineColor: string;
  fontFamily: string;
  fontSize: number;
}

interface Transform {
  pan: { x: number; y: number };
  zoom: number;
  aspectRatio: string;
}

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
}

// Helper function to download video from GCS to temp directory
async function downloadVideoToTemp(videoUrl: string): Promise<string> {
  console.log("Downloading video from:", videoUrl);

  let gcsPath: string;

  // Handle both GCS URIs and Firebase download URLs
  if (videoUrl.startsWith("gs://")) {
    gcsPath = videoUrl.replace("gs://", "");
  } else {
    // Extract GCS path from Firebase download URL
    const urlMatch = videoUrl.match(/\/o\/(.+?)\?/);
    if (!urlMatch) {
      throw new Error("Invalid video URL format");
    }
    gcsPath = decodeURIComponent(urlMatch[1]);
  }

  const [bucketName, ...pathParts] = gcsPath.split("/");
  const filePath = pathParts.join("/");

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  const tempFilePath = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);

  await file.download({ destination: tempFilePath });
  console.log("Video downloaded to:", tempFilePath);

  return tempFilePath;
}

// Get video metadata using FFmpeg
async function getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err: any, metadata: any) => {
      if (err) {
        console.error("FFprobe error:", err);
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(
        (stream: any) => stream.codec_type === "video"
      );
      if (!videoStream) {
        reject(new Error("No video stream found"));
        return;
      }

      resolve({
        width: videoStream.width,
        height: videoStream.height,
        duration: parseFloat(metadata.format.duration),
      });
    });
  });
}

// Generate ASS subtitle file for captions
function generateCaptionsFile(
  transcript: TranscriptWord[],
  selection: Selection,
  captionStyle: CaptionStyle,
  videoMetadata: VideoMetadata
): string {
  const tempSubPath = path.join(os.tmpdir(), `captions_${Date.now()}.ass`);

  // Convert hex colors to ASS format
  const hexToAssColor = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `&H00${b.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${r.toString(16).padStart(2, "0")}`;
  };

  // Calculate responsive font size based on video dimensions
  const baseFontSize = Math.min(videoMetadata.width, videoMetadata.height) / 20;
  const responsiveFontSize = Math.round(baseFontSize * captionStyle.fontSize);

  const assHeader = `[Script Info]
Title: Generated Captions
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${
    captionStyle.fontFamily.split(",")[0]
  },${responsiveFontSize},${hexToAssColor(
    captionStyle.textColor
  )},${hexToAssColor(captionStyle.highlightColor)},${hexToAssColor(
    captionStyle.outlineColor
  )},&H00000000,1,0,0,0,100,100,0,0,1,2,0,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Format time for ASS (H:MM:SS.CC)
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 1) * 100);
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  };

  // Filter transcript for selected timeframe and adjust timestamps
  const selectedWords = transcript.filter(
    (word) => word.start >= selection.start && word.end <= selection.end
  );

  let events = "";
  selectedWords.forEach((word) => {
    const adjustedStart = word.start - selection.start;
    const adjustedEnd = word.end - selection.start;

    events += `Dialogue: 0,${formatTime(adjustedStart)},${formatTime(
      adjustedEnd
    )},Default,,0,0,0,,${word.punctuated_word}\n`;
  });

  const assContent = assHeader + events;
  fs.writeFileSync(tempSubPath, assContent, "utf8");

  console.log("Generated captions file:", tempSubPath);
  return tempSubPath;
}

// Process video with FFmpeg
async function processVideoWithFFmpeg(
  inputPath: string,
  outputPath: string,
  selection: Selection,
  captionsPath: string,
  transform: Transform,
  generatedBackground?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("Starting FFmpeg processing...");

    let command = ffmpeg(inputPath)
      .seekInput(selection.start)
      .duration(selection.end - selection.start);

    // Apply transformations - FIXED ASPECT RATIO HANDLING
    let targetWidth: number;
    let targetHeight: number;

    switch (transform.aspectRatio) {
      case "16/9":
        targetWidth = 1920;
        targetHeight = 1080;
        break;
      case "9/16":
        targetWidth = 1080;
        targetHeight = 1920;
        break;
      case "1/1":
        targetWidth = 1080;
        targetHeight = 1080;
        break;
      case "4/5":
        targetWidth = 1080;
        targetHeight = 1350;
        break;
      default:
        console.error(
          `Invalid aspect ratio received: ${transform.aspectRatio}`
        );
        reject(new Error(`Unsupported aspect ratio: ${transform.aspectRatio}`));
        return;
    }

    // Video filters
    let videoFilters = [
      `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`,
      `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`,
    ];

    // Apply pan and zoom
    if (
      transform.zoom !== 1 ||
      transform.pan.x !== 0 ||
      transform.pan.y !== 0
    ) {
      const zoomFilter = `scale=iw*${transform.zoom}:ih*${transform.zoom}`;
      const panFilter = `crop=${targetWidth}:${targetHeight}:${transform.pan.x}:${transform.pan.y}`;
      videoFilters = [zoomFilter, panFilter];
    }

    command = command.videoFilters(videoFilters);

    // Add subtitles
    command = command.outputOptions([
      "-vf",
      `subtitles=${captionsPath.replace(/\\/g, "/")}:force_style='Alignment=2'`,
    ]);

    // Output settings
    command = command
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-preset",
        "medium",
        "-crf",
        "23",
        "-movflags",
        "+faststart",
      ])
      .output(outputPath);

    command
      .on("start", (commandLine: string) => {
        console.log("FFmpeg command:", commandLine);
      })
      .on("progress", (progress: any) => {
        console.log("Processing progress:", progress.percent + "%");
      })
      .on("end", () => {
        console.log("FFmpeg processing completed");
        resolve();
      })
      .on("error", (err: Error) => {
        console.error("FFmpeg error:", err);
        reject(err);
      })
      .run();
  });
}

// Upload processed clip to Firebase Storage
async function uploadClipToStorage(filePath: string): Promise<string> {
  const bucket = storage.bucket("clipforge-xl.firebasestorage.app");
  const fileName = `clips/clip_${Date.now()}.mp4`;
  const file = bucket.file(fileName);

  await bucket.upload(filePath, {
    destination: fileName,
    metadata: {
      contentType: "video/mp4",
    },
  });

  // Make file publicly accessible
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/clipforge-xl.firebasestorage.app/${fileName}`;
  console.log("Clip uploaded to:", publicUrl);

  return publicUrl;
}

// Main render function
export const renderVideo = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "8GB",
  })
  .https.onCall(async (data, context) => {
    const tempFiles: string[] = [];

    try {
      console.log(
        "Starting video render with data:",
        JSON.stringify(data, null, 2)
      );

      const {
        videoUrl,
        transcript,
        selection,
        captionStyle,
        transform,
        generatedBackground,
      } = data;

      // Validate required data
      if (
        !videoUrl ||
        !transcript ||
        !selection ||
        !captionStyle ||
        !transform
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Missing required data"
        );
      }

      // Download video to temp directory
      const inputPath = await downloadVideoToTemp(videoUrl);
      tempFiles.push(inputPath);

      // Get video metadata
      const videoMetadata = await getVideoMetadata(inputPath);
      console.log("Video metadata:", videoMetadata);

      // Generate captions file
      const captionsPath = generateCaptionsFile(
        transcript,
        selection,
        captionStyle,
        videoMetadata
      );
      tempFiles.push(captionsPath);

      // Set output path
      const outputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);
      tempFiles.push(outputPath);

      // Process video with FFmpeg
      await processVideoWithFFmpeg(
        inputPath,
        outputPath,
        selection,
        captionsPath,
        transform,
        generatedBackground
      );

      // Upload processed clip
      const clipUrl = await uploadClipToStorage(outputPath);

      return { videoUrl: clipUrl };
    } catch (error) {
      console.error("Render error:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Render failed: ${error}`
      );
    } finally {
      // Cleanup temp files
      tempFiles.forEach((filePath) => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("Cleaned up:", filePath);
          }
        } catch (cleanupError) {
          console.warn("Failed to cleanup file:", filePath, cleanupError);
        }
      });
    }
  });
