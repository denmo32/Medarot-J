/**
 * @file GameDataManager.js
 * @description ゲーム全体の永続的な状態（セーブデータ）を一元管理するシングルトンクラス。
 * このクラスは、プレイヤーの所持品、メダロット、マップ上の位置など、
 * シーンをまたいで維持されるべきデータを保持し、セーブ・ロード機能を提供します。
 */

import { MEDAROT_SETS } from '../battle/data/medarotSets.js';
import { PARTS_DATA } from '../battle/data/parts.js';
import { PartInfo } from '../battle/common/constants.js';
import { CONFIG as MAP_CONFIG } from '../map/constants.js';

// デフォルトのプレイヤー初期位置
const initialPlayerPosition = {
    x: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    y: 1 * MAP_CONFIG.TILE_SIZE + (MAP_CONFIG.TILE_SIZE - MAP_CONFIG.PLAYER_SIZE) / 2,
    mapName: 'map.json'
};

// デフォルトのプレイヤー所持メダロットデータ (3機)
const defaultPlayerMedarots = [
    {
        id: 'player_medarot_1',
        name: 'サイカチス',
        set: MEDAROT_SETS[0]
    },
    {
        id: 'player_medarot_2',
        name: 'ロクショウ',
        set: MEDAROT_SETS[1]
    },
    {
        id: 'player_medarot_3',
        name: 'ドークス',
        set: MEDAROT_SETS[3]
    }
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
        const medarots = JSON.parse(JSON.stringify(defaultPlayerMedarots));

        // 初期インベントリを生成
        const inventory = {};
        // 1. 全てのパーツデータをインベントリに追加
        for (const partType in PARTS_DATA) {
            inventory[partType] = {};
            for (const partId in PARTS_DATA[partType]) {
                // とりあえず各パーツを1つずつ所持させる
                inventory[partType][partId] = { ...PARTS_DATA[partType][partId], count: 1 };
            }
        }

        this.gameData = {
            playerPosition: { ...initialPlayerPosition },
            playerMedarots: medarots,
            playerPartsInventory: inventory,
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

                // 古いセーブデータとの互換性維持
                if (!this.gameData.playerPartsInventory) {
                    console.log('Old save data detected. Upgrading with parts inventory.');
                    const inventory = {};
                    for (const partType in PARTS_DATA) {
                        inventory[partType] = {};
                        for (const partId in PARTS_DATA[partType]) {
                            inventory[partType][partId] = { ...PARTS_DATA[partType][partId], count: 1 };
                        }
                    }
                    this.gameData.playerPartsInventory = inventory;
                }

                // セーブデータのメダロットが3機未満の場合、デフォルトデータで補う
                if (!this.gameData.playerMedarots || this.gameData.playerMedarots.length < 3) {
                    console.log('Incomplete medarot data. Completing with default medarots.');
                    const existingIds = new Set(this.gameData.playerMedarots.map(m => m.id));
                    const medarotsToAppend = defaultPlayerMedarots.filter(m => !existingIds.has(m.id));
                    this.gameData.playerMedarots.push(...medarotsToAppend.slice(0, 3 - this.gameData.playerMedarots.length));
                }

                this.saveGame(); // データを更新・補完した可能性があるので保存

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
        // プレイヤーが所持する全メダロットのデータを返す
        return this.gameData.playerMedarots.map(medarot => {
            const set = {};
            for (const partKey in medarot.set.parts) {
                const partId = medarot.set.parts[partKey];
                set[partKey] = this.gameData.playerPartsInventory[partKey]?.[partId] || null;
            }
            return {
                name: medarot.name,
                set: {
                    name: medarot.set.name,
                    parts: medarot.set.parts
                }
            };
        });
    }

    /**
     * 指定したインデックスのメダロットの現在のパーツ構成（IDと詳細データ）を取得します。
     * @param {number} index - メダロットのインデックス (0-2)
     * @returns {object | null} メダロットのデータ、またはnull
     */
    getMedarot(index) {
        if (!this.gameData.playerMedarots[index]) return null;

        const medarotData = this.gameData.playerMedarots[index];
        const assembledParts = {};

        for (const partSlot in medarotData.set.parts) {
            const partId = medarotData.set.parts[partSlot];
            const partData = this.gameData.playerPartsInventory[partSlot]?.[partId];
            assembledParts[partSlot] = {
                id: partId,
                data: partData || null
            };
        }

        return {
            name: medarotData.name,
            parts: assembledParts
        };
    }

    /**
     * 指定されたパーツスロットで利用可能な（所持している）パーツのリストを取得します。
     * @param {string} partSlot - パーツのスロット (e.g., 'head', 'rightArm')
     * @returns {Array<object>} 利用可能なパーツの配列
     */
    getAvailableParts(partSlot) {
        if (!this.gameData.playerPartsInventory[partSlot]) return [];
        // オブジェクトを配列に変換して返す
        return Object.entries(this.gameData.playerPartsInventory[partSlot]).map(([id, data]) => ({ id, ...data }));
    }

    /**
     * 指定されたメダロットのパーツを更新します。
     * @param {number} medarotIndex - 更新するメダロットのインデックス
     * @param {string} partSlot - 更新するパーツのスロット
     * @param {string} newPartId - 新しいパーツのID
     */
    updateMedarotPart(medarotIndex, partSlot, newPartId) {
        if (this.gameData.playerMedarots[medarotIndex]) {
            this.gameData.playerMedarots[medarotIndex].set.parts[partSlot] = newPartId;
            console.log(`Updated Medarot #${medarotIndex} ${partSlot} to ${newPartId}`);
        }
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
