/**
 * @file PlayerRenderer.js
 * @description プレイヤーのDOM描画ロジック。
 * QueryService -> BattleQueries
 */
import { el } from '../../../../../engine/utils/DOMUtils.js';
import { CONFIG } from '../../../common/config.js';
import { TeamID, PartInfo } from '../../../../common/constants.js';
import { EffectType } from '../../../common/constants.js';
import { PlayerInfo, Parts } from '../../../../components/index.js';
import { ActiveEffects, IsCharging, IsReadyToExecute, IsGuarding, IsBroken, IsReadyToSelect } from '../../../components/index.js';
import { BattleQueries } from '../../../queries/BattleQueries.js';
import '../../../ui/components/GameHealthBar.js';

export class PlayerRenderer {
    constructor(world, battlefield, teamContainers, uiManager) {
        this.world = world;
        this.battlefield = battlefield;
        this.teamContainers = teamContainers;
        this.uiManager = uiManager;
    }

    create(entityId, visual) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        
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

        // パーツデータの取得
        // attackableOnly=false にして脚部も含める
        const partsList = BattleQueries.getParts(this.world, entityId, true, false);

        [PartInfo.HEAD, PartInfo.RIGHT_ARM, PartInfo.LEFT_ARM, PartInfo.LEGS].forEach(info => {
            const key = info.key;
            // partsListは [ [key, data], ... ] の配列
            const partEntry = partsList.find(([k]) => k === key);
            
            if (partEntry) {
                const partData = partEntry[1];
                const healthBar = document.createElement('game-health-bar');
                healthBar.setAttribute('label', info.icon);
                healthBar.setAttribute('current', partData.hp);
                healthBar.setAttribute('max', partData.maxHp);
                
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
        const icon = domElements.iconElement;
        if (!icon) return;

        let stateKey = 'default';
        if (this.world.getComponent(entityId, IsBroken)) stateKey = 'broken';
        else if (this.world.getComponent(entityId, IsGuarding)) stateKey = 'guarding';
        else if (this.world.getComponent(entityId, IsReadyToExecute)) stateKey = 'ready_execute';
        else if (this.world.getComponent(entityId, IsCharging)) stateKey = 'charging';
        else if (this.world.getComponent(entityId, IsReadyToSelect)) stateKey = 'ready_select';

        if (cache.state !== stateKey) {
            cache.state = stateKey;

            if (stateKey === 'broken') return;

            switch (stateKey) {
                case 'charging':
                    icon.style.borderColor = '#f6ad55'; break;
                case 'ready_select': 
                    icon.style.borderColor = '#4fd1c5'; break; 
                case 'ready_execute':
                case 'guarding':
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
            
            const displayStyle = count > 0 ? 'block' : 'none';
            const displayText = count > 0 ? `🛡${count}` : '';

            if (guardIndicator.style.display !== displayStyle) guardIndicator.style.display = displayStyle;
            if (guardIndicator.textContent !== displayText) guardIndicator.textContent = displayText;
        }
    }
}