'use strict';
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVideo = exports.onVideoUpload = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const transcribe_video_1 = require("./ai/transcribe-video");
const path = __importStar(require("path"));
const Editframe = require("@editframe/editframe-js");
admin.initializeApp();
const db = admin.firestore();
// This function is triggered when a file is uploaded to the /uploads/ GCS folder.
exports.onVideoUpload = functions.runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: "1GB",
}).storage.object().onFinalize(async (object) => {
    const bucketName = object.bucket;
    const filePath = object.name;
    const { logger } = functions;
    if (!filePath || !filePath.startsWith("uploads/")) {
        logger.log(`Not a valid video upload or not in the correct folder: ${filePath}`);
        return null;
    }
    if (filePath.endsWith('/')) {
        logger.log(`This is a folder marker, skipping: ${filePath}`);
        return null;
    }
    const uid = filePath.split('/')[1];
    if (!uid) {
        logger.error(`Could not determine UID from path: ${filePath}`);
        return null;
    }
    logger.log(`Video upload detected: ${filePath} by user ${uid}.`);
    const videoDocId = `${uid}_${path.basename(filePath)}`;
    const videoDocRef = db.collection("videos").doc(videoDocId);
    logger.log(`Creating Firestore document: /videos/${videoDocId}`);
    await videoDocRef.set({
        uid: uid,
        gcsPath: `gs://${bucketName}/${filePath}`,
        status: "processing",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.log(`Successfully created Firestore document for ${videoDocId}.`);
    try {
        logger.log(`Starting transcription for ${filePath}...`);
        const transcription = await (0, transcribe_video_1.transcribeVideo)(bucketName, filePath);
        logger.log(`Transcription successful for ${filePath}. Updating Firestore.`);
        return videoDocRef.update({
            status: "completed",
            transcription: transcription.words,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        logger.error(`Transcription or database update failed for ${filePath}:`, error);
        return videoDocRef.update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
exports.renderVideo = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const { logger } = functions;
    if (!data.videoUrl || !data.selection) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data.');
    }
    try {
        logger.log("Initializing Editframe with credentials...");
        const editframe = new Editframe({
            clientId: functions.config().editframe.client_id,
            token: functions.config().editframe.token,
        });
        const { videoUrl, transcript, selection, generatedBackground, captionStyle, transform, } = data;
        logger.log("Data received:", {
            videoUrl,
            selection,
            hasTranscript: !!transcript,
            hasBackground: !!generatedBackground,
            captionStyle,
            transform
        });
        const [width, height] = transform.aspectRatio === "9/16" ? [1080, 1920] : [1920, 1080];
        const duration = selection.end - selection.start;
        logger.log("Creating composition with dimensions:", { width, height, duration });
        const composition = await editframe.videos.new({
            dimensions: { width, height },
            duration: duration,
            backgroundColor: "#000000",
        });
        logger.log("Composition created successfully");
        // Add background image if provided
        if (generatedBackground) {
            logger.log("Adding background image:", generatedBackground);
            await composition.addImage(generatedBackground, {
                position: { x: "center", y: "center" },
                size: { width: width, height: height },
                timeline: { start: 0 },
            });
        }
        // Add main video layer
        logger.log("Adding main video layer:", videoUrl);
        await composition.addVideo(videoUrl, {
            position: {
                x: ((_a = transform.pan) === null || _a === void 0 ? void 0 : _a.x) || "center",
                y: ((_b = transform.pan) === null || _b === void 0 ? void 0 : _b.y) || "center",
            },
            size: {
                scale: transform.zoom || 1,
            },
            timeline: { start: 0 },
            trim: {
                start: selection.start,
                end: selection.end
            },
        });
        // Process transcript for captions if provided
        if (transcript && transcript.length > 0) {
            logger.log("Processing transcript for captions...");
            // Group words into sentences
            const sentences = [];
            let currentSentence = [];
            for (const word of transcript) {
                currentSentence.push(word);
                if (word.punctuated_word.endsWith('.') ||
                    word.punctuated_word.endsWith('?') ||
                    word.punctuated_word.endsWith('!')) {
                    sentences.push(currentSentence);
                    currentSentence = [];
                }
            }
            if (currentSentence.length > 0)
                sentences.push(currentSentence);
            logger.log(`Created ${sentences.length} sentences from transcript`);
            // Add text layers for each sentence
            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i];
                const sentenceStart = sentence[0].start;
                const sentenceEnd = sentence[sentence.length - 1].end;
                // Only add captions for words within the selected time range
                if (sentenceStart < selection.end && sentenceEnd > selection.start) {
                    const adjustedStart = Math.max(0, sentenceStart - selection.start);
                    const adjustedEnd = Math.min(duration, sentenceEnd - selection.start);
                    const sentenceText = sentence.map(w => w.punctuated_word).join(" ");
                    logger.log(`Adding caption ${i + 1}: "${sentenceText}" (${adjustedStart}s - ${adjustedEnd}s)`);
                    await composition.addText({
                        text: sentenceText,
                        color: (captionStyle === null || captionStyle === void 0 ? void 0 : captionStyle.textColor) || "#ffffff",
                        fontFamily: (captionStyle === null || captionStyle === void 0 ? void 0 : captionStyle.fontFamily) || "Arial",
                        fontSize: Math.round(((captionStyle === null || captionStyle === void 0 ? void 0 : captionStyle.fontSize) || 2) * 50), // Convert rem to pixels
                        backgroundColor: (captionStyle === null || captionStyle === void 0 ? void 0 : captionStyle.backgroundColor) || "transparent",
                        textAlign: "center",
                    }, {
                        position: {
                            x: "center",
                            y: (captionStyle === null || captionStyle === void 0 ? void 0 : captionStyle.position) === "top" ? "20%" : "80%"
                        },
                        timeline: { start: adjustedStart },
                        trim: {
                            start: 0,
                            end: adjustedEnd - adjustedStart
                        },
                    });
                }
            }
        }
        logger.log("Starting video encoding...");
        const video = await composition.encodeSync();
        logger.log("Video encoded successfully:", video);
        return {
            success: true,
            message: "Video rendered successfully",
            videoId: video.id,
            downloadUrl: video.download_url,
            streamUrl: video.stream_url,
            isReady: video.is_ready,
        };
    }
    catch (error) {
        logger.error("Error rendering video with Editframe:", error);
        // Provide more detailed error information
        if (error instanceof Error) {
            logger.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
        throw new functions.https.HttpsError("internal", `Failed to render video: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
});
//# sourceMappingURL=index.js.map