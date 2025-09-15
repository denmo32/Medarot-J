import { CONFIG } from '../common/config.js';
import * as Components from './components.js';
import { TeamID, MedalPersonality } from '../common/constants.js';

/**
 * 単一のプレイヤーエンティティを生成し、その特性を定義するコンポーネント群を追加します。
 * @param {World} world - ワールドオブジェクト
 * @param {string} teamId - チームID
 * @param {number} index - チーム内でのインデックス
 * @param {number} totalId - 全体での通し番号
 * @returns {number} 生成されたエンティティID
 */
function createPlayerEntity(world, teamId, index, totalId) {
    const entityId = world.createEntity();
    const name = `メダロット ${totalId}`;
    const isLeader = index === 0;

    const personalityTypes = Object.values(MedalPersonality);
    const personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];

    const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
    const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + index * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;

    world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
    world.addComponent(entityId, new Components.Gauge());
    world.addComponent(entityId, new Components.GameState());
    world.addComponent(entityId, new Components.Parts());
    world.addComponent(entityId, new Components.DOMReference());
    world.addComponent(entityId, new Components.Action());
    world.addComponent(entityId, new Components.Medal(personality));
    world.addComponent(entityId, new Components.BattleLog());
    world.addComponent(entityId, new Components.Position(initialX, yPos));

    return entityId;
}

/**
 * 設定に基づいて、全プレイヤーエンティティを生成します。
 * @param {World} world - ワールドオブジェクト
 */
export function createPlayers(world) {
    let idCounter = 0;
    for (const teamId of Object.keys(CONFIG.TEAMS)) {
        for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
            createPlayerEntity(world, teamId, i, ++idCounter);
        }
    }
}
