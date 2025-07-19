'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVideo = exports.onVideoUpload = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const transcribe_video_1 = require("./ai/transcribe-video");
const path = require("path");
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
    const { logger } = functions;
    if (!data.videoUrl || !data.selection) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data.');
    }
    try {
        const editframe = new Editframe({
            clientId: functions.config().editframe.client_id,
            token: functions.config().editframe.token,
        });
        const { videoUrl, transcript, selection, generatedBackground, captionStyle, transform, } = data;
        const [width, height] = transform.aspectRatio === "9/16" ? [1080, 1920] : [1920, 1080];
        const composition = await editframe.videos.new({
            dimensions: { width, height },
            duration: selection.end - selection.start,
        });
        if (generatedBackground) {
            await composition.layers.image({
                fileUrl: generatedBackground,
            });
        }
        await composition.layers.video({
            fileUrl: videoUrl,
            trim: { from: selection.start, to: selection.end },
            transform: {
                scale: transform.zoom,
                position: transform.pan,
            }
        });
        const sentences = [];
        let currentSentence = [];
        for (const word of transcript) {
            currentSentence.push(word);
            if (word.punctuated_word.endsWith('.') || word.punctuated_word.endsWith('?') || word.punctuated_word.endsWith('!')) {
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
                await composition.layers.text({
                    text: sentence.map(w => w.punctuated_word).join(" "),
                    color: captionStyle.textColor,
                    fontFamily: captionStyle.fontFamily,
                    fontSize: captionStyle.fontSize * 10, // Convert rem to pixels
                    position: { y: "80%" },
                    style: {
                        stroke: {
                            color: captionStyle.outlineColor,
                            width: 8,
                        }
                    },
                    trim: {
                        from: sentenceStart - selection.start,
                        to: sentenceEnd - selection.start,
                    },
                    animations: [{
                            type: "karaoke",
                            style: {
                                color: captionStyle.highlightColor,
                            },
                            words: karaokeWords,
                        }]
                });
            }
        }
        await composition.encode();
        return {
            message: "Render successful.",
            videoUrl: composition.url,
        };
    }
    catch (error) {
        logger.error("Error rendering video with Editframe:", error);
        throw new functions.https.HttpsError("internal", "Failed to render video.");
    }
});
//# sourceMappingURL=index.js.map