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
        text: config.SYSTEM_PROMPT,
        cache_control: {'type': 'ephemeral'}
      });
    }
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<system-reminder>Please continue with the task or Todos steps based on the conversation list information in the request field "messages". When ending a task, it is necessary to ask the user if they have any other questions or raise questions related to the task before the task can be concluded, guiding the user to proceed to the next step. If any unusual situation occurs while using the tool, please skip or ask the user. It is forbidden to answer "正在使用工具...".</system-reminder>',
          cache_control: {'type': 'ephemeral'}
        }
      ]
    });
  } catch (error: any) {
    log("Error in router middleware:", error.message);
  }
  req.body.max_tokens = 61440
  req.body.temperature = 0
  req.body.model = config.Router!.default;
  return;
};
