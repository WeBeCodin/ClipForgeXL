
'use strict';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {transcribeVideo} from "./ai/transcribe-video";
import * as path from "path";

admin.initializeApp();
const db = admin.firestore();

// This function is triggered when a file is uploaded to the /uploads/ GCS folder.
export const onVideoUpload = functions.storage.object().onFinalize(async (object) => {
    const bucketName = object.bucket;
    const filePath = object.name;

    // Exit if this is a folder, or not in the 'uploads' folder.
    if (!filePath || !filePath.startsWith("uploads/")) {
        console.log(`Not a valid video upload or not in the correct folder: ${filePath}`);
        return null;
    }
    
    // Exit if this is a directory marker.
    if (filePath.endsWith('/')) {
        console.log(`This is a folder marker, skipping: ${filePath}`);
        return null;
    }

    const uid = filePath.split('/')[1]; // Assumes path is "uploads/{uid}/filename"
    if (!uid) {
        console.error(`Could not determine UID from path: ${filePath}`);
        return null;
    }

    console.log(`Video upload detected: ${filePath} by user ${uid}.`);
    
    // Create a document in Firestore to track the transcription status
    const videoDocId = `${uid}_${path.basename(filePath)}`;
    const videoDocRef = db.collection("videos").doc(videoDocId);

    console.log(`Creating Firestore document: /videos/${videoDocId}`);
    await videoDocRef.set({
        uid: uid,
        gcsPath: `gs://${bucketName}/${filePath}`,
        status: "processing",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
        console.log(`Starting transcription for ${filePath}...`);
        const transcription = await transcribeVideo(bucketName, filePath);
        
        console.log(`Transcription successful for ${filePath}. Updating Firestore with status 'completed'.`);
        // Return the promise to ensure the function waits for the update to complete.
        return videoDocRef.update({
            status: "completed",
            transcription: transcription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    } catch (error) {
        console.error(`Transcription or database update failed for ${filePath}:`, error);
        // Return the promise to ensure the function waits for the update to complete.
        return videoDocRef.update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
