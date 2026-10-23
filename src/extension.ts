import { isAbsolute } from "node:path";

import type { ExtensionContext } from "vscode";
import { commands, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

import { configuration } from "./configuration.ts";

type Context = Readonly<Pick<ExtensionContext, "asAbsolutePath">> & {
    readonly subscriptions: Readonly<Pick<ExtensionContext["subscriptions"], "push">>;
};

let client: LanguageClient | undefined;

export function activate(context: Context): Promise<void> {
    const executable = workspace.getConfiguration("instar").get<unknown>("executable");

    if (typeof executable !== "string" || (executable !== "" && !isAbsolute(executable))) {
        throw new Error(
            "Set instar.executable to an absolute executable path, or leave it empty to use bundled Instar.",
        );
    }

    const command =
        executable ||
        context.asAbsolutePath(
            process.platform === "win32" ? "server/instar.exe" : "server/instar",
        );

    const connection = new LanguageClient(
        "Instar",
        { command, args: ["server"] },
        {
            documentSelector: [{ scheme: "file", language: "luau" }],
            middleware: { workspace: { configuration } },
        },
    );

    client = connection;

    context.subscriptions.push(
        commands.registerCommand("instar.stop", () => connection.stop()),
        commands.registerCommand("instar.restart", () => connection.restart()),
        commands.registerCommand("instar.output", () => {
            connection.outputChannel.show();
        }),
    );

    return connection.start();
}

export function deactivate(): Promise<void> | undefined {
    return client?.stop();
}
