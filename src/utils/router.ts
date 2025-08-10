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
          text: '<system-reminder>Please continue with the task according to the conversation information listed in the "messages" request field. It is forbidden to end a task after answering a declarative sentence, and the user must be questioned to end the task. If something unusual happens while using the tool, skip or ask the user. It is forbidden to answer "正在使用工具...".</system-reminder>',
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
