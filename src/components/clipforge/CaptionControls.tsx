"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

type CaptionControlsProps = {
  textColor: string;
  setTextColor: (color: string) => void;
  highlightColor: string;
  setHighlightColor: (color: string) => void;
  outlineColor: string;
  setOutlineColor: (color: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
};

const fonts = [
  { name: "Inter", value: "Inter, sans-serif" },
  { name: "Roboto", value: "Roboto, sans-serif" },
  { name: "Lato", value: "Lato, sans-serif" },
  { name: "Montserrat", value: "Montserrat, sans-serif" },
  { name: "Oswald", value: "Oswald, sans-serif" },
  { name: "Roboto Mono", value: "Roboto Mono, monospace" },
];

export function CaptionControls({
  textColor,
  setTextColor,
  highlightColor,
  setHighlightColor,
  outlineColor,
  setOutlineColor,
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
}: CaptionControlsProps) {
  // Convert slider value (1-5) to pixel display value (16-80px)
  const getDisplayPixels = (sliderValue: number): number => {
    return Math.round(sliderValue * 16); // 1 = 16px, 2 = 32px, 3 = 48px, 4 = 64px, 5 = 80px
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Caption Styles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2">
            <Label>Text</Label>
            <Input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="w-12 h-12"
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Label>Highlight</Label>
            <Input
              type="color"
              value={highlightColor}
              onChange={(e) => setHighlightColor(e.target.value)}
              className="w-12 h-12"
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Label>Outline</Label>
            <Input
              type="color"
              value={outlineColor}
              onChange={(e) => setOutlineColor(e.target.value)}
              className="w-12 h-12"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select value={fontFamily} onValueChange={setFontFamily}>
            <SelectTrigger>
              <SelectValue placeholder="Select a font" />
            </SelectTrigger>
            <SelectContent>
              {fonts.map((font) => (
                <SelectItem key={font.name} value={font.value}>
                  {font.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Font Size ({getDisplayPixels(fontSize)}px)</Label>
          <Slider
            min={1}
            max={5}
            step={0.1}
            value={[fontSize]}
            onValueChange={(value) => setFontSize(value[0])}
          />
        </div>
      </CardContent>
    </Card>
  );
}