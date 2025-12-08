/**
 * @file PlayerRenderer.js
 * @description プレイヤーエンティティのDOM生成・更新を担当するレンダラー
 * (旧 scripts/battle/renderers/PlayerRenderer.js)
 */
import { el } from '../../../../../engine/utils/DOMUtils.js';
import { CONFIG } from '../../../common/config.js';
// 共通定数: scripts/common/constants.js
import { TeamID, PartKeyToInfoMap, PartInfo, EffectType } from '../../../../common/constants.js';
// バトル固有定数: scripts/battle/common/constants.js
import { PlayerStateType } from '../../../common/constants.js';
import { GameState, ActiveEffects } from '../../../components/index.js';
import { Parts, PlayerInfo } from '../../../../components/index.js';

export class PlayerRenderer {
    constructor(world, battlefield, teamContainers, uiManager) {
        this.world = world;
        this.battlefield = battlefield;
        this.teamContainers = teamContainers;
        this.uiManager = uiManager;
    }

    create(entityId, visual) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const parts = this.world.getComponent(entityId, Parts);
        
        const homeX = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
            : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
        const homeY = visual.y;

        // マーカーとアイコンの生成
        const marker = el('div', {
            className: 'home-marker',
            style: {
                left: `${homeX * 100}%`,
                top: `${homeY}%`
            }
        });

        const guardIndicator = el('div', { className: 'guard-indicator' });

        const icon = el('div', {
            id: `player-${entityId}-icon`,
            className: 'player-icon',
            textContent: playerInfo.name.substring(playerInfo.name.length - 1),
            style: { 
                backgroundColor: playerInfo.color,
                position: 'absolute',
                willChange: 'left, transform'
            }
        }, [
            el('div', { className: 'target-indicator' }, [
                 el('div', { className: 'corner corner-1' }),
                 el('div', { className: 'corner corner-2' }),
                 el('div', { className: 'corner corner-3' }),
                 el('div', { className: 'corner corner-4' })
            ]), 
            guardIndicator
        ]);

        this.battlefield.appendChild(marker);
        this.battlefield.appendChild(icon);

        // 情報パネルの生成
        const partDOMElements = {};
        const createPartRow = (key, part) => {
            if (!part) return null;
            
            let nameEl, barEl, valueEl;
            const row = el('div', { className: 'part-hp', dataset: { partKey: key } }, [
                nameEl = el('span', { 
                    className: 'part-name', 
                    textContent: PartKeyToInfoMap[key]?.icon || '?' 
                }),
                el('div', { className: 'part-hp-bar-container' }, [
                    barEl = el('div', { className: 'part-hp-bar' })
                ]),
                valueEl = el('span', {
                    className: 'part-hp-value',
                    textContent: `${part.hp}/${part.maxHp}`
                })
            ]);

            partDOMElements[key] = { container: row, bar: barEl, value: valueEl };
            return row;
        };

        const teamConfig = CONFIG.TEAMS[playerInfo.teamId];
        const infoPanel = el('div', { className: 'player-info' }, [
            el('div', { className: `player-name ${teamConfig.textColor}`, textContent: playerInfo.name }),
            createPartRow(PartInfo.HEAD.key, parts.head),
            createPartRow(PartInfo.RIGHT_ARM.key, parts.rightArm),
            createPartRow(PartInfo.LEFT_ARM.key, parts.leftArm),
            createPartRow(PartInfo.LEGS.key, parts.legs),
        ]);

        this.teamContainers[playerInfo.teamId].appendChild(infoPanel);

        // UIManagerへの登録
        this.uiManager.registerEntity(entityId, {
            iconElement: icon,
            homeMarkerElement: marker,
            infoPanel: infoPanel,
            guardIndicatorElement: guardIndicator,
            partDOMElements: partDOMElements,
            targetIndicatorElement: icon.querySelector('.target-indicator')
        });

