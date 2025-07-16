import { Film } from "lucide-react";

export function Header() {
  return (
    <header className="px-4 lg:px-6 h-16 flex items-center border-b">
      <a className="flex items-center justify-center" href="#">
        <Film className="h-6 w-6 text-accent" />
        <span className="ml-2 text-lg font-bold font-headline">ClipForge XL</span>
      </a>
    </header>
  );
}
