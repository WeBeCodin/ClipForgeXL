import { google } from 'googleapis';
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const youtube = google.youtube('v3');
const storage = new Storage();

interface YouTubeUploadOptions {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'private' | 'public' | 'unlisted';
}

export async function uploadToYouTube(
  videoFilePath: string,
  options: YouTubeUploadOptions,
  accessToken: string
): Promise<string> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const response = await youtube.videos.insert({
      auth,
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: options.title,
          description: options.description,
          tags: options.tags,
          categoryId: options.categoryId,
        },
        status: {
          privacyStatus: options.privacyStatus,
        },
      },
      media: {
        body: fs.createReadStream(videoFilePath),
      },
    });

    const videoId = response.data.id;
    console.log(`Video uploaded successfully: https://youtube.com/watch?v=${videoId}`);
    
    return videoId!;
  } catch (error) {
    console.error('YouTube upload error:', error);
    throw new functions.https.HttpsError('internal', `YouTube upload failed: ${error}`);
  }
}

export const uploadClipToYouTube = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "2GB",
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { clipUrl, title, description, tags, accessToken } = data;

    if (!clipUrl || !title || !accessToken) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    try {
      // Extract file path from URL
      const urlMatch = clipUrl.match(/\/([^\/]+\.mp4)$/);
      if (!urlMatch) {
        throw new Error('Invalid clip URL format');
      }
      
      const fileName = urlMatch[1];
      const tempFilePath = path.join(os.tmpdir(), fileName);
      
      // Download from your storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(`clips/${fileName}`);
      await file.download({ destination: tempFilePath });

      // Upload to YouTube
      const videoId = await uploadToYouTube(tempFilePath, {
        title,
        description: description || '',
        tags: tags || [],
        categoryId: '22', // People & Blogs
        privacyStatus: 'unlisted', // Start as unlisted for review
      }, accessToken);

      // Cleanup temp file
      fs.unlinkSync(tempFilePath);

      return { 
        videoId, 
        youtubeUrl: `https://youtube.com/watch?v=${videoId}` 
      };

    } catch (error) {
      console.error('Upload to YouTube failed:', error);
      throw new functions.https.HttpsError('internal', `Upload failed: ${error}`);
    }
  });