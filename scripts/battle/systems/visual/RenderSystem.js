/**
 * @file RenderSystem.js
 * @description Visualコンポーネントの状態をDOMに反映するシステム。
 * DOMの生成、更新、破棄を一元管理する。
 */
import { System } from '../../../../engine/core/System.js';
import { Visual, GameState, ActiveEffects } from '../../components/index.js';
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
        
        // Canvasサイズのキャッシュ（Position比率計算用）
        this.fieldRect = { width: 0, height: 0 };
        this._updateFieldRect();
        window.addEventListener('resize', () => this._updateFieldRect());

        // 管理中のエンティティID (DOM削除用)
        this.managedEntities = new Set();
    }

    _updateFieldRect() {
        if (this.battlefield) {
            const rect = this.battlefield.getBoundingClientRect();
            this.fieldRect.width = rect.width;
            this.fieldRect.height = rect.height;
        }
    }

    update(deltaTime) {
        const currentEntities = new Set();
        const entities = this.getEntities(Visual);

        for (const entityId of entities) {
            currentEntities.add(entityId);
            const visual = this.world.getComponent(entityId, Visual);

            if (!visual.isInitialized) {
                this._createDOM(entityId, visual);
                this._syncInitialValues(entityId, visual);
                visual.isInitialized = true;
                this.managedEntities.add(entityId);
            }

            this._updateDOM(entityId, visual);
        }
        
        // クリーンアップ処理 (存在しなくなったエンティティのDOMを削除)
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

        // 生成したDOM要素を削除
        if (domElements.iconElement) domElements.iconElement.remove();
        if (domElements.homeMarkerElement) domElements.homeMarkerElement.remove();
        if (domElements.infoPanel) domElements.infoPanel.remove();
        if (domElements.mainElement) domElements.mainElement.remove();

        this.uiManager.unregisterEntity(entityId);
    }

    _syncInitialValues(entityId, visual) {
        // PartsコンポーネントがあればHPの初期値をVisualにコピー
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
        // PlayerInfoがある場合はプレイヤー用DOM、なければ汎用エフェクト用DOMを作成
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);

        if (playerInfo) {
            this._createPlayerDOM(entityId, visual, playerInfo);
        } else {
            this._createEffectDOM(entityId, visual);
        }
    }

    _createPlayerDOM(entityId, visual, playerInfo) {
        const parts = this.world.getComponent(entityId, Parts);
        
        // 1. マーカーとアイコン (Battlefield内)
        
        // ホームポジションマーカーの座標設定
        const homeX = playerInfo.teamId === TeamID.TEAM1
            ? CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM1
            : CONFIG.BATTLEFIELD.HOME_MARGIN_TEAM2;
        // 初期Y座標はVisual(Position)の初期値を使用
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
            style: { backgroundColor: playerInfo.color }
        }, [
            // ターゲットインジケーターを内包
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

        // 2. 情報パネル (サイドバー内)
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

        // UIManagerに登録
        this.uiManager.registerEntity(entityId, {
            iconElement: icon,
            homeMarkerElement: marker,
            infoPanel: infoPanel,
            guardIndicatorElement: guardIndicator,
            partDOMElements: partDOMElements,
            targetIndicatorElement: icon.querySelector('.target-indicator')
        });

        visual.domId = `player-${entityId}`; // 識別用
    }

    _createEffectDOM(entityId, visual) {
        // エフェクト用のdiv生成
        const element = el('div', {
            className: 'effect-entity', // ベースクラス
            style: { position: 'absolute', pointerEvents: 'none' }
        });
        
        // 初期クラスの適用
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

        // 1. 位置・スタイルの更新 (アイコン or エフェクト)
        const targetElement = domElements.iconElement || domElements.mainElement;
        if (targetElement) {
            // 位置設定 (Position Ratio -> %)
            // Visual.x は 0.0-1.0, y は %指定(バトル仕様)
            
            // X座標: ratio -> %
            const left = (visual.x * 100) + '%';
            // Y座標: % -> %
            const top = visual.y + '%';
            
            // オフセット適用 (px)
            const transform = `translate(calc(-50% + ${visual.offsetX}px), calc(-50% + ${visual.offsetY}px)) scale(${visual.scale})`;

            targetElement.style.left = left;
            targetElement.style.top = top;
            targetElement.style.transform = transform;
            targetElement.style.opacity = visual.opacity;
            targetElement.style.zIndex = visual.zIndex || (domElements.iconElement ? 10 : 100);

            // クラスの同期 (Effectのみ。Playerはステート管理が別にあるため)
            if (domElements.mainElement) {
                // Visual.classes を反映
                visual.classes.forEach(cls => {
                    if (!targetElement.classList.contains(cls)) targetElement.classList.add(cls);
                });
            }
            
            // ターゲットインジケーター制御 (Playerアイコン内包)
            const targetIndicator = domElements.targetIndicatorElement;
            if (targetIndicator) {
                // 'attack-target-active' クラスがあればターゲットインジケーターを表示
                const isActive = visual.classes.has('attack-target-active');
                if (isActive) {
                    if (!targetIndicator.classList.contains('active')) {
                        targetIndicator.classList.add('active');
                        targetIndicator.style.opacity = '1';
                    }
                } else {
                    // 行動選択時のハイライトと競合しないよう、RenderSystemでは
                    // 「攻撃演出中ではない」状態に戻す処理だけを行う
                    // (ActionPanelSystem等が active にしている可能性があるため、強制削除は注意が必要だが、
                    //  今回は共通化のためにここで制御する)
                    if (targetIndicator.classList.contains('active') && !domElements.iconElement.classList.contains('selecting')) {
                        // ActionPanelSystem側でselectingクラス等で制御していない限り、
                        // ここでremoveすると行動選択のカーソルも消える可能性がある。
                        // ただし、実行フェーズでは行動選択は行われないため、実害はないはず。
                        targetIndicator.classList.remove('active');
                        targetIndicator.style.opacity = '';
                    }
                }
            }
        }

        // 2. プレイヤー固有の更新 (HPバー, ステート枠線)
        if (domElements.infoPanel) {
            this._updatePlayerSpecificDOM(entityId, visual, domElements);
        }
    }

    _updatePlayerSpecificDOM(entityId, visual, domElements) {
        // HPバー更新
        Object.keys(visual.partsInfo).forEach(partKey => {
            const info = visual.partsInfo[partKey];
            const partDom = domElements.partDOMElements[partKey];
            if (!partDom) return;

            const hpPercentage = (info.current / info.max) * 100;
            const displayHp = Math.round(info.current);

            // 幅更新
            partDom.bar.style.width = `${Math.max(0, Math.min(100, hpPercentage))}%`;
            // 数値更新
            partDom.value.textContent = `${Math.max(0, displayHp)}/${info.max}`;

            // 色更新
            if (displayHp <= 0) {
                partDom.bar.style.backgroundColor = '#4a5568'; // broken color
                partDom.container.classList.add('broken');
            } else {
                partDom.container.classList.remove('broken');
                const ratio = info.current / info.max;
                if (ratio > 0.5) partDom.bar.style.backgroundColor = '#68d391';
                else if (ratio > 0.2) partDom.bar.style.backgroundColor = '#f6e05e';
                else partDom.bar.style.backgroundColor = '#f56565';
            }
        });

        // プレイヤー状態に応じたアイコン枠線色 (GameState依存)
        // 本来はVisual.classesやVisual.borderColorに入れるべきだが、
        // 既存ロジックの移行のためここでGameStateを参照する
        const gameState = this.world.getComponent(entityId, GameState);
        const icon = domElements.iconElement;
        
        if (gameState && icon) {
            if (visual.lastState !== gameState.state) {
                // 状態変化時の処理
                visual.lastState = gameState.state;
                
                // アイコンのスタイル変更
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

        // ガードインジケーター更新
        // ActiveEffectsからカウントを取得して表示
        const activeEffects = this.world.getComponent(entityId, ActiveEffects);
        const guardIndicator = domElements.guardIndicatorElement;
        if (activeEffects && guardIndicator) {
            const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
            const count = guardEffect && guardEffect.count > 0 ? guardEffect.count : 0;
            
            guardIndicator.style.display = count > 0 ? 'block' : 'none';
            if (count > 0) guardIndicator.textContent = `🛡${count}`;
        }
    }
}