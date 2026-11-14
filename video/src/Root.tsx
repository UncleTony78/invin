import { Composition, Folder } from "remotion";
import { FILM_FRAMES, Film } from "./Film";
import { V_FRAMES, VerticalA, VerticalB, VerticalC } from "./Vertical";

export const Root = () => (
  <>
    <Composition id="Launch" component={Film} durationInFrames={FILM_FRAMES} fps={30} width={1920} height={1080} />
    <Folder name="Vertical">
      <Composition id="V-A-StopChasing" component={VerticalA} durationInFrames={V_FRAMES.A} fps={30} width={1080} height={1920} />
      <Composition id="V-B-Designs" component={VerticalB} durationInFrames={V_FRAMES.B} fps={30} width={1080} height={1920} />
      <Composition id="V-C-Opened" component={VerticalC} durationInFrames={V_FRAMES.C} fps={30} width={1080} height={1920} />
    </Folder>
  </>
);
