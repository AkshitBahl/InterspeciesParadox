import { useEffect, useRef } from "react";
import {
  advanceWalker,
  drawCity,
  ENCOUNTER_X,
  reachedEncounter,
  START_X,
  type Direction,
  type WalkerPosition,
} from "./introWorld";

export type IntroPhase = "ready" | "exploring" | "encounter";

interface Props {
  phase: IntroPhase;
  virtualDirection: Direction;
  autoWalk: boolean;
  onEncounter: () => void;
}

/**
 * A small interactive Canvas2D / isometric game, isolated from the application's
 * data model.  No collision engine or downloaded 3D assets are required.
 */
export default function MiniCityGame({ phase, virtualDirection, autoWalk, onEncounter }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ phase, virtualDirection, autoWalk, onEncounter });
  const walkerRef = useRef<WalkerPosition>({ x: START_X, z: 0 });
  const keysRef = useRef(new Set<string>());
  const hasTriggeredRef = useRef(false);
  useEffect(() => {
    stateRef.current = { phase, virtualDirection, autoWalk, onEncounter };
  }, [phase, virtualDirection, autoWalk, onEncounter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    let width = 1;
    let height = 1;
    let cameraX = START_X + 2.1;
    let frame = 0;
    let previousTime = 0;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onMotionChange = (event: MediaQueryListEvent) => { reducedMotion = event.matches; };
    motionQuery.addEventListener("change", onMotionChange);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const relevantKeys = new Set(["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s"]);
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!relevantKeys.has(key)) return;
      // Don't intercept keyboard input in accessibility controls / dialogues.
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (stateRef.current.phase !== "exploring") return;
      event.preventDefault();
      keysRef.current.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase());
    };
    const onBlur = () => keysRef.current.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    const animate = (now: number) => {
      const elapsed = previousTime ? Math.min((now - previousTime) / 1000, .05) : 0;
      previousTime = now;
      const current = stateRef.current;
      const keys = keysRef.current;
      const active = current.phase === "exploring";
      let horizontal = 0;
      let vertical = 0;

      if (active) {
        if (keys.has("arrowleft") || keys.has("a") || current.virtualDirection === "left") horizontal -= 1;
        if (keys.has("arrowright") || keys.has("d") || current.virtualDirection === "right") horizontal += 1;
        if (keys.has("arrowup") || keys.has("w") || current.virtualDirection === "up") vertical -= 1;
        if (keys.has("arrowdown") || keys.has("s") || current.virtualDirection === "down") vertical += 1;
        if (current.autoWalk && horizontal === 0) horizontal = 1;

        if (horizontal || vertical) {
          walkerRef.current = advanceWalker(walkerRef.current, elapsed, horizontal, vertical);
        }
        if (reachedEncounter(walkerRef.current) && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          current.onEncounter();
        }
      }

      const walker = walkerRef.current;
      const wantedCamera = walker.x + 2.1;
      cameraX += (wantedCamera - cameraX) * Math.min(1, elapsed * 3.1);
      const isWalking = active && !!(horizontal || vertical);
      drawCity(ctx, {
        width, height, time: now / 1000, cameraX, player: walker,
        walking: isWalking, encounter: current.phase === "encounter" || walker.x >= ENCOUNTER_X - .9,
        reducedMotion,
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="intro-world-canvas"
      role="img"
      aria-label="An illustrated, navigable eco-futuristic city street. A resident walks toward an apartment where a robin is nesting near the entrance. Use the controls to approach the bird."
    >
      A resident walks through a futuristic green city and encounters a bird nesting near an entrance.
    </canvas>
  );
}
