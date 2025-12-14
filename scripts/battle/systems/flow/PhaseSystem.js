/**
 * @file PhaseSystem.js
 * @description フェーズコンテキストを保持し、フェーズ遷移のログ等を管理するシステム。
 * 旧来のステートマシンロジックは廃止し、データコンテナとしての役割とデバッグ機能に特化する。
 * 実際の遷移ロジックは各専門System (ActionSelectionSystem, GameFlowSystem等) に移譲済み。
 */
import { System } from '../../../../engine/core/System.js';
import { PhaseContext } from '../../components/PhaseContext.js';
import { BattlePhase } from '../../common/constants.js';

export class PhaseSystem extends System {
    constructor(world) {
        super(world);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        this.lastPhase = null;
    }

    update(deltaTime) {
        // フェーズ変更検知（デバッグログ用など）
        if (this.phaseContext.phase !== this.lastPhase) {
            // console.log(`[PhaseSystem] Phase changed: ${this.lastPhase} -> ${this.phaseContext.phase}`);
            this.lastPhase = this.phaseContext.phase;
        }
    }
}