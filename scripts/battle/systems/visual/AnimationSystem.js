/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントの値を制御し、アニメーション（Tween）を実行するシステム。
 * TaskRunnerからのコールバック実行に対応。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Visual } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { TaskType } from '../../tasks/BattleTasks.js';
import { UI_CONFIG } from '../../common/UIConfig.js';
import { EffectType } from '../../../common/constants.js';

class Tween {
    constructor({ target, property, start, end, duration, easing, onComplete }) {
        this.target = target;
        this.property = property;
        this.start = start;
        this.end = end;
        this.duration = duration;
        this.elapsed = 0;
        this.easing = easing || ((t) => t);
        this.onComplete = onComplete;
        this.isFinished = false;
    }

    update(dt) {
        this.elapsed += dt;
        const progress = Math.min(this.elapsed / this.duration, 1.0);
        const t = this.easing(progress);
        
        this.target[this.property] = this.start + (this.end - this.start) * t;

        if (progress >= 1.0) {
            this.isFinished = true;
            if (this.onComplete) this.onComplete();
        }
    }
}

export class AnimationSystem extends System {
    constructor(world) {
        super(world);
        this.activeTweens = new Set();
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.SHOW_BATTLE_START_ANIMATION, this.onShowBattleStartAnimation.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_REQUESTED, this.onHpBarAnimationRequested.bind(this));
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
            if (visual.classes.has('attacker-active')) {
                visual.classes.delete('attacker-active');
            }
            if (visual.classes.has('target-lockon')) {
                visual.classes.delete('target-lockon');
            }
        }
    }

    onHpBarAnimationRequested(detail) {
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

        if (!hasAnimation) {
            this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects });
            return;
        }

        setTimeout(() => {
            this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects });
        }, UI_CONFIG.ANIMATION.HP_BAR.DURATION + 50);
    }

    _syncHpValue(entityId, partKey, hp) {
        const visual = this.world.getComponent(entityId, Visual);
        if (visual) {
            if (!visual.partsInfo[partKey]) visual.partsInfo[partKey] = { current: hp, max: 100 };
            visual.partsInfo[partKey].current = hp;
        }
    }

    onRequestTaskExecution(task) {
        if (task.type !== TaskType.ANIMATE) return;

        // コールバックがなければ空関数を使用
        const onComplete = task.onComplete || (() => {});

        if (task.animationType === 'attack') {
            this._playAttackAnimation(task.attackerId, task.targetId).then(() => {
                onComplete();
            });
        } else if (task.animationType === 'support') {
            setTimeout(() => {
                onComplete();
            }, UI_CONFIG.ANIMATION.DURATION || 300);
        } else {
            setTimeout(() => {
                onComplete();
            }, UI_CONFIG.ANIMATION.DURATION);
        }
    }

    _playAttackAnimation(attackerId, targetId) {
        return new Promise((resolve) => {
            const visualAttacker = this.world.getComponent(attackerId, Visual);
            const visualTarget = this.world.getComponent(targetId, Visual);

            // 1. 攻撃者強調開始
            if (visualAttacker) {
                visualAttacker.classes.add('attacker-active');
            }

            // 時間差で進行
            setTimeout(() => {
                // 2. ターゲットロックオン開始
                if (visualTarget) {
                    visualTarget.classes.add('target-lockon');
                    
                    setTimeout(() => {
                        this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
                        resolve();
                    }, 600); 
                } else {
                    this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
                    resolve();
                }
            }, 400); 
        });
    }

    onShowBattleStartAnimation() {
        const textId = this.world.createEntity();
        const textVisual = new Visual();
        textVisual.x = 0.5; // 画面中央 (0.0-1.0)
        textVisual.y = 50;  // 画面中央 (%)
        textVisual.classes.add('battle-start-text');
        
        this.world.addComponent(textId, textVisual);

        setTimeout(() => {
            this.world.destroyEntity(textId);
            this.world.emit('BATTLE_ANIMATION_COMPLETED');
        }, 2000);
    }
}