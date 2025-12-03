/**
 * @file クエリユーティリティ
 * 低レベルなデータ取得・フィルタリング機能を提供する。
 * ルール依存の高度な判定（ガード判定、有効ターゲット判定など）は TargetingService に移動済み。
 */

import { Parts, PlayerInfo } from '../../components/index.js';
import { PartInfo } from '../../common/constants.js';
import { Position } from '../components/index.js';
// TargetingService に移動したため、ここでの import は最小限にする

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
    // 循環参照を避けるため、ここではTargetingServiceを使わず、
    // TargetingService側でこの関数を使うか、あるいは単純なロジックとして実装する。
    // ここでは単純な位置計算ヘルパーとして、有効な敵リストは外部から渡されることを想定する設計に切り替えることもできるが、
    // 既存コードの維持のため、TargetingServiceのgetValidEnemies相当のロジックをここに書くのは重複になる。
    // よって、findNearestEnemy は「TargetingService」に移すべきロジックだが、
    // queryUtilsは「Service」に依存すべきではない（下位レイヤーのため）。
    // そのため、findNearestEnemyはTargetingServiceに移動すべき関数である。
    // 今回の計画では移動対象リストに入っていなかったが、TargetingServiceのgetValidEnemiesに依存しているため、
    // ここに残すとTargetingServiceをimportする必要が出て循環参照のリスクがある。
    // しかし、今回は「移動」なので、この関数もTargetingServiceへ移動させるのが正しい。
    // ただし、postMoveTargeting.js から呼ばれている。
    // よって、この関数は削除し、TargetingService.findNearestEnemy として実装する形はとらず、
    // postMoveTargeting.js が TargetingService を使うように修正する。
    // ここでは削除する。
    return null; // 削除
}
// ※ findNearestEnemy は削除されました。利用箇所は TargetingService を使用してください。

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