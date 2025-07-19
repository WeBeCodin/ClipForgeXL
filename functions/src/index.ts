'use strict';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {transcribeVideo} from "./ai/transcribe-video";
import *d* path from "path";

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
    
    // 1. Validate input data (basic validation)
    if (!data.videoUrl || !data.selection) {
        logger.error("Invalid data payload received.", data);
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The function must be called with "videoUrl" and "selection" arguments.'
        );
    }
    
    // Optional: Authenticate the user if needed.
    if (!context.auth) {
        logger.warn("Render function called by an unauthenticated user.");
        // Depending on your requirements, you might want to throw an error here.
    }

    logger.log("Received render request with data:", data);

    // 2. Placeholder for the actual rendering logic
    // This is where you would use a library like Remotion, FFMPEG, 
    // or call a third-party video rendering API.
    
    // For now, we simulate a successful render.
    const outputVideoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4";

    logger.log(`Simulated rendering. Returning dummy URL: ${outputVideoUrl}`);
    
    // 3. Return the URL of the rendered video.
    return {
        message: "Render job started successfully (simulation).",
        videoUrl: outputVideoUrl,
    };
});
