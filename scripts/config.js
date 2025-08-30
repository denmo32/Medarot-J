import { TeamID } from './constants.js';

export const CONFIG = {
    MAX_GAUGE: 100,
    UPDATE_INTERVAL: 20,
    PLAYERS_PER_TEAM: 3,
    PART_HP_BASE: 50,
            LEGS_HP_BONUS: 10,
        HOME_MARGIN: 0.05, // ホームポジションの左右マージン(5%)
    BASE_DAMAGE: 20,
    TEAMS: {
        [TeamID.TEAM1]: { name: 'チーム 1', color: '#63b3ed', baseSpeed: 1.0, textColor: 'text-blue-300' },
        [TeamID.TEAM2]: { name: 'チーム 2', color: '#f56565', baseSpeed: 1.0, textColor: 'text-red-300' }
    }
};
