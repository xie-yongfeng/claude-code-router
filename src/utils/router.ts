import {
  MessageCreateParamsBase,
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import { get_encoding } from "tiktoken";
import { log } from "./log";

const enc = get_encoding("cl100k_base");

export const router = async (req: any, _res: any, config: any) => {
  const {messages, system = [], tools }: MessageCreateParamsBase = req.body;
  try {
    // 自定义系统提示词
    if (config.SYSTEM_PROMPT){
      system.unshift({
        type: 'text',
        text: config.SYSTEM_PROMPT
      });
    }
  } catch (error: any) {
    log("Error in router middleware:", error.message);
  }
  req.body.max_tokens = 61440
  req.body.model = config.Router!.default;
  return;
};
