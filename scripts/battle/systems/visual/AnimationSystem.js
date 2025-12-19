/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントのアニメーション制御。
 * 演出の汎用化: IDの指定に基づき、攻撃以外のアクションでもターゲット演出を行えるように修正。
 */
import { System } from '../../../../engine/core/System.js';
import { Visual } from '../../components/index.js';
import { AnimateTask, UiAnimationTask } from '../../components/Tasks.js';
import { AnimationState, UIStateUpdateState, ActiveTween, TweenCompletedSignal } from '../../components/States.js';
import {
    BattleStartAnimationRequest,
    BattleStartAnimationCompleted,
    RefreshUIRequest
} from '../../components/Requests.js';
import { Parts } from '../../../components/index.js';
import { UI_CONFIG } from '../../common/UIConfig.js';
import { EffectType } from '../../common/constants.js';
import { Easing, lerp } from '../../../../engine/utils/Tween.js';
import { QueryService } from '../../services/QueryService.js';

export class AnimationSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        this._processBattleStartRequests();
        this._processAnimationStates();
        this._processRefreshRequests();

        this._processActiveTweens(deltaTime);

        const animateTasks = this.getEntities(AnimateTask);
        for (const entityId of animateTasks) {
            this._processAnimationTask(entityId, deltaTime);
        }

        const uiTaskEntities = this.getEntities(UiAnimationTask);
        for (const entityId of uiTaskEntities) {
            this._processUiAnimationTask(entityId);
        }
    }

    _processActiveTweens(deltaTime) {
        const tweenEntities = this.getEntities(ActiveTween);
        
        for (const entityId of tweenEntities) {
            const tween = this.world.getComponent(entityId, ActiveTween);
            
            tween.elapsed += deltaTime;
            const progress = Math.min(tween.elapsed / tween.duration, 1.0);
            
            const easeFn = Easing[tween.easing] || Easing.linear;
            const t = easeFn(progress);
            
            this._applyTweenValue(tween, t);

            if (progress >= 1.0) {
                if (tween.parentId) {
                    this._onTweenComplete(tween.parentId);
                }
                this.world.destroyEntity(entityId);
            }
        }
    }

    _applyTweenValue(tween, t) {
        if (tween.type === 'HP_UPDATE') {
            const visual = this.world.getComponent(tween.targetId, Visual);
            if (visual && visual.partsInfo[tween.partKey]) {
                const currentVal = lerp(tween.start, tween.end, t);
                visual.partsInfo[tween.partKey].current = currentVal;
            }
        }
    }

    _processBattleStartRequests() {
        const entities = this.getEntities(BattleStartAnimationRequest);
        for (const entityId of entities) {
            this._startBattleStartAnimation();
            this.world.destroyEntity(entityId);
        }
    }

    _processAnimationStates() {
        const entities = this.getEntities(AnimationState);
        for (const entityId of entities) {
            const state = this.world.getComponent(entityId, AnimationState);
            if (state.type === 'HP_BAR') {
                const taskEntity = this.world.createEntity();
                const task = new UiAnimationTask('HP_BAR', state.data);
                this.world.addComponent(taskEntity, task);
                task.emitOnComplete = 'ANIMATION_COMPLETED';
                state.type = null; 
            }
        }
    }

    _processRefreshRequests() {
        const entities = this.getEntities(RefreshUIRequest);
        if (entities.length > 0) {
            this._refreshUI();
            for (const id of entities) this.world.destroyEntity(id);
        }
    }

    _processAnimationTask(entityId, deltaTime) {
        const task = this.world.getComponent(entityId, AnimateTask);
        
        if (!task._startTime) {
            task._startTime = performance.now();
            task._duration = 0;
            
            // アニメーションの種類に関わらず、IDが渡されていれば演出を開始する
            this._startActionVisuals(task.attackerId || entityId, task.targetId);
            
            if (task.animationType === 'attack' || task.animationType === 'support') {
                task._duration = 600; 
            } else {
                task._duration = UI_CONFIG.ANIMATION.DURATION || 300;
            }
        }

        if (!task._elapsed) task._elapsed = 0;
        task._elapsed += deltaTime;

        if (task._elapsed >= task._duration) {
            this._cleanupActionVisuals();
            this.world.removeComponent(entityId, AnimateTask);
        }
    }

    /**
     * アクション実行時の視覚演出（強調、ロックオン）を開始
     */
    _startActionVisuals(attackerId, targetId) {
        if (attackerId) {
            const visualAttacker = this.world.getComponent(attackerId, Visual);
            if (visualAttacker) {
                visualAttacker.classes.add('attacker-active');
            }
        }
        
        if (targetId) {
            const visualTarget = this.world.getComponent(targetId, Visual);
            if (visualTarget) {
                visualTarget.classes.add('target-lockon');
            }
        }
    }

    /**
     * 全ての視覚演出クラスを解除
     */
    _cleanupActionVisuals() {
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
                
                const tweenCount = this._spawnHpBarTweens(entityId, task.data.appliedEffects);
                task._pendingTweens = tweenCount;

                if (tweenCount === 0) {
                    this._completeUiTask(entityId, task);
                }
            }
        } else {
            this.world.removeComponent(entityId, UiAnimationTask);
        }
    }
    
    _onTweenComplete(parentId) {
        if (!parentId) return;
        const task = this.world.getComponent(parentId, UiAnimationTask);
        if (task && task._pendingTweens > 0) {
            task._pendingTweens--;
            if (task._pendingTweens <= 0) {
                this._completeUiTask(parentId, task);
            }
        }
    }

    _completeUiTask(entityId, task) {
        if (task.emitOnComplete === 'ANIMATION_COMPLETED') {
            const stateEntity = this.world.createEntity();
            const uiStateUpdateState = new UIStateUpdateState();
            uiStateUpdateState.type = 'ANIMATION_COMPLETED';
            this.world.addComponent(stateEntity, uiStateUpdateState);
        }
        this.world.removeComponent(entityId, UiAnimationTask);
    }

    _spawnHpBarTweens(parentId, appliedEffects) {
        if (!appliedEffects || appliedEffects.length === 0) return 0;
        let count = 0;

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
            
            const tweenEntity = this.world.createEntity();
            const tween = new ActiveTween({
                targetId,
                type: 'HP_UPDATE',
                partKey,
                start: oldHp,
                end: newHp,
                duration: UI_CONFIG.ANIMATION.HP_BAR.DURATION,
                easing: 'easeOutQuad', 
                parentId
            });
            this.world.addComponent(tweenEntity, tween);
            
            count++;
        }
        return count;
    }

    _refreshUI() {
        const entities = this.getEntities(Parts, Visual);
        for (const entityId of entities) {
            const parts = this.world.getComponent(entityId, Parts);
            const visual = this.world.getComponent(entityId, Visual);
            
            // QueryServiceを使ってパーツデータを取得
            const partKeys = ['head', 'rightArm', 'leftArm', 'legs'];
            partKeys.forEach(key => {
                const partId = parts[key];
                const partData = QueryService.getPartData(this.world, partId);
                
                if (partData) {
                    if (!visual.partsInfo[key]) visual.partsInfo[key] = {};
                    visual.partsInfo[key].current = partData.hp;
                    visual.partsInfo[key].max = partData.maxHp;
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
        
        setTimeout(() => {
            if (this.world.entities.has(textId)) {
                this.world.destroyEntity(textId);
                this.world.addComponent(this.world.createEntity(), new BattleStartAnimationCompleted());
            }
        }, 2000);
    }
}