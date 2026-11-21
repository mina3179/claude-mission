import React from "react";
import { Composition, Still } from "remotion";
import { MV, Poster } from "./MV";
import { DURATION_FRAMES, FPS } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="NoiraraMV" component={MV} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} />
    <Still id="Poster" component={Poster} width={1080} height={1920} />
  </>
);
