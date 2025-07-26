"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Youtube, CheckCircle, AlertCircle } from "lucide-react";

interface YouTubeUploadProps {
  videoBlob?: Blob;
  accessToken?: string;
  isConnected: boolean;
  onUploadComplete?: (videoId: string) => void;
}

interface UploadMetadata {
  title: string;
  description: string;
  tags: string;
  privacy: "private" | "unlisted" | "public";
  category: string;
}

export default function YouTubeUpload({
  videoBlob,
  accessToken,
  isConnected,
  onUploadComplete,
}: YouTubeUploadProps) {
  const [metadata, setMetadata] = useState<UploadMetadata>({
    title: "",
    description: "",
    tags: "",
    privacy: "unlisted",
    category: "22", // People & Blogs
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!videoBlob || !accessToken || !isConnected) {
      setError("Video, YouTube connection, or access token is missing");
      return;
    }

    if (!metadata.title.trim()) {
      setError("Video title is required");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("video", videoBlob, "rendered-video.mp4");
      formData.append("title", metadata.title);
      formData.append("description", metadata.description);
      formData.append("tags", metadata.tags);
      formData.append("privacy", metadata.privacy);
      formData.append("category", metadata.category);

      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      setSuccess(`Video uploaded successfully! Video ID: ${result.videoId}`);
      onUploadComplete?.(result.videoId);

      // Reset form
      setMetadata({
        title: "",
        description: "",
        tags: "",
        privacy: "unlisted",
        category: "22",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const categories = [
    { value: "1", label: "Film & Animation" },
    { value: "2", label: "Autos & Vehicles" },
    { value: "10", label: "Music" },
    { value: "15", label: "Pets & Animals" },
    { value: "17", label: "Sports" },
    { value: "19", label: "Travel & Events" },
    { value: "20", label: "Gaming" },
    { value: "22", label: "People & Blogs" },
    { value: "23", label: "Comedy" },
    { value: "24", label: "Entertainment" },
    { value: "25", label: "News & Politics" },
    { value: "26", label: "Howto & Style" },
    { value: "27", label: "Education" },
    { value: "28", label: "Science & Technology" },
  ];

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <Alert>
            <Youtube className="h-4 w-4" />
            <AlertDescription>
              Connect your YouTube channel first to upload videos.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!videoBlob) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Render a video first to enable YouTube upload.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-red-500" />
          Upload to YouTube
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={metadata.title}
              onChange={(e) =>
                setMetadata((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter video title"
              maxLength={100}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {metadata.title.length}/100 characters
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={metadata.description}
              onChange={(e) =>
                setMetadata((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Enter video description"
              maxLength={5000}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {metadata.description.length}/5000 characters
            </p>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={metadata.tags}
              onChange={(e) =>
                setMetadata((prev) => ({ ...prev, tags: e.target.value }))
              }
              placeholder="Enter tags separated by commas"
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate tags with commas
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="privacy">Privacy</Label>
              <Select
                value={metadata.privacy}
                onValueChange={(value: "private" | "unlisted" | "public") =>
                  setMetadata((prev) => ({ ...prev, privacy: value }))
                }
                disabled={isUploading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="unlisted">Unlisted</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={metadata.category}
                onValueChange={(value) =>
                  setMetadata((prev) => ({ ...prev, category: value }))
                }
                disabled={isUploading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isUploading && (
            <div className="space-y-2">
              <Label>Upload Progress</Label>
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-muted-foreground">
                Uploading to YouTube...
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading || !metadata.title.trim()}
            className="w-full bg-red-500 hover:bg-red-600"
          >
            {isUploading ? (
              "Uploading..."
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload to YouTube
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
