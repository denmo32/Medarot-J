import { CONFIG } from '../battle/common/config.js';

// プレイヤーの基本情報
export class PlayerInfo {
    /**
     * @param {string} name プレイヤー名
     * @param {string} teamId チームID (TeamID定数)
     * @param {boolean} isLeader チームリーダーか否か
     */
    constructor(name, teamId, isLeader) {
        /** @type {string} */
        this.name = name;
        /** @type {string} */
        this.teamId = teamId;
        /** @type {boolean} */
        this.isLeader = isLeader;
        /** @type {string} */
        this.color = CONFIG.TEAMS[teamId].color;
    }
}