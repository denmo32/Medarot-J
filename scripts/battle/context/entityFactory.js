import { CONFIG } from '../../config/gameConfig.js';
import * as Components from '../components/index.js';
import { TeamID, MedalPersonality, PartInfo } from '../../config/constants.js'; 
import { PARTS_DATA } from '../../data/parts.js'; 
import { MEDAROT_SETS } from '../../data/medarotSets.js'; 
import { MEDALS_DATA } from '../../data/medals.js';
import { buildPartData } from '../../data/partDataUtils.js';

// --- Helper Functions ---

/**
 * 敵チーム用に完全にランダムなパーツID構成を生成します。
 * @returns {object} { head, rightArm, leftArm, legs } の形式のパーツIDオブジェクト
 */
function generateEnemyPartsIds() {
    const partIds = {};
    for (const partInfo of Object.values(PartInfo)) {
        const partKey = partInfo.key;
        const partIdList = Object.keys(PARTS_DATA[partKey]);
        if (partIdList.length > 0) {
            partIds[partKey] = partIdList[Math.floor(Math.random() * partIdList.length)];
        }
    }
    return partIds;
}

/**
 * プレイヤーチーム用のパーツID構成を取得します。
 * 指定データがあればそれを使用し、なければランダムなセットを使用します。
 * @param {object | null} medarotData - 指定されたメダロットデータ
 * @returns {{ ids: object, nameFallback: string }} パーツIDオブジェクトと名前フォールバック
 */
function getPlayerPartsIds(medarotData) {
    const partIds = {};
    const medarotSet = medarotData ? medarotData.set : MEDAROT_SETS[Math.floor(Math.random() * MEDAROT_SETS.length)];

    for (const partKey in medarotSet.parts) {
        const partId = medarotSet.parts[partKey];
        if (PARTS_DATA[partKey] && PARTS_DATA[partKey][partId]) {
            partIds[partKey] = partId;
        }
    }
    return { ids: partIds, nameFallback: medarotSet.name };
}

/**
 * メダル情報（名前、性格）を決定します。
 * @param {string} teamId
 * @param {object | null} medarotData
 * @param {string} nameFallback
 * @param {number} totalId
 * @returns {{ name: string, personality: string }}
 */
function determineMedalInfo(teamId, medarotData, nameFallback, totalId) {
    let name = null;
    let personality = null;

    // 1. メダルデータの取得を試みる
    if (teamId === TeamID.TEAM1 && medarotData?.medalId) {
        const medalData = MEDALS_DATA[medarotData.medalId];
        if (medalData) {
            name = medalData.name;
            personality = medalData.personality;
        }
    } else if (teamId === TeamID.TEAM2) {
        const medalKeys = Object.keys(MEDALS_DATA);
        if (medalKeys.length > 0) {
            const randomMedalId = medalKeys[Math.floor(Math.random() * medalKeys.length)];
            const medalData = MEDALS_DATA[randomMedalId];
            if (medalData) {
                name = medalData.name;
                personality = medalData.personality;
            }
        }
    }

    // 2. 取得できなかった場合のフォールバック
    if (!name || !personality) {
        console.warn(`Could not determine name/personality from medal for entity ${totalId}. Falling back.`);
        
        if (teamId === TeamID.TEAM2) {
            name = `エネミー #${totalId}`;
        } else {
            name = medarotData ? medarotData.name : `${nameFallback} #${totalId}`;
        }

        const personalityTypes = Object.values(MedalPersonality);
        personality = personalityTypes[Math.floor(Math.random() * personalityTypes.length)];
    }

    return { name, personality };
}

// --- Main Factory Functions ---

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

    // パーツIDの決定
    let partIds;
    let nameFallback = '';

    if (teamId === TeamID.TEAM2) {
        partIds = generateEnemyPartsIds();
    } else {
        const result = getPlayerPartsIds(medarotData);
        partIds = result.ids;
        nameFallback = result.nameFallback;
    }

    // 名前と性格の決定
    const { name, personality } = determineMedalInfo(teamId, medarotData, nameFallback, totalId);

    // 共通のデータ構築ユーティリティを使用してパーツデータを生成
    const initializedParts = {
        head: buildPartData(partIds.head, 'head'),
        rightArm: buildPartData(partIds.rightArm, 'rightArm'),
        leftArm: buildPartData(partIds.leftArm, 'leftArm'),
        legs: buildPartData(partIds.legs, 'legs')
    };

    // コンポーネントの追加
    const initialX = teamId === TeamID.TEAM1 ? 0 : 1;
    const yPos = CONFIG.BATTLEFIELD.PLAYER_INITIAL_Y + index * CONFIG.BATTLEFIELD.PLAYER_Y_STEP;

    world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
    world.addComponent(entityId, new Components.Gauge());
    world.addComponent(entityId, new Components.GameState());
    world.addComponent(entityId, new Components.Parts(
        initializedParts.head, 
        initializedParts.rightArm, 
        initializedParts.leftArm, 
        initializedParts.legs
    ));
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
            createPlayerEntity(world, teamId, i, ++idCounter, medarotData);
        }
    }
}
