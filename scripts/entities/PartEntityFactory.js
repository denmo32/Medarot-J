/**
 * @file PartEntityFactory.js
 * @description パーツデータオブジェクトからECSエンティティを生成するファクトリ。
 * マスターデータに基づいて詳細なBehaviorコンポーネントをアセンブルします。
 */
import * as PartComponents from '../battle/components/parts/PartComponents.js';

export const PartEntityFactory = {
    /**
     * パーツエンティティを生成する
     * @param {World} world 
     * @param {number} ownerId - 親となるメダロットエンティティID
     * @param {string} partKey - パーツスロットキー ('head'等)
     * @param {object} partData - buildPartData によって構築された完全なパーツデータ
     * @returns {number} 生成されたパーツエンティティID
     */
    create(world, ownerId, partKey, partData) {
        if (!partData) return null;

        const entityId = world.createEntity();

        // 1. 基本ステータス
        world.addComponent(entityId, new PartComponents.PartStats({
            name: partData.name,
            icon: partData.icon,
            action: partData.action, // buildPartData で設定された表示用ラベル (射撃/格闘等)
            type: partData.type,     // 攻撃タイプ (撃つ/狙い撃ち等)
            trait: partData.trait,   // 特性 (ライフル/ソード等)
            might: partData.might,
            success: partData.success,
            armor: partData.armor,
            mobility: partData.mobility,
            propulsion: partData.propulsion,
            stability: partData.stability,
            defense: partData.defense,
        }));

        // 2. 状態（HP）
        world.addComponent(entityId, new PartComponents.PartStatus(
            partData.maxHp,
            partData.maxHp
        ));

        // 3. 振る舞い (Behaviors)
        // 基本論理
        world.addComponent(entityId, new PartComponents.ActionLogic(
            partData.actionType,
            partData.isSupport
        ));

        // ターゲット
        world.addComponent(entityId, new PartComponents.TargetingBehavior({
            timing: partData.targetTiming,
            scope: partData.targetScope,
            autoStrategy: partData.postMoveTargeting
        }));

        // 命中
        world.addComponent(entityId, new PartComponents.AccuracyBehavior(
            partData.accuracyType || 'STANDARD'
        ));

        // 影響
        if (partData.effects) {
            world.addComponent(entityId, new PartComponents.ImpactBehavior(partData.effects));
        }

        // 4. 演出設定 (Visuals)
        if (partData.visuals) {
            world.addComponent(entityId, new PartComponents.PartVisualConfig({
                declaration: {
                    templateId: partData.visuals.declaration?.messageKey,
                    animation: partData.visuals.declaration?.animation
                },
                impacts: partData.visuals.effects
            }));
        }

        // 5. 所有者リンク
        world.addComponent(entityId, new PartComponents.AttachedToOwner(ownerId, partKey));

        // 6. 特性（Traits）由来のフラグ付与
        this._applyTraits(world, entityId, partData);

        return entityId;
    },

    /**
     * データ上のフラグに基づき、特性に関連するタグコンポーネントを付与
     */
    _applyTraits(world, entityId, partData) {
        if (partData.penetrates) {
            world.addComponent(entityId, new PartComponents.TraitPenetrate());
        }
        if (partData.criticalBonus) {
            world.addComponent(entityId, new PartComponents.TraitCriticalBonus(partData.criticalBonus));
        }
        if (partData.guardCount) {
            world.addComponent(entityId, new PartComponents.TraitGuard(partData.guardCount));
        }
    }
};