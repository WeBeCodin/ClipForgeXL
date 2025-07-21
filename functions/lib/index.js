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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
admin.initializeApp();
const db = admin.firestore();
exports.onVideoUpload = functions.runWith({
    timeoutSeconds: 540,
    memory: "1GB",
}).storage.object().onFinalize(async (object) => {
    const bucketName = object.bucket;
    const filePath = object.name;
    const { logger } = functions;
    if (!filePath || !filePath.startsWith("uploads/")) {
        return null;
    }
    if (filePath.endsWith('/')) {
        return null;
    }
    const uid = filePath.split('/')[1];
    if (!uid) {
        logger.error(`Could not determine UID from path: ${filePath}`);
        return null;
    }
    const videoDocId = `${uid}_${path.basename(filePath)}`;
    const videoDocRef = db.collection("videos").doc(videoDocId);
    await videoDocRef.set({
        uid: uid,
        gcsPath: `gs://${bucketName}/${filePath}`,
        status: "processing",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    try {
        const transcription = await (0, transcribe_video_1.transcribeVideo)(bucketName, filePath);
        return videoDocRef.update({
            status: "completed",
            transcription: transcription.words,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        logger.error(`Transcription failed for ${filePath}:`, error);
        return videoDocRef.update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
exports.renderVideo = functions.https.onCall(async (data, context) => {
    const { logger } = functions;
    if (!data.videoUrl || !data.selection) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data.');
    }
    try {
        const clientId = process.env.EDITFRAME_CLIENT_ID;
        const token = process.env.EDITFRAME_TOKEN;
        if (!clientId || !token) {
            logger.error("CRITICAL: Editframe credentials not found in process.env.");
            throw new functions.https.HttpsError("internal", "Server is not configured for video rendering.");
        }
        const editframeModule = await Promise.resolve().then(() => __importStar(require("@editframe/editframe-js")));
        const Editframe = editframeModule.Editframe;
        const editframe = new Editframe({
            clientId: clientId,
            token: token,
        });
        const { videoUrl, transcript, selection, generatedBackground, captionStyle, transform } = data;
        const [width, height] = transform.aspectRatio === "9/16" ? [1080, 1920] : [1920, 1080];
        const composition = await editframe.videos.new({
            dimensions: { width, height },
            duration: selection.end - selection.start,
        });
        if (generatedBackground) {
            await composition.addImage(generatedBackground);
        }
        await composition.addVideo(videoUrl, {
            trim: { start: selection.start, end: selection.end },
            position: transform.pan,
            size: { scale: transform.zoom }
        });
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
        for (const sentence of sentences) {
            const sentenceStart = sentence[0].start;
            const sentenceEnd = sentence[sentence.length - 1].end;
            if (sentenceStart < selection.end && sentenceEnd > selection.start) {
                const karaokeWords = sentence.map(word => ({
                    word: word.word,
                    start: word.start - sentenceStart,
                    end: word.end - sentenceStart,
                }));
                await composition.addText({
                    text: sentence.map(w => w.punctuated_word).join(" "),
                    color: captionStyle.textColor,
                    fontFamily: captionStyle.fontFamily,
                    fontSize: captionStyle.fontSize * 10,
                    stroke: {
                        color: captionStyle.outlineColor,
                        width: 8,
                    },
                    animations: [{
                            type: "karaoke",
                            style: {
                                color: captionStyle.highlightColor,
                            },
                            words: karaokeWords,
                        }]
                }, {
                    position: { y: "80%" },
                    trim: { start: sentenceStart - selection.start, end: sentenceEnd - selection.start },
                });
            }
        }
        await composition.encode();
        const resultUrl = composition.url || composition.downloadUrl || composition.outputUrl;
        return {
            message: "Render successful.",
            videoUrl: resultUrl,
        };
    }
    catch (error) {
        logger.error("Video rendering pipeline failed with error:", error);
        throw new functions.https.HttpsError("internal", "Failed to render video.", { error });
    }
});
//# sourceMappingURL=index.js.map