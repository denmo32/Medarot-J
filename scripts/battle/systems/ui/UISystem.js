import { System } from '../../../../engine/core/System.js';
import { Position, GameState, ActiveEffects } from '../../components/index.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { PlayerStateType, BattlePhase } from '../../common/constants.js';
import { EffectType } from '../../../common/constants.js';
import { UIManager } from '../../../../engine/ui/UIManager.js';
import { GameEvents } from '../../../common/events.js';
import { BattleContext } from '../../context/index.js';

export class UISystem extends System {
    constructor(world) {
        super(world);
        this.uiManager = this.world.getSingletonComponent(UIManager);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.on(GameEvents.HP_UPDATED, this.onHpUpdated.bind(this));
        this.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpAnimationCompleted.bind(this));
        this.on(GameEvents.REFRESH_UI, this.onRefreshUI.bind(this));
    }

    onHpUpdated(detail) {
        // バトルシーケンス中かどうかに関わらず、HP_UPDATEDイベントが来たら即時反映はしない。
        // ViewSystem (HP_BAR_ANIMATION) がアニメーションを担当する。
        // ここでの処理は、アニメーションを使わない更新（回復やシステム的な修正）用、
        // あるいはリセット時の強制反映用として機能するが、シーケンス中はViewSystemに任せるのが安全。
        // 今回の改修で、HP_UPDATEDは単なるデータ通知として扱い、このシステムでの反応は必須ではなくなる。
        // ただし、アニメーションを伴わない更新漏れを防ぐため、シーケンス外であれば反映する。
        if (this.battleContext && 
            this.battleContext.phase === BattlePhase.ACTION_EXECUTION &&
            this.battleContext.isSequenceRunning) {
            return;
        }

        this._updateHpDom(detail);
    }
    
    onRefreshUI() {
        // 全エンティティの表示状態を最新データに合わせて更新
        const entities = this.getEntities(PlayerInfo, Parts);
        for (const entityId of entities) {
            const parts = this.world.getComponent(entityId, Parts);
            if (!parts) continue;
            
            Object.keys(parts).forEach(partKey => {
                const part = parts[partKey];
                if (part) {
                    this._updateHpDom({ entityId, partKey, newHp: part.hp, maxHp: part.maxHp });
                }
            });
            this.updatePlayerUI(entityId);
        }
    }

    _updateHpDom(detail) {
        const { entityId, partKey, newHp, maxHp } = detail;
        const domElements = this.uiManager.getDOMElements(entityId);
        const partDom = domElements?.partDOMElements?.[partKey];
        if (!partDom) return;

        const hpPercentage = (newHp / maxHp) * 100;
        partDom.bar.style.width = `${hpPercentage}%`;

        if (partDom.value) {
            partDom.value.textContent = `${newHp}/${maxHp}`;
        }
        
        // 色の更新
        if (newHp === 0) {
            partDom.bar.style.backgroundColor = '#4a5568';
            partDom.container.classList.add('broken');
        } else {
            if (hpPercentage > 50) partDom.bar.style.backgroundColor = '#68d391';
            else if (hpPercentage > 20) partDom.bar.style.backgroundColor = '#f6e05e';
            else partDom.bar.style.backgroundColor = '#f56565';
            partDom.container.classList.remove('broken');
        }
    }
    
    onHpAnimationCompleted(detail) {
        const { appliedEffects } = detail;
        if (!appliedEffects) return;

        for (const effect of appliedEffects) {
            const domElements = this.uiManager.getDOMElements(effect.targetId);
            if (!domElements) continue;

            // 破壊エフェクト反映
            if (effect.isPartBroken) {
                const partDom = domElements.partDOMElements?.[effect.partKey];
                if (partDom) {
                    partDom.container.classList.add('broken');
                }
            }

            if (effect.isPlayerBroken) {
                 if (domElements.iconElement) {
                    domElements.iconElement.classList.add('broken');
                }
            }
            
            // ガード回数表示の更新 (アニメーション完了時に同期をとる)
            if (effect.type === EffectType.CONSUME_GUARD) {
                this._updateGuardIndicator(effect.targetId);
            }
        }
    }

    update(deltaTime) {
        const entities = this.getEntities(PlayerInfo, Position, GameState, Parts);
        for (const entityId of entities) {
            this.updatePlayerUI(entityId);
        }
    }

    updatePlayerUI(entityId) {
        const domElements = this.uiManager.getDOMElements(entityId);
        if (!domElements || !domElements.iconElement) return;

        const position = this.getCachedComponent(entityId, Position);
        const gameState = this.getCachedComponent(entityId, GameState);
        
        if (!position || !gameState) return;

        const newLeft = `${position.x * 100}%`;
        const newTop = `${position.y}%`;

        if (domElements.iconElement.style.left !== newLeft) {
            domElements.iconElement.style.left = newLeft;
        }
        if (domElements.iconElement.style.top !== newTop) {
            domElements.iconElement.style.top = newTop;
        }
        
        const transformValue = 'translate(-50%, -50%)';
        if (domElements.iconElement.style.transform !== transformValue) {
            domElements.iconElement.style.transform = transformValue;
        }

        const lastState = domElements.iconElement.dataset.lastState;
        
        if (lastState !== gameState.state) {
            switch (gameState.state) {
                case PlayerStateType.SELECTED_CHARGING:
                    domElements.iconElement.style.borderColor = '#f6ad55';
                    break;
                case PlayerStateType.CHARGING:
                    domElements.iconElement.style.borderColor = '#4fd1c5';
                    break;
                default:
                    domElements.iconElement.style.borderColor = '#718096';
                    break;
            }

            domElements.iconElement.classList.toggle('ready-execute', gameState.state === PlayerStateType.READY_EXECUTE);
            domElements.iconElement.dataset.lastState = gameState.state;
        }

        // シーケンス実行中は、ガード回数の更新をスキップする (データ適用と表示のタイミングずれを防ぐため)
        if (this.battleContext && this.battleContext.isSequenceRunning) {
            return;
        }

        this._updateGuardIndicator(entityId, domElements);
    }
    
    _updateGuardIndicator(entityId, domElements = null) {
        if (!domElements) {
            domElements = this.uiManager.getDOMElements(entityId);
        }
        if (!domElements || !domElements.guardIndicatorElement) return;

        const activeEffects = this.getCachedComponent(entityId, ActiveEffects);
        const guardIndicator = domElements.guardIndicatorElement;

        if (activeEffects) {
            const guardEffect = activeEffects.effects.find(e => e.type === EffectType.APPLY_GUARD);
            const count = guardEffect && guardEffect.count > 0 ? guardEffect.count : 0;
            const shouldShow = count > 0;

            const newDisplay = shouldShow ? 'block' : 'none';
            if (guardIndicator.style.display !== newDisplay) {
                guardIndicator.style.display = newDisplay;
            }

            if (shouldShow) {
                const newText = `🛡${count}`;
                if (guardIndicator.textContent !== newText) {
                    guardIndicator.textContent = newText;
                }
            }
        } else {
            if (guardIndicator.style.display !== 'none') {
                guardIndicator.style.display = 'none';
            }
        }
    }
}