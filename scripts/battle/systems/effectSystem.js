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
        // [修正] ATTACK_SEQUENCE_COMPLETED の代わりに TURN_END イベントを購読する
        this.world.on(GameEvents.TURN_END, this.onTurnEnd.bind(this));
    }

    /**
     * ターン終了時に呼び出され、効果の持続時間を更新します。
     * @param {object} detail - イベント詳細 ({ turnNumber })
     */
    onTurnEnd(detail) {
        // [修正] ターン終了時は、行動したエンティティだけでなく、
        // 全てのエンティティの効果を更新するのが一般的。
        const allEntities = this.world.getEntitiesWith(ActiveEffects);
        allEntities.forEach(id => this._updateEffectsForEntity(id));
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

        const nextEffects = [];

        for (const effect of activeEffects.effects) {
            if (effect.duration > 0) {
                effect.duration--;
            }

            if (effect.duration === undefined || effect.duration > 0 || effect.duration === Infinity) {
                nextEffects.push(effect);
            } else {
                this.world.emit(GameEvents.EFFECT_EXPIRED, { entityId, effect });
            }
        }

        activeEffects.effects = nextEffects;
    }

    update(deltaTime) {
        // このシステムはイベント駆動で動作するため、update処理は不要です。
    }
}