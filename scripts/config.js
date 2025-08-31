import { TeamID } from './constants.js';

export const CONFIG = {
    MAX_GAUGE: 100,
    UPDATE_INTERVAL: 20,
    PLAYERS_PER_TEAM: 3,
    PART_HP_BASE: 50,
            LEGS_HP_BONUS: 10,
        BASE_DAMAGE: 20,
    // バトルフィールド関連の定数を集約
    BATTLEFIELD: {
        HOME_MARGIN_TEAM1: 0.05, // チーム1のホームポジションのX座標
        HOME_MARGIN_TEAM2: 0.95, // チーム2のホームポジションのX座標
        ACTION_LINE_TEAM1: 0.45, // チーム1のアクションライン
        ACTION_LINE_TEAM2: 0.55, // チーム2のアクションライン
    },
    TEAMS: {
        [TeamID.TEAM1]: { name: 'チーム 1', color: '#63b3ed', baseSpeed: 1.0, textColor: 'text-blue-300' },
        [TeamID.TEAM2]: { name: 'チーム 2', color: '#f56565', baseSpeed: 1.0, textColor: 'text-red-300' }
    }
};
