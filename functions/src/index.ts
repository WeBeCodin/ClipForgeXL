'use strict';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {transcribeVideo} from "./ai/transcribe-video";
import * as path from "path";
const Editframe = require("@editframe/editframe-js");
import * as dotenv from "dotenv";
dotenv.config();

admin.initializeApp();
const db = admin.firestore();

// This function is triggered when a file is uploaded to the /uploads/ GCS folder.
export const onVideoUpload = functions.runWith({
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
        const transcription = await transcribeVideo(bucketName, filePath);
        
        logger.log(`Transcription successful for ${filePath}. Updating Firestore.`);
        return videoDocRef.update({
            status: "completed",
            transcription: transcription.words,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    } catch (error) {
        logger.error(`Transcription or database update failed for ${filePath}:`, error);
        return videoDocRef.update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});

export const renderVideo = functions.https.onCall(async (data, context) => {
    const { logger } = functions;
    
    if (!data.videoUrl || !data.selection) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data.');
    }

    const {
        videoUrl,
        transcript,
        selection,
        generatedBackground,
        captionStyle,
        transform,
    } = data;
        
    const [width, height] = transform.aspectRatio === "9/16" ? [1080, 1920] : [1920, 1080];

    try {
        logger.info("Initializing Editframe SDK...");
        const efConfig = functions.config().editframe;

        if (!efConfig || !efConfig.client_id || !efConfig.token) {
            logger.error("Editframe credentials are not set in Firebase Functions config.");
            throw new functions.https.HttpsError("internal", "Server is not configured for video rendering.");
        }
        
        // Log the credentials to confirm they are loaded (partially redacted).
        logger.info(`Found Editframe Client ID: ${efConfig.client_id.substring(0, 4)}...`);

        const editframe = new Editframe({
            clientId: efConfig.client_id,
            token: efConfig.token,
        });
        logger.info("Editframe SDK initialized successfully.");

        let composition;
        try {
            logger.info("Creating new video composition...");
            composition = await editframe.videos.new({
                dimensions: { width, height },
                duration: selection.end - selection.start,
            });
            logger.info(`Composition created with ID: ${composition.id}`);
        } catch(e) {
            logger.error("Failed to create Editframe composition:", e);
            throw e;
        }

        if (generatedBackground) {
            try {
                logger.info("Adding background layer...");
                await composition.layers.image({ fileUrl: generatedBackground });
                logger.info("Background layer added.");
            } catch(e) {
                logger.error("Failed to add background layer:", e);
                throw e;
            }
        }
        
        try {
            logger.info("Adding video layer...");
            await composition.layers.video({
                fileUrl: videoUrl,
                trim: { from: selection.start, to: selection.end },
                transform: { scale: transform.zoom, position: transform.pan }
            });
            logger.info("Video layer added.");
        } catch(e) {
            logger.error("Failed to add video layer:", e);
            throw e;
        }

        try {
            logger.info("Adding caption layers...");
            // Logic for adding karaoke-style captions...
            // (Keeping the existing logic, just wrapping in try/catch for now)
            const sentences = [];
            let currentSentence = [];
            for (const word of transcript) {
                currentSentence.push(word);
                if (word.punctuated_word.endsWith('.') || word.punctuated_word.endsWith('?') || word.punctuated_word.endsWith('!')) {
                    sentences.push(currentSentence);
                    currentSentence = [];
                }
            }
            if (currentSentence.length > 0) sentences.push(currentSentence);

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
                        fontSize: captionStyle.fontSize * 10,
                        position: { y: "80%" },
                        style: { stroke: { color: captionStyle.outlineColor, width: 8 } },
                        trim: { from: sentenceStart - selection.start, to: sentenceEnd - selection.start },
                        animations: [{ type: "karaoke", style: { color: captionStyle.highlightColor }, words: karaokeWords }]
                    });
                }
            }
            logger.info("Caption layers added.");
        } catch(e) {
            logger.error("Failed to add caption layers:", e);
            throw e;
        }
        
        try {
            logger.info("Encoding video...");
            await composition.encode();
            logger.info("Video encoding started successfully.");
        } catch(e) {
            logger.error("Failed to encode video:", e);
            throw e;
        }
        
        return {
            message: "Render successful.",
            videoUrl: composition.url,
        };
        
    } catch (error) {
        logger.error("Video rendering pipeline failed:", error);
        throw new functions.https.HttpsError("internal", "Failed to render video.");
    }
});
