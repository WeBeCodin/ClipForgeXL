
'use strict';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {transcribeVideo} from "./ai/transcribe-video";

admin.initializeApp();
const db = admin.firestore();

// This function is triggered when a file is uploaded to the /uploads/ GCS folder.
export const onVideoUpload = functions.storage.object().onFinalize(async (object) => {
    // Exit if this is not a file, or if it's not in the 'uploads' folder.
    if (!object.name || !object.name.startsWith("uploads/")) {
        console.log("Not a valid video upload.");
        return null;
    }

    const bucketName = object.bucket;
    const filePath = object.name;
    const uid = object.name.split('/')[1]; // Assumes path is "uploads/{uid}/filename"

    console.log(`Video upload detected: ${filePath} by user ${uid}.`);
    
    // Create a document in Firestore to track the transcription status
    const videoDocRef = db.collection("videos").doc(uid + "_" + path.basename(filePath));
    await videoDocRef.set({
        uid: uid,
        gcsPath: `gs://${bucketName}/${filePath}`,
        status: "processing",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
        console.log(`Starting transcription for ${filePath}...`);
        const transcription = await transcribeVideo(bucketName, filePath);
        
        console.log("Transcription successful, updating Firestore.");
        await videoDocRef.update({
            status: "completed",
            transcription: transcription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Firestore updated for ${filePath}.`);

    } catch (error) {
        console.error("Transcription failed:", error);
        await videoDocRef.update({
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    return null;
});
