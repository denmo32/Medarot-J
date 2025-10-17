import { CONFIG } from '../common/config.js';
import * as Components from './components/index.js';
// ★改善: PartInfoを参照することで、パーツに関する定義元を一元化
import { TeamID, MedalPersonality, PartInfo } from '../common/constants.js'; 
import { PARTS_DATA } from '../data/parts.js'; 
import { MEDAROT_SETS } from '../data/medarotSets.js'; 

/**
 * ★新規: マスターデータを元に、戦闘インスタンス用のパーツデータを生成します。
 * マスターデータ（設計図）と、戦闘中に変動する状態（HPなど）を明確に分離し、
 * データの不変性を保つことで、予期せぬバグを防ぎます。
 * Partsコンポーネントからロジックを移管しました。
 * @param {object} partData - パーツのマスターデータ
 * @returns {object | null} 戦闘インスタンス用のパーツオブジェクト、またはnull
 */
const initializePart = (partData) => {
    if (!partData) return null;

    // 1. ロールのデフォルト値とパーツ固有の値をマージする
    // これにより、parts.jsの記述を簡潔に保ちつつ、完全なデータ構造を構築します。
    // partData.roleが存在し、それがオブジェクトであることを確認します。
    const roleDefaults = (partData.role && typeof partData.role === 'object') ? { ...partData.role } : {};
    
    // マージの順序が重要: partDataがroleDefaultsを上書きします。
    // これにより、パーツデータで定義された`effects`などがロールのデフォルトをオーバーライドできます。
    const partInstance = { ...roleDefaults, ...partData };

    // 2. 戦闘中の状態を初期化します。
    partInstance.hp = partData.maxHp;
    partInstance.isBroken = false;
    
    // 3. effectの 'strategy' プロパティを 'type' に統一します。
    // データ定義の互換性を保ちつつ、システム内部では 'type' を使用します。
    if (partInstance.effects && Array.isArray(partInstance.effects)) {
        partInstance.effects = partInstance.effects.map(effect => {
            // strategyプロパティが存在すれば、typeにコピーして元のプロパティを削除
            if (effect.strategy) {
                const newEffect = { ...effect, type: effect.strategy };
                delete newEffect.strategy;
                return newEffect;
            }
            return effect;
        });
    }

    return partInstance;
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
    const rawPartsData = {};
    for (const partKey in medarotSet.parts) {
        const partId = medarotSet.parts[partKey];
        // partKey は 'head', 'rightArm' など
        if (PARTS_DATA[partKey] && PARTS_DATA[partKey][partId]) {
            rawPartsData[partKey] = PARTS_DATA[partKey][partId];
        }
    }

    // ★リファクタリング: このファクトリ関数内でパーツデータを完全に構築する
    const initializedParts = {
        head: initializePart(rawPartsData.head),
        rightArm: initializePart(rawPartsData.rightArm),
        leftArm: initializePart(rawPartsData.leftArm),
        legs: initializePart(rawPartsData.legs)
    };

    world.addComponent(entityId, new Components.PlayerInfo(name, teamId, isLeader));
    world.addComponent(entityId, new Components.Gauge());
    world.addComponent(entityId, new Components.GameState());
    // ★修正: 構築済みのパーツデータをPartsコンポーネントに渡す
    world.addComponent(entityId, new Components.Parts(initializedParts.head, initializedParts.rightArm, initializedParts.leftArm, initializedParts.legs));
    world.addComponent(entityId, new Components.Action());
    world.addComponent(entityId, new Components.Medal(personality));
    world.addComponent(entityId, new Components.BattleLog());
    world.addComponent(entityId, new Components.Position(initialX, yPos));
    // ★新規: ActiveEffectsコンポーネントを追加
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