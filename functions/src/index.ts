'use strict';

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { transcribeVideo } from "./ai/transcribe-video";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const Editframe = require("@editframe/editframe-js");

admin.initializeApp();
const db = admin.firestore();

export const onVideoUpload = functions.runWith({
    timeoutSeconds: 540,
    memory: "1GB",
}).storage.object().onFinalize(async (object) => {
    const bucketName = object.bucket;
    const filePath = object.name;
    const { logger } = functions;

    if (!filePath || !filePath.startsWith("uploads/")) { return null; }
    if (filePath.endsWith('/')) { return null; }

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
        const transcription = await transcribeVideo(bucketName, filePath);
        return videoDocRef.update({
            status: "completed",
            transcription: transcription.words,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        logger.error(`Transcription failed for ${filePath}:`, error);
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
        const clientId = process.env.EDITFRAME_CLIENT_ID;
        const token = process.env.EDITFRAME_TOKEN;

        if (!clientId || !token) {
            logger.error("CRITICAL: Editframe credentials not found in process.env.");
            throw new functions.https.HttpsError("internal", "Server is not configured for video rendering.");
        }

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
            await composition.layers.image({
                fileUrl: generatedBackground,
            });
        }

        await composition.layers.video({
            fileUrl: videoUrl,
            trim: { from: selection.start, to: selection.end },
            transform: { scale: transform.zoom, position: transform.pan }
        });

        const sentences = [];
        let currentSentence = [];
        for (const word of transcript) {
            currentSentence.push(word);
            if (
                word.punctuated_word.endsWith('.') ||
                word.punctuated_word.endsWith('?') ||
                word.punctuated_word.endsWith('!')
            ) {
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

        await composition.encode();

        return {
            message: "Render successful.",
            videoUrl: composition.url,
        };
    } catch (error) {
        logger.error("Video rendering pipeline failed with error:", error);
        throw new functions.https.HttpsError("internal", "Failed to render video.", { error });
    }
});