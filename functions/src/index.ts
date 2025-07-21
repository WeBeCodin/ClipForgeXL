'use strict';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {transcribeVideo} from "./ai/transcribe-video";
import * as path from "path";
import { Editframe } from "@editframe/editframe-js";

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

    try {
        logger.log("Initializing Editframe with credentials...");
        const editframe = new Editframe({
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
                x: transform.pan?.x || "center",
                y: transform.pan?.y || "center",
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
            if (currentSentence.length > 0) sentences.push(currentSentence);

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
                    
                    // Calculate Y position as pixel value instead of percentage
                    const yPosition = captionStyle?.position === "top" ? 
                        Math.round(height * 0.2) : Math.round(height * 0.8);
                    
                    await composition.addText({
                        text: sentenceText,
                        color: captionStyle?.textColor || "#ffffff",
                        fontFamily: captionStyle?.fontFamily || "Arial",
                        fontSize: Math.round((captionStyle?.fontSize || 2) * 50), // Convert rem to pixels
                        backgroundColor: captionStyle?.backgroundColor || "transparent",
                        textAlign: "center",
                    }, {
                        position: { 
                            x: "center", 
                            y: yPosition
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
            downloadUrl: video.downloadUrl,
            streamUrl: video.streamUrl,
            isReady: video.isReady,
        };
        
    } catch (error) {
        logger.error("Error rendering video with Editframe:", error);
        
        // Provide more detailed error information
        if (error instanceof Error) {
            logger.error("Error details:", {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }
        
        throw new functions.https.HttpsError(
            "internal", 
            `Failed to render video: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
});