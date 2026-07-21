import type { AiTaskId } from "@financial-intelligence/ai-core";

import type { ModelProfile } from "./model-profile";

export interface EngineDecodingMessage {
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

export type LocalAiRequest =
  | { readonly protocolVersion: 1; readonly type: "load"; readonly operationId: string; readonly profile: ModelProfile }
  | { readonly protocolVersion: 1; readonly type: "warmup"; readonly operationId: string }
  | {
      readonly protocolVersion: 1;
      readonly type: "execute";
      readonly operationId: string;
      readonly task: AiTaskId;
      readonly prompt: string;
      readonly decoding: EngineDecodingMessage;
    }
  | { readonly protocolVersion: 1; readonly type: "cancel"; readonly operationId: string }
  | { readonly protocolVersion: 1; readonly type: "unload"; readonly operationId: string }
  | { readonly protocolVersion: 1; readonly type: "dispose"; readonly operationId: string };

export type LocalAiResponse =
  | { readonly protocolVersion: 1; readonly type: "progress"; readonly operationId: string; readonly fraction: number }
  | { readonly protocolVersion: 1; readonly type: "loaded"; readonly operationId: string }
  | { readonly protocolVersion: 1; readonly type: "result"; readonly operationId: string; readonly output: string }
  | {
      readonly protocolVersion: 1;
      readonly type: "failed";
      readonly operationId: string;
      readonly errorCode: string;
      readonly message: string;
    };
