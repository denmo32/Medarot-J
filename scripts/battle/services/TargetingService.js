/**
 * @file TargetingService.js
 * @description ターゲットの検索、検証、および最終的な着弾点の解決（ガード判定など）を行うサービス。
 */
import { PlayerInfo, Parts } from '../../components/index.js';
import { ActiveEffects } from '../components/index.js';
import { EffectType, EffectScope, TargetTiming } from '../../common/constants.js';
import { targetingStrategies } from '../ai/targetingStrategies.js';

export class TargetingService {

    /**
     * 攻撃の最終的な着弾対象を解決する。
     * @param {World} world 
     * @param {number} attackerId 
     * @param {number} intendedTargetId 
     * @param {string} intendedPartKey 
     * @param {boolean} isSupport 
     * @returns {object} { finalTargetId, finalTargetPartKey, guardianInfo, shouldCancel }
     */
    static resolveActualTarget(world, attackerId, intendedTargetId, intendedPartKey, isSupport) {
        // 1. 支援行動の場合はガード判定等をスキップしてそのまま返す
        if (isSupport) {
            return {
                finalTargetId: intendedTargetId,
                finalTargetPartKey: intendedPartKey,
                guardianInfo: null,
                shouldCancel: false
            };
        }

        // 2. ターゲットの妥当性チェック
        if (!this.isValidTarget(world, intendedTargetId, intendedPartKey)) {
            return { shouldCancel: true };
        }

        // 3. ガード（かばう）判定
        // ターゲットが存在する場合のみチェック
        if (intendedTargetId !== null) {
            const foundGuardian = this._findGuardian(world, intendedTargetId);
            if (foundGuardian) {
                return {
                    finalTargetId: foundGuardian.id,
                    finalTargetPartKey: foundGuardian.partKey,
                    guardianInfo: foundGuardian,
                    shouldCancel: false
                };
            }
        }

        // 4. 通常ターゲット
        return {
            finalTargetId: intendedTargetId,
            finalTargetPartKey: intendedPartKey,
            guardianInfo: null,
            shouldCancel: false
        };
    }

    /**
     * 移動後のタイミングでターゲットを決定する必要がある場合、戦略に基づいてターゲットを解決する
     * @param {World} world 
     * @param {number} executorId 
     * @param {object} actionComp Action Component
     */
    static resolvePostMoveTarget(world, executorId, actionComp) {
        const parts = world.getComponent(executorId, Parts);
        if (!parts || !actionComp.partKey) return;
        
        const selectedPart = parts[actionComp.partKey];

        // ターゲット未定 かつ POST_MOVEタイミングの場合のみ解決を試みる
        if (selectedPart && selectedPart.targetTiming === TargetTiming.POST_MOVE && actionComp.targetId === null) {
            const strategy = targetingStrategies[selectedPart.postMoveTargeting];
            if (strategy) {
                const targetData = strategy({ world, attackerId: executorId });
                if (targetData) {
                    actionComp.targetId = targetData.targetId;
                    actionComp.targetPartKey = targetData.targetPartKey;
                }
            }
        }
    }

    /**
     * 指定されたターゲットがかばわれる対象か確認し、ガーディアンを返す
     * @param {World} world 
     * @param {number} originalTargetId 
     * @returns {object|null} ガーディアン情報またはnull
     */
    static _findGuardian(world, originalTargetId) {
        const targetInfo = world.getComponent(originalTargetId, PlayerInfo);
        if (!targetInfo) return null;

        const allEntities = world.getEntitiesWith(PlayerInfo, ActiveEffects, Parts);
        const potentialGuardians = [];

        for (const id of allEntities) {
            // 自分自身は守れない
            if (id === originalTargetId) continue;

            const info = world.getComponent(id, PlayerInfo);
            // 敵チームは守らない
            if (info.teamId !== targetInfo.teamId) continue;

            const parts = world.getComponent(id, Parts);
            // 頭部が破壊されているなら守れない
            if (parts.head?.isBroken) continue;

            const activeEffects = world.getComponent(id, ActiveEffects);
            const guardEffect = activeEffects?.effects.find(e => e.type === EffectType.APPLY_GUARD && e.count > 0);

            // ガード効果がないなら守れない
            if (!guardEffect) continue;

            const guardPart = parts[guardEffect.partKey];
            // ガードパーツが破壊されているなら守れない
            if (!guardPart || guardPart.isBroken) continue;

            potentialGuardians.push({
                id: id,
                partKey: guardEffect.partKey,
                partHp: guardPart.hp,
                name: info.name,
            });
        }

        if (potentialGuardians.length === 0) return null;
        
        // 最もHPが高いパーツを持つガーディアンが優先される
        potentialGuardians.sort((a, b) => b.partHp - a.partHp);
        
        return potentialGuardians[0];
    }

