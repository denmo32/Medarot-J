/**
 * @file RenderSystem.js
 * @description Visualコンポーネントの状態をDOMに反映するシステム。
 * 座標計算におけるJS依存を排除し、CSSのパーセント指定（left/top）を利用した堅牢な配置方式へ修正。
 * これにより、初期化時のコンテナサイズ取得エラーによる座標ズレを根本解決します。
 */
import { System } from '../../../../engine/core/System.js';
import { Visual, GameState, Position, ActiveEffects } from '../../components/index.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { el } from '../../../../engine/utils/DOMUtils.js';
import { CONFIG } from '../../common/config.js';
import { TeamID, PartKeyToInfoMap, PartInfo, EffectType } from '../../../common/constants.js';
import { PlayerStateType } from '../../common/constants.js';

export class RenderSystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        
        this.battlefield = document.getElementById('battlefield');
        this.teamContainers = {
            [TeamID.TEAM1]: document.querySelector('#team1InfoPanel .team-players-container'),
            [TeamID.TEAM2]: document.querySelector('#team2InfoPanel .team-players-container')
        };
        
        this.managedEntities = new Set();
    }

    destroy() {
        for (const entityId of this.managedEntities) {
            this._removeDOM(entityId);
        }
        this.managedEntities.clear();
        super.destroy();
    }

    update(deltaTime) {
        const currentEntities = new Set();
        const entities = this.getEntities(Visual);

        for (const entityId of entities) {
            currentEntities.add(entityId);
            const visual = this.world.getComponent(entityId, Visual);

            if (!visual.isInitialized) {
                // 初期化時にPositionコンポーネントから座標を同期
                const position = this.world.getComponent(entityId, Position);
                if (position) {
                    visual.x = position.x;
                    visual.y = position.y;
                }
                
                this._createDOM(entityId, visual);
                this._syncInitialValues(entityId, visual);
                visual.isInitialized = true;
                this.managedEntities.add(entityId);
            }

            // アニメーション中でなければPositionコンポーネントと同期
            if (!visual.isAnimating) {
                const position = this.world.getComponent(entityId, Position);
                if (position) {
                    visual.x = position.x;
                    visual.y = position.y;
                }
            }

            this._updateDOM(entityId, visual);
        }
        
        // 削除されたエンティティのDOMをクリーンアップ
        for (const entityId of this.managedEntities) {
            if (!currentEntities.has(entityId)) {
                this._removeDOM(entityId);
                this.managedEntities.delete(entityId);
            }
        }
    }

    _removeDOM(entityId) {
        const domElements = this.uiManager.getDOMElements(entityId);
        if (!domElements) return;

        if (domElements.iconElement) domElements.iconElement.remove();
        if (domElements.homeMarkerElement) domElements.homeMarkerElement.remove();
        if (domElements.infoPanel) domElements.infoPanel.remove();
        if (domElements.mainElement) domElements.mainElement.remove();

        this.uiManager.unregisterEntity(entityId);
    }

    _syncInitialValues(entityId, visual) {
        const parts = this.world.getComponent(entityId, Parts);
        if (parts) {
            Object.keys(parts).forEach(key => {
                if (parts[key]) {
                    if (!visual.partsInfo[key]) visual.partsInfo[key] = {};
                    visual.partsInfo[key].current = parts[key].hp;
                    visual.partsInfo[key].max = parts[key].maxHp;
                }
            });
        }
    }

    _createDOM(entityId, visual) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        if (playerInfo) {
            this._createPlayerDOM(entityId, visual, playerInfo);
        } else {
            this._createEffectDOM(entityId, visual);
        }
    }

    _createPlayerDOM(entityId, visual, playerInfo) {
        const parts = this.world.getComponent(entityId, Parts);
        
        const homeX = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
            : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
        const homeY = visual.y;

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
                // transformによるアニメーション最適化のヒント
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

    _createEffectDOM(entityId, visual) {
        // CSSアニメーションで制御される要素かどうか
        const isCssControlled = visual.classes.has('battle-start-text');

        const style = {
            position: 'absolute', 
            pointerEvents: 'none',
            willChange: 'transform'
        };

        // CSS制御でない場合は左上原点に配置（その後updateDOMで調整）
        if (!isCssControlled) {
            style.left = '0';
            style.top = '0';
        }

        const element = el('div', {
            className: 'effect-entity',
            style: style
        });
        
        visual.classes.forEach(cls => element.classList.add(cls));
        
        if (visual.classes.has('battle-start-text')) {
             element.textContent = 'ロボトルファイト！';
        }

        this.battlefield.appendChild(element);
        
        this.uiManager.registerEntity(entityId, {
            mainElement: element
        });
    }

    _updateDOM(entityId, visual) {
        const domElements = this.uiManager.getDOMElements(entityId);
        if (!domElements) return;

        // --- ダーティチェック: 位置・スタイル ---
        const { cache } = visual;
        const targetElement = domElements.iconElement || domElements.mainElement;
        
        const isCssControlled = visual.classes.has('battle-start-text');

        const isDirty = 
            cache.x !== visual.x ||
            cache.y !== visual.y ||
            cache.offsetX !== visual.offsetX ||
            cache.offsetY !== visual.offsetY ||
            cache.scale !== visual.scale ||
            cache.opacity !== visual.opacity ||
            cache.zIndex !== visual.zIndex;

        if (targetElement && isDirty && !isCssControlled) {
            // CSSのパーセント指定を利用して配置（親要素サイズ依存）
            // left/top は親要素に対する割合で指定
            const leftPercent = visual.x * 100;
            const topPercent = visual.y; // visual.y は元々%単位のロジックになっている

            targetElement.style.left = `${leftPercent}%`;
            targetElement.style.top = `${topPercent}%`;

            // transformは「要素自身の中心合わせ」と「微調整(px)」に使用
            // translate(-50%, -50%) により、left/topで指定した座標が要素の中心になる
            // さらに offsetX/Y を加算して振動や微調整を表現
            const transform = `translate3d(calc(-50% + ${visual.offsetX}px), calc(-50% + ${visual.offsetY}px), 0) scale(${visual.scale})`;

            targetElement.style.transform = transform;
            targetElement.style.opacity = visual.opacity;
            targetElement.style.zIndex = visual.zIndex || (domElements.iconElement ? 10 : 100);

            // キャッシュ更新
            cache.x = visual.x;
            cache.y = visual.y;
            cache.offsetX = visual.offsetX;
            cache.offsetY = visual.offsetY;
            cache.scale = visual.scale;
            cache.opacity = visual.opacity;
            cache.zIndex = visual.zIndex;
        }

        // --- クラスの同期 ---
        if (targetElement) {
            const classesSignature = Array.from(visual.classes).sort().join(' ');
            if (cache.classesSignature !== classesSignature) {
                if (cache.prevClasses) {
                    cache.prevClasses.forEach(c => targetElement.classList.remove(c));
                }
                
                visual.classes.forEach(c => targetElement.classList.add(c));
                
                cache.prevClasses = new Set(visual.classes);
                cache.classesSignature = classesSignature;
                
                if (domElements.mainElement) {
                    targetElement.className = 'effect-entity';
                    visual.classes.forEach(cls => targetElement.classList.add(cls));
                }
            }
        }
            
        // --- ターゲットインジケーター制御 ---
        if (domElements.iconElement && domElements.targetIndicatorElement) {
            const targetIndicator = domElements.targetIndicatorElement;
            const isLockon = visual.classes.has('target-lockon');
            
            if (isLockon) {
                if (!targetIndicator.classList.contains('lockon')) {
                    targetIndicator.classList.add('lockon');
                }
            } else {
                if (targetIndicator.classList.contains('lockon')) {
                    targetIndicator.classList.remove('lockon');
                }
            }
        }

        // --- プレイヤー固有の更新 ---
        if (domElements.infoPanel) {
            this._updatePlayerSpecificDOM(entityId, visual, domElements, cache);
        }
    }

    _updatePlayerSpecificDOM(entityId, visual, domElements, cache) {
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
                partDom.bar.style.backgroundColor = '#4a5568';
                partDom.container.classList.add('broken');
            } else {
                partDom.container.classList.remove('broken');
                const ratio = info.current / info.max;
                if (ratio > 0.5) partDom.bar.style.backgroundColor = '#68d391';
                else if (ratio > 0.2) partDom.bar.style.backgroundColor = '#f6e05e';
                else partDom.bar.style.backgroundColor = '#f56565';
            }

            cache.hpSignatures[partKey] = hpSignature;
        });

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
                        icon.style.borderColor = '#718096'; break;
                }
            }
        }

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