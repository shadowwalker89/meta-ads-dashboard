import { chromium, type BrowserContext } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_USER_DATA_DIR = "./.collector-session";

/**
 * Owns exactly one Playwright persistent context for the whole
 * Collector run. A persistent context IS the browser plus a saved
 * profile directory (cookies, local storage, login session) in one
 * object — that's what lets an admin log into Meta once (via the
 * headful bootstrap script) and have every later Collector run reuse
 * that same session automatically. No username/password ever touches
 * this class.
 */
export class BrowserSessionManager {
  private context: BrowserContext | null = null;
  private readonly userDataDir: string;

  constructor(
    userDataDir: string = process.env.COLLECTOR_USER_DATA_DIR ?? DEFAULT_USER_DATA_DIR
  ) {
    this.userDataDir = resolve(userDataDir);
  }

  get userDataDirPath(): string {
    return this.userDataDir;
  }

  async getContext(options: { headless?: boolean } = {}): Promise<BrowserContext> {
    if (!this.context) {
      if (!existsSync(this.userDataDir)) {
        mkdirSync(this.userDataDir, { recursive: true });
      }
      console.log(
        `[BrowserSessionManager] launching persistent context at: ${this.userDataDir}`
      );
      this.context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: options.headless ?? true,
      });
      console.log("[BrowserSessionManager] persistent context ready");
    }
    return this.context;
  }

  async shutdown(): Promise<void> {
    if (this.context) {
      console.log("[BrowserSessionManager] closing persistent context");
      await this.context.close();
      this.context = null;
    }
  }
}
