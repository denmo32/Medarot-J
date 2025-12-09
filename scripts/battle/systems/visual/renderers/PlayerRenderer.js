/**
 * @file PlayerRenderer.js
 * @description Web Componentsを利用するように刷新。
 * ガード表示ロジックの追加。
 */
import { el } from '../../../../../engine/utils/DOMUtils.js';
import { CONFIG } from '../../../common/config.js';
import { TeamID, PartInfo, EffectType } from '../../../../common/constants.js';
import { PlayerStateType } from '../../../common/constants.js';
import { GameState, ActiveEffects } from '../../../components/index.js'; // ActiveEffectsを追加
import { Parts, PlayerInfo } from '../../../../components/index.js';
import '../../../ui/components/GameHealthBar.js';

export class PlayerRenderer {
    constructor(world, battlefield, teamContainers, uiManager) {
        this.world = world;
        this.battlefield = battlefield;
        this.teamContainers = teamContainers;
        this.uiManager = uiManager;
    }

    // createメソッドは変更なしのため省略... 
    // 前回と同じ内容ですが、guardIndicatorElementへの参照保持は確認済みとします。
    create(entityId, visual) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const parts = this.world.getComponent(entityId, Parts);
        
        const homeX = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
            : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
        const homeY = visual.y;

        const marker = el('div', {
            className: 'home-marker',
            style: { left: `${homeX * 100}%`, top: `${homeY}%` }
        });

        const targetIndicator = el('div', { className: 'target-indicator' }, [
             el('div', { className: 'corner corner-1' }),
             el('div', { className: 'corner corner-2' }),
             el('div', { className: 'corner corner-3' }),
             el('div', { className: 'corner corner-4' })
        ]);

        const guardIndicator = el('div', { className: 'guard-indicator' });

        const icon = el('div', {
            id: `player-${entityId}-icon`,
            className: 'player-icon',
            textContent: playerInfo.name.substring(playerInfo.name.length - 1),
            style: { 
                backgroundColor: playerInfo.color,
                position: 'absolute'
            }
        }, [
            targetIndicator,
            guardIndicator
        ]);

        this.battlefield.appendChild(marker);
        this.battlefield.appendChild(icon);

        const partDOMElements = {};
        const infoPanel = el('div', { className: 'player-info' }, [
            el('div', { className: 'player-name', textContent: playerInfo.name })
        ]);

        [PartInfo.HEAD, PartInfo.RIGHT_ARM, PartInfo.LEFT_ARM, PartInfo.LEGS].forEach(info => {
            const key = info.key;
            const part = parts[key];
            if (part) {
                const healthBar = document.createElement('game-health-bar');
                healthBar.setAttribute('label', info.icon);
                healthBar.setAttribute('current', part.hp);
                healthBar.setAttribute('max', part.maxHp);
                
                infoPanel.appendChild(healthBar);
                partDOMElements[key] = healthBar;
            }
        });

        this.teamContainers[playerInfo.teamId].appendChild(infoPanel);

        this.uiManager.registerEntity(entityId, {
            iconElement: icon,
            homeMarkerElement: marker,
            infoPanel: infoPanel,
            partDOMElements: partDOMElements,
            targetIndicatorElement: targetIndicator,
            guardIndicatorElement: guardIndicator
        });

        visual.domId = `player-${entityId}`;
    }

    update(entityId, visual, domElements) {
        const { cache } = visual;
        
        this._updateIconTransform(visual, domElements.iconElement, cache);
        this._updateIconClasses(visual, domElements.iconElement, cache, domElements.targetIndicatorElement);
        this._updatePartsInfo(visual, domElements.partDOMElements, cache);
        this._updateStateAppearance(entityId, domElements, cache);
        
        // ★追加: ガードインジケーターの更新
        this._updateGuardIndicator(entityId, domElements);
    }

    _updatePartsInfo(visual, partElements, cache) {
        Object.keys(visual.partsInfo).forEach(partKey => {
            const info = visual.partsInfo[partKey];
            const element = partElements[partKey];
            if (!element) return;

            const hpSignature = `${info.current}/${info.max}`;
            if (cache.hpSignatures[partKey] !== hpSignature) {
                element.setAttribute('current', Math.round(info.current));
                element.setAttribute('max', info.max);
                cache.hpSignatures[partKey] = hpSignature;
            }
        });
    }

    _updateIconTransform(visual, icon, cache) {
        if (!icon) return;
        const isDirty = cache.x !== visual.x || cache.y !== visual.y || cache.scale !== visual.scale || cache.opacity !== visual.opacity;
        if (isDirty) {
            icon.style.left = `${visual.x * 100}%`;
            icon.style.top = `${visual.y}%`;
            icon.style.transform = `translate(-50%, -50%) scale(${visual.scale})`;
            icon.style.opacity = visual.opacity;
            cache.x = visual.x; cache.y = visual.y; cache.scale = visual.scale; cache.opacity = visual.opacity;
        }
    }

    _updateIconClasses(visual, icon, cache, targetIndicator) {
        if (!icon) return;
        const sig = Array.from(visual.classes).sort().join(' ');
        if (cache.classesSignature !== sig) {
            if (cache.prevClasses) cache.prevClasses.forEach(c => icon.classList.remove(c));
            visual.classes.forEach(c => icon.classList.add(c));
            cache.prevClasses = new Set(visual.classes);
            cache.classesSignature = sig;
        }
        if (targetIndicator) {
            const isLockon = visual.classes.has('target-lockon');
            targetIndicator.classList.toggle('lockon', isLockon);
        }
    }

    _updateStateAppearance(entityId, domElements, cache) {
        const gameState = this.world.getComponent(entityId, GameState);
        const icon = domElements.iconElement;
        if (gameState && icon && cache.state !== gameState.state) {
            cache.state = gameState.state;
            icon.classList.toggle('broken', gameState.state === PlayerStateType.BROKEN);
            switch (gameState.state) {
                case PlayerStateType.SELECTED_CHARGING:
                    icon.style.borderColor = '#f6ad55'; break;
                case PlayerStateType.CHARGING:
                    icon.style.borderColor = '#4fd1c5'; break;
                case PlayerStateType.READY_EXECUTE:
                    icon.style.borderColor = 'var(--color-white)'; break;
                default:
                    icon.style.borderColor = 'var(--color-border-primary)'; break;
            }
        }
    }

    _updateGuardIndicator(entityId, domElements) {
        const activeEffects = this.world.getComponent(entityId, ActiveEffects);
        const guardIndicator = domElements.guardIndicatorElement;
        
        if (activeEffects && guardIndicator) {
            const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
            const count = guardEffect && guardEffect.count > 0 ? guardEffect.count : 0;
            
            // DOM更新
            const displayStyle = count > 0 ? 'block' : 'none';
            const displayText = count > 0 ? `🛡${count}` : '';

            // 頻繁な書き換えを防ぐチェックはDOMのプロパティで行う
            if (guardIndicator.style.display !== displayStyle) guardIndicator.style.display = displayStyle;
            if (guardIndicator.textContent !== displayText) guardIndicator.textContent = displayText;
        }
    }
}