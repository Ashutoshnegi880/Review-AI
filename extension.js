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
const codingStandards = vscode.workspace
  .getConfiguration("genAiCodeReview")
  .get("codingStandards");


  function activate(context) {
	const reviewCodeCommand = vscode.commands.registerCommand("extension.reviewCode", async () => {
	  const editor = vscode.window.activeTextEditor;
	  if (!editor) return;
  
	  const selection = editor.selection;
	  const code = editor.document.getText(selection);
  
	  const codingStandards = vscode.workspace
		.getConfiguration("genAiCodeReview")
		.get("codingStandards");
  
	  // Show progress when generating review suggestions
	  vscode.window.withProgress(
		{
		  location: vscode.ProgressLocation.Window,
		  title: "Reviewing code...",
		  cancellable: false,
		},
		async (progress) => {
		  progress.report({ increment: 0 });
		  
		  const suggestions = await getReviewSuggestions(code, codingStandards);
		  
		  progress.report({ increment: 100 });
  
		  showSuggestionsInNewFile(suggestions);
		}
	  );
	});
  
	// Create a tree view provider with a single "Run Code Review" button
	const reviewProvider = new ReviewProvider();
	vscode.window.registerTreeDataProvider("reviewAiView", reviewProvider);
  
	context.subscriptions.push(reviewCodeCommand);
  }
  
  class ReviewProvider {
	getTreeItem(element) {
	  return element;
	}
  
	getChildren() {
	  return [
		new vscode.TreeItem(
		  "Run Code Review",
		  vscode.TreeItemCollapsibleState.None
		)
	  ];
	}
  
	// Define the action for the button click
	resolveTreeItem(item) {
	  item.command = {
		command: "extension.reviewCode",
		title: "Run Code Review"
	  };
	  return item;
	}
  }

async function getReviewSuggestions(code, codingStandards) {
  const standardsDescription = `
	  - Function names should be in ${codingStandards.functionNamingConvention}.
	  - Each line should end with a semicolon: ${codingStandards.endWithSemicolon}.
	  - Avoid magic numbers: ${codingStandards.noMagicNumbers}.
	  - Avoid hardcoded strings: ${codingStandards.noHardcodedStrings}.
	`;

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
		
		Important: Return the response in plain text format only, without any Markdown or special formatting.`,
    },
  ];

  const options = {
    provider: "Nextway",
    model: "gpt-4o-free",
  };

  const response = await callGenAi(messages, options);
  vscode.window.showInformationMessage(response, { modal: true });
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
  GPT4js = await getGPT4js();
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

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