    /**
     * 指定されたターゲットが有効（生存しており、ターゲット可能）か判定する
     * @param {World} world 
     * @param {number} targetId 
     * @param {string} [partKey=null] 
     * @returns {boolean}
     */
    static isValidTarget(world, targetId, partKey = null) {
        if (targetId === null || targetId === undefined) return false;
        const parts = world.getComponent(targetId, Parts);
        if (!parts || parts.head?.isBroken) return false;

        if (partKey) {
            if (!parts[partKey] || parts[partKey].isBroken) {
                return false;
            }
        }
        return true;
    }

    /**
     * 指定されたスコープに基づいて候補エンティティIDのリストを取得する
     * @param {World} world 
     * @param {number} entityId - 基準となるエンティティ（実行者）
     * @param {string} scope - EffectScope
     * @returns {number[]}
     */
    static getCandidatesByScope(world, entityId, scope) {
        switch (scope) {
            case EffectScope.ENEMY_SINGLE:
            case EffectScope.ENEMY_TEAM:
                return this.getValidEnemies(world, entityId);
            case EffectScope.ALLY_SINGLE:
                return this.getValidAllies(world, entityId, false);
            case EffectScope.ALLY_TEAM:
                return this.getValidAllies(world, entityId, true);
            case EffectScope.SELF:
                return [entityId];
            default:
                console.warn(`TargetingService: Unknown targetScope '${scope}'. Defaulting to enemies.`);
                return this.getValidEnemies(world, entityId);
        }
    }

    /**
     * 有効な敵エンティティ一覧を取得
     * @param {World} world 
     * @param {number} attackerId 
     * @returns {number[]}
     */
    static getValidEnemies(world, attackerId) {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return [];
        return this._getValidEntitiesByTeam(world, attackerInfo.teamId, false);
    }

    /**
     * 有効な味方エンティティ一覧を取得
     * @param {World} world 
     * @param {number} sourceId 
     * @param {boolean} [includeSelf=false] 
     * @returns {number[]}
     */
    static getValidAllies(world, sourceId, includeSelf = false) {
        const sourceInfo = world.getComponent(sourceId, PlayerInfo);
        if (!sourceInfo) return [];
        const allies = this._getValidEntitiesByTeam(world, sourceInfo.teamId, true);
        return includeSelf ? allies : allies.filter(id => id !== sourceId);
    }

    static _getValidEntitiesByTeam(world, sourceTeamId, isAlly) {
        return world.getEntitiesWith(PlayerInfo, Parts)
            .filter(id => {
                const pInfo = world.getComponent(id, PlayerInfo);
                const parts = world.getComponent(id, Parts);
                const isSameTeam = pInfo.teamId === sourceTeamId;
                const isAlive = !parts.head?.isBroken;
                
                return (isAlly ? isSameTeam : !isSameTeam) && isAlive;
            });
    }

    /**
     * 候補の中から最もダメージを受けているパーツを持つ味方を探す
     * @param {World} world 
     * @param {number[]} candidates 
     * @returns {object|null} { targetId, targetPartKey }
     */
    static findMostDamagedAllyPart(world, candidates) {
        if (!candidates || candidates.length === 0) return null;

        const damagedParts = candidates.flatMap(allyId => {
            const parts = world.getComponent(allyId, Parts);
            if (!parts) return [];
            
            return Object.entries(parts)
                .filter(([_, part]) => part && !part.isBroken && part.maxHp > part.hp)
                .map(([key, part]) => ({
                    targetId: allyId,
                    targetPartKey: key,
                    damage: part.maxHp - part.hp
                }));
        });

        if (damagedParts.length === 0) return null;

        damagedParts.sort((a, b) => b.damage - a.damage);
        
        return { targetId: damagedParts[0].targetId, targetPartKey: damagedParts[0].targetPartKey };
    }
}