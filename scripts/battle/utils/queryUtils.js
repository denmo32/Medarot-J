/**
 * @file クエリユーティリティ
 */

import { Parts, Position, PlayerInfo, GameState, ActiveEffects } from '../components/index.js';
import { PlayerStateType } from '../common/constants.js';
import { PartInfo, EffectType, EffectScope } from '../../common/constants.js';

export const compareByPropulsion = (world) => (entityA, entityB) => {
    const partsA = world.getComponent(entityA, Parts);
    const partsB = world.getComponent(entityB, Parts);

    const propulsionA = partsA?.legs?.propulsion || 0;
    const propulsionB = partsB?.legs?.propulsion || 0;

    return propulsionB - propulsionA;
};

export function getParts(world, entityId, includeBroken = false, attackableOnly = true) {
    if (!world || entityId === null || entityId === undefined) return [];
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return [];
    
    const attackablePartKeys = [PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key];
    
    const isTargetType = (key) => !attackableOnly || attackablePartKeys.includes(key);
    const isAlive = (part) => includeBroken || !part.isBroken;

    return Object.entries(parts)
        .filter(([key, part]) => part && isTargetType(key) && isAlive(part));
}

export function getAttackableParts(world, entityId) {
    const parts = world.getComponent(entityId, Parts);
    if (parts?.head?.isBroken) {
        return [];
    }
    return getParts(world, entityId, false, true);
}

export function getAllActionParts(world, entityId) {
    return getParts(world, entityId, true, true);
}

export function findBestDefensePart(world, entityId) {
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;
    
    const defendableParts = Object.entries(parts)
        .filter(([key, part]) => key !== PartInfo.HEAD.key && !part.isBroken)
        .sort(([, a], [, b]) => b.hp - a.hp);

    return defendableParts.length > 0 ? defendableParts[0][0] : null;
}

const _getValidEntitiesByTeam = (world, sourceTeamId, isAlly) => {
    return world.getEntitiesWith(PlayerInfo, Parts)
        .filter(id => {
            const pInfo = world.getComponent(id, PlayerInfo);
            const parts = world.getComponent(id, Parts);
            const isSameTeam = pInfo.teamId === sourceTeamId;
            const isAlive = !parts.head?.isBroken;
            
            return (isAlly ? isSameTeam : !isSameTeam) && isAlive;
        });
};

export function getValidEnemies(world, attackerId) {
    const attackerInfo = world.getComponent(attackerId, PlayerInfo);
    if (!attackerInfo) return [];
    return _getValidEntitiesByTeam(world, attackerInfo.teamId, false);
}

export function getValidAllies(world, sourceId, includeSelf = false) {
    const sourceInfo = world.getComponent(sourceId, PlayerInfo);
    if (!sourceInfo) return [];
    const allies = _getValidEntitiesByTeam(world, sourceInfo.teamId, true);
    return includeSelf ? allies : allies.filter(id => id !== sourceId);
}

export function getCandidatesByScope(world, entityId, scope) {
    switch (scope) {
        case EffectScope.ENEMY_SINGLE:
        case EffectScope.ENEMY_TEAM:
            return getValidEnemies(world, entityId);
        case EffectScope.ALLY_SINGLE:
            return getValidAllies(world, entityId, false);
        case EffectScope.ALLY_TEAM:
            return getValidAllies(world, entityId, true);
        case EffectScope.SELF:
            return [entityId];
        default:
            console.warn(`getCandidatesByScope: Unknown targetScope '${scope}'. Defaulting to enemies.`);
            return getValidEnemies(world, entityId);
    }
}

export function findMostDamagedAllyPart(world, candidates) {
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

export function isValidTarget(world, targetId, partKey = null) {
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

export function selectRandomPart(world, entityId) {
    if (!world || entityId === null || entityId === undefined) return null;
    const parts = world.getComponent(entityId, Parts);
    if (!parts || parts.head?.isBroken) return null;

    const hittablePartKeys = Object.keys(parts).filter(key => parts[key] && !parts[key].isBroken);
    if (hittablePartKeys.length === 0) return null;

    const partKey = hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)];
    return { targetId: entityId, targetPartKey: partKey };
}

export function findRandomPenetrationTarget(world, entityId, excludedPartKey) {
    if (!world || entityId === null || entityId === undefined) return null;
    const parts = world.getComponent(entityId, Parts);
    if (!parts || parts.head?.isBroken) return null;

    const hittablePartKeys = Object.keys(parts).filter(key => 
        key !== excludedPartKey && parts[key] && !parts[key].isBroken
    );

    return hittablePartKeys.length > 0 
        ? hittablePartKeys[Math.floor(Math.random() * hittablePartKeys.length)] 
        : null;
}

export function findNearestEnemy(world, attackerId) {
    const attackerPos = world.getComponent(attackerId, Position);
    if (!attackerPos) return null;
    
    const enemies = getValidEnemies(world, attackerId);
    if (enemies.length === 0) return null;

    const enemiesWithDistance = enemies
        .map(id => {
            const pos = world.getComponent(id, Position);
            return pos ? { id, distance: Math.abs(attackerPos.x - pos.x) } : null;
        })
        .filter(item => item !== null)
        .sort((a, b) => a.distance - b.distance);

    return enemiesWithDistance.length > 0 ? enemiesWithDistance[0].id : null;
}

export function getAllPartsFromCandidates(world, candidateIds) {
    if (!candidateIds) return [];
    
    return candidateIds.flatMap(id => {
        const parts = world.getComponent(id, Parts);
        if (!parts || parts.head?.isBroken) return [];
        
        return Object.entries(parts)
            .filter(([_, part]) => part && !part.isBroken)
            .map(([key, part]) => ({ entityId: id, partKey: key, part }));
    });
}

export function selectPartByCondition(world, candidates, sortFn) {
    const allParts = getAllPartsFromCandidates(world, candidates);
    if (allParts.length === 0) return null;
    
    allParts.sort(sortFn);
    const selectedPart = allParts[0];
    return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
}

export function findGuardian(world, originalTargetId) {
    const targetInfo = world.getComponent(originalTargetId, PlayerInfo);
    if (!targetInfo) return null;

    const potentialGuardians = world.getEntitiesWith(PlayerInfo, ActiveEffects, Parts)
        .filter(id => {
            if (id === originalTargetId) return false;
            const info = world.getComponent(id, PlayerInfo);
            const parts = world.getComponent(id, Parts);
            const activeEffects = world.getComponent(id, ActiveEffects);
            
            const isSameTeam = info.teamId === targetInfo.teamId;
            const isAlive = !parts.head?.isBroken;
            const hasGuardEffect = activeEffects?.effects.some(e => e.type === EffectType.APPLY_GUARD && e.count > 0);
            
            return isSameTeam && isAlive && hasGuardEffect;
        })
        .map(id => {
            const activeEffects = world.getComponent(id, ActiveEffects);
            const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
            const parts = world.getComponent(id, Parts);
            const info = world.getComponent(id, PlayerInfo);
            const guardPart = parts[guardEffect.partKey];

            if (guardPart && !guardPart.isBroken) {
                return {
                    id: id,
                    partKey: guardEffect.partKey,
                    partHp: guardPart.hp,
                    name: info.name,
                };
            }
            return null;
        })
        .filter(g => g !== null);

    if (potentialGuardians.length === 0) return null;
    
    potentialGuardians.sort((a, b) => b.partHp - a.partHp);
    return potentialGuardians[0];
}