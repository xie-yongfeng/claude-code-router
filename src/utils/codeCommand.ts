import { spawn } from "child_process";
import {
  incrementReferenceCount,
  decrementReferenceCount,
} from "./processCheck";
import { closeService } from "./close";
import { readConfigFile } from ".";
import { homedir } from "os";
import { join } from "path";

export async function executeCodeCommand(args: string[] = []) {
  // Set environment variables
  const config = await readConfigFile();
  const env = {
    ...process.env,
    ANTHROPIC_AUTH_TOKEN: "test",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${config.PORT || 3456}`,
    API_TIMEOUT_MS: String(config.API_TIMEOUT_MS ?? 600000), // Default to 10 minutes if not set
  };

  // Set ANTHROPIC_SMALL_FAST_MODEL if it exists in config
  if (config?.ANTHROPIC_SMALL_FAST_MODEL) {
    env.ANTHROPIC_SMALL_FAST_MODEL = config.ANTHROPIC_SMALL_FAST_MODEL;
  }

  if (config?.APIKEY) {
    env.ANTHROPIC_API_KEY = config.APIKEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
  }

  // Increment reference count when command starts
  incrementReferenceCount();

  // Execute claude command

  const homeDir = homedir();
  const configPath = homeDir + "\\claude-code\\claude-code_cli.js";
  //const nodePath = homeDir + "\\claude-code\\node";
  const nodePath = "node"
  const claudePath = process.env.CLAUDE_PATH || nodePath + " " + configPath;
  const claudeProcess = spawn(claudePath, args, {
    env,
    stdio: "inherit",
    shell: true,
  });

  claudeProcess.on("error", (error) => {
    console.error("Failed to start claude command:", error.message);
    console.log(
      "Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code"
    );
    decrementReferenceCount();
    process.exit(1);
  });

  claudeProcess.on("close", (code) => {
    decrementReferenceCount();
    closeService();
    process.exit(code || 0);
  });
}
