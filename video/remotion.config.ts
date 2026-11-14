import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// The video reuses the app's own invoice renderer: resolve "@/..." to the web app's src,
// and keep a single React (the video's) for everything.
Config.overrideWebpackConfig((c) => ({
  ...c,
  resolve: {
    ...c.resolve,
    alias: {
      ...(c.resolve?.alias ?? {}),
      "@": path.resolve(process.cwd(), "../web/src"),
      react: path.resolve(process.cwd(), "node_modules/react"),
      "react-dom": path.resolve(process.cwd(), "node_modules/react-dom"),
      clsx: path.resolve(process.cwd(), "node_modules/clsx"),
    },
  },
}));
