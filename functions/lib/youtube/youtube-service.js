"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadClipToYouTube = void 0;
exports.uploadToYouTube = uploadToYouTube;
const googleapis_1 = require("googleapis");
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const storage_1 = require("@google-cloud/storage");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const youtube = googleapis_1.google.youtube('v3');
const storage = new storage_1.Storage();
async function uploadToYouTube(videoFilePath, options, accessToken) {
    try {
        const auth = new googleapis_1.google.auth.OAuth2();
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
        return videoId;
    }
    catch (error) {
        console.error('YouTube upload error:', error);
        throw new functions.https.HttpsError('internal', `YouTube upload failed: ${error}`);
    }
}
exports.uploadClipToYouTube = functions
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
    }
    catch (error) {
        console.error('Upload to YouTube failed:', error);
        throw new functions.https.HttpsError('internal', `Upload failed: ${error}`);
    }
});
//# sourceMappingURL=youtube-service.js.map