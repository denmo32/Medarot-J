/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントのアニメーション制御。
 * AnimationRequest および AnimateTask, UiAnimationTask を処理する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Visual, AnimationRequest, UiAnimationRequest, AnimateTask, UiAnimationTask as UiAnimTaskComp } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { UI_CONFIG } from '../../common/UIConfig.js';
import { EffectType } from '../../common/constants.js';
import { Tween } from '../../../../engine/utils/Tween.js';

export class AnimationSystem extends System {
    constructor(world) {
        super(world);
        this.activeTweens = new Set();
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.SHOW_BATTLE_START_ANIMATION, this.onShowBattleStartAnimation.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_REQUESTED, this.onHpBarAnimationRequested.bind(this));
        this.on(GameEvents.REFRESH_UI, this.onRefreshUI.bind(this));
        this.on(GameEvents.ACTION_SEQUENCE_COMPLETED, this.onActionSequenceCompleted.bind(this));
    }

    update(deltaTime) {
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

        // 2. AnimationRequest (旧) の処理
        const animRequests = this.getEntities(AnimationRequest);
        for (const entityId of animRequests) {
            this._processAnimationRequest(entityId, deltaTime, AnimationRequest);
        }

        // 3. AnimateTask (新) の処理
        const animateTasks = this.getEntities(AnimateTask);
        for (const entityId of animateTasks) {
            this._processAnimationRequest(entityId, deltaTime, AnimateTask);
        }

        // 4. UiAnimationRequest (旧) の処理
        const uiRequests = this.getEntities(UiAnimationRequest);
        for (const entityId of uiRequests) {
            this._processUiAnimationRequest(entityId, UiAnimationRequest);
        }

        // 5. UiAnimationTask (新) の処理
        const uiTaskEntities = this.getEntities(UiAnimTaskComp);
        for (const entityId of uiTaskEntities) {
            this._processUiAnimationRequest(entityId, UiAnimTaskComp);
        }
    }

    // 共通化されたアニメーション処理
    _processAnimationRequest(entityId, deltaTime, ComponentClass) {
        const request = this.world.getComponent(entityId, ComponentClass);
        // AnimateTaskの場合は targetId プロパティ、AnimationRequestの場合は targetId
        // データ構造の違いを吸収するか、同じ構造にする
        // AnimateTask: { animationType, targetId }
        // AnimationRequest: { type, targetId, options, startTime, duration, elapsed }
        
        // 簡易的にプロパティマッピング
        const type = request.animationType || request.type;
        const targetId = request.targetId;

        // 状態管理用のプロパティをコンポーネントに直接追加（ECS的には別コンポーネントにすべきだが簡易対応）
        if (!request._startTime) {
            request._startTime = performance.now();
            request._duration = 0;
            
            if (type === 'attack') {
                this._startAttackAnimation(entityId, targetId);
                request._duration = 600; 
            } else if (type === 'support') {
                request._duration = UI_CONFIG.ANIMATION.DURATION || 300;
            } else {
                request._duration = UI_CONFIG.ANIMATION.DURATION || 300;
            }
        }

        if (!request._elapsed) request._elapsed = 0;
        request._elapsed += deltaTime;

        if (request._elapsed >= request._duration) {
            this.world.removeComponent(entityId, ComponentClass);
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

    _processUiAnimationRequest(entityId, ComponentClass) {
        const request = this.world.getComponent(entityId, ComponentClass);
        
        if (request.targetType === 'HP_BAR') {
            if (!request._initialized) {
                request._initialized = true;
                request._pendingTweens = 0;

                const onComplete = () => {
                    request._pendingTweens--;
                    if (request._pendingTweens <= 0) {
                        this.world.removeComponent(entityId, ComponentClass);
                    }
                };

                this._startHpBarAnimation(request.data, onComplete, (count) => {
                    request._pendingTweens = count;
                });
                
                if (request._pendingTweens === 0) {
                    this.world.removeComponent(entityId, ComponentClass);
                }
            }
        } else {
            this.world.removeComponent(entityId, ComponentClass);
        }
    }

    // ... (以下、_startHpBarAnimation 等の既存メソッドは変更なし) ...
    _startHpBarAnimation(detail, onComplete, onCount) {
        const appliedEffects = detail.appliedEffects || detail.effects;
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

    onHpBarAnimationRequested(detail) {
        this._startHpBarAnimation(detail, () => {}, () => {});
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