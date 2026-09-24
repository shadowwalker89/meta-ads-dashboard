import type { NextConfig } from "next";

type ServerNativeExternalsCallback = (
  err?: Error | null,
  result?: string | string[],
) => void;

const nextConfig: NextConfig = {
  // Database drivers (better-sqlite3, pg) and their transitive Node-only
  // deps must execute only in the Node.js server runtime — never in the
  // browser/client bundle. When these native packages are imported
  // through a `transpilePackages` workspace module, the SWC-compiled
  // output causes Webpack to trace into their transitive Node-only deps
  // (bindings, file-uri-to-path for better-sqlite3; pgpass,
  // pg-connection-string, split2 for pg). Those transitive deps are
  // NOT in Next.js's built-in serverExternalPackages list, so they
  // must be listed here — otherwise Webpack fails to resolve `fs`/`path`
  // during `next build`.
  serverExternalPackages: [
    "bindings",
    "file-uri-to-path",
    "pgpass",
    "pg-connection-string",
    "split2",
  ],
  transpilePackages: ["@repo/database", "@repo/shared"],
  webpack(config, { isServer }) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    // `serverExternalPackages` above externalizes the transitive Node-only
    // deps, but `better-sqlite3` and `pg` themselves are still traced
    // into by Webpack when imported through a `transpilePackages` workspace
    // module. An explicit webpack externals entry on the server bundle
    // forces these native packages to be treated as Node.js `require()`
    // calls at runtime instead of being bundled. This is server-only —
    // the client/edge bundles never see these imports.
    if (isServer) {
      const SERVER_NATIVE_PACKAGES = new Set(["better-sqlite3", "pg"]);
      const previous = config.externals;
      const list = Array.isArray(previous)
        ? previous
        : previous
          ? [previous]
          : [];
      config.externals = [
        ...list,
        function serverNativeExternals(
          { request }: { request: string },
          callback: ServerNativeExternalsCallback,
        ) {
          if (SERVER_NATIVE_PACKAGES.has(request)) {
            return callback(null, `commonjs ${request}`);
          }
          if (typeof request === "string" && request.startsWith("node:")) {
            return callback(null, `commonjs ${request}`);
          }
          return callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
