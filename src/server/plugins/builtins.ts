import { definePlugin } from "@mindstore/plugin-sdk";
import { PLUGIN_MANIFESTS } from "./registry";

export const builtInPlugins = Object.values(PLUGIN_MANIFESTS).map((manifest) =>
  definePlugin({
    source: "builtin",
    manifest,
  })
);
