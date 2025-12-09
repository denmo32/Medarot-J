/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントのアニメーション制御。
 * TaskRunnerからの依頼(イベント)に対して処理を行い、完了イベントを返す。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Visual } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { TaskType } from '../../tasks/BattleTasks.js';
import { UI_CONFIG } from '../../common/UIConfig.js';
import { EffectType } from '../../../common/constants.js';
import { Tween } from '../../../../engine/utils/Tween.js';

export class AnimationSystem extends System {
    constructor(world) {
        super(world);
        this.activeTweens = new Set();
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.SHOW_BATTLE_START_ANIMATION, this.onShowBattleStartAnimation.bind(this));
        
        // HPバーアニメーション要求は直接処理するが、Task経由のものはREQUEST_TASK_EXECUTIONで来る
        this.on(GameEvents.HP_BAR_ANIMATION_REQUESTED, this.onHpBarAnimationRequested.bind(this));
        
        // DelegateTaskからの実行要求
        this.on(GameEvents.REQUEST_TASK_EXECUTION, this.onRequestTaskExecution.bind(this));
        
        this.on(GameEvents.REFRESH_UI, this.onRefreshUI.bind(this));
        this.on(GameEvents.ACTION_SEQUENCE_COMPLETED, this.onActionSequenceCompleted.bind(this));
    }

    update(deltaTime) {
        if (this.activeTweens.size > 0) {
            const finishedTweens = [];
            for (const tween of this.activeTweens) {
                tween.update(deltaTime);
                if (tween.isFinished) {
                    finishedTweens.push(tween);
                }
            }
            finishedTweens.forEach(t => this.activeTweens.delete(t));
        }
    }

    /**
     * タスク実行要求ハンドラ
     * 処理完了後、TASK_EXECUTION_COMPLETED を emit して TaskRunner (DelegateTask) に通知する
     */
    onRequestTaskExecution(detail) {
        const { task, taskId } = detail;
        if (task.type !== TaskType.ANIMATE) return;

        // 完了時のコールバック
        const complete = () => {
            this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId });
        };

        if (task.animationType === 'attack') {
            this._playAttackAnimation(task.attackerId, task.targetId).then(complete);
        } else if (task.animationType === 'support') {
            setTimeout(complete, UI_CONFIG.ANIMATION.DURATION || 300);
        } else {
            setTimeout(complete, UI_CONFIG.ANIMATION.DURATION);
        }
    }

    _playAttackAnimation(attackerId, targetId) {
        return new Promise((resolve) => {
            const visualAttacker = this.world.getComponent(attackerId, Visual);
            const visualTarget = this.world.getComponent(targetId, Visual);

            if (visualAttacker) {
                visualAttacker.classes.add('attacker-active');
            }

            setTimeout(() => {
                if (visualTarget) {
                    visualTarget.classes.add('target-lockon');
                    // ロックオン演出時間
                    setTimeout(() => resolve(), 600); 
                } else {
                    resolve();
                }
            }, 400); 
        });
    }

    onHpBarAnimationRequested(detail) {
        // これはTask経由ではなく、Dialog表示中などに個別に呼ばれるケースがあるため、
        // 完了イベントは HP_BAR_ANIMATION_COMPLETED を返す（既存仕様維持）
        // ただし TaskType.UI_ANIMATION 経由の場合は onRequestTaskExecution で処理すべきだが
        // 互換性のためここでも処理できる構造にしておく

        const appliedEffects = detail.appliedEffects || detail.effects;
        if (!appliedEffects || appliedEffects.length === 0) {
            this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects: [] });
            return;
        }

        let hasAnimation = false;

        for (const effect of appliedEffects) {
            if (effect.type !== EffectType.DAMAGE && effect.type !== EffectType.HEAL) continue;

            const { targetId, partKey, oldHp, newHp } = effect;
            if (targetId == null || !partKey || oldHp === undefined || newHp === undefined || oldHp === newHp) {
                this._syncHpValue(targetId, partKey, newHp);
                continue;
            }

            const visual = this.world.getComponent(targetId, Visual);
            if (!visual) continue;

            if (!visual.partsInfo[partKey]) visual.partsInfo[partKey] = { current: oldHp, max: 100 };
            const partInfo = visual.partsInfo[partKey];
            
            partInfo.current = oldHp;

            this.activeTweens.add(new Tween({
                target: partInfo,
                property: 'current',
                start: oldHp,
                end: newHp,
                duration: UI_CONFIG.ANIMATION.HP_BAR.DURATION,
                easing: UI_CONFIG.ANIMATION.HP_BAR.EASING,
            }));

            hasAnimation = true;
        }

        const finish = () => {
            this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects });
        };

        if (!hasAnimation) {
            finish();
        } else {
            // アニメーション時間 + バッファ
            setTimeout(finish, UI_CONFIG.ANIMATION.HP_BAR.DURATION + 50);
        }
    }

    // ... (onRefreshUI, onActionSequenceCompleted, _syncHpValue, onShowBattleStartAnimation は変更なし)
    onRefreshUI() {
        const entities = this.getEntities(Parts, Visual);
        for (const entityId of entities) {
            const parts = this.world.getComponent(entityId, Parts);
            const visual = this.world.getComponent(entityId, Visual);
            Object.keys(parts).forEach(key => {
                if (parts[key]) {
                    if (!visual.partsInfo[key]) visual.partsInfo[key] = {};
                    visual.partsInfo[key].current = parts[key].hp;
                    visual.partsInfo[key].max = parts[key].maxHp;
                }
            });
        }
    }

    onActionSequenceCompleted() {
        const entities = this.getEntities(Visual);
        for (const entityId of entities) {
            const visual = this.world.getComponent(entityId, Visual);
            if (visual.classes.has('attacker-active')) visual.classes.delete('attacker-active');
            if (visual.classes.has('target-lockon')) visual.classes.delete('target-lockon');
        }
    }

    _syncHpValue(entityId, partKey, hp) {
        const visual = this.world.getComponent(entityId, Visual);
        if (visual) {
            if (!visual.partsInfo[partKey]) visual.partsInfo[partKey] = { current: hp, max: 100 };
            visual.partsInfo[partKey].current = hp;
        }
    }
    
    onShowBattleStartAnimation() {
        const textId = this.world.createEntity();
        const textVisual = new Visual();
        textVisual.x = 0.5;
        textVisual.y = 50;
        textVisual.classes.add('battle-start-text');
        this.world.addComponent(textId, textVisual);
        setTimeout(() => {
            this.world.destroyEntity(textId);
            this.world.emit('BATTLE_ANIMATION_COMPLETED');
        }, 2000);
    }
}