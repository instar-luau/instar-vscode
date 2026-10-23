import type {
    CancellationToken,
    ConfigurationItem,
    ConfigurationMiddleware,
} from "vscode-languageclient/node";

type Request = Readonly<{ items: readonly Readonly<ConfigurationItem>[] }>;
type Next = Parameters<NonNullable<ConfigurationMiddleware["configuration"]>>[2];

export async function configuration(
    parameters: Request,
    token: CancellationToken,
    next: Next,
): Promise<unknown[]> {
    const values: unknown = await next({ items: [...parameters.items] }, token);

    if (!Array.isArray(values)) {
        throw new TypeError("Expected an array of workspace configurations.");
    }

    const configurations: readonly unknown[] = values;

    return configurations.map((value, index) => {
        if (
            parameters.items[index]?.section !== "instar" ||
            value === null ||
            typeof value !== "object" ||
            Array.isArray(value)
        ) {
            return value;
        }

        const settings: readonly (readonly [string, unknown])[] = Object.entries(value);

        return Object.fromEntries(
            settings.filter(([name]) =>
                ["diagnostic_scope", "completion_snippets", "import", "hints"].includes(name),
            ),
        );
    });
}
