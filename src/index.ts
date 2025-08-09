import { existsSync } from "fs";
import { writeFile, appendFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { FastifyRequest, FastifyReply } from "fastify";
import { initConfig, initDir } from "./utils";
import { createServer } from "./server";
import { router } from "./utils/router";
import { apiKeyAuth } from "./middleware/auth";
import {
  cleanupPidFile,
  isServiceRunning,
  savePid,
} from "./utils/processCheck";
import { CONFIG_FILE } from "./constants";

// 日志记录函数 - 记录 /v1/messages 请求数据到指定文件
async function logMessagesRequest(data: any) {
  const logDir = join(homedir(), "claude-code");
  const logFile = join(logDir, "claude-code-req.log");
  
  try {
    // 确保日志目录存在
    await mkdir(logDir, { recursive: true });
    
    // 准备日志内容
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] /v1/messages Request Data:\n${JSON.stringify(data, null, 2)}\n\n`;
    
    // 追加到日志文件
    await appendFile(logFile, logEntry, "utf8");
  } catch (error) {
    console.error("Failed to write request log:", error);
  }
}

// 日志记录函数 - 记录 /v1/messages 返回值到指定文件
async function logMessagesResponse(data: any, requestId?: string) {
  const logDir = join(homedir(), "claude-code");
  const logFile = join(logDir, "claude-code-res.log");
  
  try {
    // 确保日志目录存在
    await mkdir(logDir, { recursive: true });
    
    // 准备日志内容
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] /v1/messages Response Data${requestId ? ` (Request ID: ${requestId})` : ''}:\n${JSON.stringify(data, null, 2)}\n${'='.repeat(100)}\n\n`;
    
    // 追加到日志文件
    await appendFile(logFile, logEntry, "utf8");
  } catch (error) {
    console.error("Failed to write response log:", error);
  }
}

// 日志记录函数 - 记录流式响应数据
async function logStreamResponse(chunk: string, requestId?: string, isStart: boolean = false, isEnd: boolean = false) {
  const logDir = join(homedir(), "claude-code");
  const logFile = join(logDir, "claude-code-res.log");
  
  try {
    // 确保日志目录存在
    await mkdir(logDir, { recursive: true });
    
    const timestamp = new Date().toISOString();
    let logEntry = "";
    
    if (isStart) {
      logEntry = `[${timestamp}] /v1/messages Stream Response Start${requestId ? ` (Request ID: ${requestId})` : ''}:\n`;
    } else if (isEnd) {
      logEntry = `[${timestamp}] /v1/messages Stream Response End${requestId ? ` (Request ID: ${requestId})` : ''}\n${'='.repeat(100)}\n\n`;
    } else {
      logEntry = chunk;
    }
    
    // 追加到日志文件
    await appendFile(logFile, logEntry, "utf8");
  } catch (error) {
    console.error("Failed to write stream response log:", error);
  }
}

async function initializeClaudeConfig() {
  const homeDir = homedir();
  const configPath = join(homeDir, ".claude.json");
  if (!existsSync(configPath)) {
    const userID = Array.from(
      { length: 64 },
      () => Math.random().toString(16)[2]
    ).join("");
    const configContent = {
      numStartups: 184,
      autoUpdaterStatus: "enabled",
      userID,
      hasCompletedOnboarding: true,
      lastOnboardingVersion: "1.0.17",
      projects: {},
    };
    await writeFile(configPath, JSON.stringify(configContent, null, 2));
  }
}

interface RunOptions {
  port?: number;
}

async function run(options: RunOptions = {}) {
  // Check if service is already running
  if (isServiceRunning()) {
    console.log("✅ Service is already running in the background.");
    return;
  }

  await initializeClaudeConfig();
  await initDir();
  const config = await initConfig();
  let HOST = config.HOST;

  if (config.HOST && !config.APIKEY) {
    HOST = "127.0.0.1";
    console.warn(
      "⚠️ API key is not set. HOST is forced to 127.0.0.1."
    );
  }

  const port = config.PORT || 3456;

  // Save the PID of the background process
  savePid(process.pid);

  // Handle SIGINT (Ctrl+C) to clean up PID file
  process.on("SIGINT", () => {
    console.log("Received SIGINT, cleaning up...");
    cleanupPidFile();
    process.exit(0);
  });

  // Handle SIGTERM to clean up PID file
  process.on("SIGTERM", () => {
    cleanupPidFile();
    process.exit(0);
  });
  console.log(HOST)

  // Use port from environment variable if set (for background process)
  const servicePort = process.env.SERVICE_PORT
    ? parseInt(process.env.SERVICE_PORT)
    : port;
  const server = createServer({
    jsonPath: CONFIG_FILE,
    initialConfig: {
      // ...config,
      providers: config.Providers || config.providers,
      HOST: HOST,
      PORT: servicePort,
      LOG_FILE: join(
        homedir(),
        "claude-code",
        "claude-code-router.log"
      ),
    },
  });
  server.addHook("preHandler", apiKeyAuth(config));
  server.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    if(req.url.startsWith("/v1/messages")) {
      router(req, reply, config)

      // 生成请求ID用于关联请求和响应
      const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.headers['x-request-id'] = requestId;

      // 记录请求数据到日志文件
      const requestData = {
        requestId: requestId,
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        query: req.query,
        params: req.params,
        ip: req.ip
      };
      await logMessagesRequest(requestData);

      // 拦截响应流数据 - 重写原始写入方法
      const originalWrite = reply.raw.write.bind(reply.raw);
      const originalEnd = reply.raw.end.bind(reply.raw);
      let streamStarted = false;

      reply.raw.write = function(chunk: any, ...args: any[]) {
        if (!streamStarted) {
          logStreamResponse("", requestId, true).catch(console.error);
          streamStarted = true;
        }
        
        // 记录数据块
        if (chunk) {
          const chunkStr = chunk.toString();
          logStreamResponse(chunkStr, requestId).catch(console.error);
        }
        
        return originalWrite(chunk, ...args);
      };

      reply.raw.end = function(chunk: any, ...args: any[]) {
        if (chunk && streamStarted) {
          const chunkStr = chunk.toString();
          logStreamResponse(chunkStr, requestId).catch(console.error);
        }
        
        if (streamStarted) {
          logStreamResponse("", requestId, false, true).catch(console.error);
        }
        
        return originalEnd(chunk, ...args);
      };
    }
  });

  // 添加响应钩子来处理非流式响应
  server.addHook("onSend", async (req: FastifyRequest, reply: FastifyReply, payload: any) => {
    if(req.url.startsWith("/v1/messages")) {
      const requestId = req.headers['x-request-id'] as string;
      
      try {
        // 检查是否是流式响应
        const contentType = reply.getHeader('content-type');
        const isStream = contentType && typeof contentType === 'string' &&
          (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson'));
        
        if (!isStream) {
          // 只处理非流式响应，流式响应已经在 preHandler 中处理
          let responseData: any;
          if (typeof payload === 'string') {
            try {
              responseData = JSON.parse(payload);
            } catch {
              responseData = payload;
            }
          } else {
            responseData = payload;
          }

          const responseInfo = {
            statusCode: reply.statusCode,
            headers: reply.getHeaders(),
            body: responseData
          };

          await logMessagesResponse(responseInfo, requestId);
        }
      } catch (error) {
        console.error("Failed to log response data:", error);
      }
    }

    return payload;
  });
  server.start();
}

export { run };
// run();
