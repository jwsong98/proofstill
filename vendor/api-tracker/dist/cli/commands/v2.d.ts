import { Command } from "commander";
export declare function migrateCommand(): Command;
export declare function appCommand(): Command;
export declare function envCommand(): Command;
export declare function specCommand(): Command;
export declare function viewCommand(): Command;
export declare function emitActorCommand(command: Command, action: "status" | "resolve" | "forget", actorId?: string, force?: boolean): Promise<void>;
