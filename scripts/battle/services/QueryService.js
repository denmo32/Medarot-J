/**
 * @file QueryService.js
 * @description 戦闘関連のエンティティやコンポーネントを検索・フィルタリングするサービス。
 * パーツのEntity化に伴い、ID解決とデータ集約を行うメソッドを強化。
 */
import { Parts } from '../../components/index.js';
import { PartStatus, PartStats, PartAction, PartEffects, TraitPenetrate, TraitCriticalBonus } from '../components/parts/PartComponents.js';
import { PartInfo } from '../../common/constants.js';

export class QueryService {

    /**
     * 指定されたパーツIDに対応するパーツエンティティの情報を統合して返す。
     * 従来のデータ構造との互換性を提供するためのアダプター。
     * @param {World} world 
     * @param {number} partEntityId 
     * @returns {object|null}
     */
    static getPartData(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;

        const status = world.getComponent(partEntityId, PartStatus);
        const stats = world.getComponent(partEntityId, PartStats);
        const action = world.getComponent(partEntityId, PartAction);
        const effectsComp = world.getComponent(partEntityId, PartEffects);
        
        if (!status || !stats) return null; // 最低限これらは必要

        // 特性タグの確認
        const penetrates = !!world.getComponent(partEntityId, TraitPenetrate);
        const critBonus = world.getComponent(partEntityId, TraitCriticalBonus);

        // オブジェクト統合
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
            
            // Action
            actionType: action?.actionType,
            action: action?.subType, // 表示用
            targetTiming: action?.targetTiming,
            targetScope: action?.targetScope,
            postMoveTargeting: action?.postMoveTargeting,
            isSupport: action?.isSupport,
            
            // Effects
            effects: effectsComp ? effectsComp.effects : [],
            
            // Traits
            penetrates: penetrates,
            criticalBonus: critBonus ? critBonus.rate : 0,
            
            // Metadata
            id: partEntityId, // 参照用ID
        };
    }

    /**
     * 推進力による比較関数を返す（ソート用）
     * @param {World} world 
     */
    static compareByPropulsion(world) {
        return (entityA, entityB) => {
            const partsA = world.getComponent(entityA, Parts);
            const partsB = world.getComponent(entityB, Parts);

            const legsA = this.getPartData(world, partsA?.legs);
            const legsB = this.getPartData(world, partsB?.legs);

            const propulsionA = legsA?.propulsion || 0;
            const propulsionB = legsB?.propulsion || 0;

            return propulsionB - propulsionA;
        };
    }

    // ヘルパー: パーツリストを取得（IDとキーのペア）
    static _getPartEntries(world, entityId) {
        if (!world || entityId == null) return [];
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return [];
        
        return [
            ['head', parts.head],
            ['rightArm', parts.rightArm],
            ['leftArm', parts.leftArm],
            ['legs', parts.legs]
        ];
    }

    /**
     * 指定エンティティのパーツ一覧を取得する
     */
    static getParts(world, entityId, includeBroken = false, attackableOnly = true) {
        const attackableKeys = new Set([PartInfo.HEAD.key, PartInfo.RIGHT_ARM.key, PartInfo.LEFT_ARM.key]);
        
        return this._getPartEntries(world, entityId)
            .map(([key, id]) => ({ key, id, data: this.getPartData(world, id) }))
            .filter(({ key, data }) => 
                data && 
                (!attackableOnly || attackableKeys.has(key)) && 
                (includeBroken || !data.isBroken)
            )
            .map(item => [item.key, item.data]); // 互換性のため [key, partData] の配列を返す
    }

    /**
     * 攻撃可能なパーツ一覧を取得する（頭部破壊時は空）
     */
    static getAttackableParts(world, entityId) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return [];
        
        const head = this.getPartData(world, parts.head);
        if (!head || head.isBroken) {
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
            .filter(([key]) => key !== PartInfo.HEAD.key)
            .map(([key, id]) => ({ key, data: this.getPartData(world, id) }))
            .filter(({ data }) => data && !data.isBroken)
            .sort((a, b) => b.data.hp - a.data.hp);

        return defendableParts.length > 0 ? defendableParts[0].key : null;
    }

    // 共通化されたランダム選択ヘルパー
    static _selectRandomPartKey(world, entityId, filterFn = () => true) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return null;
        
        const head = this.getPartData(world, parts.head);
        if (!head || head.isBroken) return null;

        const validKeys = Object.entries(parts)
            .filter(([key, id]) => {
                const data = this.getPartData(world, id);
                return data && !data.isBroken && filterFn(key);
            })
            .map(([key]) => key);

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
            if (!parts) return [];
            
            const head = this.getPartData(world, parts.head);
            if (!head || head.isBroken) return [];
            
            return Object.entries(parts)
                .map(([key, partId]) => ({ entityId: id, partKey: key, part: this.getPartData(world, partId) }))
                .filter(item => item.part && !item.part.isBroken);
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