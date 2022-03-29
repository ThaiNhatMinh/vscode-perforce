import * as vscode from "vscode";
import * as PerforceUri from "./PerforceUri";
import * as p4 from "./api/commands/filelog";
import {
    Uri,
    EventEmitter,
    Event,
    SourceControl,
    SourceControlResourceGroup,
    Disposable,
    ProgressLocation,
    window,
    workspace,
    commands,
} from "vscode";

function GetIcon(text: string): string {
    switch (text) {
        case "add":
            return "add";
        case "archive":
            return "archive";
        case "branch":
            return "git-branch";
        case "delete":
            return "notebook-delete-cell";
        case "edit":
            return "edit";
        case "integrate":
            return "testing-queued-icon";
        case "import":
            return "testing-run-all-icon";
        case "lock":
            return "private-ports-view-icon";
        case "move/add":
            return "add";
        case "move/delete":
            return "delete";
        case "purge":
            return "testing-debug-icon";
        case "copy":
            return "explorer-view-icon";
        default:
            return "git-commit";
    }
}
export class Item extends vscode.TreeItem {
    item: p4.FileLogItem | p4.FileLogIntegration;
    constructor(item: p4.FileLogItem | p4.FileLogIntegration, filename: string) {
        if ("direction" in item) {
            super(`${item.operation}`, vscode.TreeItemCollapsibleState.None);
            this.description = `${item.operation} ${
                item.direction === p4.Direction.TO ? "into" : "from"
            } ${item.file}#${item.endRev}`;
            this.iconPath = new vscode.ThemeIcon(GetIcon(item.operation));
        } else {
            if (item.integrations.length !== 0) {
                super(item.chnum, vscode.TreeItemCollapsibleState.Collapsed);
            } else {
                super(item.chnum, vscode.TreeItemCollapsibleState.None);
            }
            this.description = `#${item.revision} ${item.description}`;
            this.iconPath = new vscode.ThemeIcon(GetIcon(item.operation));
            this.tooltip = new vscode.MarkdownString(
                `#${item.revision} ${item.user} (${item.client})

${item.date}


${item.description}`,
                true
            );
            if (item.operation === "edit") {
                let left = vscode.Uri.file(filename);
                left = left.with({
                    scheme: "perforce",
                    fragment: `${Number.parseInt(item.revision) - 1}`,
                    authority: `#${Number.parseInt(item.revision) - 1}`,
                });
                let right = vscode.Uri.file(filename);
                right = right.with({
                    scheme: "perforce",
                    fragment: `${item.revision}`,
                    authority: `#${item.revision}`,
                });
                this.command = {
                    title: "Diff with previous revision",
                    command: "perforce.diffFiles",
                    arguments: [left, right],
                };
            }
        }
        this.item = item;
    }
}

export class TimeLineProvider implements vscode.TreeDataProvider<Item> {
    uri!: vscode.Uri;
    changes!: p4.FileLogItem[];
    private _onDidChangeTreeData: vscode.EventEmitter<
        undefined | null | void
    > = new vscode.EventEmitter<undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<undefined | null | void> = this
        ._onDidChangeTreeData.event;
    constructor(private context: vscode.ExtensionContext) {
        vscode.window.onDidChangeActiveTextEditor((e) => this.onActiveEditorChanged(e));
        vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChanged(e));
        this.onActiveEditorChanged(vscode.window.activeTextEditor);
    }

    onDocumentChanged(e: vscode.TextDocumentChangeEvent): any {
        throw new Error("Method not implemented.");
    }
    async onActiveEditorChanged(editor: vscode.TextEditor | undefined): Promise<any> {
        if (!editor) {
            return;
        }
        const uri = editor?.document.uri;
        this.uri = PerforceUri.fromUriWithRevision(uri, "");
        const changes = await p4.getFileHistory(uri, {
            file: this.uri,
            followBranches: false,
        });
        if (changes.length === 0) {
            return;
        }
        this.changes = changes;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element: Item): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: Item): Thenable<Item[]> {
        if (!element && this.changes) {
            return Promise.resolve(
                this.changes.map((item) => {
                    return new Item(item, this.uri.path);
                })
            );
        } else {
            if (element) {
                const item = element.item as p4.FileLogItem;

                return Promise.resolve(
                    item.integrations.map((item) => {
                        return new Item(item, this.uri.path);
                    })
                );
            }
            return Promise.resolve([]);
        }
    }
}
