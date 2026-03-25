import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildExtensionConnection, EXTENSION_FILES, EXTENSION_ROOT } from "@/server/extension";

export async function GET(req: NextRequest) {
  try {
    const zip = new JSZip();
    const origin = req.nextUrl.origin;
    const connection = buildExtensionConnection(origin);

    for (const relativePath of EXTENSION_FILES) {
      const absolutePath = path.join(EXTENSION_ROOT, relativePath);
      const fileContents = await fs.readFile(absolutePath);
      zip.file(relativePath, fileContents);
    }

    zip.file(
      "mindstore-everywhere.setup.json",
      JSON.stringify(
        {
          baseUrl: connection.baseUrl,
          docs: connection.docsUrl,
          captureUrl: connection.captureUrl,
          queryUrl: connection.queryUrl,
          setupUrl: connection.setupUrl,
          mcpUrl: connection.mcpUrl,
          note: "Paste an API key from Settings if your deployment is hosted or shared.",
        },
        null,
        2
      )
    );

    const archive = await zip.generateAsync({ type: "uint8array" });

    return new NextResponse(Buffer.from(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="mindstore-everywhere.zip"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to build extension package";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
