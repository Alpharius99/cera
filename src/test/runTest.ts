import * as path from "path";
import { runTests } from "@vscode/test-electron";

// Launches a real VS Code Extension Development Host and runs the integration
// suite inside it. This file runs in plain Node (not the host).
async function main(): Promise<void> {
  // The extension manifest lives at the repo root.
  const extensionDevelopmentPath = path.resolve(__dirname, "../../");
  // The compiled Mocha entry point that runs inside the host.
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");

  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

main().catch((err) => {
  console.error("Failed to run integration tests:", err);
  process.exit(1);
});
