/**
 * @file ViewSystem.js
 * @description バトルシーンの視覚効果（アニメーション）を担当。
 * タスクシステムから呼び出せる非同期メソッドを提供。
 */
import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import * as BattleComponents from '../../components/index.js';
import * as CommonComponents from '../../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { EffectScope } from '../../../common/constants.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { el } from '../../../../engine/utils/DOMUtils.js';
import { TaskType } from '../../tasks/BattleTasks.js';

export class ViewSystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.bindWorldEvents();
    }

    bindWorldEvents() {
        this.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));
        this.on(GameEvents.SHOW_BATTLE_START_ANIMATION, this.onShowBattleStartAnimation.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_REQUESTED, this.onHpBarAnimationRequested.bind(this));
    }

    resetView() {}

    onShowBattleStartAnimation() {
        const battlefield = document.getElementById('battlefield');
        if (!battlefield) return;

        const textEl = el('div', {
            className: 'battle-start-text',
            textContent: 'ロボトルファイト！',
            onanimationend: () => {
                textEl.remove();
                this.world.emit('BATTLE_ANIMATION_COMPLETED');
            }
        });

        battlefield.appendChild(textEl);
    }

    /**
     * アニメーション再生タスクを実行 (Async)
     * @param {object} task 
     */
    playAnimation(task) {
        return new Promise((resolve) => {
            const { attackerId, targetId, animationType } = task;

            if (animationType === 'attack') {
                this._playAttackAnimation(attackerId, targetId).then(resolve);
            } else {
                // その他のアニメーション
                setTimeout(resolve, 300);
            }
        });
    }

    _playAttackAnimation(attackerId, targetId) {
        return new Promise((resolve) => {
            const attackerDomElements = this.uiManager.getDOMElements(attackerId);
            
            const action = this.getCachedComponent(attackerId, BattleComponents.Action);
            const parts = this.getCachedComponent(attackerId, CommonComponents.Parts);
            
            let isSingleTargetAction = false;
            if (action && action.partKey && parts && parts[action.partKey]) {
                const selectedPart = parts[action.partKey];
                const scope = selectedPart.targetScope;
                isSingleTargetAction = scope === EffectScope.ENEMY_SINGLE || scope === EffectScope.ALLY_SINGLE;
            }
    
            if (!targetId || !attackerDomElements || !isSingleTargetAction) {
                // ターゲット指定がない場合はスキップ
                resolve();
                return;
            }
    
            const targetDomElements = this.uiManager.getDOMElements(targetId);
            if (!attackerDomElements.iconElement || !targetDomElements?.iconElement) {
                resolve();
                return;
            }
    
            // エフェクト生成
            const indicator = el('div', { className: 'target-indicator' }, [
                el('div', { className: 'corner corner-1' }),
                el('div', { className: 'corner corner-2' }),
                el('div', { className: 'corner corner-3' }),
                el('div', { className: 'corner corner-4' })
            ]);
    
            document.body.appendChild(indicator);
            
            const attackerIcon = attackerDomElements.iconElement;
            const targetIcon = targetDomElements.iconElement;
            
            // レイアウト確定待ち
            requestAnimationFrame(() => {
                const attackerRect = attackerIcon.getBoundingClientRect();
                const targetRect = targetIcon.getBoundingClientRect();
                
                Object.assign(indicator.style, {
                    position: 'fixed',
                    zIndex: '100',
                    opacity: '1'
                });
                
                const startX = attackerRect.left + attackerRect.width / 2;
                const startY = attackerRect.top + attackerRect.height / 2;
                const endX = targetRect.left + targetRect.width / 2;
                const endY = targetRect.top + targetRect.height / 2;
                
                indicator.style.left = `${startX}px`;
                indicator.style.top = `${startY}px`;
                
                const dx = endX - startX;
                const dy = endY - startY;
    
                const animation = indicator.animate([
                    { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1, offset: 0 },
                    { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0.2 },
                    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.5)`, opacity: 1, offset: 0.5 },
                    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0.65 },
                    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(2.0)`, opacity: 1, offset: 0.8 },
                    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: 0, offset: 1 }
                ], {
                    duration: 800, 
                    easing: 'ease-in-out'
                });
    
                animation.finished.then(() => {
                    indicator.remove();
                    this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
                    resolve();
                });
            });
        });
    }

    async onHpBarAnimationRequested(detail) {
        const { effects } = detail;

        if (!effects || effects.length === 0) {
            this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects: [] });
            return;
        }

        for (const effect of effects) {
            await this.animateHpBar(effect);
        }

        this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects: effects });
    }

    animateHpBar(effect) {
        return new Promise(resolve => {
            const { targetId, partKey } = effect;
            const targetDom = this.uiManager.getDOMElements(targetId);
            const partDom = targetDom?.partDOMElements?.[partKey];
            // 実際のデータ更新はすでに行われている前提で、表示上のアニメーションを行う
            const targetPart = this.world.getComponent(targetId, CommonComponents.Parts)?.[partKey];

            if (!partDom || !targetPart || !partDom.bar || !partDom.value) {
                resolve();
                return;
            }

            const hpBar = partDom.bar;
            const hpValueEl = partDom.value;
            let animationFrameId = null;

            const cleanup = () => {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                hpValueEl.textContent = `${targetPart.hp}/${targetPart.maxHp}`;
                hpBar.style.transition = '';
                hpBar.removeEventListener('transitionend', onTransitionEnd);
                resolve();
            };

            const onTransitionEnd = (event) => {
                if (event.propertyName === 'width') {
                    cleanup();
                }
            };

            // タイムアウト設定
            setTimeout(cleanup, 1200);
            hpBar.addEventListener('transitionend', onTransitionEnd);

            const finalHp = targetPart.hp;
            const finalHpPercentage = (finalHp / targetPart.maxHp) * 100;

            // 数値のカウントアップ演出
            const animateHpText = () => {
                const currentWidthStyle = getComputedStyle(hpBar).width;
                const parentWidth = hpBar.parentElement.clientWidth;
                
                if (parentWidth > 0) {
                    const currentWidth = parseFloat(currentWidthStyle);
                    const currentPercentage = (currentWidth / parentWidth) * 100;
                    const currentDisplayHp = Math.round((currentPercentage / 100) * targetPart.maxHp);
                    hpValueEl.textContent = `${Math.max(0, currentDisplayHp)}/${targetPart.maxHp}`;
                }
                animationFrameId = requestAnimationFrame(animateHpText);
            };

            // アニメーション開始
            requestAnimationFrame(() => {
                hpBar.style.transition = 'width 0.8s ease';
                hpBar.style.width = `${finalHpPercentage}%`;
                
                // 色の更新
                if (finalHpPercentage > 50) hpBar.style.backgroundColor = '#68d391';
                else if (finalHpPercentage > 20) hpBar.style.backgroundColor = '#f6e05e';
                else hpBar.style.backgroundColor = '#f56565';
                if (finalHp === 0) hpBar.style.backgroundColor = '#4a5568';

                animationFrameId = requestAnimationFrame(animateHpText);
            });
        });
    }
}