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
exports.generateClip = void 0;
const functions = __importStar(require("firebase-functions"));
const storage_1 = require("@google-cloud/storage");
const fs = __importStar(require("fs"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg")); // Changed this line - default import instead of namespace
// Set FFmpeg path for Cloud Functions
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
const storage = new storage_1.Storage();
exports.generateClip = functions.runWith({
    timeoutSeconds: 540,
    memory: "8GB",
}).https.onCall(async (data, context) => {
    const { logger } = functions;
    if (!data.videoUrl || !data.selection) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data.');
    }
    try {
        const { videoUrl, transcript, selection, captionStyle = {}, transform = {} } = data;
        logger.log("Starting clip generation:", {
            videoUrl,
            startTime: selection.start,
            endTime: selection.end,
            duration: selection.end - selection.start
        });
        // 1. Download source video to temp storage
        const tempInputPath = await downloadVideoToTemp(videoUrl);
        logger.log("Video downloaded to:", tempInputPath);
        // 2. Generate captions for the selected segment
        const captionsPath = await generateCaptionsFile(transcript, selection, captionStyle);
        logger.log("Captions generated:", captionsPath);
        // 3. Process video with FFmpeg
        const outputPath = await processVideoWithFFmpeg(tempInputPath, selection.start, selection.end - selection.start, captionsPath, transform);
        logger.log("Video processed:", outputPath);
        // 4. Upload result to Cloud Storage
        const finalUrl = await uploadClipToStorage(outputPath);
        logger.log("Clip uploaded:", finalUrl);
        // 5. Cleanup temp files
        cleanupTempFiles([tempInputPath, captionsPath, outputPath]);
        return {
            success: true,
            clipUrl: finalUrl,
            duration: selection.end - selection.start,
            message: "Clip generated successfully"
        };
    }
    catch (error) {
        logger.error("Clip generation failed:", error);
        throw new functions.https.HttpsError("internal", `Failed to generate clip: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
});
async function downloadVideoToTemp(videoUrl) {
    const tempPath = `/tmp/input_${Date.now()}.mp4`;
    const gcsMatch = videoUrl.match(/gs:\/\/([^\/]+)\/(.+)/);
    if (!gcsMatch) {
        throw new Error("Invalid GCS URL format");
    }
    const [, bucketName, filePath] = gcsMatch;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    await file.download({ destination: tempPath });
    return tempPath;
}
async function generateCaptionsFile(transcript, selection, captionStyle) {
    const captionsPath = `/tmp/captions_${Date.now()}.ass`;
    const relevantWords = transcript.filter(word => word.start >= selection.start && word.end <= selection.end);
    if (relevantWords.length === 0) {
        fs.writeFileSync(captionsPath, generateEmptyASS());
        return captionsPath;
    }
    const sentences = groupWordsIntoSentences(relevantWords);
    const assContent = generateASSContent(sentences, selection.start, captionStyle);
    fs.writeFileSync(captionsPath, assContent);
    return captionsPath;
}
function groupWordsIntoSentences(words) {
    const sentences = [];
    let currentSentence = [];
    for (const word of words) {
        currentSentence.push(word);
        if (word.punctuated_word.match(/[.!?]$/) ||
            currentSentence.length >= 8) {
            sentences.push([...currentSentence]);
            currentSentence = [];
        }
    }
    if (currentSentence.length > 0) {
        sentences.push(currentSentence);
    }
    return sentences;
}
function generateASSContent(sentences, selectionStart, captionStyle) {
    const fontName = captionStyle.fontFamily || "Arial";
    const fontSize = Math.round((captionStyle.fontSize || 2) * 50);
    const primaryColor = hexToAssColor(captionStyle.textColor || "#ffffff");
    const outlineColor = hexToAssColor(captionStyle.outlineColor || "#000000");
    const backgroundColor = captionStyle.backgroundColor && captionStyle.backgroundColor !== "transparent"
        ? hexToAssColor(captionStyle.backgroundColor)
        : "&H00000000";
    let assContent = `[Script Info]
Title: Generated Captions
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${backgroundColor},1,0,0,0,100,100,0,0,1,3,0,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    sentences.forEach((sentence) => {
        if (sentence.length === 0)
            return;
        const startTime = sentence[0].start - selectionStart;
        const endTime = sentence[sentence.length - 1].end - selectionStart;
        const text = sentence.map(w => w.punctuated_word).join(" ");
        const startAss = secondsToAssTime(Math.max(0, startTime));
        const endAss = secondsToAssTime(endTime);
        assContent += `Dialogue: 0,${startAss},${endAss},Default,,0,0,0,,${text}\n`;
    });
    return assContent;
}
function generateEmptyASS() {
    return `[Script Info]
Title: Empty Captions

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,50,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,0,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}
function hexToAssColor(hex) {
    const cleanHex = hex.replace('#', '');
    const r = cleanHex.substr(0, 2);
    const g = cleanHex.substr(2, 2);
    const b = cleanHex.substr(4, 2);
    return `&H00${b}${g}${r}`;
}
function secondsToAssTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const centiseconds = Math.floor((seconds % 1) * 100);
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
async function processVideoWithFFmpeg(inputPath, startTime, duration, captionsPath, transform) {
    const outputPath = `/tmp/output_${Date.now()}.mp4`;
    return new Promise((resolve, reject) => {
        const aspectRatio = transform.aspectRatio || "16/9";
        const [width, height] = aspectRatio === "9/16" ? [1080, 1920] : [1920, 1080];
        let command = (0, fluent_ffmpeg_1.default)(inputPath)
            .seekInput(startTime)
            .duration(duration)
            .videoFilters([
            `ass=${captionsPath}`,
            `scale=${width}:${height}:force_original_aspect_ratio=1,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`
        ])
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
            '-preset fast',
            '-crf 23',
            '-movflags +faststart'
        ])
            .output(outputPath);
        if (transform.zoom && transform.zoom !== 1) {
            const scale = transform.zoom;
            command.videoFilters([
                `scale=iw*${scale}:ih*${scale}`,
                `ass=${captionsPath}`
            ]);
        }
        command
            .on('end', () => {
            resolve(outputPath);
        })
            .on('error', (err) => {
            reject(new Error(`FFmpeg processing failed: ${err.message}`));
        })
            .on('progress', (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
        })
            .run();
    });
}
async function uploadClipToStorage(filePath) {
    const bucket = storage.bucket('clipforge-xl.appspot.com');
    const fileName = `clips/clip_${Date.now()}.mp4`;
    const file = bucket.file(fileName);
    await bucket.upload(filePath, {
        destination: fileName,
        metadata: {
            contentType: 'video/mp4',
        },
    });
    await file.makePublic();
    return `https://storage.googleapis.com/clipforge-xl.appspot.com/${fileName}`;
}
function cleanupTempFiles(filePaths) {
    filePaths.forEach(filePath => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        catch (error) {
            console.warn(`Failed to cleanup temp file ${filePath}:`, error);
        }
    });
}
//# sourceMappingURL=ffmpeg-processor.js.map