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
// Export the new FFmpeg-based clip generator
var ffmpeg_processor_1 = require("./video/ffmpeg-processor");
Object.defineProperty(exports, "renderVideo", { enumerable: true, get: function () { return ffmpeg_processor_1.generateClip; } });
//# sourceMappingURL=index.js.map