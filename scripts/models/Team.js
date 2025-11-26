import { CONFIG } from '../config/gameConfig.js';

// チーム情報
export class Team {
    /**
     * @param {string} id - チームID
     */
    constructor(id) {
        /** @type {string} */
        this.id = id;
        /** @type {string} */
        this.name = CONFIG.TEAMS[id].name;
    }
}