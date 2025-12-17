/**
 * @file StatusEffectSystem.js
 * @description 状態異常やバフ（SCAN, GLITCH, GUARD付与）を処理するシステム。
 */
import { System } from '../../../../engine/core/System.js';
import { ApplyEffect, EffectContext, EffectResult } from '../../components/effects/Effects.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { ActiveEffects, IsCharging, IsGuarding, Action } from '../../components/index.js';
import { EffectType, EffectScope, PlayerStateType, ActionCancelReason } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { TargetingService } from '../../services/TargetingService.js';

export class StatusEffectSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        const entities = this.getEntities(ApplyEffect, EffectContext);
        for (const entityId of entities) {
            const effect = this.world.getComponent(entityId, ApplyEffect);
            
            switch (effect.type) {
                case EffectType.APPLY_SCAN:
                    this._processScan(entityId, effect);
                    break;
                case EffectType.APPLY_GLITCH:
                    this._processGlitch(entityId, effect);
                    break;
                case EffectType.APPLY_GUARD:
                    this._processApplyGuard(entityId, effect);
                    break;
            }
        }
    }

    _processScan(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { sourceId, attackingPart } = context;

        const params = effect.params || {};
        const valueSource = params.valueSource || 'might';
        const valueFactor = params.valueFactor || 0.1;
        const duration = params.duration || 3;

        const baseValue = attackingPart[valueSource] || 0;
        const scanBonusValue = Math.floor(baseValue * valueFactor);

        // スキャンはチーム全体にかかることが多いが、
        // EffectContextのTargetIdが単体の場合はその対象のみ、
        // TargetingService等でターゲットがチーム指定されていた場合は
        // ここに来る前に複数のEffectエンティティが生成されているか、
        // あるいはここでチーム検索して適用するか。
        // 現在のActionDefinitionsでは TEAM_SCAN は targetScope: ALLY_TEAM となっている。
        // しかし EffectContext は単一ターゲットを前提としている設計が多い。
        
        // CombatService.spawnEffectEntities では「ターゲットID」に対してエフェクトを作る。
        // チーム全体の場合、TargetingServiceで「対象リスト」が返ってこないと1つしか作られない。
        
        // TargetingServiceの修正は影響範囲が大きいので、ここで「スコープがチームなら全体適用」ロジックを入れるか、
        // CombatServiceで複数生成すべき。
        // -> 今回は「TargetingServiceでターゲットが1つしか決まらない（リーダーなど）」場合でも、
        //    EffectSystem側でチーム展開する方式をとる。
        //    ただし EffectContext.targetId が代表者である場合。
        
        // 簡易実装: EffectContext.targetId を中心にチームメイトを取得して適用
        // EffectDefinitionには scope がないので、ApplyEffect生成時に含めるべきだが、
        // とりあえず単体処理として実装し、ターゲットが適切に設定されている前提とする。
        // (CombatService側でチームターゲットなら全員分生成するなどの対応が望ましいが、今回はTargetingSystem任せ)
        
        // *修正*: ScanEffect.js では apply 時に allies.forEach していた。
        // これを再現するため、ここでターゲットのチームメイトを取得する。
        
        const targets = TargetingService.getValidAllies(this.world, context.targetId, true);
        const stateUpdates = [];

        targets.forEach(tid => {
            stateUpdates.push({
                type: 'CustomUpdateComponent',
                targetId: tid,
                componentType: ActiveEffects,
                customHandler: (activeEffects) => {
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== effect.type);
                    activeEffects.effects.push({
                        type: effect.type,
                        value: scanBonusValue,
                        duration: duration,
                        partKey: context.partKey
                    });
                }
            });
        });

        this._finishEffect(entityId, {
            type: EffectType.APPLY_SCAN,
            value: scanBonusValue,
            duration,
            stateUpdates
        });
    }

    _processGlitch(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { targetId } = context;

        if (!targetId) {
            this._finishEffect(entityId, { wasSuccessful: false });
            return;
        }

        const isCharging = this.world.getComponent(targetId, IsCharging);
        const isGuarding = this.world.getComponent(targetId, IsGuarding);
        const wasSuccessful = !!(isCharging || isGuarding);

        const events = [];
        const stateUpdates = [];

        if (wasSuccessful) {
            events.push({
                type: GameEvents.ACTION_CANCELLED,
                payload: { 
                    entityId: targetId, 
                    reason: ActionCancelReason.INTERRUPTED 
                }
            });
            stateUpdates.push({
                type: 'ResetToCooldown',
                targetId: targetId,
                options: { interrupted: true }
            });
        }

        this._finishEffect(entityId, {
            type: EffectType.APPLY_GLITCH,
            targetId,
            wasSuccessful,
            events,
            stateUpdates
        });
    }

    _processApplyGuard(entityId, effect) {
        const context = this.world.getComponent(entityId, EffectContext);
        const { targetId, partKey, attackingPart } = context;

        const params = effect.params || {};
        const countSource = params.countSource || 'might';
        const countFactor = params.countFactor || 0.1;
        
        const baseValue = attackingPart[countSource] || 0;
        const guardCount = Math.floor(baseValue * countFactor);

        // Actionコンポーネントから実行パーツを取得
        // (Selfターゲットの場合、context.partKeyがnullになることが多いため)
        const action = this.world.getComponent(targetId, Action);
        const actualPartKey = action && action.partKey ? action.partKey : partKey;

        const stateUpdates = [];
        stateUpdates.push({
            type: 'TransitionState',
            targetId: targetId,
            newState: PlayerStateType.GUARDING 
        });

        stateUpdates.push({
            type: 'CustomUpdateComponent',
            targetId: targetId,
            componentType: ActiveEffects,
            customHandler: (activeEffects) => {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                activeEffects.effects.push({
                    type: EffectType.APPLY_GUARD,
                    value: guardCount,
                    count: guardCount,
                    partKey: actualPartKey,
                    duration: Infinity
                });
            }
        });

        this._finishEffect(entityId, {
            type: EffectType.APPLY_GUARD,
            targetId,
            value: guardCount,
            stateUpdates
        });
    }

    _finishEffect(entityId, resultData) {
        this.world.removeComponent(entityId, ApplyEffect);
        this.world.addComponent(entityId, new EffectResult(resultData));
    }
}