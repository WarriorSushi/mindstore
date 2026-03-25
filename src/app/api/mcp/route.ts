import { NextRequest, NextResponse } from "next/server";
import {
  buildMcpDiscovery,
  callMcpTool,
  getMcpBindings,
  getMcpPrompt,
  readMcpResource,
  MINDSTORE_MCP_SERVER_INFO,
} from "@/server/mcp/runtime";

function jsonRpcResponse(id: unknown, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET() {
  return NextResponse.json(await buildMcpDiscovery(), { headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, params, id } = body;
    let response;

    switch (method) {
      case "initialize": {
        const bindings = await getMcpBindings();
        response = jsonRpcResponse(id, {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: MINDSTORE_MCP_SERVER_INFO.name,
            version: MINDSTORE_MCP_SERVER_INFO.version,
          },
          capabilities: {
            tools: { listChanged: bindings.tools.length > 0 },
            resources: { subscribe: false, listChanged: bindings.resources.length > 0 },
            prompts: { listChanged: bindings.prompts.length > 0 },
          },
        });
        break;
      }

      case "notifications/initialized":
        return new NextResponse(null, { status: 204, headers: CORS_HEADERS });

      case "tools/list": {
        const discovery = await buildMcpDiscovery();
        response = jsonRpcResponse(id, { tools: discovery.capabilities.tools });
        break;
      }

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          if (!toolName) {
            response = jsonRpcError(id, -32602, "Missing required parameter: name");
            break;
          }

          const result = await callMcpTool(toolName, toolArgs);
          response = jsonRpcResponse(id, {
            content: [{ type: "text", text: result.text }],
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Tool execution failed";
          response = jsonRpcResponse(id, {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
          });
        }
        break;
      }

      case "resources/list": {
        const discovery = await buildMcpDiscovery();
        response = jsonRpcResponse(id, { resources: discovery.capabilities.resources });
        break;
      }

      case "resources/read": {
        const uri = params?.uri;
        try {
          if (!uri) {
            response = jsonRpcError(id, -32602, "Missing required parameter: uri");
            break;
          }

          const text = await readMcpResource(uri);
          response = jsonRpcResponse(id, {
            contents: [{ uri, mimeType: "text/plain", text }],
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Resource read failed";
          response = jsonRpcError(id, -32603, message);
        }
        break;
      }

      case "prompts/list": {
        const discovery = await buildMcpDiscovery();
        response = jsonRpcResponse(id, { prompts: discovery.capabilities.prompts });
        break;
      }

      case "prompts/get": {
        try {
          const promptName = params?.name;
          if (!promptName) {
            response = jsonRpcError(id, -32602, "Missing required parameter: name");
            break;
          }

          response = jsonRpcResponse(id, await getMcpPrompt(promptName, params?.arguments || {}));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Prompt resolution failed";
          response = jsonRpcError(id, -32603, message);
        }
        break;
      }

      case "ping":
        response = jsonRpcResponse(id, {});
        break;

      default:
        response = jsonRpcError(id, -32601, `Method not found: ${method}`);
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, "Parse error"), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}
