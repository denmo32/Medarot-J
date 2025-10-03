import { CONFIG } from '../common/config.js';
import * as Components from './components.js';
// ★改善: PartInfoを参照することで、パーツに関する定義元を一元化
import { TeamID, MedalPersonality, PartInfo } from '../common/constants.js'; 
import { PARTS_DATA } from '../data/parts.js'; 
import { MEDAROT_SETS } from '../data/medarotSets.js';
// BattleEntityを追加するために、map/components.jsをインポート
import * as MapComponents from '../../map/components.js'; 

/**
 * 単一のプレイヤーエンティティを生成し、その特性を定義するコンポーネント群を追加します。
 * @param {World} world - ワールドオブジェクト
 * @param {string} teamId - チームID
 * @param {number} index - チーム内でのインデックス
 * @param {number} totalId - 全体での通し番号
 * @returns {number} 生成されたエンティティID
 */
function createPlayerEntity(world, teamId, index, totalId) {
    // ★新規: 機体セットをランダムに選択
    const medarotSet = MEDAROT_SETS[Math.floor(Math.random() * MEDAROT_SETS.length)];

    const entityId = world.createEntity();
    // ★変更: 名前を機体セットから取得し、通し番号を追加
    const name = `${medarotSet.name} #${totalId}`;
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
    world.addComponent(entityId, new Components.DOMReference());
    world.addComponent(entityId, new Components.Action());
    world.addComponent(entityId, new Components.Medal(personality));
    world.addComponent(entityId, new Components.BattleLog());
    world.addComponent(entityId, new Components.Position(initialX, yPos));
    world.addComponent(entityId, new MapComponents.BattleEntity());

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