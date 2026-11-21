import { Config } from "@remotion/cli/config";
Config.setBrowserExecutable(process.env.REMOTION_BROWSER ?? null);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
