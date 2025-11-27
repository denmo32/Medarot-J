/**
 * @file ゲーム全体で共有される設定値を管理するモジュール
 * シーンに依存しない汎用的な設定を定義します。
 */
import { TeamID } from './constants.js';

export const CONFIG = {
    // デバッグ設定（全体）
    DEBUG: false,

    // チーム設定（共通コンポーネントで使用）
    TEAMS: {
        [TeamID.TEAM1]: { 
            name: 'チーム 1', 
            color: '#63b3ed', 
            baseSpeed: 1.0, 
            textColor: 'text-blue-300',
            startPosition: 'left'
        },
        [TeamID.TEAM2]: { 
            name: 'チーム 2', 
            color: '#f56565', 
            baseSpeed: 1.0, 
            textColor: 'text-red-300',
            startPosition: 'right'
        },
    },
};