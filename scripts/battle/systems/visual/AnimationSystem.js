/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントの値を制御し、アニメーション（Tween）を実行するシステム。
 * DOMには一切触れず、Visualコンポーネントの数値更新のみを行う。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Visual } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import { TaskType } from '../../tasks/BattleTasks.js';
import { UI_CONFIG } from '../../common/UIConfig.js';
import { EffectType, TeamID } from '../../../common/constants.js';

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
        
        // オブジェクトのプロパティを更新
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
    }

    update(deltaTime) {
        // Tweenの更新
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
        
        // Position -> Visual の同期処理は RenderSystem に移譲し、
        // AnimationSystem は Tween の実行のみに専念する
    }

    onRefreshUI() {
        // 全Visualコンポーネントをロジックデータと強制同期
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
                // 値が変わらない場合は即時同期して次へ
                this._syncHpValue(targetId, partKey, newHp);
                continue;
            }

            const visual = this.world.getComponent(targetId, Visual);
            if (!visual) continue;

            if (!visual.partsInfo[partKey]) visual.partsInfo[partKey] = { current: oldHp, max: 100 };
            const partInfo = visual.partsInfo[partKey];
            
            // アニメーション開始値をセット
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

        // アニメーション完了監視用（簡易的に、最長時間が経過したら完了通知）
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

        if (task.animationType === 'attack') {
            this._playAttackAnimation(task.attackerId, task.targetId).then(() => {
                this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId: task.id });
            });
        } else if (task.animationType === 'support') {
             // 支援などの自分自身へのアクション用
            setTimeout(() => {
                this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId: task.id });
            }, UI_CONFIG.ANIMATION.DURATION || 300);
        } else {
            setTimeout(() => {
                this.world.emit(GameEvents.TASK_EXECUTION_COMPLETED, { taskId: task.id });
            }, UI_CONFIG.ANIMATION.DURATION);
        }
    }

    _playAttackAnimation(attackerId, targetId) {
        return new Promise((resolve) => {
            const visualTarget = this.world.getComponent(targetId, Visual);

            if (!visualTarget) {
                resolve();
                return;
            }

            // ターゲット強調
            visualTarget.classes.add('attack-target-active');

            // 一定時間後に完了とする
            setTimeout(() => {
                visualTarget.classes.delete('attack-target-active');
                this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
                resolve();
            }, UI_CONFIG.ANIMATION.ATTACK_DURATION || 600);
        });
    }

    onShowBattleStartAnimation() {
        // バトル開始テキスト用の一時エンティティ
        const textId = this.world.createEntity();
        const textVisual = new Visual();
        textVisual.x = 0.5; // 画面中央
        textVisual.y = 50;  // 画面中央
        textVisual.classes.add('battle-start-text');
        
        this.world.addComponent(textId, textVisual);

        setTimeout(() => {
            this.world.destroyEntity(textId);
            this.world.emit('BATTLE_ANIMATION_COMPLETED');
        }, 2000);
    }
}