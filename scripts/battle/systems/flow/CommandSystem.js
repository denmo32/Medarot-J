/**
 * @file CommandSystem.js
 * @description 状態変更コマンドを一括で処理するシステム。
 * イベントで発行されたコマンドを解釈し、CommandExecutorに委譲する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';

export class CommandSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.EXECUTE_COMMANDS, this.onExecuteCommands.bind(this));
    }

    onExecuteCommands(commands) {
        // 古い形式のコマンド配列を新しいCommandクラスに変換
        const commandInstances = commands.map(cmd => createCommand(cmd.type, cmd));
        CommandExecutor.executeCommands(this.world, commandInstances);
    }
}