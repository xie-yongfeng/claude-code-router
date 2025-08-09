import Server from "@musistudio/llms";
import { readConfigFile, writeConfigFile } from "./utils";
import { CONFIG_FILE } from "./constants";
import { join } from "path";
import { readFileSync } from "fs";
import fastifyStatic from "@fastify/static";

export const createServer = (config: any): Server => {
  const server = new Server(config);
  return server;
};
