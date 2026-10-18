import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "out/test/suite/**/*.test.js",
  // keep the IPC socket path under the ~103 char unix socket limit
  launchArgs: ["--user-data-dir", "/tmp/vscode-teamdocs-test-udata"],
  mocha: {
    ui: "tdd",
    timeout: 30000,
  },
});
