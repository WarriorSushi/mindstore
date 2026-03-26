import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  buildMcpDiscovery,
  createOfficialMcpServer,
} from "@/server/mcp/runtime";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
  "Cache-Control": "no-store",
};

export async function GET() {
  return NextResponse.json(await buildMcpDiscovery(), { headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  return handleSdkTransportRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleSdkTransportRequest(request);
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

async function handleSdkTransportRequest(request: NextRequest) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = await createOfficialMcpServer();

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response);
  } catch (error) {
    console.error("MCP transport error:", error);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      },
      {
        status: 500,
        headers: CORS_HEADERS,
      }
    );
  } finally {
    await transport.close();
    await server.close();
  }
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
