import type { BrowserContext, Request } from "@playwright/test";

export interface LocalNetworkGuard {
  readonly unexpectedRequests: readonly string[];
  assertClean(): void;
}

export async function installLocalNetworkGuard(
  context: BrowserContext,
  allowedOrigin: string,
): Promise<LocalNetworkGuard> {
  const unexpectedRequests: string[] = [];

  await context.route("**/*", async (route) => {
    const request = route.request();

    if (isAllowedRequest(request, allowedOrigin)) {
      await route.continue();
      return;
    }

    unexpectedRequests.push(request.url());
    await route.abort("blockedbyclient");
  });

  return {
    get unexpectedRequests() {
      return [...unexpectedRequests];
    },
    assertClean() {
      if (unexpectedRequests.length > 0) {
        throw new Error(
          `Unexpected local-mode network requests:\n${unexpectedRequests.map((url) => `- ${url}`).join("\n")}`,
        );
      }
    },
  };
}

function isAllowedRequest(request: Request, allowedOrigin: string): boolean {
  const url = new URL(request.url());
  return url.origin === allowedOrigin || url.protocol === "blob:" || url.protocol === "data:";
}
