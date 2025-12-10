/**
 * @file AnimationSystem.js
 * @description ビジュアルコンポーネントのアニメーション制御。
 * 固定タイマーを廃止し、Tween完了との完全同期を実現。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { Visual, AnimationRequest, UiAnimationRequest } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
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

        // 2. AnimationRequestの処理
        const animRequests = this.getEntities(AnimationRequest);
        for (const entityId of animRequests) {
            this._processAnimationRequest(entityId, deltaTime);
        }

        // 3. UiAnimationRequestの処理
        const uiRequests = this.getEntities(UiAnimationRequest);
        for (const entityId of uiRequests) {
            this._processUiAnimationRequest(entityId);
        }
    }

    _processAnimationRequest(entityId, deltaTime) {
        const request = this.world.getComponent(entityId, AnimationRequest);
        
        if (!request.startTime) {
            request.startTime = performance.now();
            request.duration = 0;
            
            if (request.type === 'attack') {
                this._startAttackAnimation(entityId, request.targetId);
                request.duration = 600; 
            } else if (request.type === 'support') {
                request.duration = UI_CONFIG.ANIMATION.DURATION || 300;
            } else {
                request.duration = UI_CONFIG.ANIMATION.DURATION || 300;
            }
        }

        if (!request.elapsed) request.elapsed = 0;
        request.elapsed += deltaTime;

        if (request.elapsed >= request.duration) {
            this.world.removeComponent(entityId, AnimationRequest);
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

    _processUiAnimationRequest(entityId) {
        const request = this.world.getComponent(entityId, UiAnimationRequest);
        
        if (request.targetType === 'HP_BAR') {
            if (!request.initialized) {
                request.initialized = true;
                request.pendingTweens = 0;

                // コールバック関数: 全てのTweenが終わったらコンポーネントを削除
                const onComplete = () => {
                    request.pendingTweens--;
                    if (request.pendingTweens <= 0) {
                        this.world.removeComponent(entityId, UiAnimationRequest);
                    }
                };

                // アニメーション開始（Tween数をカウント）
                // onHpBarAnimationRequested にコールバックを渡せるように拡張する必要があるが、
                // 既存メソッドのシグネチャを変えるより、内部ロジックをここで呼ぶ方が安全。
                // あるいはイベント経由ではなく直接処理する。
                this._startHpBarAnimation(request.data, onComplete, (count) => {
                    request.pendingTweens = count;
                });
                
                // Tweenが発生しなかった場合
                if (request.pendingTweens === 0) {
                    this.world.removeComponent(entityId, UiAnimationRequest);
                }
            }
        } else {
            this.world.removeComponent(entityId, UiAnimationRequest);
        }
    }

    // 内部処理用メソッド (Requestから呼ばれる)
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
                onComplete: onComplete // 完了時に通知
            }));
        }
        
        onCount(tweenCount);
    }

    // イベントハンドラ用 (互換性維持)
    onHpBarAnimationRequested(detail) {
        // イベント経由の場合は完了通知不要（あるいはHP_BAR_ANIMATION_COMPLETEDをemitする）
        // ここでは単純に再生のみ行う
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