/**
 * @file BattleQueries.js
 * @description 戦闘関連のエンティティやコンポーネントを検索・取得する読み取り専用ヘルパー。
 * importパス修正: Parts, PlayerInfoはCommon, 他はBattle
 */
import { Parts, PlayerInfo } from '../../components/index.js'; // Common
import { 
    PartStatus, PartStats, PartVisualConfig, 
    ActionLogic, TargetingBehavior, AccuracyBehavior, ImpactBehavior,
    TraitPenetrate, TraitCriticalBonus 
} from '../components/parts/PartComponents.js';
import { PartInfo as PartInfoConst } from '../../common/constants.js';

export const BattleQueries = {

    /**
     * 指定されたパーツIDに対応するパーツエンティティの情報を統合して返す。
     * @param {World} world 
     * @param {number} partEntityId 
     * @returns {object|null}
     */
    getPartData(world, partEntityId) {
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
    },

    /**
     * パーツの演出設定を取得する
     */
    getPartVisualConfig(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;
        return world.getComponent(partEntityId, PartVisualConfig);
    },

    /**
     * 指定したパーツエンティティのステータスコンポーネントのみを取得する（軽量版）
     */
    getPartStats(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;
        return world.getComponent(partEntityId, PartStats);
    },

    /**
     * 指定したパーツエンティティの特定のステータス値のみを取得する
     */
    getPartStat(world, partEntityId, statName) {
        const stats = this.getPartStats(world, partEntityId);
        return stats ? (stats[statName] || 0) : 0;
    },

    /**
     * 推進力による比較関数（ソート用）
     */
    compareByPropulsion(world) {
        return (entityA, entityB) => {
            const partsA = world.getComponent(entityA, Parts);
            const partsB = world.getComponent(entityB, Parts);
            const propA = this.getPartStat(world, partsA?.legs, 'propulsion');
            const propB = this.getPartStat(world, partsB?.legs, 'propulsion');
            return propB - propA;
        };
    },

    /**
     * 指定エンティティのパーツ一覧を取得
     */
    getParts(world, entityId, includeBroken = false, attackableOnly = true) {
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
            .map(([key, id]) => ({ key, id, data: this.getPartData(world, id) }))
            .filter(({ key, data }) => 
                data && 
                (!attackableOnly || attackableKeys.has(key)) && 
                (includeBroken || !data.isBroken)
            )
            .map(item => [item.key, item.data]);
    },

    /**
     * 攻撃可能なパーツ一覧を取得（頭部破壊時は空）
     */
    getAttackableParts(world, entityId) {
        const parts = world.getComponent(entityId, Parts);
        const headStatus = world.getComponent(parts?.head, PartStatus);
        if (!headStatus || headStatus.isBroken) return [];
        return this.getParts(world, entityId, false, true);
    },

    /**
     * アクション可能な全パーツ一覧を取得（UI表示用）
     */
    getAllActionParts(world, entityId) {
        return this.getParts(world, entityId, true, true);
    },

    /**
     * 防御に最適なパーツ（HP最大）を探す
     */
    findBestDefensePart(world, entityId) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return null;

        const candidates = ['rightArm', 'leftArm', 'legs']
            .map(key => ({ key, status: world.getComponent(parts[key], PartStatus) }))
            .filter(({ status }) => status && !status.isBroken)
            .sort((a, b) => b.status.hp - a.status.hp);

        return candidates.length > 0 ? candidates[0].key : null;
    },

    /**
     * ランダムなパーツを選択する（AI思考で使用）
     */
    selectRandomPart(world, entityId) {
        const partKey = this._selectRandomPartKey(world, entityId);
        return partKey ? { targetId: entityId, targetPartKey: partKey } : null;
    },

    /**
     * 貫通対象となるランダムなパーツを選択する（指定パーツ以外）
     */
    findRandomPenetrationTarget(world, entityId, excludedPartKey) {
        const partKey = this._selectRandomPartKey(world, entityId, key => key !== excludedPartKey);
        return partKey;
    },

    /**
     * 共通化されたランダムパーツキー選択ヘルパー
     * @private
     */
    _selectRandomPartKey(world, entityId, filterFn = () => true) {
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
    },

    /**
     * 候補エンティティ群から生存パーツをリスト化して取得（AI用）
     */
    getAllPartsFromCandidates(world, candidateIds) {
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
    },

    // --- Validation Logic ---

    isValidTarget(world, targetId, partKey = null) {
        if (targetId === null || targetId === undefined) return false;
        const parts = world.getComponent(targetId, Parts);
        if (!parts) return false;
        
        const headData = this.getPartData(world, parts.head);
        if (!headData || headData.isBroken) return false;

        if (partKey) {
            const partId = parts[partKey];
            const partData = this.getPartData(world, partId);
            if (!partData || partData.isBroken) {
                return false;
            }
        }
        return true;
    },

    // --- Entity Filtering ---

    getValidEnemies(world, attackerId) {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return [];
        return this._getValidEntitiesByTeam(world, attackerInfo.teamId, false);
    },

    getValidAllies(world, sourceId, includeSelf = false) {
        const sourceInfo = world.getComponent(sourceId, PlayerInfo);
        if (!sourceInfo) return [];
        const allies = this._getValidEntitiesByTeam(world, sourceInfo.teamId, true);
        return includeSelf ? allies : allies.filter(id => id !== sourceId);
    },

    _getValidEntitiesByTeam(world, sourceTeamId, isAlly) {
        return world.getEntitiesWith(PlayerInfo, Parts)
            .filter(id => {
                const pInfo = world.getComponent(id, PlayerInfo);
                const parts = world.getComponent(id, Parts);
                const isSameTeam = pInfo.teamId === sourceTeamId;
                
                const headData = this.getPartData(world, parts.head);
                const isAlive = headData && !headData.isBroken;
                
                return (isAlly ? isSameTeam : !isSameTeam) && isAlive;
            });
    },

    findMostDamagedAllyPart(world, candidates) {
        if (!candidates || candidates.length === 0) return null;

        const damagedParts = candidates.flatMap(allyId => {
            const parts = world.getComponent(allyId, Parts);
            if (!parts) return [];
            
            return Object.entries(parts)
                .map(([key, partId]) => ({ 
                    targetId: allyId, 
                    targetPartKey: key, 
                    data: this.getPartData(world, partId) 
                }))
                .filter(item => item.data && !item.data.isBroken && item.data.maxHp > item.data.hp)
                .map(item => ({
                    targetId: item.targetId,
                    targetPartKey: item.targetPartKey,
                    damage: item.data.maxHp - item.data.hp
                }));
        });

        if (damagedParts.length === 0) return null;

        damagedParts.sort((a, b) => b.damage - a.damage);
        
        return { targetId: damagedParts[0].targetId, targetPartKey: damagedParts[0].targetPartKey };
    }
};