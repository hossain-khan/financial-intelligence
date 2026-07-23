import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ApplicationServices } from "./infrastructure";

import { Button } from "./Button";
import { isModelReady as checkModelReady } from "./local-ai";
import { LocalAiPanel } from "./LocalAiPanel";

export interface ChatMessage {
  readonly id: string;
  readonly sender: "user" | "assistant";
  readonly text: string;
  readonly timestamp: Date;
}

export interface ChatPageProperties {
  readonly services?: ApplicationServices;
  /** Injectable helper for checking if local model is ready (for unit testing). */
  readonly isModelReady?: () => Promise<boolean>;
  /** Injectable prompt executor (for unit testing). */
  readonly executePrompt?: (userText: string) => Promise<string>;
}

const STARTER_PROMPTS = [
  "How do I analyze my cash flow this month?",
  "How are subscription & recurring transactions identified?",
  "How does Financial Intelligence protect my privacy offline?",
  "What is the difference between rules and AI suggestions?",
];

const INITIAL_ASSISTANT_MESSAGE: ChatMessage = {
  id: "welcome-msg",
  sender: "assistant",
  text: "Hello! I am your browser-local financial analysis assistant. I can help answer questions about your transaction cash flows, categorization rules, and privacy controls. How can I help you today?",
  timestamp: new Date(),
};

/** Default local assistant response generator when no external task worker is connected. */
async function defaultExecutePrompt(promptText: string): Promise<string> {
  // Simple latency simulation to mirror local inference execution
  await new Promise((resolve) => setTimeout(resolve, 300));

  const text = promptText.toLowerCase();

  if (text.includes("privacy") || text.includes("offline")) {
    return "Financial Intelligence runs 100% locally on your device. Your bank statements, transaction amounts, and chat prompts never leave your browser IndexedDB and local web worker memory.";
  }

  if (text.includes("cash flow") || text.includes("analyze")) {
    return "To analyze cash flow, check the Dashboard and Overview sections. Imports are parsed locally and aggregated by net income, transfers, and expense categories using deterministic accounting rules.";
  }

  if (text.includes("rule") || text.includes("categorization") || text.includes("suggestion")) {
    return "Financial Intelligence uses a 'Rules Before Models' design principle. Deterministic rules always override AI suggestions. AI model inferences are held separately as suggestions until you explicitly confirm or accept them.";
  }

  if (text.includes("subscription") || text.includes("recurring")) {
    return "Recurring subscriptions are detected when normalized merchant names appear at predictable monthly or annual intervals with similar monetary amounts.";
  }

  return `I analyzed your request locally: "${promptText}". I am ready to help you organize transactions, review rules, or explain cash-flow reports.`;
}

let messageIdCounter = 0;
function createMessageId(prefix: string): string {
  messageIdCounter += 1;
  return `${prefix}-${messageIdCounter}`;
}

export function ChatPage(props: ChatPageProperties) {
  const modelChecker = props.isModelReady ?? checkModelReady;
  const runner = props.executePrompt ?? defaultExecutePrompt;

  const [modelReady, setModelReady] = useState<boolean | undefined>(undefined);
  const [messages, setMessages] = useState<readonly ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check local model readiness
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const ready = await modelChecker();
        if (active) setModelReady(ready);
      } catch {
        if (active) setModelReady(false);
      }
    };
    void check();
    const interval = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [modelChecker]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isProcessing) return;

    const userMsg: ChatMessage = {
      id: createMessageId("user"),
      sender: "user",
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsProcessing(true);

    try {
      const responseText = await runner(trimmed);
      const assistantMsg: ChatMessage = {
        id: createMessageId("assistant"),
        sender: "assistant",
        text: responseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: createMessageId("error"),
        sender: "assistant",
        text: "Sorry, local AI inference encountered an issue. Please verify your local model state in Settings.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSendMessage(inputText);
  };

  const handleClearChat = () => {
    setMessages([INITIAL_ASSISTANT_MESSAGE]);
  };

  if (modelReady === undefined) {
    return (
      <div className="chat-page-loading" role="status">
        <p>Checking local AI model status…</p>
      </div>
    );
  }

  if (!modelReady) {
    return (
      <div className="chat-page chat-setup-required">
        <div className="chat-page-header">
          <h2>Local AI Financial Assistant</h2>
          <p>
            To use the local AI Chat, the browser-local model must first be downloaded and verified on your device.
          </p>
        </div>
        <div className="chat-download-container">
          <LocalAiPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-page-header">
        <div className="chat-title-row">
          <h2>Financial Assistant</h2>
          <Button className="secondary-button clear-chat-button" onClick={handleClearChat}>
            Clear conversation
          </Button>
        </div>

        <div className="chat-disclaimer" role="note">
          <span className="disclaimer-badge">Privacy First</span>
          <p>
            <strong>Disclaimer:</strong> This local AI assistant helps analyze cash flows and organize financial data. It does not provide legal, tax, or professional investment advice. All conversations run 100% offline on your device.
          </p>
        </div>
      </header>

      <div className="chat-messages-container" aria-live="polite" aria-label="Conversation history">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message-row chat-message-${msg.sender}`}
          >
            <div className="chat-avatar" aria-hidden="true">
              {msg.sender === "user" ? "You" : "AI"}
            </div>
            <div className="chat-bubble">
              <p className="chat-message-text">{msg.text}</p>
              <time className="chat-message-time">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </time>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="chat-message-row chat-message-assistant chat-message-typing" role="status">
            <div className="chat-avatar" aria-hidden="true">
              AI
            </div>
            <div className="chat-bubble">
              <p className="chat-typing-indicator">Analyzing locally on your device…</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-starter-chips-container">
        <p className="starter-label">Suggested topics:</p>
        <div className="starter-chips">
          {STARTER_PROMPTS.map((promptText) => (
            <button
              key={promptText}
              type="button"
              className="chip-button"
              disabled={isProcessing}
              onClick={() => void handleSendMessage(promptText)}
            >
              {promptText}
            </button>
          ))}
        </div>
      </div>

      <form className="chat-input-form" onSubmit={onSubmit}>
        <label htmlFor="chat-input-field" className="visually-hidden">
          Ask a financial or cash flow question
        </label>
        <input
          id="chat-input-field"
          type="text"
          className="chat-input-field"
          placeholder="Ask a question about your cash flow or spending rules…"
          value={inputText}
          disabled={isProcessing}
          onChange={(e) => setInputText(e.target.value)}
        />
        <Button
          type="submit"
          className="primary-button chat-send-button"
          isDisabled={isProcessing || !inputText.trim()}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
