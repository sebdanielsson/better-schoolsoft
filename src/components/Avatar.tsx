import { Avatar as RootAvatar, AvatarFallback, AvatarImage } from "./ui/avatar.tsx";
import { useEvaResourceBlob } from "../hooks/useEvaResourceBlob.tsx";
import { colorFromName, initials } from "../lib/avatar-helpers.ts";

interface AvatarProps {
  name: string;
  /** Resource filename like "teacher9840.jpg" or "student115957.jpg". */
  picture?: string | null;
  size?: number;
}

export default function Avatar({ name, picture, size = 32 }: AvatarProps) {
  const src = useEvaResourceBlob(picture);
  const fontSize = `${Math.max(11, Math.floor(size * 0.4))}px`;

  return (
    <RootAvatar className="overflow-hidden after:hidden" style={{ width: size, height: size }}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback
        className="font-bold tracking-wide text-white"
        style={{ background: colorFromName(name), fontSize }}
      >
        {initials(name)}
      </AvatarFallback>
    </RootAvatar>
  );
}
