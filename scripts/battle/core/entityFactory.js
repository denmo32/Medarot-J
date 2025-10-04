import { CONFIG } from '../common/config.js';
import * as Components from './components.js';
// ★改善: PartInfoを参照することで、パーツに関する定義元を一元化
import { TeamID, MedalPersonality, PartInfo } from '../common/constants.js'; 
import { PARTS_DATA } from '../data/parts.js'; 
import { MEDAROT_SETS } from '../data/medarotSets.js'; 

/**
 * 単一のプレイヤーエンティティを生成し、その特性を定義するコンポーネント群を追加します。
 * @param {World} world - ワールドオブジェクト
 * @param {string} teamId - チームID
 * @param {number} index - チーム内でのインデックス
 * @param {number} totalId - 全体での通し番号
 * @param {object | null} medarotData - プレイヤーのメダロットデータ (指定された場合)
 * @returns {number} 生成されたエンティティID
 */
function createPlayerEntity(world, teamId, index, totalId, medarotData = null) {
    // 機体セットの選択ロジック
    const medarotSet = medarotData ? medarotData.set : MEDAROT_SETS[Math.floor(Math.random() * MEDAROT_SETS.length)];
    const name = medarotData ? medarotData.name : `${medarotSet.name} #${totalId}`;

    const entityId = world.createEntity();
    const isLeader = index === 0;

    const personalityTypes = Object.values(MedalPersonality);
    const personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];

    const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
    const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + index * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;

    // ★修正: よりシンプルで正しいロジックにリファクタリング
    const partsData = {};
    for (const partKey in medarotSet.parts) {
        const partId = medarotSet.parts[partKey];
        // partKey は 'head', 'rightArm' など
        if (PARTS_DATA[partKey] && PARTS_DATA[partKey][partId]) {
            partsData[partKey] = PARTS_DATA[partKey][partId];
        }
    }

    world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
    world.addComponent(entityId, new Components.Gauge());
    world.addComponent(entityId, new Components.GameState());
    // ★修正: 正しいパーツデータを渡す
    world.addComponent(entityId, new Components.Parts(partsData.head, partsData.rightArm, partsData.leftArm, partsData.legs));
    world.addComponent(entityId, new Components.Action());
    world.addComponent(entityId, new Components.Medal(personality));
    world.addComponent(entityId, new Components.BattleLog());
    world.addComponent(entityId, new Components.Position(initialX, yPos));

    return entityId;
}

/**
 * 設定に基づいて、全プレイヤーエンティティを生成します。
 * @param {World} world - ワールドオブジェクト
 * @param {Array<Object>} [playerTeamData=null] - プレイヤーチームのメダロット構成データ
 */
export function createPlayers(world, playerTeamData = null) {
    let idCounter = 0;
    for (const teamId of Object.keys(CONFIG.TEAMS)) {
        for (let i = 0; i < CONFIG.PLAYERS_PER_TEAM; i++) {
            let medarotData = null;
            // チーム1 (プレイヤー側) で、かつデータが提供されている場合
            if (teamId === TeamID.TEAM1 && playerTeamData && playerTeamData[i]) {
                medarotData = playerTeamData[i];
            }
            createPlayerEntity(world, teamId, i, ++idCounter, medarotData); // medarotDataを渡す
        }
    }
}