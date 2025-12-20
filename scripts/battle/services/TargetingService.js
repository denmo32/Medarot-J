/**
 * @file TargetingService.js
 * @description ターゲット解決サービス。
 * パーツID化に伴い、QueryServiceを使用してパーツ情報を参照する形に修正。
 * AI戦略結果の正規化ロジックを追加し、Systemの負担を軽減。
 */
import { PlayerInfo, Parts } from '../../components/index.js';
import { ActiveEffects } from '../components/index.js';
import { EffectType, EffectScope } from '../common/constants.js';
import { QueryService } from './QueryService.js';

export class TargetingService {

    /**
     * AI戦略の実行結果を正規化し、単一のターゲット情報を返す
     * @param {object|Array|null} result - 戦略関数の戻り値
     * @returns {{targetId: number, targetPartKey: string}|null}
     */
    static normalizeStrategyResult(result) {
        if (!result) return null;

        // 配列形式の場合 (重み付きリスト: [{ target: {...}, weight: ... }])
        if (Array.isArray(result)) {
            if (result.length === 0) return null;
            // 簡易実装: 先頭の候補を採用（本来はここで重み付け抽選を行っても良い）
            const candidate = result[0];
            if (candidate && candidate.target) {
                return {
                    targetId: candidate.target.targetId,
                    targetPartKey: candidate.target.targetPartKey
                };
            }
            return null;
        }

        // 単一オブジェクト形式の場合 ({ targetId, targetPartKey })
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

        return {
            finalTargetId: intendedTargetId,
            finalTargetPartKey: intendedPartKey,
            guardianInfo: null,
            shouldCancel: false
        };
    }

    static _findGuardian(world, originalTargetId) {
        const targetInfo = world.getComponent(originalTargetId, PlayerInfo);
        if (!targetInfo) return null;

        const allEntities = world.getEntitiesWith(PlayerInfo, ActiveEffects, Parts);
        const potentialGuardians = [];

        for (const id of allEntities) {
            if (id === originalTargetId) continue;

            const info = world.getComponent(id, PlayerInfo);
            if (info.teamId !== targetInfo.teamId) continue;

            const parts = world.getComponent(id, Parts);
            const headData = QueryService.getPartData(world, parts.head);
            if (!headData || headData.isBroken) continue;

            const activeEffects = world.getComponent(id, ActiveEffects);
            const guardEffect = activeEffects?.effects.find(e => e.type === EffectType.APPLY_GUARD && e.count > 0);

            if (!guardEffect) continue;

            // ガードパーツのIDを取得
            const guardPartId = parts[guardEffect.partKey];
            const guardPartData = QueryService.getPartData(world, guardPartId);
            
            if (!guardPartData || guardPartData.isBroken) continue;

            potentialGuardians.push({
                id: id,
                partKey: guardEffect.partKey,
                partHp: guardPartData.hp,
                name: info.name,
            });
        }

        if (potentialGuardians.length === 0) return null;
        
        potentialGuardians.sort((a, b) => b.partHp - a.partHp);
        
        return potentialGuardians[0];
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