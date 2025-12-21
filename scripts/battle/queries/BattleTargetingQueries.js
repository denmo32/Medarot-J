/**
 * @file BattleTargetingQueries.js
 * @description AIやアクション選択時のターゲット抽出・戦略的選択を行うヘルパー。
 */
import { Parts } from '../../components/index.js';
import { PartStatus } from '../components/parts/PartComponents.js';
import { getPartData } from './PartQueries.js';

/**
 * ランダムなパーツを選択する（AI思考で使用）
 */
export function selectRandomPart(world, entityId) {
    const partKey = _selectRandomPartKey(world, entityId);
    return partKey ? { targetId: entityId, targetPartKey: partKey } : null;
}

/**
 * 貫通対象となるランダムなパーツを選択する（指定パーツ以外）
 */
export function findRandomPenetrationTarget(world, entityId, excludedPartKey) {
    const partKey = _selectRandomPartKey(world, entityId, key => key !== excludedPartKey);
    return partKey;
}

/**
 * 共通化されたランダムパーツキー選択ヘルパー
 * @private
 */
export function _selectRandomPartKey(world, entityId, filterFn = () => true) {
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
export function getAllPartsFromCandidates(world, candidateIds) {
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
                part: getPartData(world, partId) 
            }))
            .filter(item => item.part && !item.part.isBroken);
    });
}

/**
 * 防御に最適なパーツ（HP最大）を探す
 */
export function findBestDefensePart(world, entityId) {
    const parts = world.getComponent(entityId, Parts);
    if (!parts) return null;

    const candidates = ['rightArm', 'leftArm', 'legs']
        .map(key => ({ key, status: world.getComponent(parts[key], PartStatus) }))
        .filter(({ status }) => status && !status.isBroken)
        .sort((a, b) => b.status.hp - a.status.hp);

    return candidates.length > 0 ? candidates[0].key : null;
}

/**
 * 最もダメージを受けている味方パーツを探す
 */
export function findMostDamagedAllyPart(world, candidates) {
    if (!candidates || candidates.length === 0) return null;

    const damagedParts = candidates.flatMap(allyId => {
        const parts = world.getComponent(allyId, Parts);
        if (!parts) return [];
        
        return Object.entries(parts)
            .map(([key, partId]) => ({ 
                targetId: allyId, 
                targetPartKey: key, 
                data: getPartData(world, partId) 
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
