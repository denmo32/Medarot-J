/**
 * @file CommandSystem.js
 * @description 状態変更コマンドを一括で処理するシステム。
 * イベントで発行されたコマンドを解釈し、CommandExecutorに委譲する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';

export class CommandSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.EXECUTE_COMMANDS, this.onExecuteCommands.bind(this));
    }

    onExecuteCommands(commands) {
        if (!commands || !Array.isArray(commands)) return;
        for (const cmd of commands) {
            if (cmd && typeof cmd.execute === 'function') {
                cmd.execute(this.world);
            } else {
                console.warn('CommandSystem received an invalid command object:', cmd);
            }
        }
    }
}