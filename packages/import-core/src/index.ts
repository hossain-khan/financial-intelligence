export interface SourceFileMetadata {
  readonly fileName: string;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly sha256: string;
}

export interface ImportIssue {
  readonly code: string;
  readonly severity: "error" | "warning" | "information";
  readonly sourceLocation?: string;
  readonly field?: string;
  readonly message: string;
}

export interface SourceRow {
  readonly sourceLocation: string;
  readonly fields: Readonly<Record<string, string>>;
}

export interface ParseStatementResult {
  readonly parserId: string;
  readonly parserVersion: string;
  readonly rows: readonly SourceRow[];
  readonly issues: readonly ImportIssue[];
}

export interface ParseStatementInput {
  readonly metadata: SourceFileMetadata;
  readonly bytes: ArrayBuffer;
}

export interface StatementParser {
  readonly id: string;
  readonly version: string;
  supports(metadata: SourceFileMetadata): boolean;
  parse(input: ParseStatementInput, signal: AbortSignal): Promise<ParseStatementResult>;
}

export type ImportWorkerRequest =
  | {
      readonly protocolVersion: 1;
      readonly type: "parse";
      readonly operationId: string;
      readonly input: ParseStatementInput;
    }
  | {
      readonly protocolVersion: 1;
      readonly type: "cancel";
      readonly operationId: string;
    };

export type ImportWorkerResponse =
  | {
      readonly protocolVersion: 1;
      readonly type: "progress";
      readonly operationId: string;
      readonly completed: number;
      readonly total?: number;
    }
  | {
      readonly protocolVersion: 1;
      readonly type: "completed";
      readonly operationId: string;
      readonly result: ParseStatementResult;
    }
  | {
      readonly protocolVersion: 1;
      readonly type: "failed";
      readonly operationId: string;
      readonly errorCode: string;
      readonly message: string;
    };
