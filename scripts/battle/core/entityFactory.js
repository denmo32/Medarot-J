import { CONFIG } from '../common/config.js';
import * as Components from './components/index.js';
import { TeamID, MedalPersonality, PartInfo } from '../common/constants.js'; 
import { PARTS_DATA } from '../data/parts.js'; 
import { MEDAROT_SETS } from '../data/medarotSets.js'; 
import { ActionDefinitions } from '../data/actionDefinitions.js';
import { PartRoles } from '../data/partRoles.js';
import { MEDALS_DATA } from '../data/medals.js';

/**
 * マスターデータを元に、戦闘インスタンス用のパーツデータを生成します。
 * この関数は、パーツデータ、役割、行動定義をマージして、
 * 戦闘システムが直接利用できる単一のオブジェクトを構築します。
 * @param {object} partData - パーツのマスターデータ (`PARTS_DATA`の単一エントリ)
 * @returns {object | null} 戦闘インスタンス用のパーツオブジェクト、またはnull
 */
const initializePart = (partData) => {
    if (!partData) return null;

    // 1. 役割(role)と行動定義(action)のデータを取得
    // partData.roleはオブジェクトの場合(上書き)と文字列の場合(参照)がある
    const roleKey = (typeof partData.role === 'object') ? partData.role.key : partData.role;
    const roleData = Object.values(PartRoles).find(r => r.key === roleKey) || {};

    const actionData = ActionDefinitions[partData.actionKey] || {};

    // 2. データをマージする (優先度: partData > roleData > actionData)
    // これにより、パーツ固有の設定が役割や行動のデフォルト設定を上書きできます。
    const mergedData = { ...actionData, ...roleData, ...partData };
    // roleがオブジェクトで上書きされている場合、その内容をさらにマージ
    if (typeof partData.role === 'object') {
        Object.assign(mergedData, partData.role);
    }
    
    // 3. 戦闘中の状態を初期化
    mergedData.hp = partData.maxHp;
    mergedData.isBroken = false;
    
    // 4. effectの 'strategy' プロパティを 'type' に統一 (後方互換性)
    if (mergedData.effects && Array.isArray(mergedData.effects)) {
        mergedData.effects = mergedData.effects.map(effect => {
            if (effect.strategy) {
                const newEffect = { ...effect, type: effect.strategy };
                delete newEffect.strategy;
                return newEffect;
            }
            return effect;
        });
    }

    return mergedData;
};

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
    const entityId = world.createEntity();
    const isLeader = index === 0;

    // --- パーツ構成の決定 ---
    const rawPartsData = {};
    let medarotSet; // プレイヤーチームの場合の名前フォールバック用に保持

    if (teamId === TeamID.TEAM2) {
        // 敵チーム: 各部位を完全にランダムで構成
        for (const partInfo of Object.values(PartInfo)) {
            const partKey = partInfo.key;
            const partIdList = Object.keys(PARTS_DATA[partKey]);
            if (partIdList.length > 0) {
                const randomPartId = partIdList[Math.floor(Math.random() * partIdList.length)];
                rawPartsData[partKey] = PARTS_DATA[partKey][randomPartId];
            }
        }
    } else {
        // プレイヤーチーム: 従来通り medarotData またはランダムなセットを使用
        medarotSet = medarotData ? medarotData.set : MEDAROT_SETS[Math.floor(Math.random() * MEDAROT_SETS.length)];
        for (const partKey in medarotSet.parts) {
            const partId = medarotSet.parts[partKey];
            if (PARTS_DATA[partKey] && PARTS_DATA[partKey][partId]) {
                rawPartsData[partKey] = PARTS_DATA[partKey][partId];
            }
        }
    }

    // --- メダルに基づいて名前と性格を決定 ---
    let name;
    let personality;
    const medalKeys = Object.keys(MEDALS_DATA);

    if (teamId === TeamID.TEAM1 && medarotData?.medalId) {
        // プレイヤーチーム: 指定されたメダルIDを使用
        const medalData = MEDALS_DATA[medarotData.medalId];
        if (medalData) {
            name = medalData.name;
            personality = medalData.personality;
        }
    } else if (teamId === TeamID.TEAM2 && medalKeys.length > 0) {
        // 敵チーム: ランダムなメダルを使用
        const randomMedalId = medalKeys[Math.floor(Math.random() * medalKeys.length)];
        const medalData = MEDALS_DATA[randomMedalId];
        if (medalData) {
            name = medalData.name;
            personality = medalData.personality;
        }
    }
    
    // フォールバック: メダル情報が取得できなかった場合
    if (!name || !personality) {
        console.warn(`Could not determine name/personality from medal for entity ${totalId}. Falling back.`);
        // チームに応じてフォールバック名を変更
        if (teamId === TeamID.TEAM2) {
            name = `エネミー #${totalId}`;
        } else {
            // medarotSetはプレイヤーチームの場合のみ定義されている
            name = medarotData ? medarotData.name : `${medarotSet.name} #${totalId}`;
        }
        // ランダムな性格を設定
        const personalityTypes = Object.values(MedalPersonality);
        personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
    }

    const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
    const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + index * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;

    // このファクトリ関数内でパーツデータを構築する
    const initializedParts = {
        head: initializePart(rawPartsData.head),
        rightArm: initializePart(rawPartsData.rightArm),
        leftArm: initializePart(rawPartsData.leftArm),
        legs: initializePart(rawPartsData.legs)
    };

    world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
    world.addComponent(entityId, new Components.Gauge());
    world.addComponent(entityId, new Components.GameState());
    // 構築済みのパーツデータをPartsコンポーネントに渡す
    world.addComponent(entityId, new Components.Parts(initializedParts.head, initializedParts.rightArm, initializedParts.leftArm, initializedParts.legs));
    world.addComponent(entityId, new Components.Action());
    world.addComponent(entityId, new Components.Medal(personality));
    world.addComponent(entityId, new Components.BattleLog());
    world.addComponent(entityId, new Components.Position(initialX, yPos));
    world.addComponent(entityId, new Components.ActiveEffects());

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