        visual.domId = `player-${entityId}`;
    }

    update(entityId, visual, domElements) {
        const { cache } = visual;
        const icon = domElements.iconElement;

        // --- 位置・スタイル更新 ---
        const isDirty = 
            cache.x !== visual.x ||
            cache.y !== visual.y ||
            cache.offsetX !== visual.offsetX ||
            cache.offsetY !== visual.offsetY ||
            cache.scale !== visual.scale ||
            cache.opacity !== visual.opacity ||
            cache.zIndex !== visual.zIndex;

        if (icon && isDirty) {
            const leftPercent = visual.x * 100;
            const topPercent = visual.y;

            icon.style.left = `${leftPercent}%`;
            icon.style.top = `${topPercent}%`;

            const transform = `translate3d(calc(-50% + ${visual.offsetX}px), calc(-50% + ${visual.offsetY}px), 0) scale(${visual.scale})`;

            icon.style.transform = transform;
            icon.style.opacity = visual.opacity;
            icon.style.zIndex = visual.zIndex || 10;

            cache.x = visual.x;
            cache.y = visual.y;
            cache.offsetX = visual.offsetX;
            cache.offsetY = visual.offsetY;
            cache.scale = visual.scale;
            cache.opacity = visual.opacity;
            cache.zIndex = visual.zIndex;
        }

        // --- クラス更新 (ターゲットロックオンなど) ---
        if (icon) {
            const classesSignature = Array.from(visual.classes).sort().join(' ');
            if (cache.classesSignature !== classesSignature) {
                if (cache.prevClasses) {
                    cache.prevClasses.forEach(c => icon.classList.remove(c));
                }
                visual.classes.forEach(c => icon.classList.add(c));
                cache.prevClasses = new Set(visual.classes);
                cache.classesSignature = classesSignature;
            }
        }
            
        // --- ターゲットインジケーター ---
        if (domElements.targetIndicatorElement) {
            const targetIndicator = domElements.targetIndicatorElement;
            const isLockon = visual.classes.has('target-lockon');
            
            if (isLockon && !targetIndicator.classList.contains('lockon')) {
                targetIndicator.classList.add('lockon');
            } else if (!isLockon && targetIndicator.classList.contains('lockon')) {
                targetIndicator.classList.remove('lockon');
            }
        }

        // --- HPバー等の固有表示 ---
        this._updatePartsInfo(visual, domElements, cache);
        this._updateStateAppearance(entityId, domElements, cache);
        this._updateGuardIndicator(entityId, domElements);
    }

    _updatePartsInfo(visual, domElements, cache) {
        Object.keys(visual.partsInfo).forEach(partKey => {
            const info = visual.partsInfo[partKey];
            const partDom = domElements.partDOMElements[partKey];
            if (!partDom) return;

            const hpSignature = `${info.current}/${info.max}`;
            if (cache.hpSignatures[partKey] === hpSignature) return;

            const hpPercentage = (info.current / info.max) * 100;
            const displayHp = Math.round(info.current);

            partDom.bar.style.width = `${Math.max(0, Math.min(100, hpPercentage))}%`;
            partDom.value.textContent = `${Math.max(0, displayHp)}/${info.max}`;

            if (displayHp <= 0) {
                partDom.bar.style.backgroundColor = 'var(--color-hp-broken)';
                partDom.container.classList.add('broken');
            } else {
                partDom.container.classList.remove('broken');
                const ratio = info.current / info.max;
                if (ratio > 0.5) partDom.bar.style.backgroundColor = 'var(--color-hp-full)';
                else if (ratio > 0.2) partDom.bar.style.backgroundColor = 'var(--color-hp-medium)';
                else partDom.bar.style.backgroundColor = 'var(--color-hp-low)';
            }

            cache.hpSignatures[partKey] = hpSignature;
        });
    }

    _updateStateAppearance(entityId, domElements, cache) {
        const gameState = this.world.getComponent(entityId, GameState);
        const icon = domElements.iconElement;
        
        if (gameState && icon) {
            if (cache.state !== gameState.state) {
                cache.state = gameState.state;
                
                icon.classList.toggle('broken', gameState.state === PlayerStateType.BROKEN);
                icon.classList.toggle('ready-execute', gameState.state === PlayerStateType.READY_EXECUTE);
                
                switch (gameState.state) {
                    case PlayerStateType.SELECTED_CHARGING:
                        icon.style.borderColor = '#f6ad55'; break;
                    case PlayerStateType.CHARGING:
                        icon.style.borderColor = '#4fd1c5'; break;
                    default:
                        icon.style.borderColor = 'var(--color-border-primary)'; break;
                }
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

    remove(entityId) {
        // RenderSystem共通の削除処理に委ねる
    }
}