/**
 * @file TargetingService.js
 * @description ターゲット解決サービス。
 * ガード判定ロジックを削除し、Traitフックを使用するように変更。
 */
import { PlayerInfo, Parts } from '../../components/index.js';
import { HookRegistry, HookPhase } from '../definitions/HookRegistry.js';
import { TraitRegistry } from '../definitions/traits/TraitRegistry.js';
import { QueryService } from './QueryService.js';
import { EffectScope } from '../common/constants.js';

export class TargetingService {

    // (既存の normalizeStrategyResult 等はそのまま)
    static normalizeStrategyResult(result) {
        if (!result) return null;
        if (Array.isArray(result)) {
            if (result.length === 0) return null;
            const candidate = result[0];
            if (candidate && candidate.target) {
                return {
                    targetId: candidate.target.targetId,
                    targetPartKey: candidate.target.targetPartKey
                };
            }
            return null;
        }
        if (result.targetId !== undefined) {
            return {
                targetId: result.targetId,
                targetPartKey: result.targetPartKey
            };
        }
        return null;
    }

    static resolveActualTarget(world, attackerId, intendedTargetId, intendedPartKey, isSupport) {
        if (isSupport) {
            return {
                finalTargetId: intendedTargetId,
                finalTargetPartKey: intendedPartKey,
                guardianInfo: null,
                shouldCancel: false
            };
        }

        if (!this.isValidTarget(world, intendedTargetId, intendedPartKey)) {
            return { shouldCancel: true };
        }

        // 結果オブジェクト初期化
        const result = {
            finalTargetId: intendedTargetId,
            finalTargetPartKey: intendedPartKey,
            guardianInfo: null
        };

        // --- Hook Execution ---
        // 本来は HookRegistry.execute(HookPhase.ON_TARGET_RESOLVING, { ... }) だが、
        // グローバルな登録ではなく、必要なTrait（ここではGUARD）を明示的に呼び出す形をとる。
        // 将来的には「場にいる全員のTrait」を収集して実行するのが正しいHookの姿。
        
        // 簡易実装: GuardTraitを直接呼び出し (TraitRegistry経由)
        TraitRegistry.executeTraitLogic('GUARD', HookPhase.ON_TARGET_RESOLVING, {
            world,
            originalTargetId: intendedTargetId,
            attackerId,
            result
        });

        return {
            finalTargetId: result.finalTargetId,
            finalTargetPartKey: result.finalTargetPartKey,
            guardianInfo: result.guardianInfo,
            shouldCancel: false
        };
    }

    static isValidTarget(world, targetId, partKey = null) {
        if (targetId === null || targetId === undefined) return false;
        const parts = world.getComponent(targetId, Parts);
        if (!parts) return false;
        
        const headData = QueryService.getPartData(world, parts.head);
        if (!headData || headData.isBroken) return false;

        if (partKey) {
            const partId = parts[partKey];
            const partData = QueryService.getPartData(world, partId);
            if (!partData || partData.isBroken) {
                return false;
            }
        }
        return true;
    }

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

    static getValidEnemies(world, attackerId) {
        const attackerInfo = world.getComponent(attackerId, PlayerInfo);
        if (!attackerInfo) return [];
        return this._getValidEntitiesByTeam(world, attackerInfo.teamId, false);
    }

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
                
                const headData = QueryService.getPartData(world, parts.head);
                const isAlive = headData && !headData.isBroken;
                
                return (isAlly ? isSameTeam : !isSameTeam) && isAlive;
            });
    }

    static findMostDamagedAllyPart(world, candidates) {
        if (!candidates || candidates.length === 0) return null;

        const damagedParts = candidates.flatMap(allyId => {
            const parts = world.getComponent(allyId, Parts);
            if (!parts) return [];
            
            return Object.entries(parts)
                .map(([key, partId]) => ({ 
                    targetId: allyId, 
                    targetPartKey: key, 
                    data: QueryService.getPartData(world, partId) 
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
}