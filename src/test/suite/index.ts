import * as path from "path";
import Mocha from "mocha";
import { glob } from "glob";

// Runs inside the Extension Development Host. Discovers and runs the compiled
// *.test.js suites with Mocha.
export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 30000 });
  const testsRoot = __dirname;

  const files = await glob("**/*.test.js", { cwd: testsRoot });
  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} integration test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
