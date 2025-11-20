import { GameEvents } from '../common/events.js';
import * as Components from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { BattlePhase, ModalType, EffectScope, EffectType } from '../common/constants.js';
import { UIManager } from './UIManager.js';
import { BaseSystem } from '../../core/baseSystem.js';

/**
 * アニメーションと視覚効果の再生に特化したシステム。
 */
export class ViewSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        // スタイル注入ロジックを削除（style.cssに一元化）
        this.animationStyleElement = null;

        this.dom = {
        };

        this.handlers = {
        };

        this.bindWorldEvents();
        this.bindDOMEvents();
    }

    destroy() {
        if (this.animationStyleElement) {
            // 念のため残すが、基本的にはnullのまま
            if (this.animationStyleElement.parentNode) {
                this.animationStyleElement.parentNode.removeChild(this.animationStyleElement);
            }
            this.animationStyleElement = null;
        }
    }

    bindWorldEvents() {
        this.world.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));
        this.world.on(GameEvents.SHOW_BATTLE_START_ANIMATION, this.onShowBattleStartAnimation.bind(this));
        this.world.on(GameEvents.EXECUTE_ATTACK_ANIMATION, this.executeAttackAnimation.bind(this));
        this.world.on(GameEvents.HP_BAR_ANIMATION_REQUESTED, this.onHpBarAnimationRequested.bind(this));
    }

    bindDOMEvents() {
    }

    onShowBattleStartAnimation() {
        const battlefield = document.getElementById('battlefield');
        if (!battlefield) return;

        const textEl = document.createElement('div');
        textEl.className = 'battle-start-text';
        textEl.textContent = 'ロボトルファイト！';
        battlefield.appendChild(textEl);

        textEl.addEventListener('animationend', () => {
            textEl.remove();
            this.world.emit('BATTLE_ANIMATION_COMPLETED');
        });
    }

    resetView() {
    }

    update(deltaTime) {
    }

    /**
     * 攻撃アニメーションを実行します。
     * @param {object} detail - イベントペイロード { attackerId, targetId }
     */
    executeAttackAnimation(detail) {
        const { attackerId, targetId } = detail;
        const attackerDomElements = this.uiManager.getDOMElements(attackerId);
        
        const action = this.getCachedComponent(attackerId, Components.Action);
        const parts = this.getCachedComponent(attackerId, Components.Parts);
        
        let isSingleTargetAction = false;
        if (action && action.partKey && parts && parts[action.partKey]) {
            const selectedPart = parts[action.partKey];
            const scope = selectedPart.targetScope;
            isSingleTargetAction = scope === EffectScope.ENEMY_SINGLE || scope === EffectScope.ALLY_SINGLE;
        }

        if (!targetId || !attackerDomElements || !isSingleTargetAction) {
            // [修正] GameEventsオブジェクトからイベントキーを参照するように修正
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        const targetDomElements = this.uiManager.getDOMElements(targetId);
        if (!attackerDomElements.iconElement || !targetDomElements?.iconElement) {
            console.warn('ViewSystem (Animation): Missing DOM elements for animation. Skipping.', detail);
            this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            return;
        }

        this.world.emit(GameEvents.GAME_PAUSED);
        
        const indicator = document.createElement('div');
        // style.cssで定義されたクラスを使用
        indicator.className = 'target-indicator';
        for (let i = 0; i < 4; i++) {
            const corner = document.createElement('div');
            corner.className = `corner corner-${i + 1}`;
            indicator.appendChild(corner);
        }
        document.body.appendChild(indicator);
        
        const attackerIcon = attackerDomElements.iconElement;
        const targetIcon = targetDomElements.iconElement;
        
        setTimeout(() => {
            const attackerRect = attackerIcon.getBoundingClientRect();
            const targetRect = targetIcon.getBoundingClientRect();
            
            indicator.style.position = 'fixed';
            indicator.style.zIndex = '100';
            indicator.style.opacity = '1';
            
            const startX = attackerRect.left + attackerRect.width / 2;
            const startY = attackerRect.top + attackerRect.height / 2;
            const endX = targetRect.left + targetRect.width / 2;
            const endY = targetRect.top + targetRect.height / 2;
            
            indicator.style.left = `${startX}px`;
            indicator.style.top = `${startY}px`;
            
            const animation = indicator.animate([
                { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1, offset: 0 },
                { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 1, offset: 0.2 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(1.5)`, opacity: 1, offset: 0.5 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(0.5)`, opacity: 1, offset: 0.65 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(2.0)`, opacity: 1, offset: 0.8 },
                { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(0.5)`, opacity: 0, offset: 1 }
            ], {
                duration: 1200, 
                easing: 'ease-in-out'
            });
            animation.finished.then(() => {
                indicator.remove();
                this.world.emit(GameEvents.EXECUTION_ANIMATION_COMPLETED, { entityId: attackerId });
            });
        }, 100);
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

        // 完了イベントにペイロードを追加
        this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects: effects });
    }

    animateHpBar(effect) {
        return new Promise(resolve => {
            const { targetId, partKey, value } = effect;
            const targetDom = this.uiManager.getDOMElements(targetId);
            const partDom = targetDom?.partDOMElements[partKey];
            const targetPart = this.world.getComponent(targetId, Components.Parts)?.[partKey];

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
                clearTimeout(fallback);
                resolve();
            };

            const onTransitionEnd = (event) => {
                if (event.propertyName === 'width') {
                    cleanup();
                }
            };

            const fallback = setTimeout(cleanup, 1000);
            hpBar.addEventListener('transitionend', onTransitionEnd);

            const finalHp = targetPart.hp;
            const changeAmount = value;
            const initialHp = (effect.type === EffectType.HEAL)
                ? Math.max(0, finalHp - changeAmount)
                : Math.min(targetPart.maxHp, finalHp + changeAmount);
            
            const finalHpPercentage = (finalHp / targetPart.maxHp) * 100;

            const animateHp = () => {
                const currentWidthStyle = getComputedStyle(hpBar).width;
                const parentWidth = hpBar.parentElement.clientWidth;
                const currentWidth = parseFloat(currentWidthStyle);
                
                if (parentWidth > 0) {
                    const currentPercentage = (currentWidth / parentWidth) * 100;
                    const currentDisplayHp = Math.round((currentPercentage / 100) * targetPart.maxHp);
                    hpValueEl.textContent = `${currentDisplayHp}/${targetPart.maxHp}`;
                }

                animationFrameId = requestAnimationFrame(animateHp);
            };

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    hpBar.style.transition = 'width 0.8s ease';
                    hpBar.style.width = `${finalHpPercentage}%`;
                    animationFrameId = requestAnimationFrame(animateHp);
                });
            });
        });
    }
}