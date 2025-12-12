/**
 * @file commandExecutor.js
 * @description 【エイリアス】新しいCommand.jsからexecuteCommands関数をエクスポート。
 * 旧コードとの互換性維持のため。
 */
import { CommandExecutor, createCommand } from './common/Command.js';

/**
 * 古い形式のコマンド配列を新しいCommandクラスに変換して実行
 * @param {World} world
 * @param {Array} commands
 */
export function executeCommands(world, commands) {
    if (!commands || !Array.isArray(commands)) return;
    const commandInstances = commands.map(cmd => createCommand(cmd.type, cmd));
    CommandExecutor.executeCommands(world, commandInstances);
}