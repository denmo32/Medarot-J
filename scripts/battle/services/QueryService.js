/**
 * @file QueryService.js
 * @description 戦闘関連のエンティティやコンポーネントを検索・フィルタリングするサービス。
 * ECS原則に従い、必要なコンポーネントのみへのアクセスを最適化。
 */
import { Parts } from '../../components/index.js';
import { PartStatus, PartStats, PartAction, PartEffects, PartVisualConfig, TraitPenetrate, TraitCriticalBonus } from '../components/parts/PartComponents.js';
import { PartInfo } from '../../common/constants.js';

export class QueryService {

    /**
     * 指定されたパーツIDに対応するパーツエンティティの情報を統合して返す。
     * 従来のデータ構造との互換性を提供するためのアダプター。
     * ※注意: 毎フレーム呼び出すような高頻度処理では使用を避けること。
     * @param {World} world 
     * @param {number} partEntityId 
     * @returns {object|null}
     */
    static getPartData(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;

        const status = world.getComponent(partEntityId, PartStatus);
        const stats = world.getComponent(partEntityId, PartStats);
        // 必須コンポーネントのチェック
        if (!status || !stats) return null;

        const action = world.getComponent(partEntityId, PartAction);
        const effectsComp = world.getComponent(partEntityId, PartEffects);
        
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
     * パーツの演出設定を取得する
     * @param {World} world 
     * @param {number} partEntityId 
     * @returns {PartVisualConfig|null}
     */
    static getPartVisualConfig(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;
        return world.getComponent(partEntityId, PartVisualConfig);
    }

    /**
     * 指定したパーツエンティティのステータスコンポーネントのみを取得する（軽量版）
     * 複数のステータスを参照する場合に使用。
     * @param {World} world 
     * @param {number} partEntityId 
     * @returns {PartStats|null}
     */
    static getPartStats(world, partEntityId) {
        if (partEntityId === null || partEntityId === undefined) return null;
        return world.getComponent(partEntityId, PartStats);
    }

    /**
     * 指定したパーツエンティティの特定のステータス値のみを取得する（最軽量版）
     * 単一の値を参照する場合に使用。
     * @param {World} world 
     * @param {number} partEntityId 
     * @param {string} statName 
     * @returns {number}
     */
    static getPartStat(world, partEntityId, statName) {
        if (partEntityId === null || partEntityId === undefined) return 0;
        const stats = world.getComponent(partEntityId, PartStats);
        return stats ? (stats[statName] || 0) : 0;
    }

    /**
     * 推進力による比較関数を返す（ソート用）
     * getPartDataによるオブジェクト生成を回避し、高速化。
     * @param {World} world 
     */
    static compareByPropulsion(world) {
        return (entityA, entityB) => {
            const partsA = world.getComponent(entityA, Parts);
            const partsB = world.getComponent(entityB, Parts);

            // 脚部パーツIDの取得
            const legsIdA = partsA?.legs;
            const legsIdB = partsB?.legs;

            // Statsコンポーネントへの直接アクセスで値を取得
            const propulsionA = this.getPartStat(world, legsIdA, 'propulsion');
            const propulsionB = this.getPartStat(world, legsIdB, 'propulsion');

            // 降順ソート
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
            .map(([key, id]) => {
                // ここではUI表示などで全データが必要なため getPartData を使用する
                return { key, id, data: this.getPartData(world, id) };
            })
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
        
        // 頭部生存チェック
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
            .map(([key, id]) => {
                // 最適化: HPと破壊状態だけ分かれば良い
                const status = world.getComponent(id, PartStatus);
                return { key, status };
            })
            .filter(({ status }) => status && !status.isBroken)
            .sort((a, b) => b.status.hp - a.status.hp);

        return defendableParts.length > 0 ? defendableParts[0].key : null;
    }

    // 共通化されたランダム選択ヘルパー
    static _selectRandomPartKey(world, entityId, filterFn = () => true) {
        const parts = world.getComponent(entityId, Parts);
        if (!parts) return null;
        
        const headStatus = world.getComponent(parts.head, PartStatus);
        if (!headStatus || headStatus.isBroken) return null;

        const validKeys = Object.entries(parts)
            .filter(([key, id]) => {
                const status = world.getComponent(id, PartStatus);
                // コンポーネント直接参照で高速化
                return status && !status.isBroken && filterFn(key);
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
     * AI思考ルーチンで使用
     */
    static getAllPartsFromCandidates(world, candidateIds) {
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
                    part: this.getPartData(world, partId) // AIロジックは詳細データを必要とするためオブジェクト化
                }))
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