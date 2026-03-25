import { defineMindStoreConfig } from "@mindstore/plugin-sdk";
import communityHelloPlugin from "@mindstore/example-community-plugin";
import { builtInPlugins } from "./src/server/plugins/builtins";

const deploymentMode = (
  process.env.MINDSTORE_DEPLOYMENT_MODE || "self-hosted"
) as "self-hosted" | "self-hosted-team" | "hosted-ready";

const mindstoreConfig = defineMindStoreConfig({
  docsRoot: "docs",
  deploymentMode,
  plugins: [...builtInPlugins, communityHelloPlugin],
});

export default mindstoreConfig;
