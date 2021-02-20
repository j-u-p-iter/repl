import { processTopLevelAwait } from "node-repl-await";

export class Compiler {
  constructor(private tsCompiler) {}

  public compile(fileName: string, code: string) {
    const resultCode = processTopLevelAwait(code) || code;

    return this.tsCompiler.compile(fileName, resultCode);
  }
}
