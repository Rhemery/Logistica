import { $Level } from "@package/net/minecraft/world/level";
import { toCommandNumber } from "./utils";

type PlaySoundOptions = {
  source:
    | "ambient"
    | "block"
    | "hostile"
    | "master"
    | "music"
    | "neutral"
    | "player"
    | "record"
    | "voice"
    | "weather";
  target: "@a" | "@e" | "@n" | "@p" | "@r" | "@s";
  x: number;
  y: number;
  z: number;
  distance: number;
  volume: number;
  pitch: number;
  minVolume: number;
};
export function playSound(
  level: $Level,
  soundId: string,
  options: Partial<PlaySoundOptions>,
): void {
  const o: PlaySoundOptions = {
    source: "neutral",
    target: "@a",
    x: 0,
    y: 0,
    z: 0,
    distance: 64,
    volume: 1,
    pitch: 1,
    minVolume: 0,
    ...options,
  };

  const sx = toCommandNumber(o.x);
  const sy = toCommandNumber(o.y);
  const sz = toCommandNumber(o.z);

  level.runCommandSilent(
    `playsound ${soundId} ${o.source} ${o.target} ${sx} ${sy} ${sz} ${o.volume} ${o.pitch} ${o.minVolume}`,
  );
}
