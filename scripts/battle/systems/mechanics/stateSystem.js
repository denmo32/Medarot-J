import { System } from '../../../../engine/core/System.js';
import { GameState } from '../../components/index.js';
import { GameEvents } from '../../../common/events.js';
import { PartInfo } from '../../../common/constants.js';
import { CommandExecutor, createCommand } from '../../common/Command.js';

export class StateSystem extends System {
    constructor(world) {
        super(world);
        this.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        // PART_BROKEN と GUARD_BROKEN のリスナーを削除
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        // Serviceの代わりにコマンドを発行
        const cmd = createCommand('HANDLE_GAUGE_FULL', { targetId: entityId });
        cmd.execute(this.world);
    }
}