'use strict';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {transcribeVideo} from "./ai/transcribe-video";
import * as path from "path";
const Editframe = require("@editframe/editframe-js");

admin.initializeApp();
const db = admin.firestore();

// This function is triggered when a file is uploaded to the /uploads/ GCS folder.
export const onVideoUpload = functions.runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: "1GB",
}).storage.object().onFinalize(async (object) => {
    const bucketName = object.bucket;
    const filePath = object.name;

    // Using functions.logger for structured logging
    const { logger } = functions;

    // Exit if this is a folder, or not in the 'uploads' folder.
    if (!filePath || !filePath.startsWith("uploads/")) {
        logger.log(`Not a valid video upload or not in the correct folder: ${filePath}`);
        return null;
    }
    
    // Exit if this is a directory marker.
    if (filePath.endsWith('/')) {
        logger.log(`This is a folder marker, skipping: ${filePath}`);
        return null;
    }

    const uid = filePath.split('/')[1]; // Assumes path is "uploads/{uid}/filename"
    if (!uid) {
        logger.error(`Could not determine UID from path: ${filePath}`);
        return null;
    }

    logger.log(`Video upload detected: ${filePath} by user ${uid}.`);
    
    // Create a document in Firestore to track the transcription status
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
        
        logger.log(`Transcription successful for ${filePath}. Updating Firestore with status 'completed'.`);
        // Return the promise chain to ensure the function waits for the update to complete.
        return videoDocRef.update({
            status: "completed",
            transcription: transcription.words, // Store the array of words
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).then(() => {
            logger.log(`Firestore status updated to 'completed' for ${videoDocId}.`);
        });

    } catch (error) {
        logger.error(`Transcription or database update failed for ${filePath}:`, error);
        // Return the promise chain to ensure the function waits for the update to complete.
        return videoDocRef.update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).then(() => {
            logger.log(`Firestore status updated to 'failed' for ${videoDocId}.`);
        });
    }
});

// This function is callable from the client-side application.
export const renderVideo = functions.https.onCall(async (data, context) => {
    const { logger } = functions;
    
    if (!data.videoUrl || !data.selection) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data.');
    }

    try {
        const editframe = new Editframe({
            clientId: functions.config().editframe.client_id,
            token: functions.config().editframe.token,
        });
        
        const {
            videoUrl,
            transcript,
            selection,
            generatedBackground,
            captionStyle,
            transform,
        } = data;
        
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

        // Create captions
        for (const word of transcript) {
            if (word.start >= selection.start && word.end <= selection.end) {
                await composition.layers.text({
                    text: word.punctuated_word,
                    position: {
                        x: "50%",
                        y: "80%",
                    },
                    size: captionStyle.fontSize,
                    color: captionStyle.textColor,
                    fontFamily: captionStyle.fontFamily,
                    trim: {
                        from: word.start - selection.start,
                        to: word.end - selection.start,
                    },
                    // Add more styling options as needed
                });
            }
        }
        
        await composition.encode();
        
        return {
            message: "Render successful.",
            videoUrl: composition.url,
        };
        
    } catch (error) {
        logger.error("Error rendering video with Editframe:", error);
        throw new functions.https.HttpsError("internal", "Failed to render video.");
    }
});
