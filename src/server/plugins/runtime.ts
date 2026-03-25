import { createPluginRuntime } from "@mindstore/plugin-runtime";
import mindstoreConfig from "../../../mindstore.config";

export const FEATURED_PLUGIN_SLUGS = [
  "kindle-importer",
  "youtube-transcript",
  "mind-map-generator",
  "flashcard-maker",
  "voice-to-memory",
  "blog-draft",
];

export const pluginRuntime = createPluginRuntime(mindstoreConfig);

export function getMindStoreConfig() {
  return mindstoreConfig;
}
