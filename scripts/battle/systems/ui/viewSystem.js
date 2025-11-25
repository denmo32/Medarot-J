import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import * as Components from '../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { EffectScope } from '../../common/constants.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { el } from '../../../../engine/utils/DOMUtils.js';

export class ViewSystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.bindWorldEvents();
    }

    destroy() {
    }

    bindWorldEvents() {
        this.world.on(GameEvents.GAME_WILL_RESET, this.resetView.bind(this));
        this.world.on(GameEvents.SHOW_BATTLE_START_ANIMATION, this.onShowBattleStartAnimation.bind(this));
        this.world.on(GameEvents.EXECUTE_ATTACK_ANIMATION, this.executeAttackAnimation.bind(this));
        this.world.on(GameEvents.HP_BAR_ANIMATION_REQUESTED, this.onHpBarAnimationRequested.bind(this));
    }

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

    resetView() {
    }

    update(deltaTime) {
    }

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
        
        const indicator = el('div', { className: 'target-indicator' }, [
            el('div', { className: 'corner corner-1' }),
            el('div', { className: 'corner corner-2' }),
            el('div', { className: 'corner corner-3' }),
            el('div', { className: 'corner corner-4' })
        ]);

        document.body.appendChild(indicator);
        
        const attackerIcon = attackerDomElements.iconElement;
        const targetIcon = targetDomElements.iconElement;
        
        setTimeout(() => {
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

        this.world.emit(GameEvents.HP_BAR_ANIMATION_COMPLETED, { appliedEffects: effects });
    }

    animateHpBar(effect) {
        return new Promise(resolve => {
            const { targetId, partKey } = effect;
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
            const finalHpPercentage = (finalHp / targetPart.maxHp) * 100;

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

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    hpBar.style.transition = 'width 0.8s ease';
                    hpBar.style.width = `${finalHpPercentage}%`;
                    animationFrameId = requestAnimationFrame(animateHpText);
                });
            });
        });
    }
}