"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Transform } from "@/lib/types";
import { AspectRatio } from "@radix-ui/react-aspect-ratio";

type TransformControlsProps = {
  transform: Transform;
  setTransform: (transform: Transform) => void;
};

export function TransformControls({ transform, setTransform }: TransformControlsProps) {
  const handleAspectRatioChange = (value: Transform["aspectRatio"]) => {
    if (value) {
      setTransform({ ...transform, aspectRatio: value });
    }
  };

  const handleZoomChange = (value: number[]) => {
    setTransform({ ...transform, zoom: value[0] });
  };

  const handlePanXChange = (value: number[]) => {
    setTransform({ ...transform, pan: { ...transform.pan, x: value[0] } });
  };

  const handlePanYChange = (value: number[]) => {
    setTransform({ ...transform, pan: { ...transform.pan, y: value[0] } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transform</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Aspect Ratio</Label>
          <ToggleGroup
            type="single"
            value={transform.aspectRatio}
            onValueChange={handleAspectRatioChange}
            className="grid grid-cols-4"
          >
            <ToggleGroupItem value="16/9">16:9</ToggleGroupItem>
            <ToggleGroupItem value="9/16">9:16</ToggleGroupItem>
            <ToggleGroupItem value="1/1">1:1</ToggleGroupItem>
            <ToggleGroupItem value="4/5">4:5</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-2">
          <Label>Zoom</Label>
          <Slider
            min={1}
            max={3}
            step={0.05}
            value={[transform.zoom]}
            onValueChange={handleZoomChange}
          />
        </div>
        <div className="space-y-2">
          <Label>Pan (X-axis)</Label>
          <Slider
            min={-100}
            max={100}
            step={1}
            value={[transform.pan.x]}
            onValueChange={handlePanXChange}
          />
        </div>
        <div className="space-y-2">
          <Label>Pan (Y-axis)</Label>
          <Slider
            min={-100}
            max={100}
            step={1}
            value={[transform.pan.y]}
            onValueChange={handlePanYChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
