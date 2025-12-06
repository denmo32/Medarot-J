/**
 * @file クエリユーティリティ
 * 低レベルなデータ取得・フィルタリング機能を提供する。
 * 冗長性を削減し、ヘルパー関数に統合。
 */

import { Parts } from '../../components/index.js';
import { PartInfo } from '../../common/constants.js';

export const compareByPropulsion = (world) => (entityA, entityB) => {
    const partsA = world.getComponent(entityA, Parts);
    const partsB = world.getComponent(entityB, Parts);

    const propulsionA = partsA?.legs?.propulsion || 0;
    const propulsionB = partsB?.legs?.propulsion || 0;

    return propulsionB - propulsionA;
};

// ヘルパー: パーツリストを取得
function _getPartEntries(world, entityId) {
    if (!world || entityId == null) return [];
    const parts = world.getComponent(entityId, Parts);
    return parts ? Object.entries(parts) : [];
}

export function getParts(world, entityId, includeBroken = false, attackableOnly = true) {
    const attackableKeys = new Set([PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key]);
    
    return _getPartEntries(world, entityId)
        .filter(([key, part]) => 
            part && 
            (!attackableOnly || attackableKeys.has(key)) && 
            (includeBroken || !part.isBroken)
        );
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
    const defendableParts = _getPartEntries(world, entityId)
        .filter(([key, part]) => key !== PartInfo.HEAD.key && part && !part.isBroken)
        .sort(([, a], [, b]) => b.hp - a.hp);

    return defendableParts.length > 0 ? defendableParts[0][0] : null;
}

// 共通化されたランダム選択ヘルパー
function _selectRandomPartKey(world, entityId, filterFn = () => true) {
    const parts = world.getComponent(entityId, Parts);
    if (!parts || parts.head?.isBroken) return null;

    const validKeys = Object.keys(parts).filter(key => 
        parts[key] && !parts[key].isBroken && filterFn(key)
    );

    if (validKeys.length === 0) return null;
    return validKeys[Math.floor(Math.random() * validKeys.length)];
}

export function selectRandomPart(world, entityId) {
    const partKey = _selectRandomPartKey(world, entityId);
    return partKey ? { targetId: entityId, targetPartKey: partKey } : null;
}

export function findRandomPenetrationTarget(world, entityId, excludedPartKey) {
    return _selectRandomPartKey(world, entityId, key => key !== excludedPartKey);
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