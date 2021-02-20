import figlet from "figlet";
import { Recoverable, REPLServer, start } from "repl";
import vm from "vm";

import { Compiler } from "./Compiler";

type CutomMethodHandler = (repl: Repl, ...args: any[]) => any;
interface CustomMethodOptions {
  [key: string]: any;
}

/**
 * Essentially repl is the terminal in the terminal.
 * It reads from the external input stream (stdin by defaul).
 * It somehow process read data.
 * It writes into the external output stream a processed data (stdout by default).
 *
 */
export class Repl {
  private compiler: Compiler;

  private customMethods: {
    [key: string]: {
      handler: CutomMethodHandler;
      options: CustomMethodOptions;
    };
  } = {};

  /**
   * The reference to the undeflying REPL server.
   *   Available after the "run" is invoked.
   *
   * We initialize the server with the "useGlobal" option.
   *   It means, that the "repl" provides access to any variable that exists in the global scope.
   *   It is possible to expose a variable to the REPL explicitly by assigning
   *   it to the context object associated with each REPLServer like this:
   *
   *   /-- Code snippet --/
   *   const repl = new Repl(compiler);
   *
   *   repl.server.contex.param = "hello";
   *   /--Code snippet --/
   *
   *   And after that you can get access to the "param" variable
   *     in the repl.
   *
   *   It's extremely useful, if you want to expose and use in the repl such things as:
   *     - database instance;
   *     - models.
   *
   */
  server: REPLServer;

  /**
   * According to the name of the function, it's used to recover
   *   from such called "Recoverable" syntax errors.
   *   It's thrown by the repl in case of multiline inputs.
   *
   */
  private isRecoverableError = error => {
    if (error.name === "SyntaxError") {
      return /^(Unexpected end of input|Unexpected token)/.test(error.message);
    }

    return false;
  };

  /**
   * Custom eval method to execute the user code.
   *
   */
  private evaluateCode = async (code, _, fileName, callback) => {
    let result;

    try {
      /**
       * 1. Compiles code to the code, that can be run in V8 engine.
       * 2. Runs it withing the context of the current "global" to be able to read from "global".
       * 3. Returns the result.
       *
       */
      const compiledCode = await this.compiler.compile(fileName, code);

      result = await vm.runInThisContext(compiledCode);
    } catch (error) {
      if (this.isRecoverableError(error)) {
        return callback(new Recoverable(error), null);
      }

      return callback(error, null);
    }

    callback(null, result);
  };

  private printWelcomeMessage() {
    console.log(figlet.textSync("Welcome to the Repl !", { width: 120 }));
  }

  /**
   * When you run the standalone "node" REPL from the command
   * prompt, what it's doing in the background is running "repl.start()"
   * to give you the standard REPL (opens terminal in the Terminal).
   *
   * Here we want to customze Node's repl. So, we declare our own "start"
   * method.
   *
   * The "repl" is the command line tool, that:
   *   - accepts individual lines of user input.
   *     By default input comes from process.stdin stream.
   *     You can set up any stream, using "input" option.
   *
   *   - evaluate those accoriding to a user-defined evaluation function.
   *     To customize the way, how repl compiles and runs each line of the input,
   *     you can use "eval" function. This function will be used, when evaluating each given
   *     line of input.
   *     The important thing to notice is that eval function can error with "repl.Recoverable".
   *     The Node catches thrown errors and if it's Recoverable, the Node understands, that the
   *     input was incomplete (in case of multiline input) and prompts (shows prompt) for additional
   *     lines.
   *
   *     the repl doesn't know how to run the code. Instead it delegates running the code to an another, "vm" module.
   *     So, when you customize evaluation of the code in the repl, you should use "vm" module to run the code.
   *
   *   - then output the result.
   *     By default repl writes into process.output stream. But again, you can set up any stream,
   *     using "output" option.
   *
   */
  private startReplServer() {
    this.printWelcomeMessage();

    this.server = start({
      // The input prompt to display
      prompt: "> ",

      // The Readable stream from which REPL input will be read
      // When you type in the Terminal - you write into the process.stdin.
      // repl listens this stream and handles the data, that comes from this stream.
      input: process.stdin,

      // The Writable stream to which REPL output will be written
      output: process.stdout,

      /**
       * If true, specifies that the default evaluation function will
       *   use the JavaScript global as the context as opposed to creating
       *   a new separate context for the REPL instance.
       *
       */
      useGlobal: true,

      // The function to be used when evaluating each given line of input.
      eval: this.evaluateCode
    });

    return this.server;
  }

  /**
   * The repl has some predefined .-prefixed commands. Such commands are invoked by
   *   typing a "." followed by the keyword. The example of such
   *   commands: ".help", ".clear" and etc.
   *
   * To define custom commands the "server.defineCommand" method should be used.
   *
   * Notice, that if you don't call "server.displayPrompt" in the end of this method,
   *   and you don't exit from the repl in the action function, the default prompt won't be shown.
   *   So, this is a best practice to call "server.displayPrompt" if you don't exit from the repl
   *   inside of the action function.
   */
  private defineCustomCommands() {
    this.server.defineCommand("customApi", {
      help: "View a list of available global methods/properties",

      action: () => {
        console.log("The available methods/properties are here...");
        /**
         * If we don't call this method, the default prompt won't be shown
         *   after this action function has been executed.
         *
         */
        this.server.displayPrompt();
      }
    });
  }

  /**
   * To register custom methods, we need to add them to the repl context,
   *   the same way we do for the window object, when we need to make methods
   *   available globally in the browser.
   *
   */
  private registerCustomMethods() {
    Object.entries(this.customMethods).forEach(([methodName, { handler }]) => {
      this.server.context[methodName] = (...args: any[]) => {
        return handler(this, ...args);
      };
    });
  }

  constructor(tsCompiler: any) {
    this.compiler = new Compiler(tsCompiler);
  }

  public run() {
    this.startReplServer();

    /**
     * It's important to distinguish the term "method"
     *   and the term "command".
     *
     * "Command" is something, that you write with the .-prefix.
     *   It's something, that comes with all instances of repl by default and
     *   you can use to make some common operations or get some common
     *   information.
     *
     * "Custom method" you write without .-prefixes.
     *   It's primarily specific for the project. And the main goal
     *   of such methods is to do some manipulations with the parts,
     *   specific to the project like database or models.
     *
     */
    this.registerCustomMethods();
    this.defineCustomCommands();
  }

  /**
   * To be able to get access, for example, to a database,
   *   to database models, we should add them to the repl server context.
   *
   * This is why we need this method.
   *
   * This method is public, cause a database and a model instances
   *   are project specific things and should be added from the outside.
   *
   * As we said, the methods should be added to the server context.
   *   The server is available only after we run the "repl". Before this
   *   there is no server. But we definitely should have an ability to
   *   add methods before we run a repl. For this purpose we should cache
   *   all methods in the private property "customMethods" before we run the repl.
   *   After we run the repl we should add all these methods to the context - register
   *   them.
   *
   */
  public addMethod(
    methodName: string,
    handler: CutomMethodHandler,
    options: CustomMethodOptions
  ) {
    this.customMethods[methodName] = {
      handler,
      options
    };
  }
}
