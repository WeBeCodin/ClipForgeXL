'use strict';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {transcribeVideo} from "./ai/transcribe-video";
import * as path from "path";

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

// Export the new FFmpeg-based clip generator
export { generateClip as renderVideo } from "./video/ffmpeg-processor";