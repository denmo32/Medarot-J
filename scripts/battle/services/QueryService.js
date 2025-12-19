/**
 * @file QueryService.js
 * @description 戦闘関連のエンティティやコンポーネントを検索・フィルタリングするサービス。
 * ECSの振る舞いコンポーネント（Behavior）に対応し、統合データを提供します。
 */
import { Parts } from '../../components/index.js';
import { 
    PartStatus, PartStats, PartVisualConfig, 
    ActionLogic, TargetingBehavior, AccuracyBehavior, ImpactBehavior,
    TraitPenetrate, TraitCriticalBonus 
} from '../components/parts/PartComponents.js';
import { PartInfo } from '../../common/constants.js';

export class QueryService {

    /**
     * 指定されたパーツIDに対応するパーツエンティティの情報を統合して返す。
     * 従来のデータ構造との互換性を保ちつつ、新しいBehaviorコンポーネントを反映。
     * @param {World} world 
     * @param {number} partEntityId 
     * @returns {object|null}
     */
    static getPartData(world, partEntityId) {
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
            type: stats.type, // 追加
            isSupport: logic?.isSupport || false,

            targetTiming: targeting?.timing,
            targetScope: targeting?.scope,
            postMoveTargeting: targeting?.autoStrategy,

            accuracyType: accuracy?.type,
            effects: impact?.effects || [],

            // Traits
            penetrates: penetrates,
            criticalBonus: critBonus ? critBonus.rate : 0,
            trait: stats.trait, // 追加

            id: partEntityId,
        };
    }

    /**
     * パーツの演出設定を取得する
     */
    static getPartVisualConfig(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;
        return world.getComponent(partEntityId, PartVisualConfig);
    }

    /**
     * 指定したパーツエンティティのステータスコンポーネントのみを取得する（軽量版）
     */
    static getPartStats(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;
        return world.getComponent(partEntityId, PartStats);
    }

    /**
     * 指定したパーツエンティティの特定のステータス値のみを取得する
     */
    static getPartStat(world, partEntityId, statName) {
        const stats = this.getPartStats(world, partEntityId);
        return stats ? (stats[statName] || 0) : 0;
    }

    /**
     * 推進力による比較関数（ソート用）
     */
    static compareByPropulsion(world) {
        return (entityA, entityB) => {
            const partsA = world.getComponent(entityA, Parts);
            const partsB = world.getComponent(entityB, Parts);
            const propA = this.getPartStat(world, partsA?.legs, 'propulsion');
            const propB = this.getPartStat(world, partsB?.legs, 'propulsion');
            return propB - propA;
        };
    }

    /**
     * 指定エンティティのパーツ一覧を取得
     */
    static getParts(world, entityId, includeBroken = false, attackableOnly = true) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return [];

        const attackableKeys = new Set([PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key]);
        const entries = [
            ['head', parts.head],
            ['rightArm', parts.rightArm],
            ['leftArm', parts.leftArm],
            ['legs', parts.legs]
        ];
        
        return entries
            .map(([key, id]) => ({ key, id, data: this.getPartData(world, id) }))
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
    static getAttackableParts(world, entityId) {
        const parts = world.getComponent(entityId, Parts);
        const headStatus = world.getComponent(parts?.head, PartStatus);
        if (!headStatus || headStatus.isBroken) return [];
        return this.getParts(world, entityId, false, true);
    }

    /**
     * アクション可能な全パーツ一覧を取得（UI表示用）
     */
    static getAllActionParts(world, entityId) {
        return this.getParts(world, entityId, true, true);
    }

    /**
     * 防御に最適なパーツ（HP最大）を探す
     */
    static findBestDefensePart(world, entityId) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return null;

        const candidates = ['rightArm', 'leftArm', 'legs']
            .map(key => ({ key, status: world.getComponent(parts[key], PartStatus) }))
            .filter(({ status }) => status && !status.isBroken)
            .sort((a, b) => b.status.hp - a.status.hp);

        return candidates.length > 0 ? candidates[0].key : null;
    }

    /**
     * ランダムなパーツを選択する（AI思考で使用）
     */
    static selectRandomPart(world, entityId) {
        const partKey = this._selectRandomPartKey(world, entityId);
        return partKey ? { targetId: entityId, targetPartKey: partKey } : null;
    }

    /**
     * 貫通対象となるランダムなパーツを選択する（指定パーツ以外）
     */
    static findRandomPenetrationTarget(world, entityId, excludedPartKey) {
        const partKey = this._selectRandomPartKey(world, entityId, key => key !== excludedPartKey);
        return partKey;
    }

    /**
     * 共通化されたランダムパーツキー選択ヘルパー
     * @private
     */
    static _selectRandomPartKey(world, entityId, filterFn = () => true) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return null;
        
        // 頭部が壊れている場合は何もできない
        const headStatus = world.getComponent(parts.head, PartStatus);
        if (!headStatus || headStatus.isBroken) return null;

        const validKeys = Object.entries(parts)
            .filter(([key, id]) => {
                const status = world.getComponent(id, PartStatus);
                return status && !status.isBroken && filterFn(key);
            })
            .map(([key]) => key);

        if (validKeys.length === 0) return null;
        return validKeys[Math.floor(Math.random() * validKeys.length)];
    }

    /**
     * 候補エンティティ群から生存パーツをリスト化して取得（AI用）
     */
    static getAllPartsFromCandidates(world, candidateIds) {
        if (!candidateIds) return [];
        return candidateIds.flatMap(id => {
            const parts = world.getComponent(id, Parts);
            if (!parts) return [];
            const headStatus = world.getComponent(parts.head, PartStatus);
            if (!headStatus || headStatus.isBroken) return [];
            
            return Object.entries(parts)
                .map(([key, partId]) => ({ 
                    entityId: id, 
                    partKey: key, 
                    part: this.getPartData(world, partId) 
                }))
                .filter(item => item.part && !item.part.isBroken);
        });
    }
}