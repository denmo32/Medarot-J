import { System } from '../../../../engine/core/System.js';
import { GameState, ActiveEffects } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStateType } from '../../common/constants.js';
import { EffectType, PartInfo } from '../../../common/constants.js';
import { PlayerStatusService } from '../../services/PlayerStatusService.js';
import { CooldownService } from '../../services/CooldownService.js';

export class StateSystem extends System {
    constructor(world) {
        super(world);
        // REQUEST_STATE_TRANSITION, COMBAT_SEQUENCE_RESOLVED はService化に伴い削除
        this.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
        this.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    onPartBroken(detail) {
        const { entityId, partKey } = detail;
        
        // 頭部破壊ならプレイヤー破壊（機能停止）
        if (partKey === PartInfo.HEAD.key) {
            PlayerStatusService.setPlayerBroken(this.world, entityId);
        }

        const gameState = this.world.getComponent(entityId, GameState);
        // ガード中のパーツが破壊されたかチェック
        if (gameState?.state === PlayerStateType.GUARDING) {
            const activeEffects = this.world.getComponent(entityId, ActiveEffects);
            if (!activeEffects) return;

            const isGuardPartBroken = activeEffects.effects.some(
                effect => effect.type === EffectType.APPLY_GUARD && effect.partKey === partKey
            );

            if (isGuardPartBroken) {
                this.world.emit(GameEvents.GUARD_BROKEN, { entityId });
                // ガード破壊時はクールダウンへ（Service直接呼び出し）
                CooldownService.resetEntityStateToCooldown(this.world, entityId, {});
            }
        }
    }
    
    onGuardBroken(detail) {
        // メッセージ表示などは他で行う
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        // Serviceに委譲
        PlayerStatusService.handleGaugeFull(this.world, entityId);
    }
}