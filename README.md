# Instar

Luau language support for VS Code.

Open a `.luau` file in a trusted workspace to start the server.

For `.lua` files, select **Luau** as the language mode or add this workspace setting:

```json
{
  "files.associations": {
    "*.lua": "luau"
  }
}
```

Configure projects in `instar.toml` and editor preferences under **Instar** in
VS Code settings. You can override preferences per workspace folder.

Commands: **Instar: Show Output**, **Instar: Restart Language Server**,
**Instar: Stop Language Server**.

To use another executable, set `instar.executable` to its absolute path in user
settings and reload the window.

## License

[MIT](LICENSE) © ohirume.
