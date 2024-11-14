const vscode = require("vscode");
const getGPT4js = require("gpt4js");
const fetch = async (...args) => {
  const module = await import("node-fetch");
  // @ts-ignore
  return module.default(...args);
};

// @ts-ignore
global.fetch = fetch;
let GPT4js = "";

function activate(context) {
  // Register a command to open the sidebar with input and button
  const commandId = "extension.openSidebar";
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, () => {
      SidebarProvider.createOrShow(context.extensionUri);
    })
  );

  context.subscriptions.push(SidebarProvider.register(context.extensionUri));
}

class SidebarProvider {
  static currentPanel = undefined;

  static register(extensionUri) {
    const provider = new SidebarProvider(extensionUri);
    return vscode.window.registerWebviewViewProvider(
      "extension.sidebar",
      provider
    );
  }

  constructor(extensionUri) {
    this.extensionUri = extensionUri;
  }

  static createOrShow(extensionUri) {
    if (SidebarProvider.currentPanel) {
      SidebarProvider.currentPanel.reveal(vscode.ViewColumn.One);
    } else {
      SidebarProvider.currentPanel = new SidebarProvider(extensionUri);
    }
  }

  resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === "reviewCode") {
          const code = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.document.getText(
                vscode.window.activeTextEditor.selection
              )
            : "";

          const userDefinedCodingStandards = message.userDefinedCodingStandards;

          vscode.window.showInformationMessage(
            `Input Text: ${userDefinedCodingStandards}\nSelected Code: ${code}`
          );
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Window,
              title: "Reviewing code...",
              cancellable: false,
            },
            async (progress) => {
              progress.report({ increment: 0 });

              const suggestions = await getReviewSuggestions(
                code,
                userDefinedCodingStandards
              );

              progress.report({ increment: 100 });

              showSuggestionsInNewFile(suggestions);
			  this.webviewView.webview.postMessage({ command: 'showMarkdown', markdown: suggestions });
            }
          );
          // Here you can process or send `inputText` and `selectedText`
        }
      },
      undefined,
      // @ts-ignore
      this._disposables
    );
  }

  getHtmlForWebview(webview) {
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Extension Sidebar</title>
      </head>
      <body>
        <h3>Custom Coding Standards(if any):</h3>
        <textarea id="inputText" style="width:100%; height:100px;"></textarea>
        <button id="sendBtn" style="width:100%; text-align:center; background:dodgerblue">Review Selected Code</button>

        <div id="markdownContent" style="margin-top: 20px;"></div>

        <script>
          const vscode = acquireVsCodeApi();
          
          document.getElementById('sendBtn').addEventListener('click', () => {
            const userDefinedCodingStandards = document.getElementById('inputText').value;
            vscode.postMessage({ command: 'reviewCode', userDefinedCodingStandards });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'showMarkdown') {
              // Use simple rendering for markdown
              document.getElementById('markdownContent').innerHTML = marked.parse(message.markdown);
            }
          });
        </script>

        <!-- Import Marked.js to parse markdown to HTML -->
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      </body>
      </html>`;
  }

  dispose() {
    SidebarProvider.currentPanel = undefined;
  }
}

async function getReviewSuggestions(code, userDefinedCodingStandards) {
    if(code == ''){
        return "Please Select some code"
    }
  const standardsDescription = userDefinedCodingStandards

  const generalStandardsDescription = `
	  In addition to the user-defined standards, please consider the following general coding best practices:
	  - **Error Handling**: Ensure there is proper error handling for potential runtime issues.
	  - **Readability**: Make sure the code is easy to read and understand, with meaningful variable and function names.
	  - **Consistency**: Verify consistent naming conventions, indentation, and spacing.
	  - **Performance**: Look for any inefficient code that could be optimized for better performance.
	  - **Code Structure**: Check for modular, maintainable code with reusable functions where possible.
	  - **Comments**: Ensure that critical sections of the code are appropriately documented for clarity.
	`;

  const messages = [
    {
      role: "user",
      content: `
		Review the following code based on both general coding standards/best practices and the user-defined coding standards below.

		User-defined Coding Standards:
		${standardsDescription}

		General Coding Standards:
		${generalStandardsDescription}

		Code:
		${code}

		Please provide the necessary review points in this format:

		### Review Points:
		1. Brief description of review point 1
		2. Brief description of review point 2
		3. Brief description of review point 3
		...

		### Suggested Optimized Code:

		Provide an optimized version of the code incorporating the review points above, if necessary.

		If no suggestions or optimizations are needed, return: "No suggestions or optimizations required." Indicate that the code is correct in such a case.
		`,
    },
  ];

  const options = {
    provider: "Nextway",
    model: "gpt-4o-free",
  };

  const response = await callGenAi(messages, options);
//   vscode.window.showInformationMessage(response, { modal: true });
  return response;
}

function showSuggestionsInNewFile(suggestions) {
  vscode.workspace.openTextDocument({ content: suggestions }).then((doc) => {
    vscode.window.showTextDocument(doc);
  });
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

async function callGenAi(messages, options) {
  if (GPT4js == "") {
    GPT4js = await getGPT4js();
  }
  // @ts-ignore
  const provider = GPT4js.createProvider(options.provider);
  try {
    const text = await provider.chatCompletion(messages, options, (data) => {
      console.log(data);
    });
    console.log(text);
    return text;
  } catch (error) {
    console.error("Error:", error);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
