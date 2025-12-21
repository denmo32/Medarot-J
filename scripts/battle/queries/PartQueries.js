/**
 * @file PartQueries.js
 * @description パーツ単位のエンティティやコンポーネントを検索・取得するヘルパー。
 */
import { Parts } from '../../components/index.js';
import { 
    PartStatus, PartStats, PartVisualConfig, 
    ActionLogic, TargetingBehavior, AccuracyBehavior, ImpactBehavior,
    TraitPenetrate, TraitCriticalBonus 
} from '../components/parts/PartComponents.js';
import { PartInfo as PartInfoConst } from '../../common/constants.js';

/**
 * 指定されたパーツIDに対応するパーツエンティティの情報を統合して返す。
 * @param {World} world 
 * @param {number} partEntityId 
 * @returns {object|null}
 */
export function getPartData(world, partEntityId) {
    if (partEntityId === null || partEntityId === undefined) return null;

    const status = world.getComponent(partEntityId, PartStatus);
    const stats = world.getComponent(partEntityId, PartStats);
    if (!status || !stats) return null;

    const logic = world.getComponent(partEntityId, ActionLogic);
    const targeting = world.getComponent(partEntityId, TargetingBehavior);
    const accuracy = world.getComponent(partEntityId, AccuracyBehavior);
    const impact = world.getComponent(partEntityId, ImpactBehavior);
    
    const penetrates = !!world.getComponent(partEntityId, TraitPenetrate);
    const critBonus = world.getComponent(partEntityId, TraitCriticalBonus);

    return {
        // Stats
        name: stats.name,
        might: stats.might,
        success: stats.success,
        armor: stats.armor,
        mobility: stats.mobility,
        propulsion: stats.propulsion,
        stability: stats.stability,
        defense: stats.defense,

        // Status
        hp: status.hp,
        maxHp: status.maxHp,
        isBroken: status.isBroken,

        // Behaviors
        actionType: logic?.type,
        action: stats.action,
        type: stats.type,
        isSupport: logic?.isSupport || false,

        targetTiming: targeting?.timing,
        targetScope: targeting?.scope,
        postMoveTargeting: targeting?.autoStrategy,

        accuracyType: accuracy?.type,
        effects: impact?.effects || [],

        // Traits
        penetrates: penetrates,
        criticalBonus: critBonus ? critBonus.rate : 0,
        trait: stats.trait,

        id: partEntityId,
    };
}

/**
 * パーツの演出設定を取得する
 */
export function getPartVisualConfig(world, partEntityId) {
    if (partEntityId === null || partEntityId === undefined) return null;
    return world.getComponent(partEntityId, PartVisualConfig);
}

/**
 * 指定したパーツエンティティのステータスコンポーネントのみを取得する（軽量版）
 */
export function getPartStats(world, partEntityId) {
    if (partEntityId === null || partEntityId === undefined) return null;
    return world.getComponent(partEntityId, PartStats);
}

/**
 * 指定したパーツエンティティの特定のステータス値のみを取得する
 */
export function getPartStat(world, partEntityId, statName) {
    const stats = getPartStats(world, partEntityId);
    return stats ? (stats[statName] || 0) : 0;
}

/**
 * 推進力による比較関数（ソート用）
 */
export function compareByPropulsion(world) {
    return (entityA, entityB) => {
        const partsA = world.getComponent(entityA, Parts);
        const partsB = world.getComponent(entityB, Parts);
        const propA = getPartStat(world, partsA?.legs, 'propulsion');
        const propB = getPartStat(world, partsB?.legs, 'propulsion');
        return propB - propA;
    };
}

/**
 * 指定エンティティのパーツ一覧を取得
 */
export function getParts(world, entityId, includeBroken = false, attackableOnly = true) {
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return [];

    const attackableKeys = new Set([PartInfoConst.HEAD.key, PartInfoConst.RIGHT_ARM.key, PartInfoConst.LEFT_ARM.key]);
    const entries = [
        ['head', parts.head],
        ['rightArm', parts.rightArm],
        ['leftArm', parts.leftArm],
        ['legs', parts.legs]
    ];
    
    return entries
        .map(([key, id]) => ({ key, id, data: getPartData(world, id) }))
        .filter(({ key, data }) => 
            data && 
            (!attackableOnly || attackableKeys.has(key)) && 
            (includeBroken || !data.isBroken)
        )
        .map(item => [item.key, item.data]);
}

/**
 * 攻撃可能なパーツ一覧を取得（頭部破壊時は空）
 */
export function getAttackableParts(world, entityId) {
    const parts = world.getComponent(entityId, Parts);
    const headStatus = world.getComponent(parts?.head, PartStatus);
    if (!headStatus || headStatus.isBroken) return [];
    return getParts(world, entityId, false, true);
}

/**
 * アクション可能な全パーツ一覧を取得（UI表示用）
 */
export function getAllActionParts(world, entityId) {
    return getParts(world, entityId, true, true);
}
