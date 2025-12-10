/**
 * @file CommandSystem.js
 * @description 状態変更コマンドを一括で処理するシステム。
 * イベントで発行されたコマンドを解釈し、副作用をcommandExecutorに委譲する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { executeCommands } from '../../logic/commandExecutor.js';

export class CommandSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.EXECUTE_COMMANDS, this.onExecuteCommands.bind(this));
    }

    onExecuteCommands(commands) {
        executeCommands(this.world, commands);
    }
}