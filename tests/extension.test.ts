import { expect, mock, test } from "bun:test";
import { resolve } from "node:path";

import type { ExtensionContext } from "vscode";

import type {
    CancellationToken,
    ConfigurationParams,
    ConfigurationMiddleware,
} from "vscode-languageclient/node";

const parameters: ConfigurationParams = {
    items: [
        { section: "instar", scopeUri: "file:///first" },
        { section: "other" },
        { section: "instar", scopeUri: "file:///second" },
        { section: "instar", scopeUri: "file:///third" },
    ],
};

const operations: string[] = [];
const handlers = new Map<string, () => unknown>();
let executable: unknown = "";
let server: unknown;

let clientOptions:
    | {
          readonly middleware: {
              readonly workspace: Readonly<ConfigurationMiddleware>;
          };
      }
    | undefined;

await mock.module("vscode", () => ({
    workspace: {
        getConfiguration: () => ({ get: () => executable }),
    },

    commands: {
        registerCommand: (name: string, handler: () => unknown) => {
            handlers.set(name, handler);

            return { dispose: () => handlers.delete(name) };
        },
    },
}));

await mock.module("vscode-languageclient/node", () => ({
    LanguageClient: class {
        outputChannel = {
            show() {
                operations.push("show");
            },
        };

        constructor(
            _name: string,
            options: unknown,
            configuration: NonNullable<typeof clientOptions>,
        ) {
            server = options;
            clientOptions = configuration;
        }

        start() {
            operations.push("start");

            return Promise.resolve();
        }

        stop() {
            operations.push("stop");

            return Promise.resolve();
        }

        restart() {
            operations.push("restart");

            return Promise.resolve();
        }
    },
}));

const { activate, deactivate } = await import("../src/extension.ts");

test("launches bundled Instar and supports stop, restart, and shutdown", async () => {
    const context: Pick<ExtensionContext, "subscriptions" | "asAbsolutePath"> = {
        subscriptions: [],
        asAbsolutePath: resolve,
    };

    await activate(context);

    expect(server).toEqual({
        command: resolve(process.platform === "win32" ? "server/instar.exe" : "server/instar"),
        args: ["server"],
    });

    expect([...handlers.keys()]).toEqual(["instar.stop", "instar.restart", "instar.output"]);
    await handlers.get("instar.stop")?.();
    await handlers.get("instar.restart")?.();
    await deactivate();
    expect(operations).toEqual(["start", "stop", "restart", "stop"]);

    for (const subscription of context.subscriptions) {
        subscription.dispose();
    }

    expect(handlers.size).toBe(0);
});

test("rejects invalid executable settings before starting a server", () => {
    const context: Pick<ExtensionContext, "subscriptions" | "asAbsolutePath"> = {
        subscriptions: [],
        asAbsolutePath: resolve,
    };

    const previous = executable;

    try {
        for (executable of [undefined, null, 42, "   ", "./instar"]) {
            expect(() => activate(context)).toThrow("Set instar.executable");
        }

        expect(context.subscriptions).toHaveLength(0);
    } finally {
        executable = previous;
    }
});

test("keeps client settings local while preserving server configuration", async () => {
    const context: Pick<ExtensionContext, "subscriptions" | "asAbsolutePath"> = {
        subscriptions: [],
        asAbsolutePath: resolve,
    };

    await activate(context);

    try {
        const token: CancellationToken = {
            isCancellationRequested: false,
            onCancellationRequested: () => ({ dispose() {} }),
        };

        const settings = {
            diagnostic_scope: "workspace",
            completion_snippets: false,
            import: { enabled: false },
            hints: { parameter_names: false },
        };

        const values = [
            { executable, trace: { server: "verbose" }, ...settings },
            { executable: "other extension executable" },
            { executable },
            null,
        ];

        const next = mock(() => Promise.resolve(values));
        const configuration = clientOptions?.middleware.workspace.configuration;

        if (configuration === undefined) {
            throw new Error("The client did not register configuration middleware.");
        }

        const result = await configuration(parameters, token, next);
        expect(result).toEqual([settings, values[1], {}, null]);
        expect(values[0]).toHaveProperty("executable", executable);
        expect(next).toHaveBeenCalledWith(parameters, token);
    } finally {
        await deactivate();

        for (const subscription of context.subscriptions) {
            subscription.dispose();
        }
    }
});
