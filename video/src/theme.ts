import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/Newsreader";
import { Easing } from "remotion";

export const sans = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
export const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;

/* InVin's own colours: warm near-black, warm off-white, tangerine as the one signal */
export const C = {
  bg: "#0d0c0b",
  bg2: "#161513",
  ink: "#f3efe8",
  muted: "#8a8782",
  line: "rgba(243,239,232,.12)",
  tang: "#ff5a1f",
  sand: "#d9ccb7",
  paid: "#12713f",
  paidBg: "#e3f2e8",
};

/* Strong ease-out for things arriving; ease-in-out for things travelling */
export const EO = Easing.bezier(0.23, 1, 0.32, 1);
export const EIO = Easing.bezier(0.77, 0, 0.175, 1);

export const MARK_PATH = "M94 48H162A46 46 0 0 1 208 94V162A46 46 0 0 1 162 208H94A46 46 0 0 1 48 162V94A46 46 0 0 1 94 48ZM109 88H147A13 13 0 0 1 147 114H109A13 13 0 0 1 109 88Z";
