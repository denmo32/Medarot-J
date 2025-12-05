import { Gauge, GameState } from '../../components/index.js';
import { Parts } from '../../../components/index.js';
import { BattleContext } from '../../context/index.js';
import { BattlePhase } from '../../common/constants.js';
import { PartInfo } from '../../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { System } from '../../../../engine/core/System.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';

export class GaugeSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.isPaused = false;
        
        this.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));
    }

    update(deltaTime) {
        // シーケンス実行中はゲージ更新を停止
        if (this.battleContext.isSequenceRunning) {
            return;
        }

        const activePhases = [
            BattlePhase.TURN_START,
            BattlePhase.ACTION_SELECTION,
            BattlePhase.ACTION_EXECUTION,
            BattlePhase.TURN_END,
        ];

        if (!activePhases.includes(this.battleContext.phase) || this.isPaused) {
            return;
        }

        // 行動選択待ちのアクターがいる場合も停止（従来通り）
        // ※ ここはPhaseSystem等でフラグ制御してもいいが、
        // 全体停止条件として残しておく
        const entitiesWithState = this.getEntities(GameState);
        const hasActionQueued = entitiesWithState.some(entityId => {
            const gameState = this.world.getComponent(entityId, GameState);
            // READY_SELECT/READY_EXECUTE は「待ち」状態なので全体時間を止める
            return gameState.state === 'ready_select' || gameState.state === 'ready_execute';
        });

        if (hasActionQueued) {
            return;
        }

        const entities = this.getEntities(Gauge, Parts);

        for (const entityId of entities) {
            const parts = this.world.getComponent(entityId, Parts);

            // 頭部破壊時は動かない（これはStateSystemでisActive=falseにされるべきだが、念のため）
            if (parts[PartInfo.HEAD.key]?.isBroken) {
                continue;
            }

            const gauge = this.world.getComponent(entityId, Gauge);
            
            // isActiveフラグのみで判定
            if (!gauge.isActive) {
                continue;
            }

            const mobility = parts.legs?.mobility || 0;
            const propulsion = parts.legs?.propulsion || 0;
            const speedMultiplier = gauge.speedMultiplier || 1.0;

            const { nextSpeed, increment } = CombatCalculator.calculateGaugeUpdate({
                currentSpeed: gauge.currentSpeed,
                mobility,
                propulsion,
                speedMultiplier,
                deltaTime
            });
            
            gauge.currentSpeed = nextSpeed;
            gauge.value += increment;

            if (gauge.value >= gauge.max) {
                gauge.value = gauge.max;
                this.world.emit(GameEvents.GAUGE_FULL, { entityId });
            }
        }
    }
    
    onPauseGame() { this.isPaused = true; }
    onResumeGame() { this.isPaused = false; }
}