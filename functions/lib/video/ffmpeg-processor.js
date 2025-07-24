"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVideo = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const storage_1 = require("@google-cloud/storage");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
// Set FFmpeg path
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
const storage = new storage_1.Storage();
// Helper function to download video from GCS to temp directory
async function downloadVideoToTemp(videoUrl) {
    console.log("Downloading video from:", videoUrl);
    let gcsPath;
    // Handle both GCS URIs and Firebase download URLs
    if (videoUrl.startsWith('gs://')) {
        gcsPath = videoUrl.replace('gs://', '');
    }
    else {
        // Extract GCS path from Firebase download URL
        const urlMatch = videoUrl.match(/\/o\/(.+?)\?/);
        if (!urlMatch) {
            throw new Error("Invalid video URL format");
        }
        gcsPath = decodeURIComponent(urlMatch[1]);
    }
    const [bucketName, ...pathParts] = gcsPath.split('/');
    const filePath = pathParts.join('/');
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    const tempFilePath = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
    await file.download({ destination: tempFilePath });
    console.log("Video downloaded to:", tempFilePath);
    return tempFilePath;
}
// Get video metadata using FFmpeg
async function getVideoMetadata(inputPath) {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                console.error("FFprobe error:", err);
                reject(err);
                return;
            }
            const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');
            if (!videoStream) {
                reject(new Error("No video stream found"));
                return;
            }
            resolve({
                width: videoStream.width,
                height: videoStream.height,
                duration: parseFloat(metadata.format.duration)
            });
        });
    });
}
// Generate ASS subtitle file for captions
function generateCaptionsFile(transcript, selection, captionStyle, videoMetadata) {
    const tempSubPath = path.join(os.tmpdir(), `captions_${Date.now()}.ass`);
    // Convert hex colors to ASS format
    const hexToAssColor = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `&H00${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`;
    };
    // Calculate responsive font size based on video dimensions
    const baseFontSize = Math.min(videoMetadata.width, videoMetadata.height) / 20;
    const responsiveFontSize = Math.round(baseFontSize * captionStyle.fontSize);
    const assHeader = `[Script Info]
Title: Generated Captions
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${captionStyle.fontFamily.split(',')[0]},${responsiveFontSize},${hexToAssColor(captionStyle.textColor)},${hexToAssColor(captionStyle.highlightColor)},${hexToAssColor(captionStyle.outlineColor)},&H00000000,1,0,0,0,100,100,0,0,1,2,0,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    // Format time for ASS (H:MM:SS.CC)
    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const centiseconds = Math.floor((seconds % 1) * 100);
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    };
    // Filter transcript for selected timeframe and adjust timestamps
    const selectedWords = transcript.filter(word => word.start >= selection.start && word.end <= selection.end);
    let events = '';
    selectedWords.forEach(word => {
        const adjustedStart = word.start - selection.start;
        const adjustedEnd = word.end - selection.start;
        events += `Dialogue: 0,${formatTime(adjustedStart)},${formatTime(adjustedEnd)},Default,,0,0,0,,${word.punctuated_word}\n`;
    });
    const assContent = assHeader + events;
    fs.writeFileSync(tempSubPath, assContent, 'utf8');
    console.log("Generated captions file:", tempSubPath);
    return tempSubPath;
}
// Process video with FFmpeg
async function processVideoWithFFmpeg(inputPath, outputPath, selection, captionsPath, transform, generatedBackground) {
    return new Promise((resolve, reject) => {
        console.log("Starting FFmpeg processing...");
        let command = (0, fluent_ffmpeg_1.default)(inputPath)
            .seekInput(selection.start)
            .duration(selection.end - selection.start);
        // Apply transformations - FIXED ASPECT RATIO HANDLING
        let targetWidth;
        let targetHeight;
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
                console.error(`Invalid aspect ratio received: ${transform.aspectRatio}`);
                reject(new Error(`Unsupported aspect ratio: ${transform.aspectRatio}`));
                return;
        }
        // Video filters
        let videoFilters = [
            `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`,
            `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`
        ];
        // Apply pan and zoom
        if (transform.zoom !== 1 || transform.pan.x !== 0 || transform.pan.y !== 0) {
            const zoomFilter = `scale=iw*${transform.zoom}:ih*${transform.zoom}`;
            const panFilter = `crop=${targetWidth}:${targetHeight}:${transform.pan.x}:${transform.pan.y}`;
            videoFilters = [zoomFilter, panFilter];
        }
        command = command.videoFilters(videoFilters);
        // Add subtitles
        command = command.outputOptions([
            '-vf', `subtitles=${captionsPath.replace(/\\/g, '/')}:force_style='Alignment=2'`
        ]);
        // Output settings
        command = command
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
            '-preset', 'medium',
            '-crf', '23',
            '-movflags', '+faststart'
        ])
            .output(outputPath);
        command
            .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
        })
            .on('progress', (progress) => {
            console.log('Processing progress:', progress.percent + '%');
        })
            .on('end', () => {
            console.log('FFmpeg processing completed');
            resolve();
        })
            .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(err);
        })
            .run();
    });
}
// Upload processed clip to Firebase Storage
async function uploadClipToStorage(filePath) {
    const bucket = storage.bucket('clipforge-xl.firebasestorage.app');
    const fileName = `clips/clip_${Date.now()}.mp4`;
    const file = bucket.file(fileName);
    await bucket.upload(filePath, {
        destination: fileName,
        metadata: {
            contentType: 'video/mp4',
        },
    });
    // Make file publicly accessible
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/clipforge-xl.firebasestorage.app/${fileName}`;
    console.log("Clip uploaded to:", publicUrl);
    return publicUrl;
}
// Main render function
exports.renderVideo = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "8GB",
})
    .https.onCall(async (data, context) => {
    const tempFiles = [];
    try {
        console.log("Starting video render with data:", JSON.stringify(data, null, 2));
        const { videoUrl, transcript, selection, captionStyle, transform, generatedBackground } = data;
        // Validate required data
        if (!videoUrl || !transcript || !selection || !captionStyle || !transform) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required data');
        }
        // Download video to temp directory
        const inputPath = await downloadVideoToTemp(videoUrl);
        tempFiles.push(inputPath);
        // Get video metadata
        const videoMetadata = await getVideoMetadata(inputPath);
        console.log("Video metadata:", videoMetadata);
        // Generate captions file
        const captionsPath = generateCaptionsFile(transcript, selection, captionStyle, videoMetadata);
        tempFiles.push(captionsPath);
        // Set output path
        const outputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);
        tempFiles.push(outputPath);
        // Process video with FFmpeg
        await processVideoWithFFmpeg(inputPath, outputPath, selection, captionsPath, transform, generatedBackground);
        // Upload processed clip
        const clipUrl = await uploadClipToStorage(outputPath);
        return { videoUrl: clipUrl };
    }
    catch (error) {
        console.error("Render error:", error);
        throw new functions.https.HttpsError('internal', `Render failed: ${error}`);
    }
    finally {
        // Cleanup temp files
        tempFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log("Cleaned up:", filePath);
                }
            }
            catch (cleanupError) {
                console.warn("Failed to cleanup file:", filePath, cleanupError);
            }
        });
    }
});
//# sourceMappingURL=ffmpeg-processor.js.map