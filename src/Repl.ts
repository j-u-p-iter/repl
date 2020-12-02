import { Recoverable, start, REPLServer } from "repl";
import vm from "vm";

/**
 * Essentially repl is the terminal in the terminal.
 * It reads from the external input stream (stdin by defaul).
 * It writes into the external output stream (stdout by default).
 */
export class Repl {
  /**
   * The reference to the undeflying REPL server.
   *   Available after the "run" is invoked.
   */
  replServer: REPLServer;

  /**
   * According to the name of the function, it's used to recover
   *   from such called "Recoverable" syntax errors. We throw this error
   *   in case of multiline inputs.
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
  private evaluateCode = (code, _, __, callback) => {
    let result;

    try {
      /**
       * 1. Compiles code to the code, that can be run in V8 engine.
       * 2. Runs it withing the context of the current "global".
       * 3. Returns the result.
       */
      result = vm.runInThisContext(code);
    } catch (error) {
      if (this.isRecoverableError(error)) {
        return callback(new Recoverable(error));
      }
    }

    callback(null, result);
  };

  /**
   * When you run the standalone "node" REPL from the command
   * prompt, what it's doing in the background is running "repl.start()"
   * to give you the standard REPL.
   *
   * Here we want to customise Node's repl. So, we declare our own "start"
   * method.
   *
   * What is repl is command line tool, that:
   *   - accepts individual lines of user input.
   *     By default input comes from process.stdin stream.
   *     You can set up any stream, using "input" option.
   *
   *   - evaluate those accoriding to a user-defined evaluation function.
   *     To customise the way, how repl compiles and runs each line of the input,
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
   */
  private startReplServer() {
    this.replServer = start({
      // The input prompt to display
      prompt: "> ",

      // The Readable stream from which REPL input will be read
      input: process.stdin,

      // The Writable stream to which REPL output will be written
      output: process.stdout,

      /**
       * If true, specifies that the default evaluation function will
       *   use the JavaScript global as the context as opposed to creating
       *   a new separate context for the REPL instance.
       */
      useGlobal: true,

      // The function to be used when evaluating each given line of input.
      eval: this.evaluateCode
    });

    return this.replServer;
  }

  /**
   * To define custom commands the "replServer.defineCommand" method should be used.
   *
   * Notice, that if you don't call "replServer.displayPrompt" in the end of this method,
   *   and you don't exit from the repl in the action function, the default prompt won't be shown. 
   *   So, it's a best practise to call "replServer.displayPrompt" if you don't exit from the repl
   *   inside of the action function.
   */
  private defineCustomCommands() {
    this.replServer.defineCommand('ls', {
      help: "View a list of available global methods/properties",

      action: () => {
        console.log('The available methods/properties are here...');
        /**
        * If we don't call this method, the default prompt won't be shown
        *   after this action function has been executed.
        */
        this.replServer.displayPrompt();
      }
    });
  }

  public run() {
    this.startReplServer();
   
    this.defineCustomCommands();
  }
}
