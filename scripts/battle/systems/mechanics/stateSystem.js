import { System } from '../../../../engine/core/System.js';
import { GameState } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PartInfo } from '../../../common/constants.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';

export class StateSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.on(GameEvents.PART_BROKEN, this.onPartBroken.bind(this));
        this.on(GameEvents.GUARD_BROKEN, this.onGuardBroken.bind(this));
    }

    onPartBroken(detail) {
        const { entityId, partKey } = detail;
        
        // 頭部破壊ならプレイヤー破壊（機能停止）
        if (partKey === PartInfo.HEAD.key) {
            const cmd = createCommand('SET_PLAYER_BROKEN', { targetId: entityId });
            cmd.execute(this.world);
        }
        
        // ガード破壊処理はDamageEffect.js内に移動し、イベント(REQUEST_RESET_TO_COOLDOWN)を発行する形に一本化しました。
    }
    
    onGuardBroken(detail) {
        // 現在は特に処理なし（ログ出力や演出トリガーとして利用可能）
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        // Serviceの代わりにコマンドを発行
        const cmd = createCommand('HANDLE_GAUGE_FULL', { targetId: entityId });
        cmd.execute(this.world);
    }
}