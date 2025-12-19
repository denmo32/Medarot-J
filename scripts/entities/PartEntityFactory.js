/**
 * @file PartEntityFactory.js
 * @description パーツデータオブジェクトからECSエンティティを生成するファクトリ。
 */
import * as PartComponents from '../battle/components/parts/PartComponents.js';

export const PartEntityFactory = {
    /**
     * パーツエンティティを生成する
     * @param {World} world 
     * @param {number} ownerId - 親となるメダロットエンティティID
     * @param {string} partKey - パーツスロットキー ('head'等)
     * @param {object} partData - マージ済みのパーツデータ (ActionDefinitions + PARTS_DATA)
     * @returns {number} 生成されたパーツエンティティID
     */
    create(world, ownerId, partKey, partData) {
        if (!partData) return null;

        const entityId = world.createEntity();

        // 1. 基本ステータス
        const stats = new PartComponents.PartStats({
            name: partData.name,
            icon: partData.icon, 
            might: partData.might,
            success: partData.success,
            armor: partData.armor, 
            mobility: partData.mobility,
            propulsion: partData.propulsion,
            stability: partData.stability,
            defense: partData.defense,
        });
        world.addComponent(entityId, stats);

        // 2. 状態（HP）
        const status = new PartComponents.PartStatus(
            partData.maxHp,
            partData.maxHp
        );
        world.addComponent(entityId, status);

        // 3. アクション定義
        const action = new PartComponents.PartAction({
            actionType: partData.actionType,
            type: partData.type, // subType (表示用)
            targetTiming: partData.targetTiming,
            targetScope: partData.targetScope,
            postMoveTargeting: partData.postMoveTargeting,
            isSupport: partData.isSupport
        });
        world.addComponent(entityId, action);

        // 4. エフェクト定義
        if (partData.effects && Array.isArray(partData.effects)) {
            world.addComponent(entityId, new PartComponents.PartEffects(partData.effects));
        }

        // 5. 演出設定 (New!)
        if (partData.visuals) {
            world.addComponent(entityId, new PartComponents.PartVisualConfig(partData.visuals));
        }

        // 6. 所有者リンク
        world.addComponent(entityId, new PartComponents.AttachedToOwner(ownerId, partKey));

        // 7. 特性（Traits）の解析と付与
        this._applyTraits(world, entityId, partData);

        return entityId;
    },

    _applyTraits(world, entityId, partData) {
        // 貫通
        if (partData.penetrates) {
            world.addComponent(entityId, new PartComponents.TraitPenetrate());
        }

        // クリティカル補正
        if (partData.criticalBonus) {
            world.addComponent(entityId, new PartComponents.TraitCriticalBonus(partData.criticalBonus));
        }
    }
};