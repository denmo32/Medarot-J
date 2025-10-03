/**
 * @file GameDataManager.js
 * @description ゲーム全体の永続的な状態（セーブデータ）を一元管理するシングルトンクラス。
 * このクラスは、プレイヤーの所持品、メダロット、マップ上の位置など、
 * シーンをまたいで維持されるべきデータを保持し、セーブ・ロード機能を提供します。
 */

import { MEDAROT_SETS } from '../battle/data/medarotSets.js';
import { CONFIG as MAP_CONFIG } from '../map/constants.js';

// デフォルトのプレイヤー初期位置
const initialPlayerPosition = {
    x: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    y: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    mapName: 'map.json'
};

// デフォルトのプレイヤー所持メダロットデータ
const defaultPlayerMedarots = [
    {
        id: 'player_medarot_1',
        name: 'サイカチス', // 仮の名前
        set: MEDAROT_SETS[0] // デフォルトで最初のセットを持たせる
    }
    // 今後、複数のメダロットを所持できるように拡張可能
];

let instance = null;

export class GameDataManager {
    /**
     * GameDataManagerはシングルトンとして実装されます。
     * new GameDataManager() を複数回呼び出しても、常に同じインスタンスが返されます。
     */
    constructor() {
        if (instance) {
            return instance;
        }
        this.gameData = null;
        this.loadGame(); // 起動時に自動でセーブデータを読み込む

        instance = this;
    }

    /**
     * ゲームデータを初期状態にリセットします。
     */
    resetToDefault() {
        this.gameData = {
            playerPosition: { ...initialPlayerPosition },
            playerMedarots: JSON.parse(JSON.stringify(defaultPlayerMedarots)),
            // 今後アイテムなどのデータを追加
        };
        console.log('Game data has been reset to default.');
    }

    /**
     * localStorageからゲームデータを読み込みます。データがない場合はデフォルト値を設定します。
     */
    loadGame() {
        try {
            const savedData = localStorage.getItem('medarotJSaveData');
            if (savedData) {
                this.gameData = JSON.parse(savedData);
                console.log('Game data loaded from localStorage.', this.gameData);
            } else {
                console.log('No save data found. Initializing with default data.');
                this.resetToDefault();
            }
        } catch (error) {
            console.error('Failed to load game data. Resetting to default.', error);
            this.resetToDefault();
        }
    }

    /**
     * 現在のゲームデータをlocalStorageに保存します。
     */
    saveGame() {
        try {
            localStorage.setItem('medarotJSaveData', JSON.stringify(this.gameData));
            console.log('Game data saved successfully.', this.gameData);
        } catch (error) {
            console.error('Failed to save game data.', error);
        }
    }

    /**
     * マップモードで必要となるプレイヤーのデータを取得します。
     * @returns {{position: {x: number, y: number, mapName: string}}}
     */
    getPlayerDataForMap() {
        return {
            position: this.gameData.playerPosition
        };
    }

    /**
     * バトルモードで必要となるプレイヤーのチーム構成を取得します。
     * @returns {Array<Object>} プレイヤーチームのメダロット構成の配列
     */
    getPlayerDataForBattle() {
        // 現在は最初のメダロットのみを返す
        return [this.gameData.playerMedarots[0]];
    }

    /**
     * プレイヤーのマップ上の位置を更新します。
     * @param {number} x - 新しいX座標
     * @param {number} y - 新しいY座標
     */
    updatePlayerPosition(x, y) {
        if (this.gameData && this.gameData.playerPosition) {
            this.gameData.playerPosition.x = x;
            this.gameData.playerPosition.y = y;
        }
    }

    /**
     * バトル終了後の結果をゲームデータに反映します。
     * (このフェーズでは枠組みのみ)
     * @param {object} battleResult - バトルの結果
     */
    applyBattleResult(battleResult) {
        console.log('Applying battle result (not implemented yet):', battleResult);
        // 例:
        // if (battleResult.won) {
        //   this.gameData.money += battleResult.reward;
        // }
    }
}
