/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

// Use lossless PNG for intermediate frames so text/borders stay crisp through to H.264.
Config.setVideoImageFormat("png");
// Higher quality H.264 (lower CRF = better quality). Default is 18; 14 ≈ visually lossless for screen recordings.
Config.setCrf(14);
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig(enableTailwind);
