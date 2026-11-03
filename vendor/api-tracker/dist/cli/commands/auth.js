import { Command } from "commander";
import { login, getAuthStatus } from "../../core/auth-manager.js";
import { loadConfig } from "../../storage/config-loader.js";
import { emitActorCommand } from "./v2.js";
export function authCommand() {
    const auth = new Command("auth").description("Manage authentication profiles");
    auth
        .command("login")
        .option("--profile <name>", "Legacy auth profile name")
        .option("--actor <name>", "Actor id")
        .option("--force", "Ignore a valid cache and login again")
        .action(async (opts, command) => {
        if (opts.actor) {
            await emitActorCommand(command, "resolve", opts.actor, true);
            return;
        }
        if (!opts.profile)
            throw new Error("Pass --actor <name>");
        const result = await login(opts.profile);
        console.log(JSON.stringify({
            profile: opts.profile,
            cached: true,
        }));
    });
    auth
        .command("status")
        .action(async (_opts, command) => {
        const raw = await import("../../storage/file-store.js").then(({ readYaml }) => readYaml("config.yaml"));
        if (raw.version === 2) {
            await emitActorCommand(command, "status");
            return;
        }
        const config = await loadConfig();
        const cache = await getAuthStatus();
        const profiles = {};
        for (const [name, profile] of Object.entries(config.auth.profiles)) {
            const entry = cache[name];
            profiles[name] = {
                cached: !!entry?.token,
                note: entry?.note ?? profile.note,
            };
        }
        console.log(JSON.stringify({ profiles }));
    });
    auth.command("verify").requiredOption("--actor <name>").action(async (opts, command) => emitActorCommand(command, "resolve", opts.actor));
    auth.command("forget").requiredOption("--actor <name>").action(async (opts, command) => emitActorCommand(command, "forget", opts.actor));
    return auth;
}
//# sourceMappingURL=auth.js.map