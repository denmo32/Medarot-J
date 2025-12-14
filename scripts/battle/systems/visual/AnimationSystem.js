/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントのアニメーション制御。
 * Request/Tagコンポーネントの監視に変更。
 */
import { System } from '../../../../engine/core/System.js';
import { Visual } from '../../components/index.js';
import { AnimateTask, UiAnimationTask } from '../../components/Tasks.js';
import { 
    BattleStartAnimationRequest, 
    BattleStartAnimationCompleted,
    HpBarAnimationRequest, 
    RefreshUIRequest,
    UIStateUpdateRequest
} from '../../components/Requests.js';
import { Parts } from '../../../components/index.js';
import { UI_CONFIG } from '../../common/UIConfig.js';
import { EffectType } from '../../common/constants.js';
import { Tween } from '../../../../engine/utils/Tween.js';

export class AnimationSystem extends System {
    constructor(world) {
        super(world);
        this.activeTweens = new Set();
    }

    update(deltaTime) {
        // 0. リクエスト処理
        this._processBattleStartRequests();
        this._processHpBarRequests();
        this._processRefreshRequests();

        // 1. Tween更新
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

        // 2. AnimateTask の処理
        const animateTasks = this.getEntities(AnimateTask);
        for (const entityId of animateTasks) {
            this._processAnimationTask(entityId, deltaTime);
        }

        // 3. UiAnimationTask の処理
        const uiTaskEntities = this.getEntities(UiAnimationTask);
        for (const entityId of uiTaskEntities) {
            this._processUiAnimationTask(entityId);
        }
    }

    // --- Request Processors ---

    _processBattleStartRequests() {
        const entities = this.getEntities(BattleStartAnimationRequest);
        for (const entityId of entities) {
            this._startBattleStartAnimation();
            this.world.destroyEntity(entityId);
        }
    }

    _processHpBarRequests() {
        const entities = this.getEntities(HpBarAnimationRequest);
        for (const entityId of entities) {
            const req = this.world.getComponent(entityId, HpBarAnimationRequest);
            this._startHpBarAnimation(req.appliedEffects, () => {
                // 完了通知
                const res = this.world.createEntity();
                this.world.addComponent(res, new UIStateUpdateRequest('ANIMATION_COMPLETED'));
            }, () => {});
            this.world.destroyEntity(entityId);
        }
    }

    _processRefreshRequests() {
        const entities = this.getEntities(RefreshUIRequest);
        if (entities.length > 0) {
            this._refreshUI();
            for (const id of entities) this.world.destroyEntity(id);
        }
    }

    // --- Task Processors ---

    _processAnimationTask(entityId, deltaTime) {
        const task = this.world.getComponent(entityId, AnimateTask);
        
        if (!task._startTime) {
            task._startTime = performance.now();
            task._duration = 0;
            
            if (task.animationType === 'attack') {
                this._startAttackAnimation(entityId, task.targetId);
                task._duration = 600; 
            } else {
                task._duration = UI_CONFIG.ANIMATION.DURATION || 300;
            }
        }

        if (!task._elapsed) task._elapsed = 0;
        task._elapsed += deltaTime;

        if (task._elapsed >= task._duration) {
            // アニメーション終了時のクリーンアップ
            if (task.animationType === 'attack') {
                this._cleanupAttackAnimation();
            }
            this.world.removeComponent(entityId, AnimateTask);
        }
    }

    _startAttackAnimation(attackerId, targetId) {
        const visualAttacker = this.world.getComponent(attackerId, Visual);
        const visualTarget = this.world.getComponent(targetId, Visual);

        if (visualAttacker) {
            visualAttacker.classes.add('attacker-active');
        }
        if (visualTarget) {
            visualTarget.classes.add('target-lockon');
        }
    }

    _cleanupAttackAnimation() {
        const entities = this.getEntities(Visual);
        for (const entityId of entities) {
            const visual = this.world.getComponent(entityId, Visual);
            if (visual.classes.has('attacker-active')) visual.classes.delete('attacker-active');
            if (visual.classes.has('target-lockon')) visual.classes.delete('target-lockon');
        }
    }

    _processUiAnimationTask(entityId) {
        const task = this.world.getComponent(entityId, UiAnimationTask);
        
        if (task.targetType === 'HP_BAR') {
            if (!task._initialized) {
                task._initialized = true;
                task._pendingTweens = 0;

                const onComplete = () => {
                    task._pendingTweens--;
                    if (task._pendingTweens <= 0) {
                        this.world.removeComponent(entityId, UiAnimationTask);
                    }
                };

                // UiAnimationTaskのデータ構造は { data: { appliedEffects: [...] } }
                this._startHpBarAnimation(task.data.appliedEffects, onComplete, (count) => {
                    task._pendingTweens = count;
                });
                
                if (task._pendingTweens === 0) {
                    this.world.removeComponent(entityId, UiAnimationTask);
                }
            }
        } else {
            this.world.removeComponent(entityId, UiAnimationTask);
        }
    }

    _startHpBarAnimation(appliedEffects, onComplete, onCount) {
        if (!appliedEffects || appliedEffects.length === 0) {
            onCount(0);
            return;
        }

        let tweenCount = 0;

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
            tweenCount++;

            this.activeTweens.add(new Tween({
                target: partInfo,
                property: 'current',
                start: oldHp,
                end: newHp,
                duration: UI_CONFIG.ANIMATION.HP_BAR.DURATION,
                easing: UI_CONFIG.ANIMATION.HP_BAR.EASING,
                onComplete: onComplete 
            }));
        }
        
        onCount(tweenCount);
    }

    _refreshUI() {
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

    _syncHpValue(entityId, partKey, hp) {
        const visual = this.world.getComponent(entityId, Visual);
        if (visual) {
            if (!visual.partsInfo[partKey]) visual.partsInfo[partKey] = { current: hp, max: 100 };
            visual.partsInfo[partKey].current = hp;
        }
    }
    
    _startBattleStartAnimation() {
        const textId = this.world.createEntity();
        const textVisual = new Visual();
        textVisual.x = 0.5;
        textVisual.y = 50;
        textVisual.classes.add('battle-start-text');
        this.world.addComponent(textId, textVisual);
        
        // 簡易的なタイマー処理
        setTimeout(() => {
            if (this.world.entities.has(textId)) {
                this.world.destroyEntity(textId);
                this.world.addComponent(this.world.createEntity(), new BattleStartAnimationCompleted());
            }
        }, 2000);
    }
}