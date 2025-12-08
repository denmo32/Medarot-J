/**
 * @file QueryService.js
 * @description 戦闘関連のエンティティやコンポーネントを検索・フィルタリングするサービス。
 * ECSのクエリ機能を補完するドメイン特化のヘルパー群。
 * 元 scripts/battle/utils/queryUtils.js
 */
import { Parts } from '../../components/index.js';
import { PartInfo } from '../../common/constants.js';

export class QueryService {

    /**
     * 推進力による比較関数を返す（ソート用）
     * @param {World} world 
     */
    static compareByPropulsion(world) {
        return (entityA, entityB) => {
            const partsA = world.getComponent(entityA, Parts);
            const partsB = world.getComponent(entityB, Parts);

            const propulsionA = partsA?.legs?.propulsion || 0;
            const propulsionB = partsB?.legs?.propulsion || 0;

            return propulsionB - propulsionA;
        };
    }

    // ヘルパー: パーツリストを取得
    static _getPartEntries(world, entityId) {
        if (!world || entityId == null) return [];
        const parts = world.getComponent(entityId, Parts);
        return parts ? Object.entries(parts) : [];
    }

    /**
     * 指定エンティティのパーツ一覧を取得する
     */
    static getParts(world, entityId, includeBroken = false, attackableOnly = true) {
        const attackableKeys = new Set([PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key]);
        
        return this._getPartEntries(world, entityId)
            .filter(([key, part]) => 
                part && 
                (!attackableOnly || attackableKeys.has(key)) && 
                (includeBroken || !part.isBroken)
            );
    }

    /**
     * 攻撃可能なパーツ一覧を取得する（頭部破壊時は空）
     */
    static getAttackableParts(world, entityId) {
        const parts = world.getComponent(entityId, Parts);
        if (parts?.head?.isBroken) {
            return [];
        }
        return this.getParts(world, entityId, false, true);
    }

    /**
     * アクション可能な全パーツ一覧を取得する（破壊済み含む）
     */
    static getAllActionParts(world, entityId) {
        return this.getParts(world, entityId, true, true);
    }

    /**
     * 防御に最適なパーツ（HP最大）を探す
     */
    static findBestDefensePart(world, entityId) {
        const defendableParts = this._getPartEntries(world, entityId)
            .filter(([key, part]) => key !== PartInfo.HEAD.key && part && !part.isBroken)
            .sort(([, a], [, b]) => b.hp - a.hp);

        return defendableParts.length > 0 ? defendableParts[0][0] : null;
    }

    // 共通化されたランダム選択ヘルパー
    static _selectRandomPartKey(world, entityId, filterFn = () => true) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts || parts.head?.isBroken) return null;

        const validKeys = Object.keys(parts).filter(key => 
            parts[key] && !parts[key].isBroken && filterFn(key)
        );

        if (validKeys.length === 0) return null;
        return validKeys[Math.floor(Math.random() * validKeys.length)];
    }

    /**
     * ランダムなパーツを選択する
     */
    static selectRandomPart(world, entityId) {
        const partKey = this._selectRandomPartKey(world, entityId);
        return partKey ? { targetId: entityId, targetPartKey: partKey } : null;
    }

    /**
     * 貫通対象となるランダムなパーツを選択する（指定パーツ以外）
     */
    static findRandomPenetrationTarget(world, entityId, excludedPartKey) {
        return this._selectRandomPartKey(world, entityId, key => key !== excludedPartKey);
    }

    /**
     * 候補エンティティ群から全ての生存パーツをリスト化して取得する
     */
    static getAllPartsFromCandidates(world, candidateIds) {
        if (!candidateIds) return [];
        
        return candidateIds.flatMap(id => {
            const parts = world.getComponent(id, Parts);
            if (!parts || parts.head?.isBroken) return [];
            
            return Object.entries(parts)
                .filter(([_, part]) => part && !part.isBroken)
                .map(([key, part]) => ({ entityId: id, partKey: key, part }));
        });
    }

    /**
     * 条件に基づいてパーツを選択し、ターゲット情報として返す
     */
    static selectPartByCondition(world, candidates, sortFn) {
        const allParts = this.getAllPartsFromCandidates(world, candidates);
        if (allParts.length === 0) return null;
        
        allParts.sort(sortFn);
        const selectedPart = allParts[0];
        return { targetId: selectedPart.entityId, targetPartKey: selectedPart.partKey };
    }
}