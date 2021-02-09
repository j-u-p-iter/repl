import { TSCompiler } from "@j.u.p.iter/ts-compiler";
import findCacheDir from "find-cache-dir";
import typescript from "typescript";
import { Repl } from ".";

const repl = new Repl(
  new TSCompiler({
    ts: typescript,
    cacheFolderPath: findCacheDir({ name: "j.u.p.iter/repl" }),
    compilerOptions: {}
  })
);

repl.addMethod(
  "notify",
  (_, param) => {
    console.log(param);
  },
  {}
);

repl.run();
