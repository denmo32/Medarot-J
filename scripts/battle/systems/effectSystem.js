/**
 * @file 効果管理システム
 * このファイルは、エンティティに適用されている効果（バフ・デバフ）の持続時間を管理し、
 * ターン終了時に効果を更新・削除する責務を持ちます。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { ActiveEffects, GameState, PlayerInfo } from '../core/components/index.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType } from '../common/constants.js';

export class EffectSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // 行動実行完了（≒ターン終了）のイベントを購読
        this.world.on(GameEvents.ATTACK_SEQUENCE_COMPLETED, this.onTurnEnd.bind(this));
    }

    /**
     * ターン終了時に呼び出され、効果の持続時間を更新します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onTurnEnd(detail) {
        const { entityId } = detail;

        // 行動したエンティティ自身の効果を更新
        this._updateEffectsForEntity(entityId);

        // ★将来的な拡張: ゲームのルールによっては、敵・味方全員の効果をここで更新することも可能
        // const allEntities = this.world.getEntitiesWith(ActiveEffects);
        // allEntities.forEach(id => this._updateEffectsForEntity(id));
    }

    /**
     * 指定されたエンティティの効果を更新する内部メソッド
     * @param {number} entityId 
     * @private
     */
    _updateEffectsForEntity(entityId) {
        const activeEffects = this.world.getComponent(entityId, ActiveEffects);
        if (!activeEffects || activeEffects.effects.length === 0) {
            return;
        }

        // 新しい効果の配列を作成
        const nextEffects = [];

        for (const effect of activeEffects.effects) {
            // durationが有限のものは1減らす
            if (effect.duration > 0) {
                effect.duration--;
            }

            // [修正] durationが未定義（回数制など）か、まだ残っている効果だけを次の配列に追加します。
            // ★リファクタリング: 効果が切れたらイベントを発行し、StateSystemに状態遷移を委譲
            if (effect.duration === undefined || effect.duration > 0 || effect.duration === Infinity) {
                nextEffects.push(effect);
            } else {
                // 効果が切れたことを通知するイベントを発行
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId, effect });
            }
        }

        activeEffects.effects = nextEffects;
    }

    update(deltaTime) {
        // このシステムはイベント駆動で動作するため、update処理は不要です。
    }
}