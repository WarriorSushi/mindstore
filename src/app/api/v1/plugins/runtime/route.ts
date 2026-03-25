import { NextRequest, NextResponse } from "next/server";
import { getInstalledPluginMap } from "@/server/plugins/state";
import { pluginRuntime } from "@/server/plugins/runtime";
import { getUserId } from "@/server/user";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "dashboard";

    if (action !== "dashboard") {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const userId = await getUserId();
    const installedMap = await getInstalledPluginMap();
    const widgets = await Promise.all(
      pluginRuntime
        .getDashboardWidgets(installedMap, { userId })
        .sort((a, b) => a.definition.priority - b.definition.priority)
        .map(async (binding) => ({
          pluginSlug: binding.pluginSlug,
          definition: binding.definition,
          data: await binding.load(),
        }))
    );

    return NextResponse.json({ widgets });
  } catch (error) {
    console.error("Plugin runtime dashboard error:", error);
    return NextResponse.json({ error: "Failed to load plugin widgets" }, { status: 500 });
  }
}
